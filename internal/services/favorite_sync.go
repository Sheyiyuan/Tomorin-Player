package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"half-beat-player/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	biliPlaylistProvider      = "bilibili"
	manualSyncMinimumInterval = time.Minute
	sharedSnapshotCacheWindow = 5 * time.Second
)

type favoriteSyncCall struct {
	done        chan struct{}
	status      models.PlaylistSyncStatus
	err         error
	progress    models.PlaylistSyncProgress
	hasProgress bool
	reporters   []playlistSyncProgressReporter
}

type playlistSyncProgressReporter func(models.PlaylistSyncProgress)

type favoriteSyncTaskState struct {
	task        models.FavoriteSyncTask
	sourceKey   string
	favoriteIDs map[string]struct{}
	processed   map[string]struct{}
	force       bool
}

type biliFavoriteImportTaskState struct {
	task models.BiliFavoriteImportTask
}

type favoriteSnapshotCall struct {
	done     chan struct{}
	snapshot favoriteSnapshot
}

type favoriteSnapshot struct {
	info         *models.BiliFavoriteCollection
	resources    []biliFavoriteResource
	remote       []models.BiliFavoriteInfo
	skippedCount int
	err          error
	fetchedAt    time.Time
}

// ImportBiliFavorite creates a playlist and performs its initial exact-mirror
// synchronization. Unlocked imports are detached after the initial snapshot.
func (s *Service) ImportBiliFavorite(request models.BiliFavoriteImportRequest) (models.BiliFavoriteImportResult, error) {
	return s.importBiliFavorite(request, nil)
}

func (s *Service) importBiliFavorite(request models.BiliFavoriteImportRequest, report playlistSyncProgressReporter) (models.BiliFavoriteImportResult, error) {
	mediaID := request.RemoteID
	name := request.Name
	locked := request.Locked
	if mediaID <= 0 {
		return models.BiliFavoriteImportResult{}, fmt.Errorf("收藏夹 ID 必须大于 0")
	}
	reportSyncProgress(report, models.PlaylistSyncProgress{Stage: "fetching"})
	info, err := s.GetFavoriteCollectionInfo(mediaID)
	if err != nil {
		return models.BiliFavoriteImportResult{}, fmt.Errorf("获取收藏夹信息: %w", err)
	}
	if strings.TrimSpace(name) == "" {
		name = info.Title
	}
	if strings.TrimSpace(name) == "" {
		name = "Bilibili 收藏夹"
	}
	now := time.Now()
	favorite := models.Favorite{ID: "FavList-" + uuid.NewString(), Title: name, CreatedAt: now, UpdatedAt: now}
	source := models.PlaylistSource{
		ID:          uuid.NewString(),
		FavoriteID:  favorite.ID,
		Provider:    biliPlaylistProvider,
		RemoteID:    strconv.FormatInt(mediaID, 10),
		Locked:      true,
		RemoteTitle: info.Title,
		SyncState:   "importing",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&favorite).Error; err != nil {
			return fmt.Errorf("create imported playlist: %w", err)
		}
		return tx.Create(&source).Error
	}); err != nil {
		return models.BiliFavoriteImportResult{}, err
	}
	status, err := s.syncFavoriteWithProgress(favorite.ID, true, report)
	if err != nil {
		_ = s.DeleteFavorite(favorite.ID)
		return models.BiliFavoriteImportResult{}, err
	}
	if !locked {
		if _, err := s.DetachFavoriteSource(favorite.ID, true); err != nil {
			_ = s.DeleteFavorite(favorite.ID)
			return models.BiliFavoriteImportResult{}, err
		}
	}
	var loaded models.Favorite
	if err := s.db.Preload("SongIDs", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Preload("Source", "locked = ?", true).First(&loaded, "id = ?", favorite.ID).Error; err != nil {
		_ = s.DeleteFavorite(favorite.ID)
		return models.BiliFavoriteImportResult{}, err
	}
	return models.BiliFavoriteImportResult{Favorite: loaded, SyncStatus: status}, nil
}

// StartBiliFavoriteImport starts an asynchronous import that can be polled for progress.
func (s *Service) StartBiliFavoriteImport(request models.BiliFavoriteImportRequest) (models.BiliFavoriteImportTask, error) {
	if request.RemoteID <= 0 {
		return models.BiliFavoriteImportTask{}, fmt.Errorf("收藏夹 ID 必须大于 0")
	}
	taskID := uuid.NewString()
	state := &biliFavoriteImportTaskState{task: models.BiliFavoriteImportTask{
		ID:        taskID,
		Status:    "queued",
		Progress:  models.PlaylistSyncProgress{Stage: "queued"},
		StartedAt: time.Now(),
	}}
	s.favoriteImportTaskMu.Lock()
	if s.favoriteImportTasks == nil {
		s.favoriteImportTasks = make(map[string]*biliFavoriteImportTaskState)
	}
	s.favoriteImportTasks[taskID] = state
	task := copyBiliFavoriteImportTask(state.task)
	s.favoriteImportTaskMu.Unlock()

	go s.runBiliFavoriteImportTask(taskID, request)
	return task, nil
}

