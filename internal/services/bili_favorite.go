package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"half-beat-player/internal/models"
)

type biliFavoriteResource struct {
	ID   int64
	Type int
	BVID string
}

// GetMyFavoriteCollections 获取当前登录用户的收藏夹列表
func (s *Service) GetMyFavoriteCollections() ([]models.BiliFavoriteCollection, error) {
	if !s.IsLoggedIn() {
		return nil, fmt.Errorf("未登录")
	}

	user, err := s.GetUserInfo()
	if err != nil {
		return nil, fmt.Errorf("获取用户信息失败: %w", err)
	}

	endpoint := s.biliAPIURL(fmt.Sprintf("/x/v3/fav/folder/created/list?up_mid=%d&pn=1&ps=100", user.UID))
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, classifyBiliFavoriteError(resp.StatusCode, 0, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var res struct {
		Code int    `json:"code"`
		Msg  string `json:"message"`
		Data struct {
			List []struct {
				ID         int64  `json:"id"`
				Title      string `json:"title"`
				MediaCount int    `json:"media_count"`
				Cover      string `json:"cover"`
			} `json:"list"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w, body: %s", err, string(body))
	}

	if res.Code != 0 {
		msg := res.Msg
		if msg == "" {
			msg = "未知错误"
		}
		return nil, classifyBiliFavoriteError(resp.StatusCode, res.Code, msg)
	}

	var out []models.BiliFavoriteCollection
	for _, it := range res.Data.List {
		out = append(out, models.BiliFavoriteCollection{
			ID:    it.ID,
			Title: it.Title,
			Count: it.MediaCount,
			Cover: it.Cover,
		})
	}
	return out, nil
}

// GetFavoriteCollectionInfo 获取收藏夹的基本信息（标题、封面等）
func (s *Service) GetFavoriteCollectionInfo(mediaID int64) (*models.BiliFavoriteCollection, error) {
	endpoint := s.biliAPIURL(fmt.Sprintf("/x/v3/fav/resource/list?media_id=%d&pn=1&ps=1", mediaID))

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, classifyBiliFavoriteError(resp.StatusCode, 0, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	// 检测是否返回了 HTML 错误页面
	if len(body) > 0 && body[0] == '<' {
		return nil, fmt.Errorf("收藏夹不存在或无权限访问")
	}

	var res struct {
		Code int    `json:"code"`
		Msg  string `json:"message"`
		Data struct {
			Info struct {
				ID         int64  `json:"id"`
				Title      string `json:"title"`
				Cover      string `json:"cover"`
				MediaCount int    `json:"media_count"`
			} `json:"info"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if res.Code != 0 {
		msg := res.Msg
		if msg == "" {
			msg = "未知错误"
		}
		return nil, classifyBiliFavoriteError(resp.StatusCode, res.Code, msg)
	}

	return &models.BiliFavoriteCollection{
		ID:    res.Data.Info.ID,
		Title: res.Data.Info.Title,
		Count: res.Data.Info.MediaCount,
		Cover: res.Data.Info.Cover,
	}, nil
}

// GetFavoriteCollectionBVIDs 获取指定收藏夹的所有 BVID（公开收藏夹可用，无需登录）
// 使用 /x/v3/fav/resource/ids API，一次性获取所有内容ID
func (s *Service) GetFavoriteCollectionBVIDs(mediaID int64) ([]models.BiliFavoriteInfo, error) {
	resources, err := s.getFavoriteCollectionResources(mediaID)
	if err != nil {
		return nil, err
	}

	result, _ := supportedFavoriteVideos(resources)
	return result, nil
}

func (s *Service) getFavoriteCollectionResources(mediaID int64) ([]biliFavoriteResource, error) {
	endpoint := s.biliAPIURL(fmt.Sprintf("/x/v3/fav/resource/ids?media_id=%d&platform=web", mediaID))

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	// cookieJar 会自动管理 Cookie，不需要手动设置

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, classifyBiliFavoriteError(resp.StatusCode, 0, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	// 检测是否返回了 HTML 错误页面
	if len(body) > 0 && body[0] == '<' {
		return nil, fmt.Errorf("收藏夹不存在或无权限访问")
	}

	var res struct {
		Code int    `json:"code"`
		Msg  string `json:"message"`
		Data []struct {
			ID   int64  `json:"id"`
			Type int    `json:"type"`
			BvID string `json:"bv_id"`
			BVID string `json:"bvid"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w, body: %s", err, string(body[:min(len(body), 200)]))
	}

	if res.Code != 0 {
		msg := res.Msg
		if msg == "" {
			msg = "未知错误"
		}
		return nil, classifyBiliFavoriteError(resp.StatusCode, res.Code, msg)
	}

	resources := make([]biliFavoriteResource, 0, len(res.Data))
	for _, item := range res.Data {
		bvid := strings.TrimSpace(item.BVID)
		if bvid == "" {
			bvid = strings.TrimSpace(item.BvID)
		}
		resources = append(resources, biliFavoriteResource{ID: item.ID, Type: item.Type, BVID: bvid})
	}
	return resources, nil
}

func supportedFavoriteVideos(resources []biliFavoriteResource) ([]models.BiliFavoriteInfo, int) {
	var result []models.BiliFavoriteInfo
	skippedCount := 0
	for _, item := range resources {
		if item.Type != 2 || item.BVID == "" {
			skippedCount++
			continue
		}
		result = append(result, models.BiliFavoriteInfo{BVID: item.BVID})
	}
	return result, skippedCount
}

func (s *Service) biliAPIURL(path string) string {
	base := strings.TrimRight(s.biliAPIBaseURL, "/")
	if base == "" {
		base = "https://api.bilibili.com"
	}
	return base + path
}

func classifyBiliFavoriteError(httpStatus, apiCode int, message string) error {
	details := map[string]string{
		"httpStatus": fmt.Sprint(httpStatus),
		"apiCode":    fmt.Sprint(apiCode),
	}
	switch {
	case httpStatus == http.StatusUnauthorized || apiCode == -101:
		return domainErrorWithDetails(ErrorCodeSyncAuth, "Bilibili 登录已失效，请重新登录", false, details, nil)
	case httpStatus == http.StatusForbidden || apiCode == -403 || apiCode == 11010:
		return domainErrorWithDetails(ErrorCodeSyncPermission, "没有权限访问该收藏夹", false, details, nil)
	case httpStatus == http.StatusTooManyRequests || apiCode == -412:
		return domainErrorWithDetails(ErrorCodeSyncRateLimited, "Bilibili 请求过于频繁，请稍后重试", true, details, nil)
	default:
		return domainErrorWithDetails(ErrorCodeSyncIncomplete, "无法获取完整的 Bilibili 收藏夹快照", true, details, fmt.Errorf("api error %d: %s", apiCode, message))
	}
}
