package proxy

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const shutdownTimeout = 3 * time.Second

var processToken = newToken()

var audioHostSuffixes = []string{
	"bilivideo.com",
	"bilivideo.cn",
}

var blockedPrefixes = mustPrefixes(
	"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
	"169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
	"192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24",
	"192.88.99.0/24",
	"224.0.0.0/4", "240.0.0.0/4",
	"::/128", "::1/128", "::ffff:0:0/96", "64:ff9b::/96", "100::/64",
	"2001::/23", "2001:db8::/32", "2002::/16", "5f00::/16", "fc00::/7", "fe80::/10", "ff00::/8",
)

// cdnPrefixes lists technically-reserved ranges that are widely used by
// CDN providers for edge routing (e.g. Bilibili MCDN uses 198.18.0.0/15
// inside carrier networks).  We allow them only for proxy policies that
// already validate the target hostname against an allowlist.
var cdnPrefixes = mustPrefixes(
	"198.18.0.0/15",
)

type resolver interface {
	LookupIPAddr(context.Context, string) ([]net.IPAddr, error)
}

type runState struct {
	server   *http.Server
	listener net.Listener
	baseURL  string
	client   *http.Client
	ctx      context.Context
	cancel   context.CancelFunc
	done     chan struct{}
}

type AudioProxy struct {
	configuredPort int
	baseDir        string
	token          string

	mu          sync.RWMutex
	run         *runState
	lifecycleMu sync.Mutex

	resolver resolver
	dialer   *net.Dialer
	timeout  time.Duration

	cacheMu       sync.Mutex
	cacheInFlight map[string]struct{}
}

func NewAudioProxy(port int, httpClient *http.Client, baseDir string) *AudioProxy {
	timeout := time.Duration(0)
	if httpClient != nil {
		timeout = httpClient.Timeout
	}
	return &AudioProxy{
		configuredPort: port,
		baseDir:        baseDir,
		token:          processToken,
		resolver:       net.DefaultResolver,
		dialer:         &net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second},
		timeout:        timeout,
		cacheInFlight:  make(map[string]struct{}),
	}
}

func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("generate proxy token: %v", err))
	}
	return hex.EncodeToString(b)
}

func mustPrefixes(values ...string) []netip.Prefix {
	prefixes := make([]netip.Prefix, len(values))
	for i, value := range values {
		prefixes[i] = netip.MustParsePrefix(value)
	}
	return prefixes
}

func (ap *AudioProxy) IsRunning() bool {
	ap.mu.RLock()
	defer ap.mu.RUnlock()
	return ap.run != nil
}

func (ap *AudioProxy) Start() error {
	ap.lifecycleMu.Lock()
	defer ap.lifecycleMu.Unlock()
	ap.mu.Lock()
	defer ap.mu.Unlock()
	if ap.run != nil {
		return nil
	}

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", ap.configuredPort))
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	run := &runState{
		listener: listener,
		baseURL:  "http://" + listener.Addr().String(),
		ctx:      ctx,
		cancel:   cancel,
		done:     make(chan struct{}),
	}
	run.client = ap.newHTTPClient()
	mux := http.NewServeMux()
	mux.HandleFunc("/audio", ap.handleAudio)
	mux.HandleFunc("/local", ap.handleLocal)
	mux.HandleFunc("/image", ap.handleImage)
	mux.HandleFunc("/theme-image", ap.handleThemeImage)
	run.server = &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	ap.run = run

	go func() {
		err := run.server.Serve(listener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("[Proxy] server exited: %v", err)
		}
		close(run.done)
		ap.mu.Lock()
		if ap.run == run {
			run.cancel()
			ap.run = nil
		}
		ap.mu.Unlock()
	}()
	return nil
}

func (ap *AudioProxy) Stop() error {
	ap.lifecycleMu.Lock()
	defer ap.lifecycleMu.Unlock()
	ap.mu.Lock()
	run := ap.run
	if run == nil {
		ap.mu.Unlock()
		return nil
	}
	ap.run = nil
	run.cancel()
	ap.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	err := run.server.Shutdown(ctx)
	if errors.Is(err, context.DeadlineExceeded) {
		_ = run.server.Close()
	}
	select {
	case <-run.done:
	case <-ctx.Done():
		_ = run.server.Close()
	}
	if err != nil && !errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("shutdown proxy: %w", err)
	}
	return nil
}

