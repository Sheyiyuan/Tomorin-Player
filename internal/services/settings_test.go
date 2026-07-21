package services

import (
	"sync"
	"testing"

	"half-beat-player/internal/models"
)

func TestConcurrentInitialSettingsReadsCreateOneRow(t *testing.T) {
	service := testService(t, &models.PlayerSetting{})

	const readers = 12
	errorsFound := make(chan error, readers)
	var waitGroup sync.WaitGroup
	waitGroup.Add(readers)
	for index := 0; index < readers; index++ {
		go func(readThemes bool) {
			defer waitGroup.Done()
			if readThemes {
				_, err := service.GetThemes()
				errorsFound <- err
				return
			}
			_, err := service.GetPlayerSetting()
			errorsFound <- err
		}(index%2 == 0)
	}
	waitGroup.Wait()
	close(errorsFound)

	for err := range errorsFound {
		if err != nil {
			t.Fatalf("concurrent settings read: %v", err)
		}
	}
	var count int64
	if err := service.db.Model(&models.PlayerSetting{}).Count(&count).Error; err != nil {
		t.Fatalf("count settings: %v", err)
	}
	if count != 1 {
		t.Fatalf("settings row count = %d, want 1", count)
	}
}