// GetBiliFavoriteImportTask returns an immutable snapshot for frontend polling.
func (s *Service) GetBiliFavoriteImportTask(taskID string) (models.BiliFavoriteImportTask, error) {
	s.favoriteImportTaskMu.Lock()
	defer s.favoriteImportTaskMu.Unlock()
	state := s.favoriteImportTasks[strings.TrimSpace(taskID)]
	if state == nil {
		return models.BiliFavoriteImportTask{}, fmt.Errorf("导入任务不存在或已失效")
	}
	return copyBiliFavoriteImportTask(state.task), nil
}

func (s *Service) runBiliFavoriteImportTask(taskID string, request models.BiliFavoriteImportRequest) {
	s.favoriteImportTaskMu.Lock()
	state := s.favoriteImportTasks[taskID]
	if state == nil {
		s.favoriteImportTaskMu.Unlock()
		return
	}
	state.task.Status = "running"
	s.favoriteImportTaskMu.Unlock()

	report := func(progress models.PlaylistSyncProgress) {
		s.favoriteImportTaskMu.Lock()
		if current := s.favoriteImportTasks[taskID]; current != nil {
			current.task.Progress = mergePlaylistSyncProgress(current.task.Progress, progress)
		}
		s.favoriteImportTaskMu.Unlock()
	}
	result, importErr := s.importBiliFavorite(request, report)

	s.favoriteImportTaskMu.Lock()
	defer s.favoriteImportTaskMu.Unlock()
	state = s.favoriteImportTasks[taskID]
	if state == nil {
		return
	}
	now := time.Now()
	state.task.FinishedAt = &now
	if importErr != nil {
		state.task.Status = "failed"
		state.task.ErrorCode, state.task.ErrorMessage, state.task.Retryable, state.task.ErrorDetails = taskErrorFields(importErr, ErrorCodeSyncLocalCommit)
		return
	}
	state.task.Status = "succeeded"
	state.task.Progress.Stage = "completed"
	state.task.Progress.CompletedVideoCount = state.task.Progress.TotalVideoCount
	state.task.Result = &result
}

func copyBiliFavoriteImportTask(source models.BiliFavoriteImportTask) models.BiliFavoriteImportTask {
	copy := source
	copy.ErrorDetails = cloneStringMap(source.ErrorDetails)
	if source.Result != nil {
		result := *source.Result
		copy.Result = &result
	}
	return copy
}

// SyncFavorite starts or reuses a process-level synchronization task. Local
// mirrors of the same remote fid subscribe to one task and one remote fetch.
func (s *Service) SyncFavorite(favoriteID string, force bool) (models.FavoriteSyncTask, error) {
	source, err := s.loadLockedPlaylistSource(favoriteID)
	if err != nil {
		return models.FavoriteSyncTask{}, err
	}
	sourceKey := source.Provider + ":" + source.RemoteID

	s.favoriteTaskMu.Lock()
	if s.favoriteTasks == nil {
		s.favoriteTasks = make(map[string]*favoriteSyncTaskState)
	}
	if s.favoriteTaskBySource == nil {
		s.favoriteTaskBySource = make(map[string]string)
	}
	if runningID := s.favoriteTaskBySource[sourceKey]; runningID != "" {
		if running := s.favoriteTasks[runningID]; running != nil && (running.task.Status == "queued" || running.task.Status == "running") {
			if _, exists := running.favoriteIDs[favoriteID]; !exists {
				running.favoriteIDs[favoriteID] = struct{}{}
				running.task.FavoriteIDs = append(running.task.FavoriteIDs, favoriteID)
				sort.Strings(running.task.FavoriteIDs)
				running.task.TotalFavorites = len(running.task.FavoriteIDs)
			}
			running.force = running.force || force
			task := copyFavoriteSyncTask(running.task)
			s.favoriteTaskMu.Unlock()
			return task, nil
		}
	}
	taskID := uuid.NewString()
	state := &favoriteSyncTaskState{
		task: models.FavoriteSyncTask{
			ID:             taskID,
			FavoriteIDs:    []string{favoriteID},
			Status:         "queued",
			TotalFavorites: 1,
			StartedAt:      time.Now(),
		},
		sourceKey:   sourceKey,
		favoriteIDs: map[string]struct{}{favoriteID: {}},
		processed:   make(map[string]struct{}),
		force:       force,
	}
	s.favoriteTasks[taskID] = state
	s.favoriteTaskBySource[sourceKey] = taskID
	task := copyFavoriteSyncTask(state.task)
	s.favoriteTaskMu.Unlock()

	go s.runFavoriteSyncTask(taskID)
	return task, nil
}

