package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"half-beat-player/internal/models"

	"gorm.io/gorm"
)

// 音频与封面存储相关常量
const (
	cacheDir     = "audio_cache" // 被动缓存
	downloadsDir = "downloads"   // 主动下载
	coversDir    = "covers"      // 封面缓存
	// Legacy file name for historical migration only.
	playHistoryFile = "play_history.json"
)

// PlayHistory 记录上次播放的信息
type PlayHistory struct {
	FavoriteID string `json:"favoriteId"`
	SongID     string `json:"songId"`
	Timestamp  int64  `json:"timestamp"`
}

// ensureCoverCached 下载封面到本地缓存并返回本地路径
func (s *Service) ensureCoverCached(song *models.Song) (string, error) {
	if song == nil {
		return "", fmt.Errorf("song 不能为空")
	}

	if song.Cover == "" {
		return "", nil
	}

	// 已有本地封面且文件存在则复用
	if song.CoverLocal != "" {
		if path, ok := existingFileWithin(filepath.Join(s.dataDir, coversDir), song.CoverLocal); ok {
			_ = os.Chmod(path, 0o600)
			return path, nil
		}
	}

	dstDir := filepath.Join(s.dataDir, coversDir)
	if err := ensurePrivateDir(dstDir); err != nil {
		return "", fmt.Errorf("创建封面目录失败: %w", err)
	}

	ext := ".jpg"
	if u, err := url.Parse(song.Cover); err == nil {
		lower := strings.ToLower(u.Path)
		switch {
		case strings.HasSuffix(lower, ".png"):
			ext = ".png"
		case strings.HasSuffix(lower, ".webp"):
			ext = ".webp"
		case strings.HasSuffix(lower, ".jpeg"):
			ext = ".jpeg"
		case strings.HasSuffix(lower, ".jpg"):
			ext = ".jpg"
		}
	}

	dstPath := filepath.Join(dstDir, storageKey(song.ID)+ext)
	tmpPath := dstPath + ".part"
	_ = os.Remove(tmpPath)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", song.Cover, nil)
	if err != nil {
		return "", fmt.Errorf("创建封面请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := s.publicStreamClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载封面失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("封面下载失败，状态码: %d", resp.StatusCode)
	}
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if contentType != "" && !strings.HasPrefix(contentType, "image/") {
		return "", fmt.Errorf("封面响应不是图片: %s", contentType)
	}

	const maxCoverSize = 2 * 1024 * 1024 // 2MB 上限，避免异常大文件
	limited := io.LimitReader(resp.Body, maxCoverSize+1)
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", fmt.Errorf("创建封面文件失败: %w", err)
	}
	defer f.Close()

	written, err := io.Copy(f, limited)
	if err != nil {
		_ = f.Close()
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("写入封面失败: %w", err)
	}
	if written > maxCoverSize {
		_ = f.Close()
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("封面超过 %d 字节", maxCoverSize)
	}

	if err := os.Rename(tmpPath, dstPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("保存封面失败: %w", err)
	}

	song.CoverLocal = dstPath
	_ = s.db.Model(song).Update("cover_local", dstPath)

	return dstPath, nil
}

