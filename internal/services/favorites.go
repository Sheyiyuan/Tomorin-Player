package services

import (
	"errors"
	"fmt"
	"half-beat-player/internal/models"

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