func (ap *AudioProxy) newHTTPClient() *http.Client {
	transport := &http.Transport{
		Proxy:                 nil,
		ForceAttemptHTTP2:     false,
		MaxIdleConns:          20,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
	}
	transport.DialContext = ap.validatingDialContext
	return &http.Client{
		Transport: transport,
		Timeout:   ap.timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("too many redirects")
			}
			policy, _ := via[0].Context().Value(policyKey{}).(urlPolicy)
			ips, err := validateAndResolve(req.Context(), ap.resolver, req.URL, policy)
			if err != nil {
				return err
			}
			*req = *req.WithContext(context.WithValue(req.Context(), resolvedKey{}, resolvedHost{
				host: strings.ToLower(strings.TrimSuffix(req.URL.Hostname(), ".")),
				ips:  ips,
			}))
			return nil
		},
	}
}

type policyKey struct{}
type resolvedKey struct{}
type resolvedHost struct {
	host string
	ips  []net.IP
}
type urlPolicy int

const (
	publicURL urlPolicy = iota
	audioURL
)

func (ap *AudioProxy) validatingDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("invalid upstream address: %w", err)
	}
	policy, _ := ctx.Value(policyKey{}).(urlPolicy)
	pinned, _ := ctx.Value(resolvedKey{}).(resolvedHost)
	var ips []net.IP
	if pinned.host == strings.ToLower(strings.TrimSuffix(host, ".")) && len(pinned.ips) > 0 {
		ips = pinned.ips
	} else {
		ips, err = resolvePublic(ctx, ap.resolver, host, policy)
		if err != nil {
			return nil, err
		}
	}
	var dialErr error
	for _, ip := range ips {
		conn, err := ap.dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		if err == nil {
			return conn, nil
		}
		dialErr = err
	}
	return nil, fmt.Errorf("dial upstream: %w", dialErr)
}

func validateURL(ctx context.Context, r resolver, target *url.URL, policy urlPolicy) error {
	_, err := validateAndResolve(ctx, r, target, policy)
	return err
}

func validateAndResolve(ctx context.Context, r resolver, target *url.URL, policy urlPolicy) ([]net.IP, error) {
	if target == nil || (target.Scheme != "http" && target.Scheme != "https") {
		return nil, errors.New("only http and https URLs are allowed")
	}
	if target.User != nil || target.Hostname() == "" {
		return nil, errors.New("URL credentials and empty hosts are not allowed")
	}
	if strings.Contains(target.Hostname(), "%") {
		return nil, errors.New("IPv6 zone identifiers are not allowed")
	}
	if target.Fragment != "" {
		return nil, errors.New("URL fragments are not allowed")
	}
	port := target.Port()
	if port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1 || value > 65535 {
			return nil, errors.New("invalid URL port")
		}
		if policy == audioURL && value != 80 && value != 443 {
			return nil, errors.New("audio URL port is not allowed")
		}
	}
	return resolvePublic(ctx, r, target.Hostname(), policy)
}

func resolvePublic(ctx context.Context, r resolver, host string, policy urlPolicy) ([]net.IP, error) {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if policy == audioURL && !allowedAudioHost(host) {
		return nil, errors.New("audio host is not allowed")
	}
	if ip := net.ParseIP(host); ip != nil {
		if !isPublicIP(ip, policy) {
			return nil, errors.New("non-public IP is not allowed")
		}
		return []net.IP{ip}, nil
	}
	addresses, err := r.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("resolve host: %w", err)
	}
	if len(addresses) == 0 {
		return nil, errors.New("host resolved to no addresses")
	}
	ips := make([]net.IP, 0, len(addresses))
	for _, address := range addresses {
		if !isPublicIP(address.IP, policy) {
			return nil, errors.New("host resolves to a non-public IP")
		}
		ips = append(ips, address.IP)
	}
	return ips, nil
}

func allowedAudioHost(host string) bool {
	for _, suffix := range audioHostSuffixes {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return true
		}
	}
	return false
}

func isPublicIP(ip net.IP, policy urlPolicy) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	if !addr.IsGlobalUnicast() {
		return false
	}
	for _, prefix := range blockedPrefixes {
		if prefix.Contains(addr) {
			// Allow CDN-reserved ranges for proxied Bilibili traffic
			// whose hostnames have already been validated.
			if policy == audioURL {
				for _, cdn := range cdnPrefixes {
					if cdn.Contains(addr) {
						return true
					}
				}
			}
			return false
		}
	}
	return true
}

