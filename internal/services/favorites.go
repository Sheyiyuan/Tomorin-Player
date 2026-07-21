package services

import (
	"errors"
	"fmt"
	"half-beat-player/internal/models"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ListFavorites returns favorites with song ids only (frontend can hydrate).
func (s *Service) ListFavorites() ([]models.Favorite, error) {
	var favs []models.Favorite
	if err := s.db.Preload("SongIDs", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Preload("Source", "locked = ?", true).Find(&favs).Error; err != nil {
		return nil, err
	}
	return favs, nil
}

const (
	defaultFavoriteSongPageSize = 100
	maxFavoriteSongPageSize     = 200
)

// ListFavoriteSummaries returns playlist metadata without hydrating every song reference.
func (s *Service) ListFavoriteSummaries() ([]models.FavoriteSummary, error) {
	var favorites []models.Favorite
	if err := s.db.Preload("Source", "locked = ?", true).Order("created_at ASC, id ASC").Find(&favorites).Error; err != nil {
		return nil, fmt.Errorf("list favorite summaries: %w", err)
	}
	type favoriteCount struct {
		FavoriteID string
		Count      int
	}
	var counts []favoriteCount
	if err := s.db.Model(&models.SongRef{}).Select("favorite_id, COUNT(*) AS count").Group("favorite_id").Scan(&counts).Error; err != nil {
		return nil, fmt.Errorf("count favorite songs: %w", err)
	}
	countByID := make(map[string]int, len(counts))
	for _, row := range counts {
		countByID[row.FavoriteID] = row.Count
	}
	result := make([]models.FavoriteSummary, 0, len(favorites))
	for _, favorite := range favorites {
		result = append(result, favoriteSummary(favorite, countByID[favorite.ID]))
	}
	return result, nil
}

// ListFavoriteSongs returns one stable, searchable page from a playlist.
func (s *Service) ListFavoriteSongs(request models.FavoriteSongPageRequest) (models.FavoriteSongPage, error) {
	favoriteID := strings.TrimSpace(request.FavoriteID)
	if favoriteID == "" {
		return models.FavoriteSongPage{}, fmt.Errorf("歌单 ID 不能为空")
	}
	var favorite models.Favorite
	if err := s.db.First(&favorite, "id = ?", favoriteID).Error; err != nil {
		return models.FavoriteSongPage{}, fmt.Errorf("load favorite: %w", err)
	}
	offset, limit := normalizedPage(request.Offset, request.Limit)
	query := strings.TrimSpace(request.Query)
	base := s.db.Table("song_refs").Joins("JOIN songs ON songs.id = song_refs.song_id").Where("song_refs.favorite_id = ?", favoriteID)
	if query != "" {
		pattern := "%" + escapeLike(strings.ToLower(query)) + "%"
		base = base.Where("LOWER(COALESCE(songs.name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(songs.singer, '')) LIKE ? ESCAPE '\\'", pattern, pattern)
	}
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return models.FavoriteSongPage{}, fmt.Errorf("count favorite songs: %w", err)
	}
	items := make([]models.Song, 0, limit)
	if err := base.Select("songs.*").Order("song_refs.position ASC, song_refs.id ASC").Offset(offset).Limit(limit).Scan(&items).Error; err != nil {
		return models.FavoriteSongPage{}, fmt.Errorf("list favorite songs: %w", err)
	}
	return models.FavoriteSongPage{
		Items: items, Total: int(total), Offset: offset, Limit: limit,
		Revision: favorite.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}, nil
}

// SearchLocalSongPage searches the complete local library without loading it into the frontend.
func (s *Service) SearchLocalSongPage(request models.LocalSongSearchRequest) (models.LocalSongSearchPage, error) {
	offset, limit := normalizedPage(request.Offset, request.Limit)
	query := strings.TrimSpace(request.Query)
	if query == "" {
		return models.LocalSongSearchPage{Items: []models.Song{}, Offset: offset, Limit: limit}, nil
	}
	pattern := "%" + escapeLike(strings.ToLower(query)) + "%"
	base := s.db.Model(&models.Song{}).Where(
		"LOWER(COALESCE(name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(singer, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(singer_id, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(bvid, '')) LIKE ? ESCAPE '\\'",
		pattern, pattern, pattern, pattern,
	)
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return models.LocalSongSearchPage{}, fmt.Errorf("count local song search: %w", err)
	}
	items := make([]models.Song, 0, limit)
	if err := base.Order("updated_at DESC, id ASC").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return models.LocalSongSearchPage{}, fmt.Errorf("search local songs: %w", err)
	}
	return models.LocalSongSearchPage{Items: items, Total: int(total), Offset: offset, Limit: limit}, nil
}

