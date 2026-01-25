package services

import (
    "encoding/json"
    "errors"
    "fmt"
    "time"

    "half-beat-player/internal/models"

    "github.com/google/uuid"
    "gorm.io/gorm"
)

// SavePlayerSetting overwrites the single settings row.
func (s *Service) SavePlayerSetting(setting models.PlayerSetting) error {
	var existing models.PlayerSetting
	if err := s.db.First(&existing, 1).Error; err == nil {
		if existing.Config == nil {
			existing.Config = make(map[string]any)
		}
		// Merge new config into existing one
		for k, v := range setting.Config {
			existing.Config[k] = v
		}
		existing.UpdatedAt = time.Now()
		err := s.db.Save(&existing).Error
		if err != nil {
			fmt.Printf("SavePlayerSetting error: %v\n", err)
		}
		return err
	}

	// If not found, create new
	setting.ID = 1
	setting.UpdatedAt = time.Now()
	err := s.db.Save(&setting).Error
	if err != nil {
		fmt.Printf("SavePlayerSetting error: %v\n", err)
	}
	return err
}

// GetPlayerSetting returns the stored setting (or defaults).
func (s *Service) GetPlayerSetting() (models.PlayerSetting, error) {
	var setting models.PlayerSetting
	if err := s.db.First(&setting, 1).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			themesJSON, _ := formatThemesJSON([]models.Theme{})
			setting = models.PlayerSetting{
				ID: 1,
				Config: map[string]any{
					"playMode":             "order",
					"defaultVolume":        0.5,
					"themes":               themesJSON,
					"currentThemeId":       "light",
					"volumeCompensationDb": 0,
					"songVolumeOffsets":    map[string]any{},
				},
			}
			if err := s.db.Create(&setting).Error; err != nil {
				return setting, err
			}
			fmt.Printf("GetPlayerSetting: Created default settings\n")
			return setting, nil
		}
		return setting, err
	}
	if setting.Config == nil {
		setting.Config = make(map[string]any)
	}
	return setting, nil
}

// Helper to get string from config map
func getConfigString(m map[string]any, key string, defaultValue string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return defaultValue
}

// formatThemesJSON converts theme slice to JSON string
func formatThemesJSON(themes []models.Theme) (string, error) {
    data, err := json.Marshal(themes)
    return string(data), err
}

// parseThemesJSON converts JSON string back to theme slice
func parseThemesJSON(themesJSON string) ([]models.Theme, error) {
    var themes []models.Theme
    if themesJSON == "" || themesJSON == "null" {
        return themes, nil
    }
    if err := json.Unmarshal([]byte(themesJSON), &themes); err != nil {
        // Return empty slice instead of nil on error
        return themes, err
    }
    return themes, nil
}

// GetThemes returns all available themes
func (s *Service) GetThemes() ([]models.Theme, error) {
	setting, err := s.GetPlayerSetting()
	if err != nil {
		fmt.Printf("GetThemes: GetPlayerSetting error: %v\n", err)
		return []models.Theme{}, err
	}
	themesJSON := getConfigString(setting.Config, "themes", "")
	themes, err := parseThemesJSON(themesJSON)
	if err != nil {
		fmt.Printf("GetThemes: parseThemesJSON error: %v\n", err)
		return []models.Theme{}, err
	}
	return themes, nil
}

// CreateTheme adds a new custom theme
func (s *Service) CreateTheme(theme models.Theme) (models.Theme, error) {
	setting, err := s.GetPlayerSetting()
	if err != nil {
		return theme, err
	}

	themesJSON := getConfigString(setting.Config, "themes", "")
	themes, err := parseThemesJSON(themesJSON)
	if err != nil {
		return theme, err
	}

	// Generate unique ID for new theme
	theme.ID = "theme-" + uuid.NewString()
	theme.IsDefault = false
	theme.IsReadOnly = false
	themes = append(themes, theme)

	newThemesJSON, err := formatThemesJSON(themes)
	if err != nil {
		return theme, err
	}

	setting.Config["themes"] = newThemesJSON
	err = s.SavePlayerSetting(setting)
	return theme, err
}

// UpdateTheme modifies an existing custom theme
func (s *Service) UpdateTheme(theme models.Theme) error {
	setting, err := s.GetPlayerSetting()
	if err != nil {
		return err
	}

	themesJSON := getConfigString(setting.Config, "themes", "")
	themes, err := parseThemesJSON(themesJSON)
	if err != nil {
		return err
	}

	found := false
	for i, t := range themes {
		if t.ID == theme.ID {
			// 保留 IsDefault 属性
			theme.IsDefault = t.IsDefault
			themes[i] = theme
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("theme not found: %s", theme.ID)
	}

	newThemesJSON, err := formatThemesJSON(themes)
	if err != nil {
		return err
	}

	setting.Config["themes"] = newThemesJSON
	return s.SavePlayerSetting(setting)
}

// DeleteTheme removes a custom theme
func (s *Service) DeleteTheme(themeID string) error {
	setting, err := s.GetPlayerSetting()
	if err != nil {
		return err
	}

	themesJSON := getConfigString(setting.Config, "themes", "")
	themes, err := parseThemesJSON(themesJSON)
	if err != nil {
		return err
	}

	newThemes := []models.Theme{}
	for _, t := range themes {
		if t.ID == themeID {
			if t.IsDefault {
				return fmt.Errorf("cannot delete default theme")
			}
			continue
		}
		newThemes = append(newThemes, t)
	}

	// If deleted theme was current, switch to light theme
	if getConfigString(setting.Config, "currentThemeId", "") == themeID {
		setting.Config["currentThemeId"] = "light"
	}

	newThemesJSON, err := formatThemesJSON(newThemes)
	if err != nil {
		return err
	}

	setting.Config["themes"] = newThemesJSON
	return s.SavePlayerSetting(setting)
}

// SetCurrentTheme changes the active theme
func (s *Service) SetCurrentTheme(themeID string) error {
	setting, err := s.GetPlayerSetting()
	if err != nil {
		return err
	}

	setting.Config["currentThemeId"] = themeID
	return s.SavePlayerSetting(setting)
}