// GetFavoriteSyncTask returns an immutable snapshot for frontend polling.
func (s *Service) GetFavoriteSyncTask(taskID string) (models.FavoriteSyncTask, error) {
	s.favoriteTaskMu.Lock()
	defer s.favoriteTaskMu.Unlock()
	state := s.favoriteTasks[strings.TrimSpace(taskID)]
	if state == nil {
		return models.FavoriteSyncTask{}, fmt.Errorf("同步任务不存在或已失效")
	}
	return copyFavoriteSyncTask(state.task), nil
}

func (s *Service) runFavoriteSyncTask(taskID string) {
	s.favoriteTaskMu.Lock()
	state := s.favoriteTasks[taskID]
	if state == nil {
		s.favoriteTaskMu.Unlock()
		return
	}
	state.task.Status = "running"
	s.favoriteTaskMu.Unlock()

	for {
		s.favoriteTaskMu.Lock()
		state = s.favoriteTasks[taskID]
		if state == nil {
			s.favoriteTaskMu.Unlock()
			return
		}
		favoriteID := ""
		for _, candidate := range state.task.FavoriteIDs {
			if _, done := state.processed[candidate]; !done {
				favoriteID = candidate
				state.processed[candidate] = struct{}{}
				break
			}
		}
		if favoriteID == "" {
			now := time.Now()
			if state.task.ErrorCode != "" {
				state.task.Status = "failed"
			} else {
				state.task.Status = "succeeded"
				state.task.Progress.Stage = "completed"
				state.task.Progress.CompletedVideoCount = state.task.Progress.TotalVideoCount
			}
			state.task.FinishedAt = &now
			if s.favoriteTaskBySource[state.sourceKey] == taskID {
				delete(s.favoriteTaskBySource, state.sourceKey)
			}
			s.favoriteTaskMu.Unlock()
			return
		}
		force := state.force
		state.task.Progress = models.PlaylistSyncProgress{Stage: "fetching", FavoriteID: favoriteID}
		s.favoriteTaskMu.Unlock()

		report := func(progress models.PlaylistSyncProgress) {
			progress.FavoriteID = favoriteID
			s.favoriteTaskMu.Lock()
			if current := s.favoriteTasks[taskID]; current != nil {
				current.task.Progress = mergePlaylistSyncProgress(current.task.Progress, progress)
			}
			s.favoriteTaskMu.Unlock()
		}
		status, syncErr := s.syncFavoriteWithProgress(favoriteID, force, report)
		s.favoriteTaskMu.Lock()
		state = s.favoriteTasks[taskID]
		if state != nil {
			state.task.CompletedFavorites++
			state.task.Result = &status
			if syncErr != nil {
				state.task.ErrorCode, state.task.ErrorMessage, state.task.Retryable, state.task.ErrorDetails = taskErrorFields(syncErr, ErrorCodeSyncLocalCommit)
			}
		}
		s.favoriteTaskMu.Unlock()
	}
}

func copyFavoriteSyncTask(source models.FavoriteSyncTask) models.FavoriteSyncTask {
	copy := source
	copy.FavoriteIDs = append([]string(nil), source.FavoriteIDs...)
	copy.ErrorDetails = cloneStringMap(source.ErrorDetails)
	if source.Result != nil {
		result := *source.Result
		copy.Result = &result
	}
	return copy
}

func reportSyncProgress(report playlistSyncProgressReporter, progress models.PlaylistSyncProgress) {
	if report != nil {
		report(progress)
	}
}

func mergePlaylistSyncProgress(current, next models.PlaylistSyncProgress) models.PlaylistSyncProgress {
	if next.Stage == "" {
		return current
	}
	if current.FavoriteID == next.FavoriteID && playlistSyncStageRank(next.Stage) < playlistSyncStageRank(current.Stage) {
		return current
	}
	if current.Stage == next.Stage && current.FavoriteID == next.FavoriteID && current.CompletedVideoCount > next.CompletedVideoCount {
		next.CompletedVideoCount = current.CompletedVideoCount
	}
	return next
}

func playlistSyncStageRank(stage string) int {
	switch stage {
	case "fetching":
		return 1
	case "resolving":
		return 2
	case "committing":
		return 3
	case "completed":
		return 4
	default:
		return 0
	}
}

func (s *Service) syncFavorite(favoriteID string, bypassMinimumInterval bool) (models.PlaylistSyncStatus, error) {
	return s.syncFavoriteWithProgress(favoriteID, bypassMinimumInterval, nil)
}

