package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"half-beat-player/internal/models"

	"gorm.io/gorm"
)

// SearchLocalSongs searches songs in local database by name or singer.
func (s *Service) SearchLocalSongs(keyword string) ([]models.Song, error) {
	var songs []models.Song
	searchTerm := "%" + keyword + "%"
	if err := s.db.Where("name LIKE ? OR singer LIKE ?", searchTerm, searchTerm).
		Find(&songs).Error; err != nil {
		return nil, err
	}
	return songs, nil
}

// SearchBiliVideos queries Bilibili video search and returns lightweight Song-like items.
// order uses Bilibili search order values (e.g. totalrank, pubdate, click, favorite, danmaku).
func (s *Service) SearchBiliVideos(keyword string, page int, pageSize int, order string) ([]models.Song, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 30 {
		pageSize = 10
	}
	_ = s.warmupBiliCookies()
	api := "https://api.bilibili.com/x/web-interface/search/type"
	q := url.Values{}
	q.Set("search_type", "video")
	q.Set("keyword", keyword)
	q.Set("page", fmt.Sprintf("%d", page))
	q.Set("page_size", fmt.Sprintf("%d", pageSize))
	if order == "" {
		order = "totalrank"
	}
	q.Set("order", order)
	endpoint := api + "?" + q.Encode()

	req, _ := http.NewRequest("GET", endpoint, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://search.bilibili.com/")
	req.Header.Set("Origin", "https://www.bilibili.com")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	if cookieHeader := s.buildBiliCookieHeader("https://api.bilibili.com"); cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}
	client := s.httpClient
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusPreconditionFailed {
		_ = s.warmupBiliCookies()
		resp.Body.Close()
		req2, _ := http.NewRequest("GET", endpoint, nil)
		req2.Header = req.Header.Clone()
		resp, err = client.Do(req2)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		body, _ = io.ReadAll(resp.Body)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("bili search http %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "" && !strings.Contains(ct, "application/json") {
		snippet := string(body)
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		return nil, fmt.Errorf("bili search non-json response: %s", snippet)
	}

	var parsed struct {
		Code int `json:"code"`
		Data struct {
			Result []struct {
				BVID     string `json:"bvid"`
				Title    string `json:"title"`
				Author   string `json:"author"`
				Pic      string `json:"pic"`
				Duration string `json:"duration"`
			} `json:"result"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Code != 0 {
		return []models.Song{}, nil
	}

	// Strip HTML tags from title
	tagRe := regexp.MustCompile(`<[^>]+>`)

	var out []models.Song
	for _, it := range parsed.Data.Result {
		out = append(out, models.Song{
			ID:       "",
			BVID:     it.BVID,
			Name:     tagRe.ReplaceAllString(it.Title, ""),
			Singer:   it.Author,
			SingerID: "",
			Cover:    normalizeBiliPic(it.Pic),
			SourceID: "",
		})
	}
	return out, nil
}

func (s *Service) warmupBiliCookies() error {
	client := s.httpClient
	if client == nil {
		client = http.DefaultClient
	}
	// Visit homepage to seed buvid cookies
	req, _ := http.NewRequest("GET", "https://www.bilibili.com/", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com/")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)

	// Touch API endpoint to ensure cookies for api.bilibili.com are present
	apiReq, _ := http.NewRequest("GET", "https://api.bilibili.com/x/web-interface/nav", nil)
	apiReq.Header.Set("User-Agent", "Mozilla/5.0")
	apiReq.Header.Set("Referer", "https://www.bilibili.com/")
	apiReq.Header.Set("Accept", "application/json, text/plain, */*")
	if cookieHeader := s.buildBiliCookieHeader("https://www.bilibili.com"); cookieHeader != "" {
		apiReq.Header.Set("Cookie", cookieHeader)
	}
	apiResp, apiErr := client.Do(apiReq)
	if apiErr == nil {
		defer apiResp.Body.Close()
		_, _ = io.ReadAll(apiResp.Body)
	}
	return nil
}

func (s *Service) buildBiliCookieHeader(rawURL string) string {
	if s.cookieJar == nil {
		return ""
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	cookies := s.cookieJar.Cookies(u)
	if len(cookies) == 0 {
		return ""
	}
	parts := make([]string, 0, len(cookies))
	for _, c := range cookies {
		if c == nil || c.Name == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s=%s", c.Name, c.Value))
	}
	return strings.Join(parts, "; ")
}

// SearchBVID searches for a BV number in both local database and Bilibili.
// Returns local results first, then remote results.
func (s *Service) SearchBVID(bvid string) ([]models.Song, error) {
	var results []models.Song

	// 1. 搜索本地数据库中相同 BVID 的所有歌曲实例
	if err := s.db.Where("bvid = ?", bvid).Find(&results).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// 2. 从B站获取完整视频信息
	videoInfo, err := s.getCompleteVideoInfo(bvid)
	if err == nil {
		// 为每个分P创建一个Song条目
		for _, page := range videoInfo.Pages {
			songName := formatSongName(videoInfo.Title, page.Page, page.Part, len(videoInfo.Pages))
			
			remoteResult := models.Song{
				ID:           "",
				BVID:         bvid,
				Name:         songName,
				Singer:       videoInfo.Author,
				SingerID:     "",
				Cover:        videoInfo.Cover,
				SourceID:     "", // 未保存的远程资源
				PageNumber:   page.Page,
				PageTitle:    page.Part,
				VideoTitle:   videoInfo.Title,
				TotalPages:   len(videoInfo.Pages),
			}
			results = append(results, remoteResult)
		}
	}

	return results, nil
}

func (s *Service) findSongByBVID(bvid string) (*models.Song, error) {
	var song models.Song
	if err := s.db.First(&song, "bvid = ?", bvid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &song, nil
}
