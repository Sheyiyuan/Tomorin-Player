package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	lyricparser "half-beat-player/internal/lyrics"
	"half-beat-player/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	lyricAutoApplyThreshold = 0.92
	lyricAutoApplyLead      = 0.12
)

var structuredArtistPattern = regexp.MustCompile(`(?im)(?:^|\s)(?:歌手|演唱|原唱)\s*[:：]\s*([^\n\r;；|]{1,120})`)

type lyricSearchTaskState struct {
	task models.LyricSearchTask
}

// SearchLyrics starts or reuses provider work and returns immediately. A
// running task is shared per song; provider results may still populate that
// song's cache after the UI stops polling it.
func (s *Service) SearchLyrics(request models.LyricSearchRequest) (models.LyricSearchTask, error) {
	request.SongID = strings.TrimSpace(request.SongID)
	if request.SongID == "" {
		return models.LyricSearchTask{}, fmt.Errorf("song id is required")
	}
	if strings.TrimSpace(request.RequestID) == "" {
		request.RequestID = uuid.NewString()
	}

	s.lyricTaskMu.Lock()
	if s.lyricTasks == nil {
		s.lyricTasks = make(map[string]*lyricSearchTaskState)
	}
	if s.lyricTaskBySong == nil {
		s.lyricTaskBySong = make(map[string]string)
	}
	if runningID := s.lyricTaskBySong[request.SongID]; runningID != "" {
		if running := s.lyricTasks[runningID]; running != nil && (running.task.Status == "queued" || running.task.Status == "running") {
			task := copyLyricSearchTask(running.task)
			s.lyricTaskMu.Unlock()
			return task, nil
		}
	}
	state := &lyricSearchTaskState{task: models.LyricSearchTask{
		RequestID: request.RequestID,
		SongID:    request.SongID,
		Status:    "queued",
		StartedAt: time.Now(),
	}}
	s.lyricTasks[request.RequestID] = state
	s.lyricTaskBySong[request.SongID] = request.RequestID
	task := copyLyricSearchTask(state.task)
	s.lyricTaskMu.Unlock()

	go s.runLyricSearchTask(request)
	return task, nil
}

// GetLyricSearch returns a stable task snapshot for polling clients.
func (s *Service) GetLyricSearch(requestID string) (models.LyricSearchTask, error) {
	s.lyricTaskMu.Lock()
	defer s.lyricTaskMu.Unlock()
	state := s.lyricTasks[strings.TrimSpace(requestID)]
	if state == nil {
		return models.LyricSearchTask{}, domainError(ErrorCodeLyricNotFound, "歌词搜索任务不存在或已失效", nil)
	}
	return copyLyricSearchTask(state.task), nil
}

func (s *Service) runLyricSearchTask(request models.LyricSearchRequest) {
	s.lyricTaskMu.Lock()
	state := s.lyricTasks[request.RequestID]
	if state == nil {
		s.lyricTaskMu.Unlock()
		return
	}
	state.task.Status = "running"
	s.lyricTaskMu.Unlock()

	result, err := s.searchLyricsNow(request)
	now := time.Now()
	s.lyricTaskMu.Lock()
	state = s.lyricTasks[request.RequestID]
	if state != nil {
		state.task.FinishedAt = &now
		if err != nil {
			state.task.Status = "failed"
			state.task.ErrorCode, state.task.ErrorMessage, state.task.Retryable, state.task.ErrorDetails = taskErrorFields(err, ErrorCodeProvider)
		} else {
			state.task.Status = "succeeded"
			state.task.Result = &result
		}
	}
	if s.lyricTaskBySong[request.SongID] == request.RequestID {
		delete(s.lyricTaskBySong, request.SongID)
	}
	s.lyricTaskMu.Unlock()
}

func copyLyricSearchTask(source models.LyricSearchTask) models.LyricSearchTask {
	copy := source
	copy.ErrorDetails = cloneStringMap(source.ErrorDetails)
	if source.Result != nil {
		result := *source.Result
		copy.Result = &result
	}
	return copy
}