// GetSongsByIDs hydrates queue entries in input order and preserves duplicates.
func (s *Service) GetSongsByIDs(ids []string) ([]models.Song, error) {
	if len(ids) == 0 {
		return []models.Song{}, nil
	}
	unique := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" {
			if _, exists := seen[id]; !exists {
				seen[id] = struct{}{}
				unique = append(unique, id)
			}
		}
	}
	var songs []models.Song
	if len(unique) > 0 {
		if err := s.db.Where("id IN ?", unique).Find(&songs).Error; err != nil {
			return nil, fmt.Errorf("get songs by ids: %w", err)
		}
	}
	byID := make(map[string]models.Song, len(songs))
	for _, song := range songs {
		byID[song.ID] = song
	}
	ordered := make([]models.Song, 0, len(ids))
	for _, id := range ids {
		if song, exists := byID[strings.TrimSpace(id)]; exists {
			ordered = append(ordered, song)
		}
	}
	return ordered, nil
}

func (s *Service) CreateLocalFavorite(title string) (models.FavoriteSummary, error) {
	now := time.Now()
	favorite := models.Favorite{ID: "FavList-" + uuid.NewString(), Title: normalizedFavoriteTitle(title), CreatedAt: now, UpdatedAt: now}
	if err := s.db.Create(&favorite).Error; err != nil {
		return models.FavoriteSummary{}, fmt.Errorf("create favorite: %w", err)
	}
	return favoriteSummary(favorite, 0), nil
}

func (s *Service) RenameFavorite(favoriteID, title string) (models.FavoriteSummary, error) {
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := ensureMutableFavorite(tx, favoriteID); err != nil {
			return err
		}
		return tx.Model(&models.Favorite{}).Where("id = ?", favoriteID).Updates(map[string]any{"title": normalizedFavoriteTitle(title), "updated_at": time.Now()}).Error
	}); err != nil {
		return models.FavoriteSummary{}, err
	}
	return s.getFavoriteSummary(favoriteID)
}

func (s *Service) DuplicateFavorite(sourceID, title string) (models.FavoriteSummary, error) {
	newID := "FavList-" + uuid.NewString()
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var source models.Favorite
		if err := tx.First(&source, "id = ?", sourceID).Error; err != nil {
			return fmt.Errorf("load source favorite: %w", err)
		}
		now := time.Now()
		copy := models.Favorite{ID: newID, Title: normalizedFavoriteTitle(title), CreatedAt: now, UpdatedAt: now}
		if err := tx.Create(&copy).Error; err != nil {
			return err
		}
		var refs []models.SongRef
		if err := tx.Where("favorite_id = ?", sourceID).Order("position ASC, id ASC").Find(&refs).Error; err != nil {
			return err
		}
		copies := make([]models.SongRef, 0, len(refs))
		for index, ref := range refs {
			copies = append(copies, models.SongRef{FavoriteID: newID, SongID: ref.SongID, Position: index})
		}
		if len(copies) > 0 {
			return tx.CreateInBatches(copies, 200).Error
		}
		return nil
	}); err != nil {
		return models.FavoriteSummary{}, fmt.Errorf("duplicate favorite: %w", err)
	}
	return s.getFavoriteSummary(newID)
}

func (s *Service) AddSongsToFavorite(favoriteID string, songIDs []string) (models.FavoriteSummary, error) {
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := ensureMutableFavorite(tx, favoriteID); err != nil {
			return err
		}
		var existing []string
		if err := tx.Model(&models.SongRef{}).Where("favorite_id = ?", favoriteID).Pluck("song_id", &existing).Error; err != nil {
			return err
		}
		existingSet := make(map[string]struct{}, len(existing))
		for _, id := range existing {
			existingSet[id] = struct{}{}
		}
		var maxPosition int
		if err := tx.Model(&models.SongRef{}).Where("favorite_id = ?", favoriteID).Select("COALESCE(MAX(position), -1)").Scan(&maxPosition).Error; err != nil {
			return err
		}
		refs := make([]models.SongRef, 0, len(songIDs))
		for _, songID := range songIDs {
			songID = strings.TrimSpace(songID)
			if songID == "" {
				continue
			}
			if _, exists := existingSet[songID]; exists {
				continue
			}
			var count int64
			if err := tx.Model(&models.Song{}).Where("id = ?", songID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return fmt.Errorf("歌曲不存在: %s", songID)
			}
			maxPosition++
			refs = append(refs, models.SongRef{FavoriteID: favoriteID, SongID: songID, Position: maxPosition})
			existingSet[songID] = struct{}{}
		}
		if len(refs) > 0 {
			if err := tx.CreateInBatches(refs, 200).Error; err != nil {
				return err
			}
			return tx.Model(&models.Favorite{}).Where("id = ?", favoriteID).Update("updated_at", time.Now()).Error
		}
		return nil
	}); err != nil {
		return models.FavoriteSummary{}, err
	}
	return s.getFavoriteSummary(favoriteID)
}

func (s *Service) RemoveSongFromFavorite(favoriteID, songID string) (models.FavoriteSummary, error) {
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := ensureMutableFavorite(tx, favoriteID); err != nil {
			return err
		}
		var ref models.SongRef
		if err := tx.Where("favorite_id = ? AND song_id = ?", favoriteID, songID).First(&ref).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if err := tx.Delete(&ref).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.SongRef{}).Where("favorite_id = ? AND position > ?", favoriteID, ref.Position).Update("position", gorm.Expr("position - 1")).Error; err != nil {
			return err
		}
		return tx.Model(&models.Favorite{}).Where("id = ?", favoriteID).Update("updated_at", time.Now()).Error
	}); err != nil {
		return models.FavoriteSummary{}, err
	}
	return s.getFavoriteSummary(favoriteID)
}

