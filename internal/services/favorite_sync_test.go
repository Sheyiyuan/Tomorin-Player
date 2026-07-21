package services

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"half-beat-player/internal/models"

	"gorm.io/gorm"
)

func syncTestService(t *testing.T) *Service {
	t.Helper()
	return testService(t,
		&models.Favorite{}, &models.SongRef{}, &models.Song{}, &models.StreamSource{},
		&models.PlaylistSource{}, &models.PlaylistSourceItem{}, &models.PlaylistSyncRun{},
	)
}

func TestLockedFavoriteRejectsSaveAndDetachIsIrreversible(t *testing.T) {
	service := syncTestService(t)
	favorite := models.Favorite{ID: "fav", Title: "mirror"}
	source := models.PlaylistSource{ID: "source", FavoriteID: favorite.ID, Provider: biliPlaylistProvider, RemoteID: "1", Locked: true}
	if err := service.db.Create(&favorite).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.Create(&source).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.Create(&models.Song{ID: "song", Name: "song"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.Create(&models.SongRef{FavoriteID: favorite.ID, SongID: "song", Position: 0}).Error; err != nil {
		t.Fatal(err)
	}
	favorite.Title = "renamed"
	if err := service.SaveFavorite(favorite); err == nil || !strings.Contains(err.Error(), ErrorCodePlaylistLocked) {
		t.Fatalf("locked SaveFavorite error = %v", err)
	}
	if _, err := service.DetachFavoriteSource(favorite.ID, false); err == nil {
		t.Fatal("detach without acknowledgement succeeded")
	}
	detached, err := service.DetachFavoriteSource(favorite.ID, true)
	if err != nil {
		t.Fatalf("detach: %v", err)
	}
	if detached.ID != favorite.ID || detached.Source != nil {
		t.Fatalf("detached favorite = %#v", detached)
	}
	var detachedSource models.PlaylistSource
	if err := service.db.First(&detachedSource, "id = ?", source.ID).Error; err != nil || detachedSource.Locked || detachedSource.DetachedAt == nil || detachedSource.Provider != "" || detachedSource.RemoteID != "" {
		t.Fatalf("detached source was not cleared: %#v, %v", detachedSource, err)
	}
	var refCount int64
	if err := service.db.Model(&models.SongRef{}).Where("favorite_id = ?", favorite.ID).Count(&refCount).Error; err != nil || refCount != 1 {
		t.Fatalf("detach changed membership: count=%d err=%v", refCount, err)
	}
	if _, err := service.DetachFavoriteSource(favorite.ID, true); err == nil || !strings.Contains(err.Error(), ErrorCodePlaylistDetached) {
		t.Fatalf("second detach error = %v", err)
	}
	if err := service.SaveFavorite(favorite); err != nil {
		t.Fatalf("local save after detach: %v", err)
	}
}

func TestDeleteLockedMirrorRemovesLocalRelationsWithForeignKeysEnabled(t *testing.T) {
	service := syncTestService(t)
	sqlDatabase, err := service.db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDatabase.SetMaxOpenConns(1)
	if err := service.db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatal(err)
	}
	seedLockedFavorite(t, service)
	if err := service.db.Create(&models.PlaylistSyncRun{
		ID: "run", SourceID: "source", Status: "synced", StartedAt: time.Now(),
	}).Error; err != nil {
		t.Fatal(err)
	}

	if err := service.DeleteFavorite("fav"); err != nil {
		t.Fatalf("delete locked mirror: %v", err)
	}

	for model, query := range map[any]string{
		&models.Favorite{}:           "id = 'fav'",
		&models.SongRef{}:            "favorite_id = 'fav'",
		&models.PlaylistSource{}:     "favorite_id = 'fav'",
		&models.PlaylistSourceItem{}: "source_id = 'source'",
		&models.PlaylistSyncRun{}:    "source_id = 'source'",
	} {
		var count int64
		if err := service.db.Model(model).Where(query).Count(&count).Error; err != nil || count != 0 {
			t.Fatalf("%T count=%d err=%v", model, count, err)
		}
	}
	var songCount int64
	if err := service.db.Model(&models.Song{}).Where("id = ?", "song-old").Count(&songCount).Error; err != nil || songCount != 1 {
		t.Fatalf("song was deleted with mirror: count=%d err=%v", songCount, err)
	}
}

func TestIncompleteSnapshotPreservesMembership(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if strings.Contains(r.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 1}}}, http.StatusOK), nil
		}
		return &http.Response{StatusCode: http.StatusBadGateway, Body: io.NopCloser(strings.NewReader("temporary")), Header: http.Header{}}, nil
	})}
	if _, err := service.syncFavorite("fav", false); err == nil || !strings.Contains(err.Error(), ErrorCodeSyncIncomplete) {
		t.Fatalf("sync error = %v", err)
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("membership changed: %#v, %v", refs, err)
	}
}