func (s *Service) syncFavoriteWithProgress(favoriteID string, bypassMinimumInterval bool, report playlistSyncProgressReporter) (models.PlaylistSyncStatus, error) {
	s.favoriteSyncMu.Lock()
	if s.favoriteSyncCalls == nil {
		s.favoriteSyncCalls = make(map[string]*favoriteSyncCall)
	}
	if running := s.favoriteSyncCalls[favoriteID]; running != nil {
		if report != nil {
			running.reporters = append(running.reporters, report)
		}
		progress, hasProgress := running.progress, running.hasProgress
		s.favoriteSyncMu.Unlock()
		if report != nil && hasProgress {
			report(progress)
		}
		<-running.done
		return running.status, running.err
	}
	call := &favoriteSyncCall{done: make(chan struct{})}
	if report != nil {
		call.reporters = append(call.reporters, report)
	}
	s.favoriteSyncCalls[favoriteID] = call
	if s.favoriteSyncSlots == nil {
		s.favoriteSyncSlots = make(chan struct{}, 2)
	}
	slots := s.favoriteSyncSlots
	s.favoriteSyncMu.Unlock()

	slots <- struct{}{}
	call.status, call.err = s.executeFavoriteSync(favoriteID, bypassMinimumInterval, func(progress models.PlaylistSyncProgress) {
		s.publishFavoriteSyncProgress(call, progress)
	})
	<-slots
	s.favoriteSyncMu.Lock()
	delete(s.favoriteSyncCalls, favoriteID)
	close(call.done)
	s.favoriteSyncMu.Unlock()
	return call.status, call.err
}

func (s *Service) publishFavoriteSyncProgress(call *favoriteSyncCall, progress models.PlaylistSyncProgress) {
	s.favoriteSyncMu.Lock()
	call.progress = mergePlaylistSyncProgress(call.progress, progress)
	call.hasProgress = true
	current := call.progress
	reporters := append([]playlistSyncProgressReporter(nil), call.reporters...)
	s.favoriteSyncMu.Unlock()
	for _, report := range reporters {
		report(current)
	}
}

func (s *Service) executeFavoriteSync(favoriteID string, bypassMinimumInterval bool, report playlistSyncProgressReporter) (models.PlaylistSyncStatus, error) {
	source, err := s.loadLockedPlaylistSource(favoriteID)
	if err != nil {
		return models.PlaylistSyncStatus{}, err
	}
	if !bypassMinimumInterval && source.LastAttemptedAt != nil {
		nextAllowed := source.LastAttemptedAt.Add(manualSyncMinimumInterval)
		if time.Now().Before(nextAllowed) {
			status, _ := s.GetFavoriteSyncStatus(favoriteID)
			return status, domainErrorWithDetails(ErrorCodeSyncRateLimited, "手动同步间隔至少为 60 秒", true, map[string]string{
				"retryAfter": nextAllowed.Format(time.RFC3339),
			}, nil)
		}
	}
	mediaID, err := strconv.ParseInt(source.RemoteID, 10, 64)
	if err != nil {
		return models.PlaylistSyncStatus{}, fmt.Errorf("invalid remote playlist id: %w", err)
	}
	now := time.Now()
	run := models.PlaylistSyncRun{
		ID:        uuid.NewString(),
		SourceID:  source.ID,
		Status:    "running",
		StartedAt: now,
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&run).Error; err != nil {
			return err
		}
		result := tx.Model(&models.PlaylistSource{}).Where("id = ? AND locked = ?", source.ID, true).
			Updates(map[string]interface{}{"sync_state": "syncing", "last_attempted_at": now, "last_error_code": "", "last_error_message": "", "updated_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return domainError(ErrorCodePlaylistDetached, "歌单已转换为本地歌单，同步已停止", nil)
		}
		return nil
	}); err != nil {
		return models.PlaylistSyncStatus{}, err
	}

	reportSyncProgress(report, models.PlaylistSyncProgress{Stage: "fetching"})
	snapshot := s.fetchFavoriteSnapshot(mediaID)
	if snapshot.err != nil {
		code := errorCodeOr(snapshot.err, ErrorCodeSyncIncomplete)
		_ = s.failPlaylistSync(source.ID, run.ID, code, "未取得完整收藏夹快照", snapshot.err)
		status, _ := s.GetFavoriteSyncStatus(favoriteID)
		return status, snapshot.err
	}

	draft, err := s.preparePlaylistSyncWithProgress(source, snapshot.remote, snapshot.skippedCount, report)
	if err != nil {
		_ = s.failPlaylistSync(source.ID, run.ID, ErrorCodeSyncLocalCommit, "准备同步失败", err)
		status, _ := s.GetFavoriteSyncStatus(favoriteID)
		return status, domainError(ErrorCodeSyncLocalCommit, "无法准备本地同步事务", err)
	}
	draft.remoteCount = len(snapshot.resources)
	draft.skippedCount = snapshot.skippedCount
	draft.remoteTitle = snapshot.info.Title
	draft.snapshotHash = snapshotHash(snapshot.resources)
	reportSyncProgress(report, models.PlaylistSyncProgress{
		Stage:               "committing",
		CompletedVideoCount: draft.videoCount,
		TotalVideoCount:     draft.videoCount,
		SkippedCount:        snapshot.skippedCount,
	})
	if err := s.commitPlaylistSync(source, &run, draft); err != nil {
		if errorCodeOr(err, "") == ErrorCodePlaylistDetached {
			status, _ := s.GetFavoriteSyncStatus(favoriteID)
			return status, err
		}
		_ = s.failPlaylistSync(source.ID, run.ID, ErrorCodeSyncLocalCommit, "写入同步结果失败", err)
		status, _ := s.GetFavoriteSyncStatus(favoriteID)
		return status, domainError(ErrorCodeSyncLocalCommit, "无法提交本地同步事务", err)
	}
	return s.GetFavoriteSyncStatus(favoriteID)
}