// searchLyricsNow fetches and persists automatic candidates. It never replaces
// a manual selection and echoes request identity for stale-result protection.
func (s *Service) searchLyricsNow(request models.LyricSearchRequest) (models.LyricSearchResult, error) {
	result := models.LyricSearchResult{SongID: request.SongID, RequestID: request.RequestID}
	var song models.Song
	if err := s.db.First(&song, "id = ?", request.SongID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return result, domainError(ErrorCodeLyricNotFound, "歌曲不存在，无法获取歌词", err)
		}
		return result, fmt.Errorf("load song: %w", err)
	}
	view, err := s.GetActiveLyric(song.ID)
	if err != nil {
		return result, err
	}
	if view.ManualLocked {
		result.View = view
		result.Message = "正在使用本地歌词，未执行自动覆盖"
		return result, nil
	}
	ownerName := song.Singer
	searchSong, videoDescription := s.enrichLyricSearchEvidence(song)

	candidates := make([]models.LyricDocument, 0, 4)
	providerErrors := make([]error, 0, 2)
	if song.BVID != "" {
		biliCandidates, providerErr := s.cachedLyricProviderSearch(searchSong, "bilibili", request.Force, s.searchBiliSubtitleLyrics)
		candidates = append(candidates, biliCandidates...)
		if providerErr != nil {
			providerErrors = append(providerErrors, providerErr)
		}
	}
	lrcCandidates, providerErr := s.cachedLyricProviderSearch(searchSong, "lrclib", request.Force, s.searchLRCLIBLyrics)
	candidates = append(candidates, lrcCandidates...)
	if providerErr != nil {
		providerErrors = append(providerErrors, providerErr)
	}
	candidates = uniqueAvailableLyricDocuments(candidates)
	sort.SliceStable(candidates, func(i, j int) bool { return candidates[i].Confidence > candidates[j].Confidence })
	if len(candidates) == 0 && len(providerErrors) > 0 {
		return result, domainErrorWithDetails(ErrorCodeProvider, "歌词服务暂时不可用，已有歌词未受影响", true, map[string]string{
			"providersFailed": strconv.Itoa(len(providerErrors)),
		}, errors.Join(providerErrors...))
	}
	if err := s.attachLyricTargetEvidence(candidates, searchSong, ownerName, videoDescription); err != nil {
		return result, err
	}

	if len(candidates) > 0 {
		if shouldAutoApplyLyric(candidates) {
			latest, loadErr := s.GetActiveLyric(song.ID)
			if loadErr != nil {
				return result, loadErr
			}
			if !latest.ManualLocked {
				if err := s.activateLyricDocument(song.ID, candidates[0].ID, false); err != nil {
					return result, err
				}
				result.AutoApplied = true
			}
		}
	}
	result.View, err = s.GetActiveLyric(song.ID)
	if err != nil {
		return result, err
	}
	if len(candidates) == 0 {
		result.Message = "暂未找到可靠歌词，请手动导入"
	} else if !result.AutoApplied {
		result.Message = "暂未找到可靠歌词，请手动导入"
	} else {
		result.Message = "已自动采用可靠歌词"
	}
	return result, nil
}

func (s *Service) enrichLyricSearchEvidence(song models.Song) (models.Song, string) {
	if strings.TrimSpace(song.BVID) == "" {
		return song, ""
	}
	info, err := s.getVideoInfo(song.BVID)
	if err != nil {
		return song, ""
	}
	if strings.TrimSpace(song.VideoTitle) == "" {
		song.VideoTitle = info.Title
	}
	if artist := extractStructuredArtist(info.Description); artist != "" && strings.TrimSpace(song.Singer) == "" {
		song.Singer = artist
	}
	return song, info.Description
}