func TestDeclaredCountMismatchPreservesMembership(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 2}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"type": 2, "bvid": "BVold"}}}, http.StatusOK), nil
	})}
	if _, err := service.syncFavorite("fav", false); err == nil || !strings.Contains(err.Error(), ErrorCodeSyncIncomplete) {
		t.Fatalf("sync error = %v", err)
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("membership changed after count mismatch: %#v, %v", refs, err)
	}
}

func TestSyncSkipsUnsupportedFavoriteResources(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 2}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{
			map[string]any{"id": 101, "type": 2, "bvid": "BVold"},
			map[string]any{"id": 102, "type": 12, "bvid": "BVunsupported"},
		}}, http.StatusOK), nil
	})}
	resolvedBVIDs := make([]string, 0, 1)
	service.videoInfoResolver = func(bvid string) (models.CompleteVideoInfo, error) {
		resolvedBVIDs = append(resolvedBVIDs, bvid)
		return models.CompleteVideoInfo{BVID: bvid, Title: "old", Pages: []models.PageInfo{{Page: 1, Part: "old", Duration: 60}}}, nil
	}

	status, err := service.syncFavorite("fav", false)
	if err != nil {
		t.Fatal(err)
	}
	if status.Source == nil || status.Source.SyncState != "synced" || status.Source.RemoteCount != 2 {
		t.Fatalf("source = %#v", status.Source)
	}
	if status.Run == nil || status.Run.RemoteCount != 2 || status.Run.SkippedCount != 1 || status.Run.PendingCount != 0 {
		t.Fatalf("run = %#v", status.Run)
	}
	if len(resolvedBVIDs) != 1 || resolvedBVIDs[0] != "BVold" {
		t.Fatalf("resolved BVIDs = %#v", resolvedBVIDs)
	}
	var items []models.PlaylistSourceItem
	if err := service.db.Where("source_id = ?", "source").Find(&items).Error; err != nil || len(items) != 1 || items[0].State != "ready" {
		t.Fatalf("source items = %#v, %v", items, err)
	}
}

func TestSyncSkipsMissingBVIDAndKeepsResolutionFailuresPending(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 3}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{
			map[string]any{"id": 201, "type": 2},
			map[string]any{"id": 202, "type": 12, "bvid": "BVunsupported"},
			map[string]any{"id": 203, "type": 2, "bvid": "BVfailed"},
		}}, http.StatusOK), nil
	})}
	resolvedBVIDs := make([]string, 0, 1)
	service.videoInfoResolver = func(bvid string) (models.CompleteVideoInfo, error) {
		resolvedBVIDs = append(resolvedBVIDs, bvid)
		return models.CompleteVideoInfo{}, assertError("offline")
	}

	status, err := service.syncFavorite("fav", false)
	if err != nil {
		t.Fatal(err)
	}
	if status.Source == nil || status.Source.SyncState != "stale" || status.Source.RemoteCount != 3 {
		t.Fatalf("source = %#v", status.Source)
	}
	if status.Run == nil || status.Run.RemoteCount != 3 || status.Run.SkippedCount != 2 || status.Run.PendingCount != 1 {
		t.Fatalf("run = %#v", status.Run)
	}
	if len(resolvedBVIDs) != 1 || resolvedBVIDs[0] != "BVfailed" {
		t.Fatalf("resolved BVIDs = %#v", resolvedBVIDs)
	}
	var items []models.PlaylistSourceItem
	if err := service.db.Where("source_id = ?", "source").Find(&items).Error; err != nil || len(items) != 1 || items[0].BVID != "BVfailed" || items[0].State != "pending" {
		t.Fatalf("source items = %#v, %v", items, err)
	}
}

func TestGetFavoriteCollectionBVIDsKeepsSupportedVideoSemantics(t *testing.T) {
	service := syncTestService(t)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return jsonResponse(map[string]any{"code": 0, "data": []any{
			map[string]any{"id": 1, "type": 2, "bv_id": "BVvideo"},
			map[string]any{"id": 2, "type": 12, "bvid": "BVunsupported"},
			map[string]any{"id": 3, "type": 2},
		}}, http.StatusOK), nil
	})}

	result, err := service.GetFavoriteCollectionBVIDs(1)
	if err != nil || len(result) != 1 || result[0].BVID != "BVvideo" {
		t.Fatalf("BVID result = %#v, %v", result, err)
	}
}

