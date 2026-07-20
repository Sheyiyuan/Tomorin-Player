package services

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"half-beat-player/internal/models"
	"half-beat-player/internal/netguard"
)

type downloadRoundTripFunc func(*http.Request) (*http.Response, error)

func (function downloadRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func downloadResponse(request *http.Request, body string) *http.Response {
	return &http.Response{
		StatusCode:    http.StatusOK,
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: int64(len(body)),
		Header:        make(http.Header),
		Request:       request,
	}
}

func TestIsLocalProxyAudioURL(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want bool
	}{
		{name: "proxied audio", raw: "http://127.0.0.1:49152/audio?u=https%3A%2F%2Faudio.bilivideo.com%2Fa.m4s", want: true},
		{name: "cached audio", raw: "http://127.0.0.1:49152/local?f=BV1mBwNzUEAX.m4s", want: true},
		{name: "public audio", raw: "https://audio.bilivideo.com/a.m4s"},
		{name: "loopback text in query", raw: "https://audio.bilivideo.com/a.m4s?next=http%3A%2F%2F127.0.0.1%3A49152%2Flocal"},
		{name: "lookalike host", raw: "http://127.0.0.1.example.com/audio"},
		{name: "different local route", raw: "http://127.0.0.1:49152/image?u=https%3A%2F%2Fexample.com%2Fa.jpg"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isLocalProxyAudioURL(test.raw); got != test.want {
				t.Fatalf("isLocalProxyAudioURL(%q) = %v, want %v", test.raw, got, test.want)
			}
		})
	}
}

func TestDownloadSongCopiesCompletedPlaybackCache(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{
		ID:                 "BV1mBwNzUEAX",
		BVID:               "BV1mBwNzUEAX",
		Name:               "cached song",
		StreamURL:          "http://127.0.0.1:49152/local?f=BV1mBwNzUEAX.m4s",
		StreamURLExpiresAt: time.Now().Add(time.Hour),
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}

	cachePath := filepath.Join(service.dataDir, cacheDir, localAudioFilename(song))
	if err := os.MkdirAll(filepath.Dir(cachePath), 0o700); err != nil {
		t.Fatalf("create cache directory: %v", err)
	}
	wantContent := []byte("completed cached audio")
	if err := os.WriteFile(cachePath, wantContent, 0o600); err != nil {
		t.Fatalf("write cache: %v", err)
	}

	requestCount := 0
	rejectRequests := &http.Client{Transport: downloadRoundTripFunc(func(*http.Request) (*http.Response, error) {
		requestCount++
		return nil, errors.New("unexpected HTTP request")
	})}
	service.httpClient = rejectRequests
	service.streamClient = rejectRequests
	service.publicStreamClient = rejectRequests

	gotPath, err := service.DownloadSong(song.ID)
	if err != nil {
		t.Fatalf("DownloadSong: %v", err)
	}
	wantPath := filepath.Join(service.dataDir, downloadsDir, localAudioFilename(song))
	if gotPath != wantPath {
		t.Fatalf("DownloadSong path = %q, want %q", gotPath, wantPath)
	}
	if requestCount != 0 {
		t.Fatalf("DownloadSong made %d HTTP requests", requestCount)
	}
	gotContent, err := os.ReadFile(gotPath)
	if err != nil {
		t.Fatalf("read download: %v", err)
	}
	if string(gotContent) != string(wantContent) {
		t.Fatalf("download content = %q, want %q", gotContent, wantContent)
	}
	info, err := os.Stat(gotPath)
	if err != nil {
		t.Fatalf("stat download: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("download permissions = %o, want 600", info.Mode().Perm())
	}
	if _, err := os.Stat(gotPath + ".part"); !os.IsNotExist(err) {
		t.Fatalf("temporary download still exists: %v", err)
	}

	if err := service.ClearAudioCache(); err != nil {
		t.Fatalf("ClearAudioCache: %v", err)
	}
	if _, err := os.Stat(cachePath); !os.IsNotExist(err) {
		t.Fatalf("playback cache still exists: %v", err)
	}
	if gotContent, err = os.ReadFile(gotPath); err != nil || string(gotContent) != string(wantContent) {
		t.Fatalf("download after clearing cache = %q, %v", gotContent, err)
	}
}

func TestDownloadSongFallsBackToPublicStreamForEmptyCache(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{
		ID:                 "BV1mBwNzUEAX",
		BVID:               "BV1mBwNzUEAX",
		Name:               "empty cache",
		StreamURL:          "https://audio.bilivideo.com/fresh.m4s",
		StreamURLExpiresAt: time.Now().Add(time.Hour),
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	cachePath := filepath.Join(service.dataDir, cacheDir, localAudioFilename(song))
	if err := os.MkdirAll(filepath.Dir(cachePath), 0o700); err != nil {
		t.Fatalf("create cache directory: %v", err)
	}
	if err := os.WriteFile(cachePath, nil, 0o600); err != nil {
		t.Fatalf("write empty cache: %v", err)
	}

	streamRequests := 0
	service.streamClient = &http.Client{Transport: downloadRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		streamRequests++
		if request.URL.String() != song.StreamURL {
			t.Fatalf("stream URL = %q, want %q", request.URL.String(), song.StreamURL)
		}
		return downloadResponse(request, "network audio"), nil
	})}

	gotPath, err := service.DownloadSong(song.ID)
	if err != nil {
		t.Fatalf("DownloadSong: %v", err)
	}
	if streamRequests != 1 {
		t.Fatalf("stream requests = %d, want 1", streamRequests)
	}
	gotContent, err := os.ReadFile(gotPath)
	if err != nil || string(gotContent) != "network audio" {
		t.Fatalf("download content = %q, %v", gotContent, err)
	}
}