func (s *Service) fetchFavoriteSnapshot(mediaID int64) favoriteSnapshot {
	key := strconv.FormatInt(mediaID, 10)
	s.favoriteSyncMu.Lock()
	if s.favoriteSnapshots == nil {
		s.favoriteSnapshots = make(map[string]*favoriteSnapshotCall)
	}
	if s.favoriteSnapshotCache == nil {
		s.favoriteSnapshotCache = make(map[string]favoriteSnapshot)
	}
	if cached, ok := s.favoriteSnapshotCache[key]; ok && time.Since(cached.fetchedAt) <= sharedSnapshotCacheWindow {
		s.favoriteSyncMu.Unlock()
		return cached
	}
	if running := s.favoriteSnapshots[key]; running != nil {
		s.favoriteSyncMu.Unlock()
		<-running.done
		return running.snapshot
	}
	call := &favoriteSnapshotCall{done: make(chan struct{})}
	s.favoriteSnapshots[key] = call
	s.favoriteSyncMu.Unlock()

	info, err := s.GetFavoriteCollectionInfo(mediaID)
	var resources []biliFavoriteResource
	if err == nil {
		resources, err = s.getFavoriteCollectionResources(mediaID)
	}
	if err == nil && info == nil {
		err = domainError(ErrorCodeSyncIncomplete, "收藏夹元信息缺失", nil)
	}
	if err == nil && info.Count != len(resources) {
		err = domainErrorWithDetails(ErrorCodeSyncIncomplete, "收藏夹声明数量与完整快照不一致", true, map[string]string{
			"declaredCount": fmt.Sprint(info.Count),
			"receivedCount": fmt.Sprint(len(resources)),
		}, nil)
	}
	remote, skippedCount := supportedFavoriteVideos(resources)
	call.snapshot = favoriteSnapshot{info: info, resources: resources, remote: remote, skippedCount: skippedCount, err: err, fetchedAt: time.Now()}

	s.favoriteSyncMu.Lock()
	delete(s.favoriteSnapshots, key)
	if err == nil {
		s.favoriteSnapshotCache[key] = call.snapshot
	}
	close(call.done)
	s.favoriteSyncMu.Unlock()
	return call.snapshot
}

type playlistSyncDraft struct {
	songs        []models.Song
	items        []models.PlaylistSourceItem
	refs         []models.SongRef
	remoteCount  int
	skippedCount int
	pendingCount int
	snapshotHash string
	remoteTitle  string
	videoCount   int
}

func (s *Service) preparePlaylistSync(source models.PlaylistSource, remote []models.BiliFavoriteInfo) (playlistSyncDraft, error) {
	return s.preparePlaylistSyncWithProgress(source, remote, 0, nil)
}