// DownloadSong downloads the audio file for the given song ID and returns the
// absolute path under dataDir/downloads.
func (s *Service) DownloadSong(songID string) (string, error) {
	if songID == "" {
		return "", fmt.Errorf("songID 不能为空")
	}

	// Lookup song
	var song models.Song
	if err := s.db.First(&song, "id = ?", songID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("未找到歌曲: %s", songID)
		}
		return "", fmt.Errorf("查询歌曲失败: %w", err)
	}

	filename := s.getLocalAudioFilename(song)
	if filename == "" {
		return "", fmt.Errorf("无法生成本地文件名")
	}
	dstDir := filepath.Join(s.dataDir, downloadsDir)
	if err := ensurePrivateDir(dstDir); err != nil {
		return "", fmt.Errorf("创建下载目录失败: %w", err)
	}
	dstPath := filepath.Join(dstDir, filename)

	cachePath := filepath.Join(s.dataDir, cacheDir, filename)
	usedCache, err := copyCompletedAudioCache(cachePath, dstPath)
	if err != nil {
		return "", err
	}
	if usedCache {
		fmt.Printf("[Download] 已复用播放缓存 %s\n", filename)
		return dstPath, nil
	}

	// 封面本地缓存（最佳努力，不阻断音频下载）
	if _, err := s.ensureCoverCached(&song); err != nil {
		fmt.Printf("[Download] 封面缓存失败: %v\n", err)
	}

	// Ensure we have a valid audio URL
	var audioURL string
	if song.StreamURL != "" && song.StreamURLExpiresAt.After(time.Now().Add(30*time.Second)) {
		if isLocalProxyAudioURL(song.StreamURL) {
			if song.BVID == "" {
				return "", fmt.Errorf("歌曲缺少 BVID，无法解析播放地址")
			}
			p := song.PageNumber
			if p <= 0 {
				p = 1
			}
			info, err := s.GetPlayURL(song.BVID, p)
			if err != nil {
				return "", err
			}
			audioURL = info.RawURL
		} else {
			audioURL = song.StreamURL
		}
	} else {
		if song.BVID == "" {
			return "", fmt.Errorf("歌曲缺少 BVID，无法解析播放地址")
		}
		p := song.PageNumber
		if p <= 0 {
			p = 1
		}
		info, err := s.GetPlayURL(song.BVID, p)
		if err != nil {
			return "", err
		}
		audioURL = info.RawURL
		song.StreamURL = info.ProxyURL
		song.StreamURLExpiresAt = info.ExpiresAt
		song.UpdatedAt = time.Now()
		_ = s.db.Save(&song).Error
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", audioURL, nil)
	if err != nil {
		return "", fmt.Errorf("创建下载请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := s.streamClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("下载失败，状态码: %d", resp.StatusCode)
	}

	contentLength := resp.ContentLength
	if contentLength <= 0 {
		return "", fmt.Errorf("无法获取文件大小信息，可能是服务器不支持")
	}

	tmpPath := dstPath + ".part"
	_ = os.Remove(tmpPath)

	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer f.Close()

	written, err := io.Copy(f, resp.Body)
	if err != nil {
		_ = f.Close()
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("写入文件失败: %w", err)
	}

	if written != contentLength {
		_ = f.Close()
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("下载不完整: 期望 %d 字节，实际 %d 字节", contentLength, written)
	}

	if err := f.Sync(); err != nil {
		_ = f.Close()
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("刷新文件失败: %w", err)
	}
	_ = f.Close()

	stat, err := os.Stat(tmpPath)
	if err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("文件验证失败: %w", err)
	}
	if stat.Size() != contentLength {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("文件大小验证失败: 期望 %d 字节，实际 %d 字节", contentLength, stat.Size())
	}

	if _, err := os.Stat(dstPath); err == nil {
		if err := os.Remove(dstPath); err != nil {
			_ = os.Remove(tmpPath)
			return "", fmt.Errorf("无法覆盖已存在的文件: %w", err)
		}
	}

	if err := os.Rename(tmpPath, dstPath); err != nil {
		_ = os.Remove(tmpPath)
		return "", fmt.Errorf("保存文件失败: %w", err)
	}

	stat, err = os.Stat(dstPath)
	if err != nil {
		_ = os.Remove(dstPath)
		return "", fmt.Errorf("最终验证失败: %w", err)
	}
	if stat.Size() != contentLength {
		_ = os.Remove(dstPath)
		return "", fmt.Errorf("最终大小验证失败: 期望 %d 字节，实际 %d 字节", contentLength, stat.Size())
	}

	fmt.Printf("[Download] 成功下载 %s: %d 字节\n", filename, contentLength)
	return dstPath, nil
}

