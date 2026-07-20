package services

import (
	"half-beat-player/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ExportData dumps all persisted entities.
type ExportData struct {
	Songs               []models.Song               `json:"songs"`
	Favorites           []models.Favorite           `json:"favorites"`
	Settings            models.PlayerSetting        `json:"settings"`
	Lyrics              []models.LyricMapping       `json:"lyrics"`
	LyricDocuments      []models.LyricDocument      `json:"lyricDocuments"`
	LyricPreferences    []models.LyricPreference    `json:"lyricPreferences"`
	PlaylistSources     []models.PlaylistSource     `json:"playlistSources"`
	PlaylistSourceItems []models.PlaylistSourceItem `json:"playlistSourceItems"`
	PlaylistSyncRuns    []models.PlaylistSyncRun    `json:"playlistSyncRuns"`
}

func (s *Service) ExportData() (ExportData, error) {
	var out ExportData
	if err := s.db.Find(&out.Songs).Error; err != nil {
		return out, err
	}
	if err := s.db.Preload("SongIDs", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).Preload("Source", "locked = ?", true).Find(&out.Favorites).Error; err != nil {
		return out, err
	}
	out.Settings, _ = s.GetPlayerSetting()
	if err := s.db.Find(&out.Lyrics).Error; err != nil {
		return out, err
	}
	for model, destination := range map[any]any{
		&models.LyricDocument{}:      &out.LyricDocuments,
		&models.LyricPreference{}:    &out.LyricPreferences,
		&models.PlaylistSource{}:     &out.PlaylistSources,
		&models.PlaylistSourceItem{}: &out.PlaylistSourceItems,
		&models.PlaylistSyncRun{}:    &out.PlaylistSyncRuns,
	} {
		if err := s.db.Model(model).Find(destination).Error; err != nil {
			return out, err
		}
	}
	return out, nil
}

func (s *Service) ImportData(in ExportData) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, table := range []string{"playlist_sync_runs", "playlist_source_items", "playlist_sources", "lyric_preferences", "lyric_documents"} {
			if err := tx.Exec("DELETE FROM " + table).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec("DELETE FROM song_refs").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM favorites").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM songs").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM lyric_mappings").Error; err != nil {
			return err
		}
		if err := tx.Save(&in.Songs).Error; err != nil {
			return err
		}
		for i := range in.Favorites {
			if in.Favorites[i].ID == "" {
				in.Favorites[i].ID = "FavList-" + uuid.NewString()
			}
		}
		if err := tx.Omit("SongIDs", "Source").Save(&in.Favorites).Error; err != nil {
			return err
		}
		for i := range in.Favorites {
			for j := range in.Favorites[i].SongIDs {
				in.Favorites[i].SongIDs[j].FavoriteID = in.Favorites[i].ID
			}
			if err := tx.Create(&in.Favorites[i].SongIDs).Error; err != nil {
				return err
			}
		}
		if err := tx.Save(&in.Settings).Error; err != nil {
			return err
		}
		if err := tx.Save(&in.Lyrics).Error; err != nil {
			return err
		}
		if len(in.LyricDocuments) > 0 {
			if err := tx.Save(&in.LyricDocuments).Error; err != nil {
				return err
			}
		}
		if len(in.LyricPreferences) > 0 {
			if err := tx.Save(&in.LyricPreferences).Error; err != nil {
				return err
			}
		}
		if len(in.PlaylistSources) > 0 {
			if err := tx.Save(&in.PlaylistSources).Error; err != nil {
				return err
			}
		}
		if len(in.PlaylistSourceItems) > 0 {
			if err := tx.Save(&in.PlaylistSourceItems).Error; err != nil {
				return err
			}
		}
		if len(in.PlaylistSyncRuns) > 0 {
			if err := tx.Save(&in.PlaylistSyncRuns).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ClearLibrary removes all songs, favorites, and lyric mappings, then seeds an empty default favorite.
func (s *Service) ClearLibrary() error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, table := range []string{"playlist_sync_runs", "playlist_source_items", "playlist_sources", "lyric_preferences", "lyric_documents"} {
			if err := tx.Exec("DELETE FROM " + table).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec("DELETE FROM song_refs").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM favorites").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM songs").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM lyric_mappings").Error; err != nil {
			return err
		}
		seed := models.Favorite{ID: "FavList-default", Title: "默认歌单"}
		if err := tx.Create(&seed).Error; err != nil {
			return err
		}
		return nil
	})
}
