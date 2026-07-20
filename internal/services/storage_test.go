package services

import (
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"half-beat-player/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func testService(t *testing.T, modelTypes ...any) *Service {
	t.Helper()
	database, err := gorm.Open(sqlite.Open("file:"+url.QueryEscape(t.Name())+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := database.AutoMigrate(modelTypes...); err != nil {
		t.Fatalf("migrate test database: %v", err)
	}
	return &Service{db: database, dataDir: t.TempDir(), session: newSessionState()}
}

func TestStorageKeyPreservesKnownSafeIDsAndHashesUnsafeIDs(t *testing.T) {
	uuid := "550e8400-e29b-41d4-a716-446655440000"
	bvid := "BV1xx411c7mD"
	if got := storageKey(uuid); got != uuid {
		t.Fatalf("UUID key = %q", got)
	}
	if got := storageKey(bvid); got != bvid {
		t.Fatalf("BVID key = %q", got)
	}

	unsafe := "../../outside/file"
	got := storageKey(unsafe)
	if !strings.HasPrefix(got, "id-") || strings.ContainsAny(got, `/\\`) {
		t.Fatalf("unsafe key was not hashed: %q", got)
	}
	if got != storageKey(unsafe) {
		t.Fatal("unsafe key hashing is not deterministic")
	}
}

func TestLocalAudioCandidatesIncludeSafeLegacyFilename(t *testing.T) {
	song := models.Song{ID: "legacy-song_1", Name: "legacy"}
	candidates := localAudioCandidates(song)
	if len(candidates) != 2 || candidates[1] != "legacy-song_1.m4s" {
		t.Fatalf("localAudioCandidates() = %v", candidates)
	}
	unsafe := localAudioCandidates(models.Song{ID: "../legacy", Name: "unsafe"})
	if len(unsafe) != 1 {
		t.Fatalf("unsafe legacy candidate exposed: %v", unsafe)
	}
}

func TestServiceUsesSeparateAPIAndStreamTimeouts(t *testing.T) {
	service := testService(t, &models.LoginSession{})
	service = NewService(service.db, t.TempDir())
	if service.httpClient.Timeout != 30*time.Second {
		t.Fatalf("API client timeout = %v", service.httpClient.Timeout)
	}
	if service.streamClient.Timeout != 0 {
		t.Fatalf("stream client has total timeout %v", service.streamClient.Timeout)
	}
	if service.publicStreamClient.Timeout != 0 {
		t.Fatalf("public stream client has total timeout %v", service.publicStreamClient.Timeout)
	}
}

func TestDownloadOperationsUseMultiPFilename(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{ID: "BV1xx411c7mD", BVID: "BV1xx411c7mD", Name: "part two", PageNumber: 2, TotalPages: 3}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	dir := filepath.Join(service.dataDir, downloadsDir)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("create downloads dir: %v", err)
	}
	path := filepath.Join(dir, "BV1xx411c7mD-P2.m4s")
	if err := os.WriteFile(path, []byte("audio"), 0o600); err != nil {
		t.Fatalf("write download: %v", err)
	}

	downloaded, err := service.IsSongDownloaded(song.ID)
	if err != nil || !downloaded {
		t.Fatalf("IsSongDownloaded = %v, %v", downloaded, err)
	}
	if err := service.DeleteDownloadedSong(song.ID); err != nil {
		t.Fatalf("DeleteDownloadedSong: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("multi-P download still exists: %v", err)
	}
}

func TestGetAudioCacheIDMatchesMultiPStorageFilename(t *testing.T) {
	service := testService(t, &models.Song{})
	song := models.Song{
		ID:         "BV1xx411c7mD",
		BVID:       "BV1xx411c7mD",
		Name:       "part two",
		PageNumber: 2,
		TotalPages: 3,
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}

	cacheID, err := service.GetAudioCacheID(song.ID)
	if err != nil {
		t.Fatalf("GetAudioCacheID: %v", err)
	}
	if cacheID != "BV1xx411c7mD-P2" {
		t.Fatalf("GetAudioCacheID = %q", cacheID)
	}
	if got := cacheID + ".m4s"; got != localAudioFilename(song) {
		t.Fatalf("proxy cache filename %q != local filename %q", got, localAudioFilename(song))
	}
}

func TestGetDownloadedSongIDsBatchesAndDeduplicates(t *testing.T) {
	service := testService(t, &models.Song{})
	songs := []models.Song{
		{ID: "song-1", Name: "one"},
		{ID: "BV1xx411c7mD", BVID: "BV1xx411c7mD", Name: "part", PageNumber: 2, TotalPages: 3},
	}
	if err := service.db.Create(&songs).Error; err != nil {
		t.Fatalf("create songs: %v", err)
	}
	dir := filepath.Join(service.dataDir, downloadsDir)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("create downloads dir: %v", err)
	}
	for _, name := range []string{storageKey("song-1") + ".m4s", "BV1xx411c7mD-P2.m4s"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("audio"), 0o600); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}

	got, err := service.GetDownloadedSongIDs([]string{"song-1", "missing", "song-1", "BV1xx411c7mD"})
	if err != nil {
		t.Fatalf("GetDownloadedSongIDs: %v", err)
	}
	want := []string{"song-1", "BV1xx411c7mD"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("GetDownloadedSongIDs = %v, want %v", got, want)
	}
}