func copyCompletedAudioCache(srcPath, dstPath string) (bool, error) {
	pathInfo, err := os.Lstat(srcPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("检查播放缓存失败: %w", err)
	}
	if !pathInfo.Mode().IsRegular() {
		return false, fmt.Errorf("播放缓存不是普通文件: %s", srcPath)
	}

	src, err := os.Open(srcPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("读取播放缓存失败: %w", err)
	}
	defer src.Close()

	srcInfo, err := src.Stat()
	if err != nil {
		return false, fmt.Errorf("检查播放缓存大小失败: %w", err)
	}
	if !srcInfo.Mode().IsRegular() || !os.SameFile(pathInfo, srcInfo) {
		return false, fmt.Errorf("播放缓存在读取时发生变化: %s", srcPath)
	}
	cacheSize := srcInfo.Size()
	if cacheSize == 0 {
		return false, nil
	}

	tmpPath := dstPath + ".part"
	if err := os.Remove(tmpPath); err != nil && !os.IsNotExist(err) {
		return false, fmt.Errorf("清理临时下载文件失败: %w", err)
	}
	dst, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return false, fmt.Errorf("创建临时下载文件失败: %w", err)
	}
	cleanup := func() {
		_ = dst.Close()
		_ = os.Remove(tmpPath)
	}

	written, err := io.Copy(dst, src)
	if err != nil {
		cleanup()
		return false, fmt.Errorf("复制播放缓存失败: %w", err)
	}
	if written != cacheSize {
		cleanup()
		return false, fmt.Errorf("播放缓存复制不完整: 期望 %d 字节，实际 %d 字节", cacheSize, written)
	}
	if err := dst.Chmod(0o600); err != nil {
		cleanup()
		return false, fmt.Errorf("设置下载文件权限失败: %w", err)
	}
	if err := dst.Sync(); err != nil {
		cleanup()
		return false, fmt.Errorf("刷新下载文件失败: %w", err)
	}
	if err := dst.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return false, fmt.Errorf("关闭下载文件失败: %w", err)
	}

	tmpInfo, err := os.Stat(tmpPath)
	if err != nil {
		_ = os.Remove(tmpPath)
		return false, fmt.Errorf("验证临时下载文件失败: %w", err)
	}
	if !tmpInfo.Mode().IsRegular() || tmpInfo.Size() != cacheSize {
		_ = os.Remove(tmpPath)
		return false, fmt.Errorf("临时下载文件大小验证失败: 期望 %d 字节，实际 %d 字节", cacheSize, tmpInfo.Size())
	}

	if err := os.Rename(tmpPath, dstPath); err != nil {
		_ = os.Remove(tmpPath)
		return false, fmt.Errorf("保存缓存下载文件失败: %w", err)
	}
	finalInfo, err := os.Stat(dstPath)
	if err != nil {
		_ = os.Remove(dstPath)
		return false, fmt.Errorf("验证缓存下载文件失败: %w", err)
	}
	if !finalInfo.Mode().IsRegular() || finalInfo.Size() != cacheSize {
		_ = os.Remove(dstPath)
		return false, fmt.Errorf("缓存下载文件大小验证失败: 期望 %d 字节，实际 %d 字节", cacheSize, finalInfo.Size())
	}
	return true, nil
}

func (s *Service) getLocalAudioFilename(song models.Song) string {
	return localAudioFilename(song)
}

// GetAudioCacheID returns the proxy cache key used by the local audio lookup.
func (s *Service) GetAudioCacheID(songID string) (string, error) {
	if songID == "" {
		return "", fmt.Errorf("songID 不能为空")
	}

	var song models.Song
	filename := ""
	if err := s.db.First(&song, "id = ?", songID).Error; err == nil {
		filename = localAudioFilename(song)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fmt.Errorf("查询歌曲失败: %w", err)
	} else {
		filename = storageKey(songID) + ".m4s"
	}
	if filename == "" {
		return "", fmt.Errorf("无法生成音频缓存键")
	}
	return strings.TrimSuffix(filename, filepath.Ext(filename)), nil
}

// GetLocalAudioURL returns a local proxy URL for a cached audio file if it exists,
// otherwise returns an empty string.
func (s *Service) GetLocalAudioURL(songID string) (string, error) {
	if songID == "" {
		return "", fmt.Errorf("songID 不能为空")
	}

	var song models.Song
	var candidates []string
	if err := s.db.First(&song, "id = ?", songID).Error; err == nil {
		candidates = localAudioCandidates(song)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fmt.Errorf("查询歌曲失败: %w", err)
	} else {
		candidates = []string{storageKey(songID) + ".m4s"}
		if legacy := legacyAudioFilename(songID); legacy != "" && legacy != candidates[0] {
			candidates = append(candidates, legacy)
		}
	}

	for _, candidate := range candidates {
		path := filepath.Join(s.dataDir, cacheDir, candidate)
		if _, err := os.Stat(path); err == nil {
			_ = os.Chmod(path, 0o600)
			return s.getLocalProxyURL(candidate), nil
		}
		path2 := filepath.Join(s.dataDir, downloadsDir, candidate)
		if _, err := os.Stat(path2); err == nil {
			_ = os.Chmod(path2, 0o600)
			return s.getLocalProxyURL(candidate), nil
		}
	}

	return "", nil
}

// OpenAudioCacheFolder opens the audio cache directory in the system file manager.
func (s *Service) OpenAudioCacheFolder() error {
	dir := filepath.Join(s.dataDir, cacheDir)
	if err := ensurePrivateDir(dir); err != nil {
		return fmt.Errorf("创建缓存目录失败: %w", err)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", dir)
	case "linux":
		cmd = exec.Command("xdg-open", dir)
	case "windows":
		cmd = exec.Command("explorer", dir)
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("打开文件管理器失败: %w", err)
	}
	return nil
}

