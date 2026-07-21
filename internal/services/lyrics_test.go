package services

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"

	"half-beat-player/internal/models"
)

func TestLegacyLyricMigrationIsIdempotentAndManualLocked(t *testing.T) {
	service := testService(t, &models.LyricMapping{}, &models.LyricDocument{}, &models.LyricPreference{})
	legacy := models.LyricMapping{ID: "song-1", Lyric: "[00:01]第一行\n[00:02]第二行", OffsetMS: 250}
	if err := service.db.Create(&legacy).Error; err != nil {
		t.Fatalf("create legacy lyric: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := service.MigrateLegacyLyrics(); err != nil {
			t.Fatalf("migration %d: %v", i, err)
		}
	}
	var count int64
	if err := service.db.Model(&models.LyricDocument{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("document count = %d, %v", count, err)
	}
	view, err := service.GetActiveLyric("song-1")
	if err != nil || view.Document == nil || !view.ManualLocked || view.OffsetMS != 250 {
		t.Fatalf("view = %#v, %v", view, err)
	}
}

func TestPastedLyricCharacterLimitAndDurationPreview(t *testing.T) {
	service := testService(t, &models.LyricDocument{}, &models.LyricPreference{})
	if _, err := service.PreviewLyricText(strings.Repeat("字", maxPastedLyricRunes), ".txt", 0); err != nil {
		t.Fatalf("boundary input rejected: %v", err)
	}
	if _, err := service.PreviewLyricText(strings.Repeat("字", maxPastedLyricRunes+1), ".txt", 0); err == nil || !strings.Contains(err.Error(), ErrorCodeLyricTooLarge) {
		t.Fatalf("oversized paste error = %v", err)
	}
	preview, err := service.PreviewLyricText("[00:01]start\n[11:01]late", ".lrc", 60)
	if err != nil || len(preview.Warnings) != 1 {
		t.Fatalf("duration preview = %#v, %v", preview, err)
	}
}

func TestManualLyricHistoryKeepsAtMostFiveAndPrunesThirtyDayVersions(t *testing.T) {
	service := testService(t, &models.LyricDocument{}, &models.LyricPreference{})
	for index := 0; index < 7; index++ {
		if _, err := service.SaveManualLyric("song-history", "version "+string(rune('a'+index)), ".txt"); err != nil {
			t.Fatal(err)
		}
	}
	var count int64
	if err := service.db.Model(&models.LyricDocument{}).Where("song_id = ? AND is_manual = ?", "song-history", true).Count(&count).Error; err != nil || count != 5 {
		t.Fatalf("manual history count=%d err=%v", count, err)
	}
	if err := service.db.Model(&models.LyricDocument{}).Where("song_id = ? AND is_manual = ?", "song-history", true).
		Where("id <> (SELECT active_document_id FROM lyric_preferences WHERE song_id = ?)", "song-history").
		Update("created_at", time.Now().Add(-31*24*time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := service.SaveManualLyric("song-history", "newest", ".txt"); err != nil {
		t.Fatal(err)
	}
	if err := service.db.Model(&models.LyricDocument{}).Where("song_id = ? AND is_manual = ?", "song-history", true).Count(&count).Error; err != nil || count != 2 {
		t.Fatalf("expired history count=%d err=%v", count, err)
	}
}

func TestLyricProviderTimeoutRetriesAtMostTwice(t *testing.T) {
	service := testService(t)
	service.lyricRetryDelays = []time.Duration{0, 0, 0}
	var calls atomic.Int32
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		calls.Add(1)
		return nil, context.DeadlineExceeded
	})}
	request, _ := http.NewRequest(http.MethodGet, "https://lrclib.net/api/search", nil)
	if _, err := service.doLyricProviderRequest(client, request); err == nil {
		t.Fatal("timeout unexpectedly succeeded")
	}
	if calls.Load() != 3 {
		t.Fatalf("provider calls=%d, want initial + 2 retries", calls.Load())
	}
}

func TestLyricProviderHonorsRetryAfter(t *testing.T) {
	service := testService(t)
	service.lyricRetryDelays = []time.Duration{0, 0, 0}
	var calls atomic.Int32
	var slept time.Duration
	service.lyricSleep = func(delay time.Duration) { slept += delay }
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		if calls.Add(1) == 1 {
			return &http.Response{StatusCode: http.StatusTooManyRequests, Header: http.Header{"Retry-After": []string{"2"}}, Body: io.NopCloser(strings.NewReader("limited"))}, nil
		}
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader("[]"))}, nil
	})}
	request, _ := http.NewRequest(http.MethodGet, "https://lrclib.net/api/search", nil)
	response, err := service.doLyricProviderRequest(client, request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if calls.Load() != 2 || slept != 2*time.Second {
		t.Fatalf("calls=%d slept=%s", calls.Load(), slept)
	}
}

