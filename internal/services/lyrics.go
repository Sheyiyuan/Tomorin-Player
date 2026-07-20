package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	lyricparser "half-beat-player/internal/lyrics"
	"half-beat-player/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxPastedLyricRunes = 200_000

// SaveLyricMapping keeps the legacy Wails API compatible while writing the
// new versioned lyric store. Existing clients therefore gain manual locking.
func (s *Service) SaveLyricMapping(mapping models.LyricMapping) error {
	if mapping.ID == "" {
		return fmt.Errorf("lyric id required")
	}
	mapping.UpdatedAt = time.Now()
	if err := s.db.Save(&mapping).Error; err != nil {
		return fmt.Errorf("save legacy lyric mapping: %w", err)
	}
	if strings.TrimSpace(mapping.Lyric) == "" {
		return s.setLyricOffset(mapping.ID, mapping.OffsetMS)
	}
	_, err := s.saveLyricDocument(mapping.ID, mapping.Lyric, "", "manual", "本地", 1, true, true, "utf-8", mapping.OffsetMS)
	return err
}

func (s *Service) GetLyricMapping(id string) (models.LyricMapping, error) {
	view, err := s.GetActiveLyric(id)
	if err != nil {
		return models.LyricMapping{}, err
	}
	if view.Document == nil {
		return models.LyricMapping{ID: id, OffsetMS: view.OffsetMS}, nil
	}
	return models.LyricMapping{
		ID:        id,
		Lyric:     view.Document.RawText,
		OffsetMS:  view.OffsetMS,
		UpdatedAt: view.Document.UpdatedAt,
	}, nil
}

// MigrateLegacyLyrics imports all non-empty legacy mappings idempotently.
func (s *Service) MigrateLegacyLyrics() error {
	if !s.db.Migrator().HasTable(&models.LyricMapping{}) {
		return nil
	}
	var mappings []models.LyricMapping
	if err := s.db.Find(&mappings).Error; err != nil {
		return fmt.Errorf("load legacy lyrics: %w", err)
	}
	for _, mapping := range mappings {
		if strings.TrimSpace(mapping.Lyric) == "" {
			if err := s.ensureLyricPreference(mapping.ID, mapping.OffsetMS); err != nil {
				return err
			}
			continue
		}
		if _, err := s.saveLyricDocument(mapping.ID, mapping.Lyric, "", "legacy", "本地（旧版）", 1, true, true, "utf-8", mapping.OffsetMS); err != nil {
			return fmt.Errorf("migrate lyric %s: %w", mapping.ID, err)
		}
	}
	return nil
}

// GetActiveLyric returns the active version, preference and recent candidates.
func (s *Service) GetActiveLyric(songID string) (models.LyricView, error) {
	if songID == "" {
		return models.LyricView{}, fmt.Errorf("song id required")
	}
	if err := s.migrateLegacyLyric(songID); err != nil {
		return models.LyricView{}, err
	}
	view := models.LyricView{SongID: songID, Candidates: []models.LyricDocument{}}
	var preference models.LyricPreference
	if err := s.db.First(&preference, "song_id = ?", songID).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return view, fmt.Errorf("load lyric preference: %w", err)
		}
	} else {
		view.OffsetMS = preference.OffsetMS
		view.ManualLocked = preference.ManualLocked
		if preference.ActiveDocumentID != "" {
			var document models.LyricDocument
			if err := s.db.Where("id = ? AND song_id = ? AND rejected_at IS NULL", preference.ActiveDocumentID, songID).
				Where("(is_manual = ? OR is_reliable = ?)", true, true).First(&document).Error; err == nil {
				view.Document = &document
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return view, fmt.Errorf("load active lyric document: %w", err)
			}
		}
	}
	if view.Document != nil {
		query := s.db.Where("song_id = ? AND is_manual = ? AND is_reliable = ? AND rejected_at IS NULL AND id <> ?", songID, false, true, view.Document.ID)
		if err := query.Order("confidence DESC, updated_at DESC").Limit(10).Find(&view.Candidates).Error; err != nil {
			return view, fmt.Errorf("load lyric candidates: %w", err)
		}
	}
	return view, nil
}