func (s *Service) preparePlaylistSyncWithProgress(source models.PlaylistSource, remote []models.BiliFavoriteInfo, skippedCount int, report playlistSyncProgressReporter) (playlistSyncDraft, error) {
	var existingItems []models.PlaylistSourceItem
	if err := s.db.Where("source_id = ?", source.ID).Order("position ASC").Find(&existingItems).Error; err != nil {
		return playlistSyncDraft{}, err
	}
	itemsByBVID := make(map[string][]models.PlaylistSourceItem)
	itemsByKey := make(map[string]models.PlaylistSourceItem)
	for _, item := range existingItems {
		itemsByBVID[item.BVID] = append(itemsByBVID[item.BVID], item)
		itemsByKey[item.RemoteKey] = item
	}

	type resolvedVideo struct {
		video models.CompleteVideoInfo
		err   error
	}
	orderedBVIDs := make([]string, 0, len(remote))
	seenBVID := make(map[string]struct{})
	for _, remoteItem := range remote {
		bvid := strings.TrimSpace(remoteItem.BVID)
		if bvid == "" {
			continue
		}
		if _, duplicate := seenBVID[bvid]; duplicate {
			continue
		}
		seenBVID[bvid] = struct{}{}
		orderedBVIDs = append(orderedBVIDs, bvid)
	}
	reportSyncProgress(report, models.PlaylistSyncProgress{
		Stage:           "resolving",
		TotalVideoCount: len(orderedBVIDs),
		SkippedCount:    skippedCount,
	})
	resolved := make(map[string]resolvedVideo, len(orderedBVIDs))
	if len(orderedBVIDs) > 0 {
		jobs := make(chan string)
		var resolvedMu sync.Mutex
		var workers sync.WaitGroup
		completed := 0
		workerCount := min(4, len(orderedBVIDs))
		workers.Add(workerCount)
		for range workerCount {
			go func() {
				defer workers.Done()
				for bvid := range jobs {
					video, resolveErr := s.resolveCompleteVideoInfo(bvid)
					resolvedMu.Lock()
					resolved[bvid] = resolvedVideo{video: video, err: resolveErr}
					completed++
					reportSyncProgress(report, models.PlaylistSyncProgress{
						Stage:               "resolving",
						CompletedVideoCount: completed,
						TotalVideoCount:     len(orderedBVIDs),
						SkippedCount:        skippedCount,
					})
					resolvedMu.Unlock()
				}
			}()
		}
		for _, bvid := range orderedBVIDs {
			jobs <- bvid
		}
		close(jobs)
		workers.Wait()
	}

	draft := playlistSyncDraft{songs: []models.Song{}, items: []models.PlaylistSourceItem{}, refs: []models.SongRef{}, videoCount: len(orderedBVIDs)}
	position := 0
	for _, bvid := range orderedBVIDs {
		resolution := resolved[bvid]
		if resolution.err != nil {
			retained := append([]models.PlaylistSourceItem(nil), itemsByBVID[bvid]...)
			sort.SliceStable(retained, func(i, j int) bool { return retained[i].PageNumber < retained[j].PageNumber })
			if len(retained) == 0 {
				key := stableBiliRemoteKey(bvid, 0)
				retained = []models.PlaylistSourceItem{{
					ID:        deterministicID("source-item", source.ID+":"+key),
					SourceID:  source.ID,
					RemoteKey: key,
					BVID:      bvid,
					State:     "pending",
				}}
			}
			for _, item := range retained {
				item.Position = position
				item.State = "pending"
				item.LastSeenAt = time.Now()
				draft.items = append(draft.items, item)
				if item.SongID != "" {
					draft.refs = append(draft.refs, models.SongRef{FavoriteID: source.FavoriteID, SongID: item.SongID, Position: position})
				}
				position++
			}
			draft.pendingCount++
			continue
		}
		for _, page := range resolution.video.Pages {
			key := stableBiliRemoteKey(bvid, page.Page)
			existingItem := itemsByKey[key]
			song, err := s.songForRemotePage(existingItem, resolution.video, page)
			if err != nil {
				return playlistSyncDraft{}, err
			}
			draft.songs = append(draft.songs, song)
			itemID := existingItem.ID
			if itemID == "" {
				itemID = deterministicID("source-item", source.ID+":"+key)
			}
			item := models.PlaylistSourceItem{
				ID:         itemID,
				SourceID:   source.ID,
				RemoteKey:  key,
				BVID:       bvid,
				PageNumber: page.Page,
				SongID:     song.ID,
				Position:   position,
				State:      "ready",
				LastSeenAt: time.Now(),
			}
			draft.items = append(draft.items, item)
			draft.refs = append(draft.refs, models.SongRef{FavoriteID: source.FavoriteID, SongID: song.ID, Position: position})
			position++
		}
	}
	return draft, nil
}

func (s *Service) songForRemotePage(existing models.PlaylistSourceItem, video models.CompleteVideoInfo, page models.PageInfo) (models.Song, error) {
	if existing.SongID != "" {
		var song models.Song
		if err := s.db.First(&song, "id = ?", existing.SongID).Error; err == nil {
			return song, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Song{}, err
		}
	}
	var song models.Song
	query := s.db.Where("bvid = ? AND (page_number = ? OR (page_number = 0 AND ? = 1))", video.BVID, page.Page, page.Page).
		Order("page_number DESC").Limit(1).Find(&song)
	if query.Error == nil && query.RowsAffected > 0 {
		return song, nil
	}
	if query.Error != nil {
		return models.Song{}, query.Error
	}
	now := time.Now()
	return models.Song{
		ID:         deterministicID("bili-song", stableBiliRemoteKey(video.BVID, page.Page)),
		BVID:       video.BVID,
		Name:       formatSongName(video.Title, page.Page, page.Part, len(video.Pages)),
		Singer:     video.Author,
		Cover:      video.Cover,
		PageNumber: page.Page,
		PageTitle:  page.Part,
		VideoTitle: video.Title,
		TotalPages: len(video.Pages),
		Duration:   page.Duration,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (s *Service) commitPlaylistSync(source models.PlaylistSource, run *models.PlaylistSyncRun, draft playlistSyncDraft) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var lockedCount int64
		if err := tx.Model(&models.PlaylistSource{}).Where("id = ? AND locked = ?", source.ID, true).Count(&lockedCount).Error; err != nil {
			return err
		}
		if lockedCount == 0 {
			return domainError(ErrorCodePlaylistDetached, "歌单已转换为本地歌单，同步结果未写入", nil)
		}
		var oldRefs []models.SongRef
		if err := tx.Where("favorite_id = ?", source.FavoriteID).Find(&oldRefs).Error; err != nil {
			return err
		}
		if len(draft.songs) > 0 {
			if err := tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&draft.songs).Error; err != nil {
				return err
			}
		}
		if len(draft.items) > 0 {
			if err := tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&draft.items).Error; err != nil {
				return err
			}
			ids := make([]string, 0, len(draft.items))
			for _, item := range draft.items {
				ids = append(ids, item.ID)
			}
			if err := tx.Where("source_id = ? AND id NOT IN ?", source.ID, ids).Delete(&models.PlaylistSourceItem{}).Error; err != nil {
				return err
			}
		} else if err := tx.Where("source_id = ?", source.ID).Delete(&models.PlaylistSourceItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("favorite_id = ?", source.FavoriteID).Delete(&models.SongRef{}).Error; err != nil {
			return err
		}
		if len(draft.refs) > 0 {
			if err := tx.Create(&draft.refs).Error; err != nil {
				return err
			}
		}
		added, removed := membershipDiff(oldRefs, draft.refs)
		now := time.Now()
		state := "synced"
		if draft.pendingCount > 0 {
			state = "stale"
		}
		if err := tx.Model(&models.PlaylistSource{}).Where("id = ?", source.ID).Updates(map[string]interface{}{
			"sync_state":         state,
			"last_error_code":    "",
			"last_error_message": "",
			"last_snapshot_hash": draft.snapshotHash,
			"remote_title":       draft.remoteTitle,
			"remote_count":       draft.remoteCount,
			"last_synced_at":     now,
			"updated_at":         now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Favorite{}).Where("id = ?", source.FavoriteID).Update("updated_at", now).Error; err != nil {
			return err
		}
		run.Status = state
		run.SnapshotComplete = true
		run.RemoteCount = draft.remoteCount
		run.ResolvedCount = len(draft.refs)
		run.AddedCount = added
		run.RemovedCount = removed
		run.SkippedCount = draft.skippedCount
		run.PendingCount = draft.pendingCount
		run.FinishedAt = &now
		return tx.Save(run).Error
	})
}