func (s *Service) attachLyricTargetEvidence(documents []models.LyricDocument, song models.Song, ownerName, description string) error {
	queries := lyricparser.BuildSearchQueries(song.PageTitle, song.VideoTitle, song.Name, song.Singer, song.TotalPages)
	targetTitle := song.Name
	targetArtist := song.Singer
	if len(queries) > 0 {
		targetTitle = queries[0].Title
		targetArtist = queries[0].Artist
	}
	for index := range documents {
		if documents[index].Evidence == nil {
			documents[index].Evidence = make(map[string]string)
		}
		documents[index].Evidence["targetTitle"] = targetTitle
		documents[index].Evidence["targetArtist"] = targetArtist
		documents[index].Evidence["ownerName"] = ownerName
		if description != "" {
			documents[index].Evidence["videoDescription"] = description
		}
		if err := s.db.Model(&documents[index]).Select("Evidence").Updates(&documents[index]).Error; err != nil {
			return fmt.Errorf("save lyric target evidence: %w", err)
		}
	}
	return nil
}

func normalizeVideoDescription(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	lines := strings.Split(value, "\n")
	for index := range lines {
		lines[index] = strings.Join(strings.Fields(lines[index]), " ")
	}
	value = strings.TrimSpace(strings.Join(lines, "\n"))
	if len(value) <= 4*1024 {
		return value
	}
	value = value[:4*1024]
	for !utf8.ValidString(value) {
		value = value[:len(value)-1]
	}
	return value
}

func extractStructuredArtist(description string) string {
	match := structuredArtistPattern.FindStringSubmatch(description)
	if len(match) != 2 {
		return ""
	}
	return strings.TrimSpace(match[1])
}

func (s *Service) cachedLyricProviderSearch(song models.Song, provider string, force bool, search func(models.Song) ([]models.LyricDocument, error)) ([]models.LyricDocument, error) {
	evidenceHash := lyricEvidenceHash(song)
	cacheKey := provider + ":" + evidenceHash
	cutoff := time.Now().Add(-24 * time.Hour)
	var cached []models.LyricDocument
	if !force {
		if err := s.db.Where("song_id = ? AND source = ? AND is_reliable = ? AND rejected_at IS NULL AND updated_at >= ?", song.ID, provider, true, cutoff).
			Order("confidence DESC, updated_at DESC").Limit(10).Find(&cached).Error; err != nil {
			return nil, fmt.Errorf("load %s lyric cache: %w", provider, err)
		}
		matching := cached[:0]
		for _, document := range cached {
			if document.Evidence["evidenceHash"] == evidenceHash {
				matching = append(matching, document)
			}
		}
		if len(matching) > 0 {
			return matching, nil
		}
		s.lyricProviderMu.Lock()
		if s.lyricNegativeCache == nil {
			s.lyricNegativeCache = make(map[string]time.Time)
		}
		negativeUntil := s.lyricNegativeCache[cacheKey]
		s.lyricProviderMu.Unlock()
		if time.Now().Before(negativeUntil) {
			return nil, nil
		}
	}

	s.waitForLyricProvider(provider)
	documents, err := search(song)
	if err == nil {
		for index := range documents {
			if documents[index].Evidence == nil {
				documents[index].Evidence = make(map[string]string)
			}
			documents[index].Evidence["evidenceHash"] = evidenceHash
			if updateErr := s.db.Model(&documents[index]).Select("Evidence").Updates(&documents[index]).Error; updateErr != nil {
				return nil, fmt.Errorf("save %s lyric evidence hash: %w", provider, updateErr)
			}
		}
	}
	if err != nil || len(documents) == 0 {
		s.lyricProviderMu.Lock()
		if s.lyricNegativeCache == nil {
			s.lyricNegativeCache = make(map[string]time.Time)
		}
		s.lyricNegativeCache[cacheKey] = time.Now().Add(10 * time.Minute)
		s.lyricProviderMu.Unlock()
	}
	return documents, err
}