func (s *Service) GetFavoriteMemberships(songID string) ([]string, error) {
	var ids []string
	if err := s.db.Model(&models.SongRef{}).Where("song_id = ?", strings.TrimSpace(songID)).Order("favorite_id ASC").Pluck("favorite_id", &ids).Error; err != nil {
		return nil, fmt.Errorf("get favorite memberships: %w", err)
	}
	return ids, nil
}

func normalizedPage(offset, limit int) (int, int) {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = defaultFavoriteSongPageSize
	}
	if limit > maxFavoriteSongPageSize {
		limit = maxFavoriteSongPageSize
	}
	return offset, limit
}

func escapeLike(value string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(value)
}

func normalizedFavoriteTitle(title string) string {
	if title = strings.TrimSpace(title); title != "" {
		return title
	}
	return "未命名歌单"
}

func favoriteSummary(favorite models.Favorite, count int) models.FavoriteSummary {
	return models.FavoriteSummary{ID: favorite.ID, Title: favorite.Title, SongCount: count, Source: favorite.Source, CreatedAt: favorite.CreatedAt, UpdatedAt: favorite.UpdatedAt}
}

func (s *Service) getFavoriteSummary(favoriteID string) (models.FavoriteSummary, error) {
	var favorite models.Favorite
	if err := s.db.Preload("Source", "locked = ?", true).First(&favorite, "id = ?", favoriteID).Error; err != nil {
		return models.FavoriteSummary{}, fmt.Errorf("load favorite summary: %w", err)
	}
	var count int64
	if err := s.db.Model(&models.SongRef{}).Where("favorite_id = ?", favoriteID).Count(&count).Error; err != nil {
		return models.FavoriteSummary{}, fmt.Errorf("count favorite summary: %w", err)
	}
	return favoriteSummary(favorite, int(count)), nil
}

func ensureMutableFavorite(tx *gorm.DB, favoriteID string) error {
	var favoriteCount int64
	if err := tx.Model(&models.Favorite{}).Where("id = ?", strings.TrimSpace(favoriteID)).Count(&favoriteCount).Error; err != nil {
		return err
	}
	if favoriteCount == 0 {
		return gorm.ErrRecordNotFound
	}
	var lockedCount int64
	if err := tx.Model(&models.PlaylistSource{}).Where("favorite_id = ? AND locked = ?", favoriteID, true).Count(&lockedCount).Error; err != nil {
		return err
	}
	if lockedCount > 0 {
		return domainError(ErrorCodePlaylistLocked, "同步歌单为只读，请先转换为本地歌单", nil)
	}
	return nil
}

// SaveFavorite stores a favorite list.
func (s *Service) SaveFavorite(fav models.Favorite) error {
	if fav.ID == "" {
		fav.ID = "FavList-" + uuid.NewString()
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		var source models.PlaylistSource
		if err := tx.First(&source, "favorite_id = ? AND locked = ?", fav.ID, true).Error; err == nil {
			return domainError(ErrorCodePlaylistLocked, "同步歌单为只读，请先转换为本地歌单", nil)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("check playlist lock: %w", err)
		}
		if err := tx.Omit("SongIDs", "Source").Clauses(clauseOnConflictID()).Create(&fav).Error; err != nil {
			return err
		}
		if err := tx.Where("favorite_id = ?", fav.ID).Delete(&models.SongRef{}).Error; err != nil {
			return err
		}
		for i := range fav.SongIDs {
			fav.SongIDs[i].FavoriteID = fav.ID
			fav.SongIDs[i].Position = i
		}
		if len(fav.SongIDs) == 0 {
			return nil
		}
		return tx.Create(&fav.SongIDs).Error
	})
}

// DeleteFavorite deletes a favorite and its song refs.
func (s *Service) DeleteFavorite(id string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var sourceIDs []string
		if err := tx.Model(&models.PlaylistSource{}).Where("favorite_id = ?", id).Pluck("id", &sourceIDs).Error; err != nil {
			return err
		}
		if len(sourceIDs) > 0 {
			if err := tx.Delete(&models.PlaylistSourceItem{}, "source_id IN ?", sourceIDs).Error; err != nil {
				return err
			}
			if err := tx.Delete(&models.PlaylistSyncRun{}, "source_id IN ?", sourceIDs).Error; err != nil {
				return err
			}
		}
		if err := tx.Delete(&models.PlaylistSource{}, "favorite_id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.SongRef{}, "favorite_id = ?", id).Error; err != nil {
			return err
		}
		return tx.Delete(&models.Favorite{}, "id = ?", id).Error
	})
}

// clauseOnConflictID is a small helper to update on PK conflict.
func clauseOnConflictID() clause.Expression {
	return clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"title": clause.Expr{SQL: "excluded.title"}, "updated_at": clause.Expr{SQL: "excluded.updated_at"}}),
	}
}
