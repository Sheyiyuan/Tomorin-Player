package proxy

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type fakeResolver map[string][]string

func (r fakeResolver) LookupIPAddr(_ context.Context, host string) ([]net.IPAddr, error) {
	values := r[host]
	result := make([]net.IPAddr, 0, len(values))
	for _, value := range values {
		result = append(result, net.IPAddr{IP: net.ParseIP(value)})
	}
	return result, nil
}

func TestURLPolicies(t *testing.T) {
	resolver := fakeResolver{
		"images.example.com":        {"93.184.216.34"},
		"audio.bilivideo.com":       {"93.184.216.34"},
		"not-bilivideo.example.com": {"93.184.216.34"},
		"mixed.example.com":         {"93.184.216.34", "127.0.0.1"},
	}
	tests := []struct {
		name    string
		rawURL  string
		policy  urlPolicy
		wantErr bool
	}{
		{name: "public image host", rawURL: "https://images.example.com/a.png?size=2", policy: publicURL},
		{name: "audio CDN", rawURL: "https://audio.bilivideo.com/a.m4s", policy: audioURL},
		{name: "audio disallowed host", rawURL: "https://not-bilivideo.example.com/a.m4s", policy: audioURL, wantErr: true},
		{name: "allowlist boundary", rawURL: "https://evilbilivideo.com/a.m4s", policy: audioURL, wantErr: true},
		{name: "loopback", rawURL: "http://127.0.0.1/a", policy: publicURL, wantErr: true},
		{name: "metadata", rawURL: "http://169.254.169.254/a", policy: publicURL, wantErr: true},
		{name: "private IPv6", rawURL: "http://[fd00::1]/a", policy: publicURL, wantErr: true},
		{name: "mixed DNS answer", rawURL: "https://mixed.example.com/a", policy: publicURL, wantErr: true},
		{name: "credentials", rawURL: "https://user:pass@images.example.com/a", policy: publicURL, wantErr: true},
		{name: "non-web scheme", rawURL: "file:///etc/passwd", policy: publicURL, wantErr: true},
		{name: "public custom port", rawURL: "https://images.example.com:8443/a", policy: publicURL},
		{name: "invalid port", rawURL: "https://images.example.com:0/a", policy: publicURL, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			target, err := url.Parse(test.rawURL)
			if err != nil {
				t.Fatal(err)
			}
			err = validateURL(context.Background(), resolver, target, test.policy)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateURL() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestIPClassification(t *testing.T) {
	for _, value := range []string{
		"0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1",
		"172.16.0.1", "192.0.2.1", "192.168.1.1", "198.18.0.1", "224.0.0.1",
		"::1", "::ffff:127.0.0.1", "2001:db8::1", "fd00::1", "fe80::1",
	} {
		if isPublicIP(net.ParseIP(value)) {
			t.Errorf("isPublicIP(%q) = true", value)
		}
	}
	for _, value := range []string{"8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"} {
		if !isPublicIP(net.ParseIP(value)) {
			t.Errorf("isPublicIP(%q) = false", value)
		}
	}
}

func TestPathValidation(t *testing.T) {
	for _, name := range []string{"song.m4s", "cover-01.webp", "BV1xx411c7mD-P2.m4s"} {
		if !validFileName(name) {
			t.Errorf("validFileName(%q) = false", name)
		}
	}
	for _, name := range []string{"", ".", "..", "../song.m4s", `..\song.m4s`, "/tmp/song.m4s", `C:\song.m4s`, "bad\x00name", "name with spaces.mp4", "歌曲.m4s"} {
		if validFileName(name) {
			t.Errorf("validFileName(%q) = true", name)
		}
	}
	for _, sid := range []string{"song_123-A", "abc"} {
		if !validCacheID(sid) {
			t.Errorf("validCacheID(%q) = false", sid)
		}
	}
	for _, sid := range []string{"", "../x", "a.b", "a b", strings.Repeat("a", 129)} {
		if validCacheID(sid) {
			t.Errorf("validCacheID(%q) = true", sid)
		}
	}
	root := t.TempDir()
	path, err := containedPath(root, "song.m4s")
	if err != nil || filepath.Dir(path) != root {
		t.Fatalf("containedPath() = %q, %v", path, err)
	}
	if _, err := containedPath(root, "../song.m4s"); err == nil {
		t.Fatal("containedPath accepted traversal")
	}
	outside := filepath.Join(t.TempDir(), "outside.m4s")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "link.m4s")); err != nil {
		t.Fatal(err)
	}
	if _, err := existingContainedPath(root, "link.m4s"); err == nil {
		t.Fatal("existingContainedPath accepted symlink escape")
	}
	base := t.TempDir()
	if err := os.Symlink(t.TempDir(), filepath.Join(base, "audio_cache")); err != nil {
		t.Fatal(err)
	}
	if _, err := containedDir(base, "audio_cache"); err == nil {
		t.Fatal("containedDir accepted symlink escape")
	}
}

func TestRedirectRevalidationAndEnvironmentProxyDisabled(t *testing.T) {
	ap := NewAudioProxy(0, nil, t.TempDir())
	ap.resolver = fakeResolver{
		"audio.bilivideo.com": {"93.184.216.34"},
		"images.example.com":  {"93.184.216.34"},
	}
	client := ap.newHTTPClient()
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport type = %T", client.Transport)
	}
	if transport.Proxy != nil {
		t.Fatal("transport uses an environment proxy")
	}

	initial, err := http.NewRequest(http.MethodGet, "https://audio.bilivideo.com/a.m4s", nil)
	if err != nil {
		t.Fatal(err)
	}
	initial = initial.WithContext(context.WithValue(initial.Context(), policyKey{}, audioURL))
	redirect, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/metadata", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.CheckRedirect(redirect, []*http.Request{initial}); err == nil {
		t.Fatal("redirect to private IP was accepted")
	}
	redirect, err = http.NewRequest(http.MethodGet, "https://images.example.com/a.m4s", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.CheckRedirect(redirect, []*http.Request{initial}); err == nil {
		t.Fatal("audio redirect to a non-CDN host was accepted")
	}
	redirect, err = http.NewRequest(http.MethodGet, "https://audio.bilivideo.com/b.m4s", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.CheckRedirect(redirect, []*http.Request{initial}); err != nil {
		t.Fatalf("valid audio redirect rejected: %v", err)
	}
	pinned, ok := redirect.Context().Value(resolvedKey{}).(resolvedHost)
	if !ok || pinned.host != "audio.bilivideo.com" || len(pinned.ips) != 1 {
		t.Fatalf("redirect did not pin resolved address: %#v", pinned)
	}
}

func TestLifecycleTokenMethodsAndRange(t *testing.T) {
	baseDir := t.TempDir()
	cacheDir := filepath.Join(baseDir, "audio_cache")
	if err := os.Mkdir(cacheDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cacheDir, "song.m4s"), []byte("0123456789"), 0o600); err != nil {
		t.Fatal(err)
	}

	ap := NewAudioProxy(0, nil, baseDir)
	if ap.GetBaseURL() != "" || ap.GetLocalProxyURL("song.m4s") != "" {
		t.Fatal("stopped proxy generated URLs")
	}
	if err := ap.Start(); err != nil {
		t.Fatal(err)
	}
	firstBaseURL := ap.GetBaseURL()
	if firstBaseURL == "" || strings.HasSuffix(firstBaseURL, ":0") {
		t.Fatalf("unexpected dynamic base URL %q", firstBaseURL)
	}
	localURL := ap.GetLocalProxyURL("song.m4s")
	parsed, err := url.Parse(localURL)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Query().Get("token")) != 64 {
		t.Fatalf("missing process token in %q", localURL)
	}
	refreshed := ap.RefreshProxyURL("http://127.0.0.1:9999/local?token=old&f=song.m4s")
	refreshedURL, err := url.Parse(refreshed)
	if err != nil || refreshedURL.Host != parsed.Host || refreshedURL.Query().Get("token") != parsed.Query().Get("token") {
		t.Fatalf("RefreshProxyURL() = %q, %v", refreshed, err)
	}
	if got := ap.RefreshProxyURL("http://127.0.0.1:9999/unknown?f=song.m4s"); got != "" {
		t.Fatalf("RefreshProxyURL accepted unsupported route: %q", got)
	}

	assertStatus(t, http.MethodGet, firstBaseURL+"/local?f=song.m4s", "", http.StatusForbidden)
	assertStatus(t, http.MethodOptions, firstBaseURL+"/local?f=song.m4s", "", http.StatusForbidden)
	assertStatus(t, http.MethodPost, localURL, "", http.StatusMethodNotAllowed)
	assertStatus(t, http.MethodOptions, localURL, "", http.StatusNoContent)

	req, err := http.NewRequest(http.MethodGet, localURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Range", "bytes=2-5")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusPartialContent || string(body) != "2345" || resp.Header.Get("Content-Range") != "bytes 2-5/10" {
		t.Fatalf("range response: status=%d body=%q content-range=%q", resp.StatusCode, body, resp.Header.Get("Content-Range"))
	}

	if err := ap.Stop(); err != nil {
		t.Fatal(err)
	}
	if ap.IsRunning() || ap.GetBaseURL() != "" || ap.GetProxyURL("https://x.bilivideo.com/a.m4s") != "" {
		t.Fatal("proxy still exposed state after Stop")
	}
	if err := ap.Stop(); err != nil {
		t.Fatal(err)
	}
	if err := ap.Start(); err != nil {
		t.Fatal(err)
	}
	if !ap.IsRunning() || ap.GetBaseURL() == "" {
		t.Fatal("proxy did not restart")
	}
	if err := ap.Stop(); err != nil {
		t.Fatal(err)
	}
}