func (s *Service) waitForLyricProvider(provider string) {
	s.lyricProviderMu.Lock()
	if s.lyricProviderLast == nil {
		s.lyricProviderLast = make(map[string]time.Time)
	}
	now := time.Now()
	reserved := now
	if next := s.lyricProviderLast[provider].Add(500 * time.Millisecond); next.After(reserved) {
		reserved = next
	}
	s.lyricProviderLast[provider] = reserved
	wait := time.Until(reserved)
	s.lyricProviderMu.Unlock()
	if wait > 0 {
		s.sleepForLyrics(wait)
	}
}

func lyricEvidenceHash(song models.Song) string {
	return lyricContentHash(strings.Join([]string{
		song.ID,
		song.BVID,
		strconv.Itoa(song.PageNumber),
		song.PageTitle,
		song.VideoTitle,
		song.Name,
		song.Singer,
		strconv.FormatInt(song.Duration, 10),
	}, "\x00"))
}

func shouldAutoApplyLyric(candidates []models.LyricDocument) bool {
	if len(candidates) == 0 || !candidates[0].IsReliable || candidates[0].RejectedAt != nil || candidates[0].Confidence < lyricAutoApplyThreshold {
		return false
	}
	if len(candidates) == 1 {
		return true
	}
	if candidates[0].Source == "bilibili" {
		biliCount := 0
		for _, candidate := range candidates {
			if candidate.Source == "bilibili" {
				biliCount++
			}
		}
		if biliCount == 1 {
			return true
		}
	}
	return candidates[0].Confidence-candidates[1].Confidence+1e-9 >= lyricAutoApplyLead
}

func uniqueAvailableLyricDocuments(documents []models.LyricDocument) []models.LyricDocument {
	result := make([]models.LyricDocument, 0, len(documents))
	seen := make(map[string]struct{}, len(documents))
	for _, document := range documents {
		if document.IsManual || !document.IsReliable || document.RejectedAt != nil {
			continue
		}
		if _, exists := seen[document.ID]; exists {
			continue
		}
		seen[document.ID] = struct{}{}
		result = append(result, document)
	}
	return result
}

type biliSubtitleCue struct {
	From    float64 `json:"from"`
	To      float64 `json:"to"`
	Content string  `json:"content"`
}