func TestFavoriteSnapshotHashIncludesEveryRawResourceFieldAndOrder(t *testing.T) {
	base := []biliFavoriteResource{{ID: 1, Type: 2, BVID: "BVvideo"}, {ID: 2, Type: 12, BVID: "BVskipped"}}
	baseHash := snapshotHash(base)
	variants := [][]biliFavoriteResource{
		{{ID: 9, Type: 2, BVID: "BVvideo"}, {ID: 2, Type: 12, BVID: "BVskipped"}},
		{{ID: 1, Type: 12, BVID: "BVvideo"}, {ID: 2, Type: 12, BVID: "BVskipped"}},
		{{ID: 1, Type: 2, BVID: "BVchanged"}, {ID: 2, Type: 12, BVID: "BVskipped"}},
		{{ID: 2, Type: 12, BVID: "BVskipped"}, {ID: 1, Type: 2, BVID: "BVvideo"}},
	}
	for index, variant := range variants {
		if snapshotHash(variant) == baseHash {
			t.Fatalf("variant %d did not change snapshot hash", index)
		}
	}
}

func TestPreparePlaylistSyncReportsUniqueVideoProgress(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.videoInfoResolver = func(bvid string) (models.CompleteVideoInfo, error) {
		if bvid == "BVfailed" {
			return models.CompleteVideoInfo{}, assertError("offline")
		}
		return models.CompleteVideoInfo{BVID: bvid, Title: bvid, Pages: []models.PageInfo{{Page: 1, Part: bvid, Duration: 60}}}, nil
	}
	progress := make([]models.PlaylistSyncProgress, 0, 3)
	draft, err := service.preparePlaylistSyncWithProgress(
		models.PlaylistSource{ID: "source", FavoriteID: "fav"},
		[]models.BiliFavoriteInfo{{BVID: "BVready"}, {BVID: "BVfailed"}, {BVID: "BVready"}},
		1,
		func(update models.PlaylistSyncProgress) { progress = append(progress, update) },
	)
	if err != nil {
		t.Fatal(err)
	}
	if draft.videoCount != 2 || draft.pendingCount != 1 {
		t.Fatalf("draft videoCount=%d pendingCount=%d", draft.videoCount, draft.pendingCount)
	}
	if len(progress) != 3 || progress[0].CompletedVideoCount != 0 || progress[0].TotalVideoCount != 2 {
		t.Fatalf("progress = %#v", progress)
	}
	for index, update := range progress {
		if update.Stage != "resolving" || update.TotalVideoCount != 2 || update.SkippedCount != 1 || update.CompletedVideoCount != index {
			t.Fatalf("progress[%d] = %#v", index, update)
		}
	}
}

func TestPlaylistSyncProgressNeverRegresses(t *testing.T) {
	current := models.PlaylistSyncProgress{Stage: "resolving", FavoriteID: "fav", CompletedVideoCount: 2, TotalVideoCount: 4}
	merged := mergePlaylistSyncProgress(current, models.PlaylistSyncProgress{Stage: "resolving", FavoriteID: "fav", CompletedVideoCount: 1, TotalVideoCount: 4})
	if merged.CompletedVideoCount != 2 {
		t.Fatalf("completed progress regressed: %#v", merged)
	}
	committing := models.PlaylistSyncProgress{Stage: "committing", FavoriteID: "fav", CompletedVideoCount: 4, TotalVideoCount: 4}
	merged = mergePlaylistSyncProgress(committing, current)
	if merged.Stage != "committing" {
		t.Fatalf("progress stage regressed: %#v", merged)
	}
}

func TestAsyncBiliFavoriteImportReportsRealProgress(t *testing.T) {
	service := syncTestService(t)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 3}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{
			map[string]any{"id": 1, "type": 2, "bvid": "BVone"},
			map[string]any{"id": 2, "type": 12},
			map[string]any{"id": 3, "type": 2, "bvid": "BVtwo"},
		}}, http.StatusOK), nil
	})}
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	service.videoInfoResolver = func(bvid string) (models.CompleteVideoInfo, error) {
		entered <- struct{}{}
		<-release
		return models.CompleteVideoInfo{BVID: bvid, Title: bvid, Pages: []models.PageInfo{{Page: 1, Part: bvid, Duration: 60}}}, nil
	}

	task, err := service.StartBiliFavoriteImport(models.BiliFavoriteImportRequest{RemoteID: 1, Locked: true})
	if err != nil {
		t.Fatal(err)
	}
	<-entered
	<-entered
	running, err := service.GetBiliFavoriteImportTask(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if running.Status != "running" || running.Progress.Stage != "resolving" || running.Progress.CompletedVideoCount != 0 || running.Progress.TotalVideoCount != 2 || running.Progress.SkippedCount != 1 {
		t.Fatalf("running task = %#v", running)
	}
	close(release)
	completed := waitForBiliFavoriteImportTask(t, service, task.ID)
	if completed.Status != "succeeded" || completed.Progress.Stage != "completed" || completed.Progress.CompletedVideoCount != 2 || completed.Result == nil || len(completed.Result.Favorite.SongIDs) != 2 {
		t.Fatalf("completed task = %#v", completed)
	}
}

