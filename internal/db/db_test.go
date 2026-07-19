package db

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"gorm.io/gorm"
)

func TestOpenConfiguresSQLiteAndPermissions(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "data")
	path := filepath.Join(dir, "player.db")
	database, err := Open(path, nil)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	sqlDB, err := database.DB()
	if err != nil {
		t.Fatalf("get sql DB: %v", err)
	}
	defer sqlDB.Close()

	for pragma, want := range map[string]int{"busy_timeout": 5000, "foreign_keys": 1} {
		var got int
		if err := database.Raw(fmt.Sprintf("PRAGMA %s", pragma)).Scan(&got).Error; err != nil {
			t.Fatalf("read %s: %v", pragma, err)
		}
		if got != want {
			t.Errorf("PRAGMA %s = %d, want %d", pragma, got, want)
		}
	}

	dirInfo, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("stat data dir: %v", err)
	}
	if got := dirInfo.Mode().Perm(); got != 0o700 {
		t.Errorf("data dir mode = %o, want 700", got)
	}
	fileInfo, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat db file: %v", err)
	}
	if got := fileInfo.Mode().Perm(); got != 0o600 {
		t.Errorf("db mode = %o, want 600", got)
	}
}

func TestOpenReturnsMigrationError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "player.db")
	database, err := Open(path, func(*gorm.DB) error { return fmt.Errorf("migration failed") })
	if database != nil {
		t.Fatal("expected nil database after migration failure")
	}
	if err == nil || err.Error() != "migrate: migration failed" {
		t.Fatalf("unexpected error: %v", err)
	}
}
