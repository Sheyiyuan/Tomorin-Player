package db

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open opens (and migrates) a SQLite database at the given path.
func Open(dbPath string, migrate func(*gorm.DB) error) (*gorm.DB, error) {
	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return nil, fmt.Errorf("resolve db path: %w", err)
	}
	dbPath = absPath
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o700); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}
	if filepath.Dir(dbPath) != "." {
		if err := os.Chmod(filepath.Dir(dbPath), 0o700); err != nil {
			return nil, fmt.Errorf("secure db dir: %w", err)
		}
	}

	dsn := (&url.URL{
		Scheme:   "file",
		Path:     filepath.ToSlash(dbPath),
		RawQuery: "_busy_timeout=5000&_foreign_keys=on",
	}).String()
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		// 禁用 GORM 默认日志，防止 RecordNotFound 错误被打印
		Logger: logger.Discard,
	})
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := os.Chmod(dbPath, 0o600); err != nil {
		closeDB(db)
		return nil, fmt.Errorf("secure sqlite file: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		closeDB(db)
		return nil, fmt.Errorf("get sqlite handle: %w", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	if migrate != nil {
		if err := migrate(db); err != nil {
			closeDB(db)
			return nil, fmt.Errorf("migrate: %w", err)
		}
	}

	log.Printf("database ready at %s", dbPath)
	return db, nil
}

func closeDB(db *gorm.DB) {
	sqlDB, err := db.DB()
	if err == nil {
		_ = sqlDB.Close()
	}
}