func TestFavoriteSyncTaskReportsRealProgress(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 2}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{
			map[string]any{"id": 1, "type": 2, "bvid": "BVone"},
			map[string]any{"id": 2, "type": 2, "bvid": "BVtwo"},
		}}, http.StatusOK), nil
	})}
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	service.videoInfoResolver = func(bvid string) (models.CompleteVideoInfo, error) {
		entered <- struct{}{}
		<-release
		return models.CompleteVideoInfo{BVID: bvid, Title: bvid, Pages: []models.PageInfo{{Page: 1, Part: bvid, Duration: 60}}}, nil
	}

	task, err := service.SyncFavorite("fav", false)
	if err != nil {
		t.Fatal(err)
	}
	<-entered
	<-entered
	running, err := service.GetFavoriteSyncTask(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if running.Progress.Stage != "resolving" || running.Progress.FavoriteID != "fav" || running.Progress.CompletedVideoCount != 0 || running.Progress.TotalVideoCount != 2 {
		t.Fatalf("running task = %#v", running)
	}
	close(release)
	completed := waitForFavoriteSyncTask(t, service, task.ID)
	if completed.Status != "succeeded" || completed.Progress.Stage != "completed" || completed.Progress.CompletedVideoCount != 2 {
		t.Fatalf("completed task = %#v", completed)
	}
}

func TestFailedAsyncBiliFavoriteImportCleansUpProvisionalFavorite(t *testing.T) {
	service := syncTestService(t)
	var infoCalls atomic.Int32
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			count := 1
			if infoCalls.Add(1) > 1 {
				count = 2
			}
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": count}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"id": 1, "type": 2, "bvid": "BVone"}}}, http.StatusOK), nil
	})}

	task, err := service.StartBiliFavoriteImport(models.BiliFavoriteImportRequest{RemoteID: 1, Locked: true})
	if err != nil {
		t.Fatal(err)
	}
	failed := waitForBiliFavoriteImportTask(t, service, task.ID)
	if failed.Status != "failed" || failed.ErrorCode != ErrorCodeSyncIncomplete {
		t.Fatalf("failed task = %#v", failed)
	}
	var favoriteCount int64
	if err := service.db.Model(&models.Favorite{}).Count(&favoriteCount).Error; err != nil || favoriteCount != 0 {
		t.Fatalf("provisional favorites=%d err=%v", favoriteCount, err)
	}
}

func TestAuthFailureUsesAuthRequiredState(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return jsonResponse(map[string]any{"code": -101, "message": "账号未登录"}, http.StatusOK), nil
	})}
	status, err := service.syncFavorite("fav", false)
	if err == nil || !strings.Contains(err.Error(), ErrorCodeSyncAuth) {
		t.Fatalf("sync error = %v", err)
	}
	if status.Source == nil || status.Source.SyncState != "auth-required" || status.Run == nil || status.Run.Status != "auth-required" {
		t.Fatalf("auth status = %#v", status)
	}
	if strings.Contains(status.Source.LastErrorMessage, "{") || status.Source.LastErrorMessage == "" {
		t.Fatalf("unsafe auth error message = %q", status.Source.LastErrorMessage)
	}
}