func TestLyricProviderMalformedResponseIsLocalError(t *testing.T) {
	service := testService(t, &models.LyricDocument{}, &models.LyricPreference{})
	service.lyricRetryDelays = []time.Duration{0}
	service.lyricSleep = func(time.Duration) {}
	service.lyricsClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader("not-json"))}, nil
	})}
	if _, err := service.searchLRCLIBLyrics(models.Song{ID: "song", Name: "title"}); err == nil || !strings.Contains(err.Error(), "decode LRCLIB") {
		t.Fatalf("malformed response error = %v", err)
	}
}

func TestLyricProviderSuccessfulAndNegativeCaches(t *testing.T) {
	service := testService(t, &models.LyricDocument{}, &models.LyricPreference{})
	service.lyricRetryDelays = []time.Duration{0}
	service.lyricSleep = func(time.Duration) {}
	song := models.Song{ID: "song-cache", BVID: "BV1xx411c7mD", Name: "title", Duration: 60}
	var successCalls atomic.Int32
	search := func(models.Song) ([]models.LyricDocument, error) {
		successCalls.Add(1)
		document, err := service.saveLyricDocument(song.ID, "[00:01]one\n[00:02]two", ".lrc", "fixture", "Fixture", 0.9, false, true, "utf-8", 0)
		return []models.LyricDocument{document}, err
	}
	if _, err := service.cachedLyricProviderSearch(song, "fixture", true, search); err != nil {
		t.Fatal(err)
	}
	if _, err := service.cachedLyricProviderSearch(song, "fixture", false, search); err != nil {
		t.Fatal(err)
	}
	if successCalls.Load() != 1 {
		t.Fatalf("successful provider calls=%d", successCalls.Load())
	}

	var emptyCalls atomic.Int32
	emptySearch := func(models.Song) ([]models.LyricDocument, error) {
		emptyCalls.Add(1)
		return nil, nil
	}
	if _, err := service.cachedLyricProviderSearch(song, "empty", false, emptySearch); err != nil {
		t.Fatal(err)
	}
	if _, err := service.cachedLyricProviderSearch(song, "empty", false, emptySearch); err != nil {
		t.Fatal(err)
	}
	if emptyCalls.Load() != 1 {
		t.Fatalf("negative-cache provider calls=%d", emptyCalls.Load())
	}
	if _, err := service.cachedLyricProviderSearch(song, "empty", true, emptySearch); err != nil {
		t.Fatal(err)
	}
	if emptyCalls.Load() != 2 {
		t.Fatalf("manual retry did not bypass negative cache: calls=%d", emptyCalls.Load())
	}
}

func TestLyricSearchTaskCanBePolledAfterManualLockShortCircuit(t *testing.T) {
	service := testService(t, &models.Song{}, &models.LyricMapping{}, &models.LyricDocument{}, &models.LyricPreference{})
	if err := service.db.Create(&models.Song{ID: "song-task", Name: "title"}).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := service.SaveManualLyric("song-task", "manual", ".txt"); err != nil {
		t.Fatal(err)
	}
	started, err := service.SearchLyrics(models.LyricSearchRequest{SongID: "song-task", RequestID: "request-task"})
	if err != nil || started.RequestID != "request-task" {
		t.Fatalf("start task = %#v, %v", started, err)
	}
	deadline := time.Now().Add(time.Second)
	for {
		task, taskErr := service.GetLyricSearch(started.RequestID)
		if taskErr != nil {
			t.Fatal(taskErr)
		}
		if task.Status == "succeeded" {
			if task.Result == nil || task.Result.View.Document == nil || !task.Result.View.ManualLocked {
				t.Fatalf("task result = %#v", task)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("task did not finish: %#v", task)
		}
		time.Sleep(time.Millisecond)
	}
}

func TestConcurrentLyricSearchesForOneSongReuseTask(t *testing.T) {
	service := testService(t, &models.Song{}, &models.LyricMapping{}, &models.LyricDocument{}, &models.LyricPreference{})
	if err := service.db.Create(&models.Song{ID: "song-shared-task", Name: "title"}).Error; err != nil {
		t.Fatal(err)
	}
	entered := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32
	service.lyricRetryDelays = []time.Duration{0}
	service.lyricsClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		if calls.Add(1) == 1 {
			close(entered)
			<-release
		}
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader("[]"))}, nil
	})}
	first, err := service.SearchLyrics(models.LyricSearchRequest{SongID: "song-shared-task", RequestID: "first"})
	if err != nil {
		t.Fatal(err)
	}
	<-entered
	second, err := service.SearchLyrics(models.LyricSearchRequest{SongID: "song-shared-task", RequestID: "second"})
	if err != nil {
		t.Fatal(err)
	}
	if first.RequestID != second.RequestID {
		t.Fatalf("tasks were not reused: %#v %#v", first, second)
	}
	close(release)
	deadline := time.Now().Add(time.Second)
	for {
		task, taskErr := service.GetLyricSearch(first.RequestID)
		if taskErr != nil {
			t.Fatal(taskErr)
		}
		if task.Status == "succeeded" {
			break
		}
		if task.Status == "failed" || time.Now().After(deadline) {
			t.Fatalf("shared task failed: %#v", task)
		}
		time.Sleep(time.Millisecond)
	}
	if calls.Load() != 1 {
		t.Fatalf("provider calls=%d", calls.Load())
	}
}

