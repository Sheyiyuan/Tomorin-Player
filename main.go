package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"half-beat-player/internal/db"
	"half-beat-player/internal/models"
	"half-beat-player/internal/proxy"
	"half-beat-player/internal/services"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"gorm.io/gorm"
)

//go:embed frontend/dist
var assets embed.FS

var audioProxy *proxy.AudioProxy

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func resolveDataDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return secureDataDir(filepath.Join("app_data"))
	}

	dir := filepath.Join(configDir, "half-beat", "app_data")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return secureDataDir(filepath.Join("app_data"))
	}
	_ = os.Chmod(dir, 0o700)
	return dir
}

func secureDataDir(dir string) string {
	_ = os.MkdirAll(dir, 0o700)
	_ = os.Chmod(dir, 0o700)
	return dir
}

func run() error {
	dataDir := resolveDataDir()
	dbPath := filepath.Join(dataDir, "half-beat.db")

	gormDB, err := db.Open(dbPath, func(gdb *gorm.DB) error {
		// 标准迁移
		if err := gdb.AutoMigrate(
			&models.StreamSource{},
			&models.Song{},
			&models.Favorite{},
			&models.SongRef{},
			&models.PlayerSetting{},
			&models.LyricMapping{},
			&models.LyricDocument{},
			&models.LyricPreference{},
			&models.PlaylistSource{},
			&models.PlaylistSourceItem{},
			&models.PlaylistSyncRun{},
			&models.Playlist{},
			&models.LoginSession{},
			&models.PlayHistory{},
		); err != nil {
			return err
		}
		// 确保 songs 表有 bvid 列（兼容旧数据库）
		if !gdb.Migrator().HasColumn(&models.Song{}, "bvid") {
			if err := gdb.Migrator().AddColumn(&models.Song{}, "bvid"); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	sqlDB, err := gormDB.DB()
	if err != nil {
		return fmt.Errorf("get sql database: %w", err)
	}
	var cleanupOnce sync.Once
	cleanup := func() {
		cleanupOnce.Do(func() {
			if audioProxy != nil {
				_ = audioProxy.Stop()
			}
			_ = sqlDB.Close()
		})
	}
	defer cleanup()

	backend := services.NewService(gormDB, dataDir)
	if err := backend.Seed(); err != nil {
		return err
	}
	if err := backend.MigrateLegacyLyrics(); err != nil {
		return fmt.Errorf("migrate legacy lyrics: %w", err)
	}
	if err := backend.RecoverInterruptedPlaylistSyncs(); err != nil {
		return fmt.Errorf("recover interrupted playlist syncs: %w", err)
	}

	// Bind an available loopback port before showing the application.
	audioProxy = proxy.NewAudioProxy(0, nil, dataDir)
	if err := audioProxy.Start(); err != nil {
		return fmt.Errorf("start audio proxy: %w", err)
	}
	services.SetAudioProxy(backend, audioProxy)

	return wails.Run(&options.App{
		Title:     "half-beat",
		Width:     1280,
		Height:    800,
		MinWidth:  900,
		MinHeight: 640,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Logger:           logger.NewDefaultLogger(),
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 30, A: 1},
		OnStartup: func(ctx context.Context) {
			services.SetAppContext(backend, ctx)
		},
		OnShutdown: func(ctx context.Context) {
			log.Println("OnShutdown called")
			cleanup()
		},
		Bind: []interface{}{backend},
	})
}