func TestConcurrentSyncCallsReuseOneTaskAndRemoteSnapshot(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	entered := make(chan struct{})
	release := make(chan struct{})
	var infoCalls atomic.Int32
	var snapshotCalls atomic.Int32
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			if infoCalls.Add(1) == 1 {
				close(entered)
				<-release
			}
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 1}}}, http.StatusOK), nil
		}
		snapshotCalls.Add(1)
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"type": 2, "bvid": "BVold"}}}, http.StatusOK), nil
	})}
	service.videoInfoResolver = func(string) (models.CompleteVideoInfo, error) {
		return models.CompleteVideoInfo{BVID: "BVold", Title: "old", Pages: []models.PageInfo{{Page: 1, Part: "old", Duration: 60}}}, nil
	}

	results := make([]models.FavoriteSyncTask, 2)
	errorsFound := make([]error, 2)
	var waitGroup sync.WaitGroup
	waitGroup.Add(2)
	go func() {
		defer waitGroup.Done()
		results[0], errorsFound[0] = service.SyncFavorite("fav", false)
	}()
	<-entered
	go func() {
		defer waitGroup.Done()
		results[1], errorsFound[1] = service.SyncFavorite("fav", false)
	}()
	time.Sleep(20 * time.Millisecond)
	close(release)
	waitGroup.Wait()
	if errorsFound[0] != nil || errorsFound[1] != nil {
		t.Fatalf("sync errors = %v, %v", errorsFound[0], errorsFound[1])
	}
	for {
		latest, taskErr := service.GetFavoriteSyncTask(results[0].ID)
		if taskErr != nil {
			t.Fatal(taskErr)
		}
		if latest.Status == "succeeded" || latest.Status == "failed" {
			results[0] = latest
			break
		}
		time.Sleep(time.Millisecond)
	}
	if infoCalls.Load() != 1 || snapshotCalls.Load() != 1 {
		t.Fatalf("remote calls info=%d snapshot=%d", infoCalls.Load(), snapshotCalls.Load())
	}
	if results[0].ID == "" || results[0].ID != results[1].ID || results[0].Status != "succeeded" {
		t.Fatalf("calls did not share task: %#v %#v", results[0], results[1])
	}
	var sourceItem models.PlaylistSourceItem
	if err := service.db.First(&sourceItem, "source_id = ? AND remote_key = ?", "source", stableBiliRemoteKey("BVold", 1)).Error; err != nil || sourceItem.ID != "item" {
		t.Fatalf("source item identity changed: %#v, %v", sourceItem, err)
	}
}

func TestDifferentFavoritesWithSameFIDShareOneTaskStatus(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	secondFavorite := models.Favorite{ID: "fav-two", Title: "second mirror"}
	secondSource := models.PlaylistSource{ID: "source-two", FavoriteID: secondFavorite.ID, Provider: biliPlaylistProvider, RemoteID: "1", Locked: true, CreatedAt: time.Now()}
	if err := service.db.Create(&secondFavorite).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.Create(&secondSource).Error; err != nil {
		t.Fatal(err)
	}
	entered := make(chan struct{})
	release := make(chan struct{})
	var infoCalls atomic.Int32
	var snapshotCalls atomic.Int32
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			if infoCalls.Add(1) == 1 {
				close(entered)
				<-release
			}
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 1}}}, http.StatusOK), nil
		}
		snapshotCalls.Add(1)
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"type": 2, "bvid": "BVold"}}}, http.StatusOK), nil
	})}
	service.videoInfoResolver = func(string) (models.CompleteVideoInfo, error) {
		return models.CompleteVideoInfo{BVID: "BVold", Title: "old", Pages: []models.PageInfo{{Page: 1, Part: "old", Duration: 60}}}, nil
	}
	first, err := service.SyncFavorite("fav", false)
	if err != nil {
		t.Fatal(err)
	}
	<-entered
	second, err := service.SyncFavorite("fav-two", false)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || second.TotalFavorites != 2 {
		t.Fatalf("tasks were not shared: %#v %#v", first, second)
	}
	close(release)
	deadline := time.Now().Add(2 * time.Second)
	for {
		task, taskErr := service.GetFavoriteSyncTask(first.ID)
		if taskErr != nil {
			t.Fatal(taskErr)
		}
		if task.Status == "succeeded" {
			if task.CompletedFavorites != 2 || task.TotalFavorites != 2 {
				t.Fatalf("task progress = %#v", task)
			}
			break
		}
		if task.Status == "failed" || time.Now().After(deadline) {
			t.Fatalf("shared task failed: %#v", task)
		}
		time.Sleep(time.Millisecond)
	}
	if infoCalls.Load() != 1 || snapshotCalls.Load() != 1 {
		t.Fatalf("remote calls info=%d snapshot=%d", infoCalls.Load(), snapshotCalls.Load())
	}
	for _, favoriteID := range []string{"fav", "fav-two"} {
		var count int64
		if err := service.db.Model(&models.SongRef{}).Where("favorite_id = ?", favoriteID).Count(&count).Error; err != nil || count != 1 {
			t.Fatalf("favorite %s refs=%d err=%v", favoriteID, count, err)
		}
	}
}