func (ap *AudioProxy) currentRun() *runState {
	ap.mu.RLock()
	defer ap.mu.RUnlock()
	return ap.run
}

func (ap *AudioProxy) authorize(w http.ResponseWriter, r *http.Request, methods string, allowed ...string) bool {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", methods)
	w.Header().Set("Access-Control-Allow-Headers", "Range")
	if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("token")), []byte(ap.token)) != 1 {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}
	for _, method := range allowed {
		if r.Method == method {
			return true
		}
	}
	w.Header().Set("Allow", methods)
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	return false
}

func (ap *AudioProxy) upstreamRequest(r *http.Request, rawURL string, policy urlPolicy) (*http.Request, error) {
	target, err := url.Parse(rawURL)
	if err != nil {
		return nil, errors.New("invalid URL")
	}
	ips, err := validateAndResolve(r.Context(), ap.resolver, target, policy)
	if err != nil {
		return nil, err
	}
	ctx := context.WithValue(r.Context(), policyKey{}, policy)
	ctx = context.WithValue(ctx, resolvedKey{}, resolvedHost{
		host: strings.ToLower(strings.TrimSuffix(target.Hostname(), ".")),
		ips:  ips,
	})
	method := r.Method
	if method != http.MethodHead {
		method = http.MethodGet
	}
	req, err := http.NewRequestWithContext(ctx, method, target.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com")
	req.Header.Set("Origin", "https://www.bilibili.com")
	req.Header.Set("Accept", "*/*")
	return req, nil
}

func (ap *AudioProxy) handleAudio(w http.ResponseWriter, r *http.Request) {
	if !ap.authorize(w, r, "GET, HEAD, OPTIONS", http.MethodGet, http.MethodHead, http.MethodOptions) {
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	rawURL := r.URL.Query().Get("u")
	if rawURL == "" {
		http.Error(w, "missing u parameter", http.StatusBadRequest)
		return
	}
	req, err := ap.upstreamRequest(r, rawURL, audioURL)
	if err != nil {
		http.Error(w, "invalid upstream URL", http.StatusBadRequest)
		return
	}
	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}
	if sid := r.URL.Query().Get("sid"); sid != "" {
		if !validCacheID(sid) {
			http.Error(w, "invalid sid parameter", http.StatusBadRequest)
			return
		}
		ap.ensureCachedAsync(rawURL, sid)
	}
	run := ap.currentRun()
	if run == nil {
		http.Error(w, "proxy stopped", http.StatusServiceUnavailable)
		return
	}
	log.Printf("[Proxy] fetching audio host=%s path=%s", req.URL.Hostname(), req.URL.EscapedPath())
	resp, err := run.client.Do(req)
	if err != nil {
		http.Error(w, "upstream request failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusForbidden && ap.serveAudioFallback(w, r, req.URL) {
		return
	}
	copyHeaders(w.Header(), resp.Header)
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" || contentType == "application/octet-stream" || contentType == "video/mp4" {
		contentType = "audio/mp4"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(resp.StatusCode)
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, resp.Body)
	}
}

func (ap *AudioProxy) ensureCachedAsync(rawURL, sid string) {
	if !validCacheID(sid) {
		return
	}
	run := ap.currentRun()
	if run == nil {
		return
	}
	cacheDir, err := containedDir(ap.baseDir, "audio_cache")
	if err != nil {
		return
	}
	cachePath, err := containedPath(cacheDir, sid+".m4s")
	if err != nil {
		return
	}
	if _, err := os.Stat(cachePath); err == nil {
		return
	}
	ap.cacheMu.Lock()
	if _, exists := ap.cacheInFlight[sid]; exists {
		ap.cacheMu.Unlock()
		return
	}
	ap.cacheInFlight[sid] = struct{}{}
	ap.cacheMu.Unlock()
	go func(run *runState) {
		defer func() {
			ap.cacheMu.Lock()
			delete(ap.cacheInFlight, sid)
			ap.cacheMu.Unlock()
		}()
		ctx, cancel := context.WithTimeout(run.ctx, 5*time.Minute)
		defer cancel()
		fakeRequest := &http.Request{Method: http.MethodGet}
		fakeRequest = fakeRequest.WithContext(ctx)
		req, err := ap.upstreamRequest(fakeRequest, rawURL, audioURL)
		if err != nil {
			return
		}
		resp, err := run.client.Do(req)
		if err != nil {
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return
		}
		tmp := cachePath + ".part"
		_ = os.Remove(tmp)
		file, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
		if err != nil {
			return
		}
		_, copyErr := io.Copy(file, resp.Body)
		closeErr := file.Close()
		if copyErr != nil || closeErr != nil || ctx.Err() != nil {
			_ = os.Remove(tmp)
			return
		}
		if err := os.Rename(tmp, cachePath); err != nil {
			_ = os.Remove(tmp)
		}
	}(run)
}