func (s *Service) PreviewLyricText(text, filename string, durationSeconds int64) (models.LyricImportPreview, error) {
	if utf8.RuneCountInString(text) > maxPastedLyricRunes {
		return models.LyricImportPreview{}, domainError(ErrorCodeLyricTooLarge, "粘贴歌词不能超过 200,000 个字符", nil)
	}
	return previewLyricWithDuration([]byte(text), filename, durationSeconds)
}

func (s *Service) PreviewLyricFile(data []byte, filename string, durationSeconds int64) (models.LyricImportPreview, error) {
	return previewLyricWithDuration(data, filename, durationSeconds)
}

func previewLyric(data []byte, filename string) (models.LyricImportPreview, error) {
	return previewLyricWithDuration(data, filename, 0)
}

func previewLyricWithDuration(data []byte, filename string, durationSeconds int64) (models.LyricImportPreview, error) {
	if len(data) > lyricparser.MaxInputBytes {
		return models.LyricImportPreview{}, domainError(ErrorCodeLyricTooLarge, "歌词文件不能超过 1 MiB", nil)
	}
	extension := strings.ToLower(filepath.Ext(filename))
	if extension != "" && extension != ".lrc" && extension != ".txt" {
		return models.LyricImportPreview{}, domainErrorWithDetails(ErrorCodeLyricParse, "仅支持 LRC 和 TXT 歌词", false, map[string]string{"extension": extension}, nil)
	}
	parsed, err := lyricparser.ParseWithDuration(data, max(durationSeconds, 0)*1000)
	if err != nil {
		return models.LyricImportPreview{}, domainError(ErrorCodeLyricParse, "歌词解析失败", err)
	}
	if strings.EqualFold(filepath.Ext(filename), ".txt") {
		parsed.Format = "plain"
		parsed.Lines = []models.LyricLine{}
	}
	preview := models.LyricImportPreview{
		Text:             parsed.Text,
		Format:           parsed.Format,
		Encoding:         parsed.Encoding,
		Lines:            parsed.Lines,
		Metadata:         parsed.Metadata,
		EmbeddedOffsetMS: parsed.EmbeddedOffsetMS,
		ValidLineCount:   parsed.ValidLineCount,
		Warnings:         parsed.Warnings,
	}
	if len(parsed.Lines) > 0 {
		preview.FirstMS = parsed.Lines[0].StartMS
		preview.LastMS = parsed.Lines[len(parsed.Lines)-1].StartMS
	}
	return preview, nil
}

func (s *Service) ImportLyricText(songID, text, filename string) (models.LyricView, error) {
	preview, err := s.PreviewLyricText(text, filename, 0)
	if err != nil {
		return models.LyricView{}, err
	}
	return s.saveManualPreview(songID, preview)
}

func (s *Service) ImportLyricFile(songID string, data []byte, filename string) (models.LyricView, error) {
	preview, err := s.PreviewLyricFile(data, filename, 0)
	if err != nil {
		return models.LyricView{}, err
	}
	return s.saveManualPreview(songID, preview)
}

func (s *Service) SaveManualLyric(songID, text, filename string) (models.LyricView, error) {
	return s.ImportLyricText(songID, text, filename)
}

func (s *Service) saveManualPreview(songID string, preview models.LyricImportPreview) (models.LyricView, error) {
	if strings.TrimSpace(songID) == "" {
		return models.LyricView{}, fmt.Errorf("song id required")
	}
	if strings.TrimSpace(preview.Text) == "" {
		return models.LyricView{}, fmt.Errorf("歌词内容不能为空")
	}
	preference, err := loadLyricPreference(s.db, songID)
	if err != nil {
		return models.LyricView{}, fmt.Errorf("load lyric preference: %w", err)
	}
	_, err = s.saveParsedLyricDocument(songID, preview, "manual", "本地", 1, true, true, "", preference.OffsetMS)
	if err != nil {
		return models.LyricView{}, err
	}
	return s.GetActiveLyric(songID)
}