func TestLargePlaylistResolutionUsesAtMostFourWorkersAndOneCommit(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	remote := make([]models.BiliFavoriteInfo, 600)
	var active atomic.Int32
	var maximum atomic.Int32
	service.videoInfoResolver = func(bvid string) (models.CompleteVideoInfo, error) {
		current := active.Add(1)
		for {
			previous := maximum.Load()
			if current <= previous || maximum.CompareAndSwap(previous, current) {
				break
			}
		}
		time.Sleep(100 * time.Microsecond)
		active.Add(-1)
		return models.CompleteVideoInfo{BVID: bvid, Title: bvid, Pages: []models.PageInfo{{Page: 1, Part: bvid, Duration: 60}}}, nil
	}
	for index := range remote {
		remote[index] = models.BiliFavoriteInfo{BVID: "BVstress" + strconv.Itoa(index)}
	}
	draft, err := service.preparePlaylistSync(models.PlaylistSource{ID: "source", FavoriteID: "fav"}, remote)
	if err != nil {
		t.Fatal(err)
	}
	if maximum.Load() < 2 || maximum.Load() > 4 || len(draft.refs) != len(remote) {
		t.Fatalf("workers=%d refs=%d", maximum.Load(), len(draft.refs))
	}
	draft.remoteCount = len(remote)
	draft.snapshotHash = "large-snapshot"
	run := models.PlaylistSyncRun{ID: "large-run", SourceID: "source", Status: "running", StartedAt: time.Now()}
	if err := service.db.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.commitPlaylistSync(models.PlaylistSource{ID: "source", FavoriteID: "fav"}, &run, draft); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := service.db.Model(&models.SongRef{}).Where("favorite_id = ?", "fav").Count(&count).Error; err != nil || count != int64(len(remote)) {
		t.Fatalf("large commit refs=%d err=%v", count, err)
	}
}

func TestSubtitleLooksLikeLyricsRequiresEveryQualitySignal(t *testing.T) {
	valid := make([]biliSubtitleCue, 10)
	for index := range valid {
		start := float64(index * 6)
		valid[index] = biliSubtitleCue{From: start, To: start + 5, Content: "lyric"}
	}
	dialogue := make([]biliSubtitleCue, 10)
	for index := range dialogue {
		start := float64(index * 6)
		dialogue[index] = biliSubtitleCue{From: start, To: start + 5, Content: "今天我们继续介绍这个功能。"}
	}
	if ok, _ := subtitleLooksLikeLyrics(dialogue, 100, 0); ok {
		t.Fatal("spoken dialogue was accepted as lyrics")
	}
	if ok, coverage := subtitleLooksLikeLyrics(valid, 100, 0); !ok || coverage < 0.45 {
		t.Fatalf("valid subtitle rejected: ok=%v coverage=%.2f", ok, coverage)
	}

	tests := []struct {
		name        string
		mutate      func([]biliSubtitleCue) []biliSubtitleCue
		duration    int64
		punctuation int
	}{
		{name: "too few cues", mutate: func(cues []biliSubtitleCue) []biliSubtitleCue { return cues[:7] }, duration: 100},
		{name: "low coverage", mutate: func(cues []biliSubtitleCue) []biliSubtitleCue { return cues }, duration: 200},
		{name: "median too short", mutate: func(cues []biliSubtitleCue) []biliSubtitleCue {
			for index := range cues {
				cues[index].To = cues[index].From + 1
			}
			return cues
		}, duration: 20},
		{name: "too much punctuation", mutate: func(cues []biliSubtitleCue) []biliSubtitleCue { return cues }, duration: 100, punctuation: 4},
		{name: "out of order", mutate: func(cues []biliSubtitleCue) []biliSubtitleCue { cues[5].From = 2; cues[5].To = 7; return cues }, duration: 100},
		{name: "too much overlap", mutate: func(cues []biliSubtitleCue) []biliSubtitleCue {
			for index := 1; index < 5; index++ {
				cues[index].From = cues[index-1].To - 1
				cues[index].To = cues[index].From + 5
			}
			return cues
		}, duration: 100},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cues := append([]biliSubtitleCue(nil), valid...)
			if ok, _ := subtitleLooksLikeLyrics(test.mutate(cues), test.duration, test.punctuation); ok {
				t.Fatal("invalid subtitle accepted")
			}
		})
	}
}

func TestCompleteEmptySnapshotClearsOnlyReferences(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if strings.Contains(r.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 0}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{}}, http.StatusOK), nil
	})}
	status, err := service.syncFavorite("fav", false)
	if err != nil || status.Run == nil || !status.Run.SnapshotComplete {
		t.Fatalf("SyncFavorite = %#v, %v", status, err)
	}
	var refCount, songCount int64
	_ = service.db.Model(&models.SongRef{}).Count(&refCount).Error
	_ = service.db.Model(&models.Song{}).Count(&songCount).Error
	if refCount != 0 || songCount != 1 {
		t.Fatalf("refs=%d songs=%d", refCount, songCount)
	}
}