func TestNoDoubleURLUnescapeAndAudioAllowlist(t *testing.T) {
	ap := NewAudioProxy(0, nil, t.TempDir())
	ap.resolver = fakeResolver{
		"images.example.com":  {"93.184.216.34"},
		"audio.bilivideo.com": {"93.184.216.34"},
	}
	if err := ap.Start(); err != nil {
		t.Fatal(err)
	}
	defer ap.Stop()

	doubleEscaped := ap.GetImageProxyURL("https%3A%2F%2Fimages.example.com%2Fa.png")
	assertStatus(t, http.MethodGet, doubleEscaped, "", http.StatusBadRequest)
	disallowedAudio := ap.GetProxyURL("https://images.example.com/a.m4s")
	assertStatus(t, http.MethodGet, disallowedAudio, "", http.StatusBadRequest)
	invalidSID := ap.GetProxyURL("https://audio.bilivideo.com/a.m4s") + "&sid=../escape"
	assertStatus(t, http.MethodGet, invalidSID, "", http.StatusBadRequest)
}

func assertStatus(t *testing.T, method, target, body string, want int) {
	t.Helper()
	req, err := http.NewRequest(method, target, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	if resp.StatusCode != want {
		t.Fatalf("%s %s status = %d, want %d", method, target, resp.StatusCode, want)
	}
}