// OpenDownloadsFolder opens the downloads directory in the system file manager.
func (s *Service) OpenDownloadsFolder() error {
	dir := filepath.Join(s.dataDir, downloadsDir)
	if err := ensurePrivateDir(dir); err != nil {
		return fmt.Errorf("创建下载目录失败: %w", err)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", dir)
	case "linux":
		cmd = exec.Command("xdg-open", dir)
	case "windows":
		cmd = exec.Command("explorer", dir)
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("打开文件管理器失败: %w", err)
	}
	return nil
}

func (s *Service) getLocalProxyURL(fileName string) string {
	if s.audioProxy != nil {
		return s.audioProxy.GetLocalProxyURL(fileName)
	}
	return ""
}

func isLocalProxyAudioURL(raw string) bool {
	target, err := url.Parse(raw)
	if err != nil || !strings.EqualFold(target.Scheme, "http") || target.Hostname() != "127.0.0.1" {
		return false
	}
	return target.Path == "/audio" || target.Path == "/local"
}

// IsSongDownloaded checks if the song exists in the downloads directory
func (s *Service) IsSongDownloaded(songID string) (bool, error) {
	if songID == "" {
		return false, fmt.Errorf("songID 不能为空")
	}
	candidates, err := s.downloadCandidates(songID)
	if err != nil {
		return false, err
	}
	for _, candidate := range candidates {
		path := filepath.Join(s.dataDir, downloadsDir, candidate)
		if _, err := os.Stat(path); err == nil {
			_ = os.Chmod(path, 0o600)
			return true, nil
		} else if !os.IsNotExist(err) {
			return false, err
		}
	}
	return false, nil
}

// GetDownloadedSongIDs returns the downloaded subset in one frontend call.
func (s *Service) GetDownloadedSongIDs(songIDs []string) ([]string, error) {
	uniqueIDs := make([]string, 0, len(songIDs))
	seen := make(map[string]struct{}, len(songIDs))
	for _, songID := range songIDs {
		if songID == "" {
			continue
		}
		if _, exists := seen[songID]; exists {
			continue
		}
		seen[songID] = struct{}{}
		uniqueIDs = append(uniqueIDs, songID)
	}
	if len(uniqueIDs) == 0 {
		return []string{}, nil
	}

	var songs []models.Song
	if err := s.db.Where("id IN ?", uniqueIDs).Find(&songs).Error; err != nil {
		return nil, fmt.Errorf("查询歌曲失败: %w", err)
	}
	songsByID := make(map[string]models.Song, len(songs))
	for _, song := range songs {
		songsByID[song.ID] = song
	}

	downloaded := make([]string, 0, len(uniqueIDs))
	for _, songID := range uniqueIDs {
		candidates := []string{storageKey(songID) + ".m4s"}
		if song, exists := songsByID[songID]; exists {
			candidates = localAudioCandidates(song)
		} else if legacy := legacyAudioFilename(songID); legacy != "" && legacy != candidates[0] {
			candidates = append(candidates, legacy)
		}

		for _, candidate := range candidates {
			path := filepath.Join(s.dataDir, downloadsDir, candidate)
			if _, err := os.Stat(path); err == nil {
				_ = os.Chmod(path, 0o600)
				downloaded = append(downloaded, songID)
				break
			} else if !os.IsNotExist(err) {
				return nil, err
			}
		}
	}
	return downloaded, nil
}