func TestCompleteSnapshotRemovesOnlyMirrorReferences(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	for index, bvid := range []string{"BVremove1", "BVremove2"} {
		song := models.Song{ID: "song-remove-" + strconv.Itoa(index), BVID: bvid, Name: bvid}
		ref := models.SongRef{FavoriteID: "fav", SongID: song.ID, Position: index + 1}
		item := models.PlaylistSourceItem{ID: "item-remove-" + strconv.Itoa(index), SourceID: "source", RemoteKey: stableBiliRemoteKey(bvid, 1), BVID: bvid, PageNumber: 1, SongID: song.ID, Position: index + 1, State: "ready"}
		for _, value := range []any{&song, &ref, &item} {
			if err := service.db.Create(value).Error; err != nil {
				t.Fatalf("seed %T: %v", value, err)
			}
		}
	}
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 1}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"type": 2, "bvid": "BVold"}}}, http.StatusOK), nil
	})}
	service.videoInfoResolver = func(string) (models.CompleteVideoInfo, error) {
		return models.CompleteVideoInfo{BVID: "BVold", Title: "old", Pages: []models.PageInfo{{Page: 1, Part: "old", Duration: 60}}}, nil
	}

	status, err := service.syncFavorite("fav", false)
	if err != nil || status.Run == nil || status.Run.RemovedCount != 2 {
		t.Fatalf("SyncFavorite = %#v, %v", status, err)
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("refs = %#v, %v", refs, err)
	}
	var songCount int64
	if err := service.db.Model(&models.Song{}).Count(&songCount).Error; err != nil || songCount != 3 {
		t.Fatalf("songs were deleted: count=%d err=%v", songCount, err)
	}
}

func TestRemoteResolutionFailureRetainsExistingMirrorEntry(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 1}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"type": 2, "bvid": "BVold"}}}, http.StatusOK), nil
	})}
	service.videoInfoResolver = func(string) (models.CompleteVideoInfo, error) {
		return models.CompleteVideoInfo{}, assertError("offline")
	}

	status, err := service.syncFavorite("fav", false)
	if err != nil || status.Source == nil || status.Source.SyncState != "stale" || status.Run == nil || status.Run.PendingCount != 1 {
		t.Fatalf("SyncFavorite = %#v, %v", status, err)
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("existing reference was removed: %#v, %v", refs, err)
	}
}

func TestDetachDuringRemoteFetchPreventsLateSyncCommit(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	entered := make(chan struct{})
	release := make(chan struct{})
	service.httpClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if strings.Contains(request.URL.Path, "/resource/list") {
			close(entered)
			<-release
			return jsonResponse(map[string]any{"code": 0, "data": map[string]any{"info": map[string]any{"id": 1, "title": "remote", "media_count": 1}}}, http.StatusOK), nil
		}
		return jsonResponse(map[string]any{"code": 0, "data": []any{map[string]any{"type": 2, "bvid": "BVnew"}}}, http.StatusOK), nil
	})}
	service.videoInfoResolver = func(string) (models.CompleteVideoInfo, error) {
		return models.CompleteVideoInfo{BVID: "BVnew", Title: "new", Pages: []models.PageInfo{{Page: 1, Part: "new", Duration: 60}}}, nil
	}
	syncDone := make(chan error, 1)
	go func() {
		_, err := service.syncFavorite("fav", false)
		syncDone <- err
	}()
	<-entered
	if _, err := service.DetachFavoriteSource("fav", true); err != nil {
		t.Fatalf("detach: %v", err)
	}
	close(release)
	if err := <-syncDone; err == nil || !strings.Contains(err.Error(), ErrorCodePlaylistDetached) {
		t.Fatalf("late sync error = %v", err)
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("late sync changed detached membership: %#v, %v", refs, err)
	}
	var source models.PlaylistSource
	if err := service.db.First(&source, "id = ?", "source").Error; err != nil || source.Locked || source.SyncState != "detached" {
		t.Fatalf("detached source overwritten: %#v, %v", source, err)
	}
}

func TestPageResolutionFailureCreatesPendingItem(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	service.videoInfoResolver = func(string) (models.CompleteVideoInfo, error) {
		return models.CompleteVideoInfo{}, assertError("offline")
	}
	draft, err := service.preparePlaylistSync(models.PlaylistSource{ID: "source", FavoriteID: "fav"}, []models.BiliFavoriteInfo{{BVID: "BVnew"}})
	if err != nil || draft.pendingCount != 1 || len(draft.items) != 1 || draft.items[0].State != "pending" {
		t.Fatalf("draft = %#v, %v", draft, err)
	}
}

