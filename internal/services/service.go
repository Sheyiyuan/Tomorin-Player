package services

import (
	"context"
	"fmt"
	"half-beat-player/internal/netguard"
	"half-beat-player/internal/proxy"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gorm.io/gorm"
)

// Service exposes backend operations to the Wails frontend.
type Service struct {
	db                 *gorm.DB
	session            *sessionState
	httpClient         *http.Client
	streamClient       *http.Client
	publicStreamClient *http.Client
	dataDir            string // 数据目录用于存储 cookie
	appCtx             context.Context
	audioProxy         *proxy.AudioProxy
	sessionPersistMu   sync.Mutex
}

func NewService(db *gorm.DB, dataDir string) *Service {
	session := newSessionState()
	newTransport := func() *http.Transport {
		return &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   10 * time.Second, // 连接超时
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			IdleConnTimeout:       90 * time.Second,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   10,
			ResponseHeaderTimeout: 30 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}
	}

	client := &http.Client{
		Transport: &sessionTransport{base: newTransport(), session: session},
		Timeout:   30 * time.Second, // 默认请求超时
	}
	streamClient := netguard.NewPublicGateway(netguard.Config{
		AllowedHostSuffixes: []string{"bilivideo.com", "bilivideo.cn"},
	})
	publicStreamClient := netguard.NewPublicGateway(netguard.Config{})

	// 确保数据目录存在（跨平台用户级路径）
	_ = os.MkdirAll(dataDir, 0o700)
	_ = os.Chmod(dataDir, 0o700)
	// 确保音频缓存目录存在，便于用户可见且避免首次写入失败
	_ = os.MkdirAll(filepath.Join(dataDir, cacheDir), 0o700)
	_ = os.Chmod(filepath.Join(dataDir, cacheDir), 0o700)

	service := &Service{
		db:                 db,
		session:            session,
		httpClient:         client,
		streamClient:       streamClient,
		publicStreamClient: publicStreamClient,
		dataDir:            dataDir,
	}

	// 在启动时尝试恢复之前的登录状态
	_ = service.restoreLogin()

	return service
}

// SetAudioProxy wires process-local infrastructure without exposing it as a Wails RPC.
func SetAudioProxy(service *Service, audioProxy *proxy.AudioProxy) {
	service.audioProxy = audioProxy
}

// EnsureAudioProxyRunning attempts to start the local audio proxy.
// It is safe to call multiple times.
func (s *Service) EnsureAudioProxyRunning() (string, error) {
	if s.audioProxy == nil {
		return "", fmt.Errorf("audio proxy not initialised")
	}
	if s.audioProxy.IsRunning() {
		return s.audioProxy.GetBaseURL(), nil
	}
	if err := s.audioProxy.Start(); err != nil {
		return "", fmt.Errorf("start audio proxy: %w", err)
	}
	return s.audioProxy.GetBaseURL(), nil
}

// GetProxyBaseURL returns the active process-scoped proxy URL.
func (s *Service) GetProxyBaseURL() string {
	if s.audioProxy != nil {
		return s.audioProxy.GetBaseURL()
	}
	return ""
}

// GetImageProxyURL returns a proxied URL for images to bypass CORS restrictions
func (s *Service) GetImageProxyURL(imageURL string) string {
	if imageURL == "" {
		return ""
	}
	if s.audioProxy != nil {
		return s.audioProxy.GetImageProxyURL(imageURL)
	}
	return ""
}

func (s *Service) getAudioProxyURL(audioURL string) string {
	if s.audioProxy != nil {
		return s.audioProxy.GetProxyURL(audioURL)
	}
	return ""
}

// RefreshProxyURL rebuilds a persisted loopback URL with the current port and token.
func (s *Service) RefreshProxyURL(rawURL string) string {
	if s.audioProxy == nil {
		return ""
	}
	return s.audioProxy.RefreshProxyURL(rawURL)
}

// SetAppContext wires the Wails runtime context without exposing it as a Wails RPC.
func SetAppContext(service *Service, ctx context.Context) {
	service.appCtx = ctx
}

// 窗口控制方法
func (s *Service) MinimiseWindow() {
	if s.appCtx != nil {
		runtime.WindowMinimise(s.appCtx)
	}
}

func (s *Service) MaximizeWindow() {
	if s.appCtx != nil {
		runtime.WindowMaximise(s.appCtx)
	}
}

func (s *Service) UnmaximizeWindow() {
	if s.appCtx != nil {
		runtime.WindowUnmaximise(s.appCtx)
	}
}

func (s *Service) IsWindowMaximized() bool {
	if s.appCtx != nil {
		return runtime.WindowIsMaximised(s.appCtx)
	}
	return false
}

// 最小化到托盘（隐藏窗口）
func (s *Service) MinimizeToTray() {
	if s.appCtx != nil {
		runtime.WindowHide(s.appCtx)
	}
}

// 直接退出应用
func (s *Service) QuitApp() {
	if s.appCtx != nil {
		runtime.Quit(s.appCtx)
	}
}