func (s *Service) SetLyricOffset(songID string, offsetMS int) (models.LyricView, error) {
	if offsetMS < -30_000 || offsetMS > 30_000 {
		return models.LyricView{}, fmt.Errorf("歌词偏移必须在 -30000 到 30000 毫秒之间")
	}
	if err := s.setLyricOffset(songID, offsetMS); err != nil {
		return models.LyricView{}, err
	}
	return s.GetActiveLyric(songID)
}

func (s *Service) setLyricOffset(songID string, offsetMS int) error {
	if songID == "" {
		return fmt.Errorf("song id required")
	}
	preference := models.LyricPreference{SongID: songID}
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "song_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{"offset_ms": offsetMS, "updated_at": time.Now()}),
	}).Create(&models.LyricPreference{SongID: preference.SongID, OffsetMS: offsetMS, UpdatedAt: time.Now()}).Error
}

func (s *Service) ApplyLyricCandidate(songID, documentID string) (models.LyricView, error) {
	var document models.LyricDocument
	if err := s.db.First(&document, "id = ? AND song_id = ? AND is_manual = ? AND is_reliable = ? AND rejected_at IS NULL", documentID, songID, false, true).Error; err != nil {
		return models.LyricView{}, fmt.Errorf("load lyric candidate: %w", err)
	}
	if err := s.activateLyricDocument(songID, document.ID, false); err != nil {
		return models.LyricView{}, err
	}
	return s.GetActiveLyric(songID)
}

func (s *Service) RestoreAutomaticLyric(songID string) (models.LyricView, error) {
	var document models.LyricDocument
	err := s.db.Where("song_id = ? AND is_manual = ? AND is_reliable = ? AND rejected_at IS NULL", songID, false, true).
		Order("confidence DESC, updated_at DESC").First(&document).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := s.db.Model(&models.LyricPreference{}).Where("song_id = ?", songID).
			Updates(map[string]interface{}{"active_document_id": "", "manual_locked": false, "updated_at": time.Now()}).Error; err != nil {
			return models.LyricView{}, err
		}
		return s.GetActiveLyric(songID)
	}
	if err != nil {
		return models.LyricView{}, fmt.Errorf("load automatic lyric: %w", err)
	}
	if err := s.activateLyricDocument(songID, document.ID, false); err != nil {
		return models.LyricView{}, err
	}
	return s.GetActiveLyric(songID)
}

// RejectLyricCandidate permanently disables an automatic provider result for
// this song. Provider identity is retained so future refreshes cannot recreate
// the same rejected match with slightly different text.
func (s *Service) RejectLyricCandidate(songID, documentID string) (models.LyricView, error) {
	songID = strings.TrimSpace(songID)
	documentID = strings.TrimSpace(documentID)
	if songID == "" || documentID == "" {
		return models.LyricView{}, fmt.Errorf("song id and lyric document id required")
	}
	now := time.Now()
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var document models.LyricDocument
		if err := tx.First(&document, "id = ? AND song_id = ? AND is_manual = ?", documentID, songID, false).Error; err != nil {
			return fmt.Errorf("load lyric candidate: %w", err)
		}
		if err := tx.Model(&document).Updates(map[string]interface{}{
			"is_reliable": false,
			"rejected_at": now,
			"updated_at":  now,
		}).Error; err != nil {
			return fmt.Errorf("reject lyric candidate: %w", err)
		}
		if err := tx.Model(&models.LyricPreference{}).
			Where("song_id = ? AND active_document_id = ?", songID, documentID).
			Updates(map[string]interface{}{
				"active_document_id": "",
				"manual_locked":      false,
				"updated_at":         now,
			}).Error; err != nil {
			return fmt.Errorf("clear rejected lyric: %w", err)
		}
		return nil
	}); err != nil {
		return models.LyricView{}, err
	}
	return s.GetActiveLyric(songID)
}