func TestPlaylistSyncTransactionRollsBackMembershipOnWriteFailure(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	callbackName := "test:reject-new-song-ref"
	if err := service.db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "song_refs" {
			tx.AddError(assertError("injected song ref failure"))
		}
	}); err != nil {
		t.Fatalf("register callback: %v", err)
	}
	t.Cleanup(func() { _ = service.db.Callback().Create().Remove(callbackName) })

	now := time.Now()
	draft := playlistSyncDraft{
		songs:        []models.Song{{ID: "song-new", BVID: "BVnew", Name: "new"}},
		items:        []models.PlaylistSourceItem{{ID: "item-new", SourceID: "source", RemoteKey: stableBiliRemoteKey("BVnew", 1), BVID: "BVnew", PageNumber: 1, SongID: "song-new", State: "ready"}},
		refs:         []models.SongRef{{FavoriteID: "fav", SongID: "song-new", Position: 0}},
		remoteCount:  1,
		snapshotHash: "new",
	}
	run := models.PlaylistSyncRun{ID: "run", SourceID: "source", Status: "running", StartedAt: now}
	if err := service.db.Create(&run).Error; err != nil {
		t.Fatalf("create run: %v", err)
	}
	if err := service.commitPlaylistSync(models.PlaylistSource{ID: "source", FavoriteID: "fav"}, &run, draft); err == nil {
		t.Fatal("commit unexpectedly succeeded")
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("rollback membership = %#v, %v", refs, err)
	}
	var newSongCount int64
	if err := service.db.Model(&models.Song{}).Where("id = ?", "song-new").Count(&newSongCount).Error; err != nil || newSongCount != 0 {
		t.Fatalf("new song survived rollback: %d, %v", newSongCount, err)
	}
}

func TestRecoverInterruptedPlaylistSyncPreservesMirror(t *testing.T) {
	service := syncTestService(t)
	seedLockedFavorite(t, service)
	run := models.PlaylistSyncRun{ID: "interrupted", SourceID: "source", Status: "running", StartedAt: time.Now().Add(-time.Minute)}
	if err := service.db.Create(&run).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.RecoverInterruptedPlaylistSyncs(); err != nil {
		t.Fatalf("recover: %v", err)
	}
	status, err := service.GetFavoriteSyncStatus("fav")
	if err != nil || status.Source == nil || status.Source.SyncState != "stale" || status.Run == nil || status.Run.ErrorCode != ErrorCodeSyncInterrupted {
		t.Fatalf("status = %#v, %v", status, err)
	}
	var refs []models.SongRef
	if err := service.db.Where("favorite_id = ?", "fav").Find(&refs).Error; err != nil || len(refs) != 1 || refs[0].SongID != "song-old" {
		t.Fatalf("mirror changed during recovery: %#v, %v", refs, err)
	}
}

type assertError string

func (e assertError) Error() string { return string(e) }

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func jsonResponse(value any, status int) *http.Response {
	reader, writer := io.Pipe()
	go func() {
		_ = json.NewEncoder(writer).Encode(value)
		_ = writer.Close()
	}()
	return &http.Response{StatusCode: status, Body: reader, Header: http.Header{"Content-Type": []string{"application/json"}}}
}

func waitForBiliFavoriteImportTask(t *testing.T, service *Service, taskID string) models.BiliFavoriteImportTask {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		task, err := service.GetBiliFavoriteImportTask(taskID)
		if err != nil {
			t.Fatal(err)
		}
		if task.Status == "succeeded" || task.Status == "failed" {
			return task
		}
		if time.Now().After(deadline) {
			t.Fatalf("import task timed out: %#v", task)
		}
		time.Sleep(time.Millisecond)
	}
}

func waitForFavoriteSyncTask(t *testing.T, service *Service, taskID string) models.FavoriteSyncTask {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		task, err := service.GetFavoriteSyncTask(taskID)
		if err != nil {
			t.Fatal(err)
		}
		if task.Status == "succeeded" || task.Status == "failed" {
			return task
		}
		if time.Now().After(deadline) {
			t.Fatalf("sync task timed out: %#v", task)
		}
		time.Sleep(time.Millisecond)
	}
}

func seedLockedFavorite(t *testing.T, service *Service) {
	t.Helper()
	favorite := models.Favorite{ID: "fav", Title: "mirror"}
	song := models.Song{ID: "song-old", BVID: "BVold", Name: "old"}
	ref := models.SongRef{FavoriteID: favorite.ID, SongID: song.ID, Position: 0}
	source := models.PlaylistSource{ID: "source", FavoriteID: favorite.ID, Provider: biliPlaylistProvider, RemoteID: "1", Locked: true, CreatedAt: time.Now()}
	item := models.PlaylistSourceItem{ID: "item", SourceID: source.ID, RemoteKey: stableBiliRemoteKey(song.BVID, 1), BVID: song.BVID, PageNumber: 1, SongID: song.ID, State: "ready"}
	for _, value := range []any{&favorite, &song, &ref, &source, &item} {
		if err := service.db.Create(value).Error; err != nil {
			t.Fatalf("seed %T: %v", value, err)
		}
	}
}