func validCacheID(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	for _, c := range value {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && c != '-' && c != '_' {
			return false
		}
	}
	return true
}

func validFileName(name string) bool {
	if name == "" || len(name) > 255 || name == "." || name == ".." || filepath.Base(name) != name {
		return false
	}
	for _, c := range name {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && c != '-' && c != '_' && c != '.' {
			return false
		}
	}
	return true
}

func containedPath(root, name string) (string, error) {
	if !validFileName(name) {
		return "", errors.New("invalid filename")
	}
	root, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	path := filepath.Join(root, name)
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", errors.New("path escapes root")
	}
	return path, nil
}

func existingContainedPath(root, name string) (string, error) {
	path, err := containedPath(root, name)
	if err != nil {
		return "", err
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	resolvedPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(resolvedRoot, resolvedPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", errors.New("resolved path escapes root")
	}
	return resolvedPath, nil
}

func containedDir(base, name string) (string, error) {
	if !validFileName(name) {
		return "", errors.New("invalid directory name")
	}
	if err := os.MkdirAll(base, 0o700); err != nil {
		return "", err
	}
	resolvedBase, err := filepath.EvalSymlinks(base)
	if err != nil {
		return "", err
	}
	directory := filepath.Join(resolvedBase, name)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return "", err
	}
	resolvedDirectory, err := filepath.EvalSymlinks(directory)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(resolvedBase, resolvedDirectory)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", errors.New("directory escapes base")
	}
	return resolvedDirectory, nil
}

func (ap *AudioProxy) serveAudioFallback(w http.ResponseWriter, r *http.Request, target *url.URL) bool {
	name := filepath.Base(target.Path)
	if !validFileName(name) || (filepath.Ext(name) != ".m4s" && filepath.Ext(name) != ".mp4") {
		return false
	}
	for _, directory := range []string{"audio_cache", "downloads"} {
		path, err := existingContainedPath(filepath.Join(ap.baseDir, directory), name)
		if err == nil {
			ap.serveLocalFile(w, r, path)
			return true
		}
	}
	return false
}