func TestLogoutReplacesJarAndPersistsDeletion(t *testing.T) {
	service := testService(t, &models.LoginSession{})
	target := &url.URL{Scheme: "https", Host: "www.bilibili.com"}
	service.session.restoreCookies(target, []*http.Cookie{{Name: "SESSDATA", Value: "secret", Path: "/"}})
	if err := service.db.Create(&models.LoginSession{ID: 1, Sessdata: "secret", SavedAt: time.Now()}).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}
	if err := service.Logout(); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if service.IsLoggedIn() {
		t.Fatal("cookie remained after logout")
	}
	var count int64
	if err := service.db.Model(&models.LoginSession{}).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("persisted sessions = %d, %v", count, err)
	}
}

func TestSessionResetRejectsCookiesFromEarlierGeneration(t *testing.T) {
	session := newSessionState()
	target := &url.URL{Scheme: "https", Host: "www.bilibili.com"}
	request := &http.Request{URL: target}
	_, generation := session.cookies(request)
	session.reset()
	session.setCookies(request, []*http.Cookie{{Name: "SESSDATA", Value: "stale", Path: "/"}}, generation)
	if cookies := session.currentCookies(target); len(cookies) != 0 {
		t.Fatalf("stale response restored cookies: %v", cookies)
	}
}

func TestSaveCookiesDoesNotRestoreLoggedOutSession(t *testing.T) {
	service := testService(t, &models.LoginSession{})
	if err := service.saveCookies(); err == nil {
		t.Fatal("saveCookies accepted an inactive session")
	}
	var count int64
	if err := service.db.Model(&models.LoginSession{}).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("persisted sessions = %d, %v", count, err)
	}
}

func TestDeleteSongRemovesOrphanedStreamSource(t *testing.T) {
	service := testService(t, &models.Song{}, &models.SongRef{}, &models.StreamSource{})
	source := models.StreamSource{ID: "source", BVID: "BV1xx411c7mD"}
	song := models.Song{ID: "song", Name: "name", SourceID: source.ID}
	if err := service.db.Create(&source).Error; err != nil {
		t.Fatalf("create source: %v", err)
	}
	if err := service.db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	if err := service.DeleteSong(song.ID); err != nil {
		t.Fatalf("DeleteSong: %v", err)
	}
	for _, model := range []any{&models.Song{}, &models.StreamSource{}} {
		var count int64
		if err := service.db.Model(model).Count(&count).Error; err != nil || count != 0 {
			t.Fatalf("remaining %T count = %d, %v", model, count, err)
		}
	}
}