// DeleteActiveLyric clears the current selection without deleting version
// history. Automatic acquisition only resumes after an explicit user action.
func (s *Service) DeleteActiveLyric(songID string) (models.LyricView, error) {
	if strings.TrimSpace(songID) == "" {
		return models.LyricView{}, fmt.Errorf("song id required")
	}
	now := time.Now()
	preference := models.LyricPreference{SongID: songID, UpdatedAt: now}
	if err := s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "song_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"active_document_id": "",
			"manual_locked":      false,
			"updated_at":         now,
		}),
	}).Create(&preference).Error; err != nil {
		return models.LyricView{}, fmt.Errorf("clear active lyric: %w", err)
	}
	return s.GetActiveLyric(songID)
}

func (s *Service) migrateLegacyLyric(songID string) error {
	var count int64
	if err := s.db.Model(&models.LyricDocument{}).Where("song_id = ?", songID).Count(&count).Error; err != nil || count > 0 {
		return err
	}
	var mapping models.LyricMapping
	if err := s.db.First(&mapping, "id = ?", songID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return fmt.Errorf("load legacy lyric: %w", err)
	}
	if strings.TrimSpace(mapping.Lyric) == "" {
		return s.ensureLyricPreference(songID, mapping.OffsetMS)
	}
	_, err := s.saveLyricDocument(songID, mapping.Lyric, "", "legacy", "本地（旧版）", 1, true, true, "utf-8", mapping.OffsetMS)
	return err
}

func (s *Service) ensureLyricPreference(songID string, offsetMS int) error {
	now := time.Now()
	return s.db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "song_id"}}, DoNothing: true}).
		Create(&models.LyricPreference{SongID: songID, OffsetMS: offsetMS, UpdatedAt: now}).Error
}

func (s *Service) saveLyricDocument(songID, text, filename, source, sourceLabel string, confidence float64, manual, reliable bool, encoding string, offsetMS int) (models.LyricDocument, error) {
	preview, err := previewLyric([]byte(text), filename)
	if err != nil {
		return models.LyricDocument{}, err
	}
	if encoding != "" {
		preview.Encoding = encoding
	}
	return s.saveParsedLyricDocument(songID, preview, source, sourceLabel, confidence, manual, reliable, "", offsetMS)
}