func (s *Service) searchBiliSubtitleLyrics(song models.Song) ([]models.LyricDocument, error) {
	page := song.PageNumber
	if page < 1 {
		page = 1
	}
	cid, _, duration, err := s.getCidFromBVID(song.BVID, page)
	if err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf("https://api.bilibili.com/x/player/v2?bvid=%s&cid=%d", url.QueryEscape(song.BVID), cid)
	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com/")
	resp, err := s.doLyricProviderRequest(s.httpClient, req)
	if err != nil {
		return nil, fmt.Errorf("fetch Bilibili subtitles: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Bilibili subtitle HTTP %d", resp.StatusCode)
	}
	var payload struct {
		Code int `json:"code"`
		Data struct {
			Subtitle struct {
				Subtitles []struct {
					ID          int64  `json:"id"`
					IDString    string `json:"id_str"`
					Language    string `json:"lan"`
					LanguageDoc string `json:"lan_doc"`
					URL         string `json:"subtitle_url"`
					AIType      int    `json:"ai_type"`
				} `json:"subtitles"`
			} `json:"subtitle"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&payload); err != nil || payload.Code != 0 {
		return nil, fmt.Errorf("decode Bilibili subtitles")
	}
	documents := make([]models.LyricDocument, 0, len(payload.Data.Subtitle.Subtitles))
	for _, subtitle := range payload.Data.Subtitle.Subtitles {
		languageLabel := strings.ToLower(subtitle.LanguageDoc)
		if subtitle.AIType != 0 || strings.Contains(languageLabel, "自动") || strings.Contains(languageLabel, "机器") {
			continue
		}
		s.waitForLyricProvider("bilibili")
		rawURL := normalizeBiliPic(subtitle.URL)
		subtitleReq, _ := http.NewRequest(http.MethodGet, rawURL, nil)
		subtitleResp, err := s.doLyricProviderRequest(s.lyricHTTPClient(), subtitleReq)
		if err != nil {
			continue
		}
		if subtitleResp.StatusCode < http.StatusOK || subtitleResp.StatusCode >= http.StatusMultipleChoices {
			subtitleResp.Body.Close()
			continue
		}
		var content struct {
			Body []biliSubtitleCue `json:"body"`
		}
		decodeErr := json.NewDecoder(io.LimitReader(subtitleResp.Body, 2<<20)).Decode(&content)
		subtitleResp.Body.Close()
		if decodeErr != nil || len(content.Body) == 0 {
			continue
		}
		var builder strings.Builder
		punctuationOnly := 0
		nonEmptyCues := make([]biliSubtitleCue, 0, len(content.Body))
		for _, cue := range content.Body {
			text := strings.TrimSpace(cue.Content)
			if text == "" {
				continue
			}
			if strings.Trim(text, " []【】()（）,.!?，。！？…-—音乐掌声") == "" {
				punctuationOnly++
			}
			nonEmptyCues = append(nonEmptyCues, cue)
			fmt.Fprintf(&builder, "[%02d:%05.2f]%s\n", int(cue.From)/60, cue.From-float64(int(cue.From)/60*60), text)
		}
		lyricLike, coverage := subtitleLooksLikeLyrics(nonEmptyCues, duration, punctuationOnly)
		if !lyricLike {
			continue
		}
		preview, err := previewLyric([]byte(builder.String()), ".lrc")
		if err != nil || strings.TrimSpace(preview.Text) == "" {
			continue
		}
		providerRef := subtitle.IDString
		if providerRef == "" {
			providerRef = fmt.Sprint(subtitle.ID)
		}
		document, err := s.saveParsedLyricDocument(song.ID, preview, "bilibili", "Bilibili 字幕 · "+subtitle.LanguageDoc, 0.97, false, true, providerRef, 0)
		if err == nil && document.RejectedAt == nil {
			document.SourceURL = rawURL
			document.Evidence = map[string]string{
				"bvid":      song.BVID,
				"cid":       strconv.FormatInt(cid, 10),
				"language":  subtitle.Language,
				"cueCount":  strconv.Itoa(len(nonEmptyCues)),
				"coverage":  fmt.Sprintf("%.3f", coverage),
				"lyricLike": strconv.FormatBool(lyricLike),
				"aiType":    strconv.Itoa(subtitle.AIType),
			}
			document.RetrievedAt = time.Now()
			document.UpdatedAt = document.RetrievedAt
			if updateErr := s.db.Model(&document).Select("SourceURL", "Evidence", "RetrievedAt", "UpdatedAt").Updates(&document).Error; updateErr != nil {
				return nil, fmt.Errorf("save Bilibili lyric evidence: %w", updateErr)
			}
			documents = append(documents, document)
		}
	}
	return documents, nil
}

func subtitleLooksLikeLyrics(cues []biliSubtitleCue, durationSeconds int64, punctuationOnly int) (bool, float64) {
	if len(cues) == 0 || durationSeconds <= 0 {
		return false, 0
	}
	durations := make([]float64, 0, len(cues))
	lineLengths := make([]int, 0, len(cues))
	totalDuration := 0.0
	overlaps := 0
	ordered := true
	sentenceEndings := 0
	longLines := 0
	repeatedLines := 0
	seenLines := make(map[string]struct{}, len(cues))
	for index, cue := range cues {
		cueDuration := cue.To - cue.From
		if cueDuration < 0 {
			ordered = false
			cueDuration = 0
		}
		durations = append(durations, cueDuration)
		text := strings.TrimSpace(cue.Content)
		lineLength := utf8.RuneCountInString(text)
		lineLengths = append(lineLengths, lineLength)
		if lineLength > 32 {
			longLines++
		}
		if strings.HasSuffix(text, "。") || strings.HasSuffix(text, "！") || strings.HasSuffix(text, "？") || strings.HasSuffix(text, ".") || strings.HasSuffix(text, "!") || strings.HasSuffix(text, "?") {
			sentenceEndings++
		}
		normalizedLine := strings.ToLower(strings.Trim(text, " \t[]【】()（）,.!?，。！？…-—"))
		if utf8.RuneCountInString(normalizedLine) >= 2 {
			if _, exists := seenLines[normalizedLine]; exists {
				repeatedLines++
			} else {
				seenLines[normalizedLine] = struct{}{}
			}
		}
		totalDuration += cueDuration
		if index > 0 {
			if cue.From < cues[index-1].From {
				ordered = false
			}
			if cue.From < cues[index-1].To {
				overlaps++
			}
		}
	}
	sort.Float64s(durations)
	sort.Ints(lineLengths)
	median := durations[len(durations)/2]
	if len(durations)%2 == 0 {
		median = (durations[len(durations)/2-1] + durations[len(durations)/2]) / 2
	}
	coverage := totalDuration / float64(durationSeconds)
	punctuationRatio := float64(punctuationOnly) / float64(len(cues))
	overlapRatio := float64(overlaps) / float64(max(1, len(cues)-1))
	medianLineLength := lineLengths[len(lineLengths)/2]
	sentenceRatio := float64(sentenceEndings) / float64(len(cues))
	longLineRatio := float64(longLines) / float64(len(cues))
	contentLooksLikeLyrics := (repeatedLines > 0 && sentenceRatio <= 0.35) || (medianLineLength <= 18 && sentenceRatio <= 0.15)
	return len(cues) >= 10 && coverage >= 0.45 && coverage <= 1.05 && median >= 1.2 && median <= 12 && punctuationRatio < 0.20 && longLineRatio <= 0.10 && ordered && overlapRatio < 0.20 && contentLooksLikeLyrics, coverage
}

type lrcLibTrack struct {
	ID           int     `json:"id"`
	TrackName    string  `json:"trackName"`
	ArtistName   string  `json:"artistName"`
	Duration     float64 `json:"duration"`
	PlainLyrics  string  `json:"plainLyrics"`
	SyncedLyrics string  `json:"syncedLyrics"`
}

func (s *Service) searchLRCLIBLyrics(song models.Song) ([]models.LyricDocument, error) {
	queries := lyricparser.BuildSearchQueries(song.PageTitle, song.VideoTitle, song.Name, song.Singer, song.TotalPages)
	tracks := make([]lrcLibTrack, 0, 10)
	seenTracks := make(map[int]struct{})
	for index, searchQuery := range queries {
		if index > 0 {
			s.waitForLyricProvider("lrclib")
		}
		query := url.Values{}
		query.Set("track_name", searchQuery.Title)
		if searchQuery.Artist != "" {
			query.Set("artist_name", searchQuery.Artist)
		}
		endpoint := "https://lrclib.net/api/search?" + query.Encode()
		req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
		req.Header.Set("User-Agent", "HalfBeatPlayer/1.2")
		resp, err := s.doLyricProviderRequest(s.lyricHTTPClient(), req)
		if err != nil {
			return nil, fmt.Errorf("search LRCLIB: %w", err)
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			return nil, domainError(ErrorCodeProvider, "LRCLIB 请求过于频繁", nil)
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			resp.Body.Close()
			return nil, fmt.Errorf("LRCLIB HTTP %d", resp.StatusCode)
		}
		var responseTracks []lrcLibTrack
		decodeErr := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&responseTracks)
		resp.Body.Close()
		if decodeErr != nil {
			return nil, fmt.Errorf("decode LRCLIB response: %w", decodeErr)
		}
		for _, track := range responseTracks {
			if _, duplicate := seenTracks[track.ID]; duplicate {
				continue
			}
			seenTracks[track.ID] = struct{}{}
			tracks = append(tracks, track)
		}
	}
	documents := make([]models.LyricDocument, 0, min(len(tracks), 5))
	for _, track := range tracks {
		text := track.SyncedLyrics
		filename := ".lrc"
		if strings.TrimSpace(text) == "" {
			text = track.PlainLyrics
			filename = ".txt"
		}
		if strings.TrimSpace(text) == "" {
			continue
		}
		score := 0.0
		reliable := false
		for _, searchQuery := range queries {
			score = max(score, lyricparser.MatchScore(searchQuery.Title, searchQuery.Artist, int(song.Duration), track.TrackName, track.ArtistName, int(track.Duration), 0.75, 0.8))
			reliable = reliable || lyricparser.IsReliableMatch(searchQuery.Title, searchQuery.Artist, int(song.Duration), track.TrackName, track.ArtistName, int(track.Duration))
		}
		if !reliable || score < lyricAutoApplyThreshold {
			continue
		}
		preview, err := previewLyric([]byte(text), filename)
		if err != nil {
			continue
		}
		document, err := s.saveParsedLyricDocument(song.ID, preview, "lrclib", "LRCLIB", score, false, true, fmt.Sprint(track.ID), 0)
		if err == nil && document.RejectedAt == nil {
			document.SourceURL = fmt.Sprintf("https://lrclib.net/api/get/%d", track.ID)
			document.Evidence = map[string]string{
				"trackName":         track.TrackName,
				"artistName":        track.ArtistName,
				"candidateDuration": fmt.Sprintf("%.3f", track.Duration),
				"targetDuration":    strconv.FormatInt(song.Duration, 10),
			}
			document.RetrievedAt = time.Now()
			document.UpdatedAt = document.RetrievedAt
			if updateErr := s.db.Model(&document).Select("SourceURL", "Evidence", "RetrievedAt", "UpdatedAt").Updates(&document).Error; updateErr != nil {
				return nil, fmt.Errorf("save LRCLIB lyric evidence: %w", updateErr)
			}
			documents = append(documents, document)
		}
		if len(documents) == 5 {
			break
		}
	}
	return documents, nil
}

func (s *Service) lyricHTTPClient() *http.Client {
	if s.lyricsClient != nil {
		return s.lyricsClient
	}
	return &http.Client{Timeout: 15 * time.Second}
}

func (s *Service) doLyricProviderRequest(client *http.Client, request *http.Request) (*http.Response, error) {
	delays := append([]time.Duration(nil), s.lyricRetryDelays...)
	if len(delays) == 0 {
		delays = []time.Duration{0, time.Second, 3 * time.Second}
	}
	var lastErr error
	for attempt := range delays {
		if delays[attempt] > 0 {
			s.sleepForLyrics(delays[attempt])
		}
		response, err := client.Do(request.Clone(request.Context()))
		if err == nil && response.StatusCode != http.StatusTooManyRequests && response.StatusCode < http.StatusInternalServerError {
			return response, nil
		}
		if err != nil {
			lastErr = err
			continue
		}
		lastErr = fmt.Errorf("provider HTTP %d", response.StatusCode)
		if response.StatusCode == http.StatusTooManyRequests && attempt+1 < len(delays) {
			if seconds, parseErr := strconv.Atoi(response.Header.Get("Retry-After")); parseErr == nil && seconds > 0 && seconds <= 15 {
				delays[attempt+1] = time.Duration(seconds) * time.Second
			}
		}
		response.Body.Close()
	}
	return nil, lastErr
}

func (s *Service) sleepForLyrics(delay time.Duration) {
	if s.lyricSleep != nil {
		s.lyricSleep(delay)
		return
	}
	time.Sleep(delay)
}

func loadLyricPreference(tx *gorm.DB, songID string) (models.LyricPreference, error) {
	var preference models.LyricPreference
	err := tx.First(&preference, "song_id = ?", songID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.LyricPreference{SongID: songID}, nil
	}
	return preference, err
}