func TestVideoDescriptionEvidenceIsNormalizedBoundedAndStructured(t *testing.T) {
	raw := "  简介  \r\n歌手： 周杰伦  \r\n" + strings.Repeat("词", 5000)
	normalized := normalizeVideoDescription(raw)
	if len(normalized) > 4*1024 || !utf8.ValidString(normalized) {
		t.Fatalf("normalized description bytes=%d valid=%v", len(normalized), utf8.ValidString(normalized))
	}
	if artist := extractStructuredArtist(normalized); artist != "周杰伦" {
		t.Fatalf("structured artist = %q", artist)
	}
}

func TestManualLyricCannotBeReplacedByAutomaticSearchState(t *testing.T) {
	service := testService(t, &models.LyricMapping{}, &models.LyricDocument{}, &models.LyricPreference{})
	view, err := service.SaveManualLyric("song-1", "本地歌词", ".txt")
	if err != nil {
		t.Fatalf("SaveManualLyric: %v", err)
	}
	manualID := view.Document.ID
	automatic, err := service.saveLyricDocument("song-1", "[00:01]自动一\n[00:02]自动二", ".lrc", "lrclib", "LRCLIB", 0.99, false, true, "utf-8", 0)
	if err != nil {
		t.Fatalf("save automatic candidate: %v", err)
	}
	latest, err := service.GetActiveLyric("song-1")
	if err != nil || latest.Document.ID != manualID || latest.Candidates[0].ID != automatic.ID {
		t.Fatalf("manual lyric was replaced: %#v, %v", latest, err)
	}
}

func TestAutomaticLyricThresholdAndLead(t *testing.T) {
	fixtures := []struct {
		name       string
		confidence []float64
		want       bool
	}{
		{name: "old threshold is no longer enough", confidence: []float64{0.86}, want: false},
		{name: "single reliable exact", confidence: []float64{0.92}, want: true},
		{name: "0.95 candidate leads by only 0.04", confidence: []float64{0.95, 0.91}, want: false},
		{name: "clear lead", confidence: []float64{0.96, 0.83}, want: true},
	}
	for _, fixture := range fixtures {
		t.Run(fixture.name, func(t *testing.T) {
			documents := make([]models.LyricDocument, len(fixture.confidence))
			for i, confidence := range fixture.confidence {
				documents[i].Confidence = confidence
				documents[i].IsReliable = true
			}
			if got := shouldAutoApplyLyric(documents); got != fixture.want {
				t.Fatalf("shouldAutoApplyLyric() = %v", got)
			}
		})
	}
}

func TestRejectedAutomaticLyricIsHiddenAndCannotReturn(t *testing.T) {
	service := testService(t, &models.LyricDocument{}, &models.LyricPreference{})
	document, err := service.saveLyricDocument("song-reject", "[00:01]错误歌词", ".lrc", "lrclib", "LRCLIB", 0.99, false, true, "utf-8", 0)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.activateLyricDocument("song-reject", document.ID, false); err != nil {
		t.Fatal(err)
	}
	view, err := service.RejectLyricCandidate("song-reject", document.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.Document != nil || len(view.Candidates) != 0 {
		t.Fatalf("rejected lyric remained visible: %#v", view)
	}

	refetched, err := service.saveLyricDocument("song-reject", "[00:01]错误歌词", ".lrc", "lrclib", "LRCLIB", 0.99, false, true, "utf-8", 0)
	if err != nil {
		t.Fatal(err)
	}
	if refetched.RejectedAt == nil || refetched.IsReliable {
		t.Fatalf("rejected lyric was restored: %#v", refetched)
	}
}

func TestUnverifiedAutomaticLyricIsTreatedAsMissing(t *testing.T) {
	service := testService(t, &models.LyricDocument{}, &models.LyricPreference{})
	document, err := service.saveLyricDocument("song-unverified", "[00:01]旧歌词", ".lrc", "lrclib", "LRCLIB", 0.99, false, false, "utf-8", 0)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.activateLyricDocument("song-unverified", document.ID, false); err != nil {
		t.Fatal(err)
	}
	view, err := service.GetActiveLyric("song-unverified")
	if err != nil {
		t.Fatal(err)
	}
	if view.Document != nil || len(view.Candidates) != 0 {
		t.Fatalf("unverified lyric remained visible: %#v", view)
	}
}