// DeleteDownloadedSong deletes the song file from the downloads directory
func (s *Service) DeleteDownloadedSong(songID string) error {
	if songID == "" {
		return fmt.Errorf("songID 不能为空")
	}
	candidates, err := s.downloadCandidates(songID)
	if err != nil {
		return err
	}
	for _, candidate := range candidates {
		path := filepath.Join(s.dataDir, downloadsDir, candidate)
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

// OpenDownloadedFile reveals the downloaded file in the system file manager
func (s *Service) OpenDownloadedFile(songID string) error {
	if songID == "" {
		return fmt.Errorf("songID 不能为空")
	}
	candidates, err := s.downloadCandidates(songID)
	if err != nil {
		return err
	}
	path := ""
	for _, candidate := range candidates {
		candidatePath := filepath.Join(s.dataDir, downloadsDir, candidate)
		if _, err := os.Stat(candidatePath); err == nil {
			path = candidatePath
			break
		} else if !os.IsNotExist(err) {
			return err
		}
	}
	if path == "" {
		return os.ErrNotExist
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", "-R", path)
	case "linux":
		cmd = exec.Command("xdg-open", filepath.Dir(path))
	case "windows":
		cmd = exec.Command("explorer", path)
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("打开文件失败: %w", err)
	}
	return nil
}

// GetAudioCacheSize 获取缓存大小
func (s *Service) GetAudioCacheSize() (int64, error) {
	cachePath := filepath.Join(s.dataDir, cacheDir)
	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		return 0, nil
	}

	var size int64
	err := filepath.Walk(cachePath, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}

// ClearAudioCache 清除所有缓存音乐
func (s *Service) ClearAudioCache() error {
	cachePath := filepath.Join(s.dataDir, cacheDir)
	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		if err := ensurePrivateDir(cachePath); err != nil {
			return fmt.Errorf("create audio cache dir: %w", err)
		}
		return nil
	}

	// 清空目录内容但保留目录本身，便于在文件管理器中可见。
	entries, err := os.ReadDir(cachePath)
	if err != nil {
		return fmt.Errorf("read audio cache dir: %w", err)
	}
	for _, entry := range entries {
		p := filepath.Join(cachePath, entry.Name())
		if err := os.RemoveAll(p); err != nil {
			return fmt.Errorf("remove cache entry %s: %w", p, err)
		}
	}
	return nil
}

func (s *Service) downloadCandidates(songID string) ([]string, error) {
	var song models.Song
	if err := s.db.First(&song, "id = ?", songID).Error; err == nil {
		return localAudioCandidates(song), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询歌曲失败: %w", err)
	}
	candidates := []string{storageKey(songID) + ".m4s"}
	if legacy := legacyAudioFilename(songID); legacy != "" && legacy != candidates[0] {
		candidates = append(candidates, legacy)
	}
	return candidates, nil
}

// SavePlayHistory 保存播放历史
func (s *Service) SavePlayHistory(favoriteID, songID string) error {
	rec := models.PlayHistory{
		ID:         1,
		FavoriteID: favoriteID,
		SongID:     songID,
		Timestamp:  time.Now().Unix(),
		UpdatedAt:  time.Now(),
	}
	if err := s.db.Save(&rec).Error; err != nil {
		return fmt.Errorf("save play history to db: %w", err)
	}

	// Best-effort cleanup of legacy file.
	_ = os.Remove(filepath.Join(s.dataDir, playHistoryFile))
	return nil
}

// GetPlayHistory 获取播放历史
func (s *Service) GetPlayHistory() (PlayHistory, error) {
	var rec models.PlayHistory
	dbErr := s.db.First(&rec, 1).Error
	if dbErr == nil {
		return PlayHistory{FavoriteID: rec.FavoriteID, SongID: rec.SongID, Timestamp: rec.Timestamp}, nil
	} else if errors.Is(dbErr, gorm.ErrRecordNotFound) {
		// One-time migration from legacy file if exists
		historyFile := filepath.Join(s.dataDir, playHistoryFile)
		data, readErr := os.ReadFile(historyFile)
		if readErr != nil {
			if os.IsNotExist(readErr) {
				return PlayHistory{}, nil
			}
			return PlayHistory{}, fmt.Errorf("read legacy play history file: %w", readErr)
		}

		var history PlayHistory
		if err := json.Unmarshal(data, &history); err != nil {
			return PlayHistory{}, fmt.Errorf("parse legacy play history file: %w", err)
		}

		migrated := models.PlayHistory{
			ID:         1,
			FavoriteID: history.FavoriteID,
			SongID:     history.SongID,
			Timestamp:  history.Timestamp,
			UpdatedAt:  time.Now(),
		}
		if err := s.db.Save(&migrated).Error; err != nil {
			return PlayHistory{}, fmt.Errorf("migrate play history to db: %w", err)
		}
		_ = os.Remove(historyFile)
		return history, nil
	}
	return PlayHistory{}, fmt.Errorf("load play history from db: %w", dbErr)
}

// OpenDatabaseFile opens the database file in the system file manager.
func (s *Service) OpenDatabaseFile() error {
	dbDir := s.dataDir
	if _, err := os.Stat(dbDir); err != nil {
		return fmt.Errorf("数据库目录不存在: %w", err)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		// macOS: 使用 open 打开文件夹
		cmd = exec.Command("open", dbDir)
	case "linux":
		// Linux: 使用文件管理器打开文件夹
		cmd = exec.Command("xdg-open", dbDir)
	case "windows":
		// Windows: 使用 explorer 打开文件夹
		cmd = exec.Command("explorer", dbDir)
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("打开数据库目录失败: %w", err)
	}
	return nil
}