func (s *Service) failPlaylistSync(sourceID, runID, code, message string, cause error) error {
	now := time.Now()
	displayMessage := message
	var domain *DomainError
	if errors.As(cause, &domain) && domain.Message != "" && domain.Message != message {
		displayMessage += ": " + domain.Message
	}
	state := syncFailureState(code)
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.PlaylistSource{}).Where("id = ? AND locked = ?", sourceID, true).Updates(map[string]interface{}{
			"sync_state":         state,
			"last_error_code":    code,
			"last_error_message": displayMessage,
			"updated_at":         now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&models.PlaylistSyncRun{}).Where("id = ?", runID).Updates(map[string]interface{}{
			"status":            state,
			"snapshot_complete": false,
			"error_code":        code,
			"error_message":     displayMessage,
			"finished_at":       now,
		}).Error
	})
}

func errorCodeOr(err error, fallback string) string {
	var domain *DomainError
	if errors.As(err, &domain) && domain.Code != "" {
		return domain.Code
	}
	return fallback
}

func syncFailureState(code string) string {
	switch code {
	case ErrorCodeSyncAuth, ErrorCodeSyncPermission:
		return "auth-required"
	case ErrorCodeSyncIncomplete, ErrorCodeSyncRateLimited, ErrorCodeProvider, ErrorCodeSyncInterrupted:
		return "stale"
	default:
		return "error"
	}
}

func (s *Service) GetFavoriteSyncStatus(favoriteID string) (models.PlaylistSyncStatus, error) {
	var source models.PlaylistSource
	if err := s.db.First(&source, "favorite_id = ?", favoriteID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.PlaylistSyncStatus{}, nil
		}
		return models.PlaylistSyncStatus{}, err
	}
	if !source.Locked || source.DetachedAt != nil {
		return models.PlaylistSyncStatus{}, nil
	}
	status := models.PlaylistSyncStatus{Source: &source}
	var run models.PlaylistSyncRun
	if err := s.db.Where("source_id = ?", source.ID).Order("started_at DESC").First(&run).Error; err == nil {
		status.Run = &run
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return status, err
	}
	return status, nil
}

// SyncStaleBiliFavorites refreshes mirrors older than maxAgeMinutes.
func (s *Service) SyncStaleBiliFavorites(maxAgeMinutes int) ([]models.PlaylistSyncStatus, error) {
	if maxAgeMinutes <= 0 {
		maxAgeMinutes = 360
	}
	cutoff := time.Now().Add(-time.Duration(maxAgeMinutes) * time.Minute)
	var sources []models.PlaylistSource
	if err := s.db.Where("provider = ? AND locked = ? AND (last_synced_at IS NULL OR last_synced_at < ?)", biliPlaylistProvider, true, cutoff).Find(&sources).Error; err != nil {
		return nil, err
	}
	statuses := make([]models.PlaylistSyncStatus, 0, len(sources))
	for _, source := range sources {
		status, err := s.syncFavorite(source.FavoriteID, true)
		if err != nil {
			status, _ = s.GetFavoriteSyncStatus(source.FavoriteID)
		}
		statuses = append(statuses, status)
	}
	return statuses, nil
}