func (s *Service) saveParsedLyricDocument(songID string, preview models.LyricImportPreview, source, sourceLabel string, confidence float64, manual, reliable bool, providerRef string, offsetMS int) (models.LyricDocument, error) {
	hash := lyricContentHash(preview.Text)
	now := time.Now()
	document := models.LyricDocument{
		ID:               uuid.NewString(),
		SongID:           songID,
		Source:           source,
		SourceLabel:      sourceLabel,
		Format:           preview.Format,
		RawText:          preview.Text,
		Lines:            preview.Lines,
		Metadata:         preview.Metadata,
		ContentHash:      hash,
		ProviderRef:      providerRef,
		Encoding:         preview.Encoding,
		Confidence:       confidence,
		EmbeddedOffsetMS: preview.EmbeddedOffsetMS,
		IsManual:         manual,
		IsReliable:       reliable,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if !manual && providerRef != "" {
			var rejected models.LyricDocument
			if err := tx.First(&rejected, "song_id = ? AND source = ? AND provider_ref = ? AND rejected_at IS NOT NULL", songID, source, providerRef).Error; err == nil {
				document = rejected
				return nil
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
		var existing models.LyricDocument
		err := tx.First(&existing, "song_id = ? AND content_hash = ?", songID, hash).Error
		if err == nil {
			document = existing
			if manual && !existing.IsManual {
				if err := tx.Model(&existing).Updates(map[string]interface{}{
					"source":       source,
					"source_label": sourceLabel,
					"provider_ref": "",
					"confidence":   confidence,
					"is_manual":    true,
					"is_reliable":  true,
					"rejected_at":  nil,
					"updated_at":   now,
				}).Error; err != nil {
					return err
				}
				document = existing
				document.Source = source
				document.SourceLabel = sourceLabel
				document.ProviderRef = ""
				document.Confidence = confidence
				document.IsManual = true
				document.IsReliable = true
				document.RejectedAt = nil
				document.UpdatedAt = now
			} else if !manual && reliable && !existing.IsManual && !existing.IsReliable && existing.RejectedAt == nil {
				if err := tx.Model(&existing).Updates(map[string]interface{}{
					"is_reliable":  true,
					"confidence":   confidence,
					"provider_ref": providerRef,
					"updated_at":   now,
				}).Error; err != nil {
					return err
				}
				document.IsReliable = true
				document.Confidence = confidence
				document.ProviderRef = providerRef
				document.UpdatedAt = now
			}
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := tx.Create(&document).Error; err != nil {
				return fmt.Errorf("create lyric document: %w", err)
			}
		} else {
			return err
		}
		if manual {
			preference := models.LyricPreference{
				SongID:           songID,
				ActiveDocumentID: document.ID,
				OffsetMS:         offsetMS,
				ManualLocked:     true,
				UpdatedAt:        now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "song_id"}},
				DoUpdates: clause.Assignments(map[string]interface{}{
					"active_document_id": document.ID,
					"manual_locked":      true,
					"offset_ms":          offsetMS,
					"updated_at":         now,
				}),
			}).Create(&preference).Error; err != nil {
				return err
			}
			return pruneManualLyricHistory(tx, songID, document.ID, now)
		}
		return nil
	})
	return document, err
}

func pruneManualLyricHistory(tx *gorm.DB, songID, activeDocumentID string, now time.Time) error {
	if err := tx.Where("song_id = ? AND is_manual = ? AND id <> ? AND created_at < ?", songID, true, activeDocumentID, now.Add(-30*24*time.Hour)).
		Delete(&models.LyricDocument{}).Error; err != nil {
		return fmt.Errorf("prune expired manual lyrics: %w", err)
	}
	var excess []models.LyricDocument
	if err := tx.Where("song_id = ? AND is_manual = ? AND id <> ?", songID, true, activeDocumentID).
		Order("updated_at DESC").Offset(4).Find(&excess).Error; err != nil {
		return fmt.Errorf("load excess manual lyrics: %w", err)
	}
	if len(excess) == 0 {
		return nil
	}
	ids := make([]string, 0, len(excess))
	for _, document := range excess {
		ids = append(ids, document.ID)
	}
	return tx.Where("id IN ?", ids).Delete(&models.LyricDocument{}).Error
}

func (s *Service) activateLyricDocument(songID, documentID string, manualLocked bool) error {
	now := time.Now()
	return s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "song_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"active_document_id": documentID,
			"manual_locked":      manualLocked,
			"updated_at":         now,
		}),
	}).Create(&models.LyricPreference{
		SongID:           songID,
		ActiveDocumentID: documentID,
		ManualLocked:     manualLocked,
		UpdatedAt:        now,
	}).Error
}

func lyricContentHash(text string) string {
	normalized := strings.TrimSpace(strings.ReplaceAll(text, "\r\n", "\n"))
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

func sortLyricDocuments(documents []models.LyricDocument) {
	sort.SliceStable(documents, func(i, j int) bool {
		if documents[i].Confidence == documents[j].Confidence {
			return documents[i].UpdatedAt.After(documents[j].UpdatedAt)
		}
		return documents[i].Confidence > documents[j].Confidence
	})
}