func (ap *AudioProxy) handleImage(w http.ResponseWriter, r *http.Request) {
	if !ap.authorize(w, r, "GET, HEAD, OPTIONS", http.MethodGet, http.MethodHead, http.MethodOptions) {
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	rawURL := r.URL.Query().Get("u")
	if rawURL == "" {
		http.Error(w, "missing u parameter", http.StatusBadRequest)
		return
	}
	req, err := ap.upstreamRequest(r, rawURL, publicURL)
	if err != nil {
		http.Error(w, "invalid upstream URL", http.StatusBadRequest)
		return
	}
	req.Header.Set("Accept", "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
	run := ap.currentRun()
	if run == nil {
		http.Error(w, "proxy stopped", http.StatusServiceUnavailable)
		return
	}
	log.Printf("[Proxy] fetching image host=%s path=%s", req.URL.Hostname(), req.URL.EscapedPath())
	resp, err := run.client.Do(req)
	if err != nil {
		http.Error(w, "upstream request failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	contentType := resp.Header.Get("Content-Type")
	if contentType != "" && !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		http.Error(w, "upstream is not an image", http.StatusUnsupportedMediaType)
		return
	}
	copyHeaders(w.Header(), resp.Header)
	if contentType == "" {
		contentType = "image/jpeg"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(resp.StatusCode)
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, resp.Body)
	}
}

func copyHeaders(dst, src http.Header) {
	for key, values := range src {
		switch http.CanonicalHeaderKey(key) {
		case "Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers", "Access-Control-Allow-Credentials", "Content-Type":
			continue
		}
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func (ap *AudioProxy) handleLocal(w http.ResponseWriter, r *http.Request) {
	if !ap.authorize(w, r, "GET, HEAD, OPTIONS", http.MethodGet, http.MethodHead, http.MethodOptions) {
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	name := r.URL.Query().Get("f")
	if !validFileName(name) {
		http.Error(w, "invalid filename", http.StatusBadRequest)
		return
	}
	for _, directory := range []string{"audio_cache", "downloads"} {
		path, err := existingContainedPath(filepath.Join(ap.baseDir, directory), name)
		if err == nil {
			ap.serveLocalFile(w, r, path)
			return
		}
	}
	http.Error(w, "file not found", http.StatusNotFound)
}

func (ap *AudioProxy) serveLocalFile(w http.ResponseWriter, r *http.Request, path string) {
	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.Error(w, "invalid file", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "audio/mp4")
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func (ap *AudioProxy) handleThemeImage(w http.ResponseWriter, r *http.Request) {
	if !ap.authorize(w, r, "GET, HEAD, OPTIONS", http.MethodGet, http.MethodHead, http.MethodOptions) {
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	name := r.URL.Query().Get("f")
	path, err := existingContainedPath(filepath.Join(ap.baseDir, "theme_images"), name)
	if err != nil {
		http.Error(w, "invalid filename", http.StatusBadRequest)
		return
	}
	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.Error(w, "invalid file", http.StatusNotFound)
		return
	}
	if contentType := mime.TypeByExtension(filepath.Ext(name)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func (ap *AudioProxy) proxyURL(path string, values url.Values) string {
	run := ap.currentRun()
	if run == nil {
		return ""
	}
	values.Set("token", ap.token)
	return run.baseURL + path + "?" + values.Encode()
}

func (ap *AudioProxy) GetProxyURL(audioURL string) string {
	if audioURL == "" {
		return ""
	}
	return ap.proxyURL("/audio", url.Values{"u": {audioURL}})
}

func (ap *AudioProxy) GetBaseURL() string {
	run := ap.currentRun()
	if run == nil {
		return ""
	}
	return run.baseURL
}

func (ap *AudioProxy) GetImageProxyURL(imageURL string) string {
	if imageURL == "" {
		return ""
	}
	return ap.proxyURL("/image", url.Values{"u": {imageURL}})
}

func (ap *AudioProxy) GetLocalProxyURL(fileName string) string {
	if !validFileName(fileName) {
		return ""
	}
	return ap.proxyURL("/local", url.Values{"f": {fileName}})
}

func (ap *AudioProxy) GetThemeImageProxyURL(fileName string) string {
	if !validFileName(fileName) {
		return ""
	}
	return ap.proxyURL("/theme-image", url.Values{"f": {fileName}})
}

// RefreshProxyURL replaces a previous process's origin and token while
// preserving only supported proxy route parameters.
func (ap *AudioProxy) RefreshProxyURL(rawURL string) string {
	target, err := url.Parse(rawURL)
	if err != nil || target.Scheme != "http" || target.Hostname() != "127.0.0.1" {
		return ""
	}
	query := target.Query()
	switch target.Path {
	case "/audio":
		values := url.Values{"u": {query.Get("u")}}
		if sid := query.Get("sid"); validCacheID(sid) {
			values.Set("sid", sid)
		}
		return ap.proxyURL("/audio", values)
	case "/image":
		return ap.GetImageProxyURL(query.Get("u"))
	case "/local":
		return ap.GetLocalProxyURL(query.Get("f"))
	case "/theme-image":
		return ap.GetThemeImageProxyURL(query.Get("f"))
	default:
		return ""
	}
}

// Kept for package compatibility with existing callers and tests.
type httpRange struct {
	start  int64
	length int64
}

func parseRange(s string, size int64) ([]httpRange, error) {
	if !strings.HasPrefix(s, "bytes=") {
		return nil, errors.New("invalid range")
	}
	var ranges []httpRange
	for _, value := range strings.Split(s[6:], ",") {
		parts := strings.Split(strings.TrimSpace(value), "-")
		if len(parts) != 2 {
			return nil, errors.New("invalid range")
		}
		start, err1 := strconv.ParseInt(parts[0], 10, 64)
		end, err2 := strconv.ParseInt(parts[1], 10, 64)
		if err1 != nil || err2 != nil || start < 0 || end < start || start >= size {
			return nil, errors.New("invalid range")
		}
		if end >= size {
			end = size - 1
		}
		ranges = append(ranges, httpRange{start: start, length: end - start + 1})
	}
	return ranges, nil
}