// RecoverInterruptedPlaylistSyncs closes audit rows left running by a previous
// process and keeps the last committed mirror available for offline playback.
func (s *Service) RecoverInterruptedPlaylistSyncs() error {
	now := time.Now()
	return s.db.Transaction(func(tx *gorm.DB) error {
		var sourceIDs []string
		if err := tx.Model(&models.PlaylistSyncRun{}).Where("status = ?", "running").Distinct("source_id").Pluck("source_id", &sourceIDs).Error; err != nil {
			return fmt.Errorf("find interrupted sync runs: %w", err)
		}
		if len(sourceIDs) == 0 {
			return nil
		}
		if err := tx.Model(&models.PlaylistSyncRun{}).Where("status = ?", "running").Updates(map[string]interface{}{
			"status":        "stale",
			"error_code":    ErrorCodeSyncInterrupted,
			"error_message": "上次同步被应用退出中断，本地歌单保持原状",
			"finished_at":   now,
		}).Error; err != nil {
			return fmt.Errorf("mark interrupted sync runs: %w", err)
		}
		return tx.Model(&models.PlaylistSource{}).Where("id IN ? AND locked = ?", sourceIDs, true).Updates(map[string]interface{}{
			"sync_state":         "stale",
			"last_error_code":    ErrorCodeSyncInterrupted,
			"last_error_message": "上次同步被应用退出中断，本地歌单保持原状",
			"updated_at":         now,
		}).Error
	})
}

// DetachFavoriteSource irreversibly converts a mirror into a local playlist.
func (s *Service) DetachFavoriteSource(favoriteID string, acknowledged bool) (models.Favorite, error) {
	if !acknowledged {
		return models.Favorite{}, fmt.Errorf("必须确认不可逆转换")
	}
	now := time.Now()
	detached := false
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&models.PlaylistSource{}).Where("favorite_id = ? AND locked = ?", favoriteID, true).Updates(map[string]interface{}{
			"provider":           "",
			"remote_id":          "",
			"remote_owner_id":    "",
			"remote_title":       "",
			"locked":             false,
			"detached_at":        now,
			"sync_state":         "detached",
			"last_error_code":    "",
			"last_error_message": "",
			"last_snapshot_hash": "",
			"remote_count":       0,
			"last_synced_at":     nil,
			"last_attempted_at":  nil,
			"updated_at":         now,
		})
		if result.Error != nil {
			return result.Error
		}
		detached = result.RowsAffected > 0
		if !detached {
			return nil
		}
		return tx.Model(&models.Favorite{}).Where("id = ?", favoriteID).Update("updated_at", now).Error
	}); err != nil {
		return models.Favorite{}, err
	}
	if !detached {
		return models.Favorite{}, domainError(ErrorCodePlaylistDetached, "歌单已是本地歌单，无法重新关联", nil)
	}
	var favorite models.Favorite
	if err := s.db.Preload("SongIDs", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Preload("Source", "locked = ?", true).First(&favorite, "id = ?", favoriteID).Error; err != nil {
		return models.Favorite{}, err
	}
	return favorite, nil
}

func (s *Service) loadLockedPlaylistSource(favoriteID string) (models.PlaylistSource, error) {
	var source models.PlaylistSource
	if err := s.db.First(&source, "favorite_id = ?", favoriteID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return source, fmt.Errorf("歌单没有可同步来源")
		}
		return source, err
	}
	if !source.Locked || source.DetachedAt != nil {
		return source, domainError(ErrorCodePlaylistDetached, "歌单已转换为本地歌单，重新关联需要再次导入", nil)
	}
	return source, nil
}

func (s *Service) resolveCompleteVideoInfo(bvid string) (models.CompleteVideoInfo, error) {
	if s.videoInfoResolver != nil {
		return s.videoInfoResolver(bvid)
	}
	return s.getCompleteVideoInfo(bvid)
}

func stableBiliRemoteKey(bvid string, page int) string {
	if page <= 0 {
		return "bilibili:" + bvid + ":pending"
	}
	return fmt.Sprintf("bilibili:%s:p%d", bvid, page)
}

func deterministicID(prefix, value string) string {
	sum := sha256.Sum256([]byte(value))
	return prefix + "-" + hex.EncodeToString(sum[:12])
}

func snapshotHash(items []biliFavoriteResource) string {
	parts := make([]string, 0, len(items))
	for index, item := range items {
		parts = append(parts, fmt.Sprintf("%d:%d:%d:%s", index, item.ID, item.Type, item.BVID))
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return hex.EncodeToString(sum[:])
}

func membershipDiff(oldRefs, newRefs []models.SongRef) (int, int) {
	oldSet := make(map[string]struct{}, len(oldRefs))
	newSet := make(map[string]struct{}, len(newRefs))
	for _, ref := range oldRefs {
		oldSet[ref.SongID] = struct{}{}
	}
	for _, ref := range newRefs {
		newSet[ref.SongID] = struct{}{}
	}
	added, removed := 0, 0
	for id := range newSet {
		if _, exists := oldSet[id]; !exists {
			added++
		}
	}
	for id := range oldSet {
		if _, exists := newSet[id]; !exists {
			removed++
		}
	}
	return added, removed
}