func TestDownloadSongRefreshesLocalProxyURLWithoutCache(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{
		ID:                 "BV1mBwNzUEAX",
		BVID:               "BV1mBwNzUEAX",
		Name:               "stale local URL",
		StreamURL:          "http://127.0.0.1:49152/local?f=BV1mBwNzUEAX.m4s",
		StreamURLExpiresAt: time.Now().Add(time.Hour),
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}

	apiRequests := 0
	service.httpClient = &http.Client{Transport: downloadRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		apiRequests++
		switch request.URL.Path {
		case "/x/player/pagelist":
			return downloadResponse(request, `{"code":0,"data":[{"cid":123,"page":1,"part":"song","duration":180}]}`), nil
		case "/x/player/playurl":
			return downloadResponse(request, `{"code":0,"data":{"dash":{"audio":[{"baseUrl":"https://audio.bilivideo.com/fresh.m4s"}]}}}`), nil
		default:
			t.Fatalf("unexpected API path %q", request.URL.Path)
			return nil, errors.New("unexpected API path")
		}
	})}
	streamRequests := 0
	service.streamClient = &http.Client{Transport: downloadRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		streamRequests++
		if request.URL.String() != "https://audio.bilivideo.com/fresh.m4s" {
			t.Fatalf("stream URL = %q", request.URL.String())
		}
		return downloadResponse(request, "refreshed audio"), nil
	})}

	gotPath, err := service.DownloadSong(song.ID)
	if err != nil {
		t.Fatalf("DownloadSong: %v", err)
	}
	if apiRequests != 2 || streamRequests != 1 {
		t.Fatalf("request counts = API %d, stream %d", apiRequests, streamRequests)
	}
	gotContent, err := os.ReadFile(gotPath)
	if err != nil || string(gotContent) != "refreshed audio" {
		t.Fatalf("download content = %q, %v", gotContent, err)
	}
}

func TestDownloadSongDoesNotIgnoreCacheFilesystemErrors(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{
		ID:                 "BV1mBwNzUEAX",
		BVID:               "BV1mBwNzUEAX",
		Name:               "invalid cache",
		StreamURL:          "https://audio.bilivideo.com/fresh.m4s",
		StreamURLExpiresAt: time.Now().Add(time.Hour),
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	cachePath := filepath.Join(service.dataDir, cacheDir, localAudioFilename(song))
	if err := os.MkdirAll(cachePath, 0o700); err != nil {
		t.Fatalf("create invalid cache entry: %v", err)
	}
	service.streamClient = &http.Client{Transport: downloadRoundTripFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("unexpected stream request")
		return nil, errors.New("unexpected stream request")
	})}

	_, err := service.DownloadSong(song.ID)
	if err == nil || !strings.Contains(err.Error(), "播放缓存不是普通文件") {
		t.Fatalf("DownloadSong error = %v", err)
	}
	downloadPath := filepath.Join(service.dataDir, downloadsDir, localAudioFilename(song))
	if _, err := os.Stat(downloadPath); !os.IsNotExist(err) {
		t.Fatalf("download exists after cache error: %v", err)
	}
}

func TestDownloadSongKeepsPublicStreamHostRestriction(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{
		ID:                 "BV1mBwNzUEAX",
		BVID:               "BV1mBwNzUEAX",
		Name:               "disallowed stream host",
		StreamURL:          "https://example.com/audio.m4s",
		StreamURLExpiresAt: time.Now().Add(time.Hour),
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	service.streamClient = netguard.NewPublicGateway(netguard.Config{
		AllowedHostSuffixes: []string{"bilivideo.com", "bilivideo.cn"},
	})

	_, err := service.DownloadSong(song.ID)
	if err == nil || !strings.Contains(err.Error(), "target host is not allowed") {
		t.Fatalf("DownloadSong error = %v", err)
	}
}
