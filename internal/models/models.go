package models

import "time"

// StreamSource represents the actual playable audio stream.
// Multiple songs can share the same stream source.
type StreamSource struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	BVID      string    `json:"bvid"`
	StreamURL string    `json:"streamUrl"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Song represents a song instance with independent metadata.
// Each song instance is unique, even if they share the same stream source.
type Song struct {
	ID                 string    `gorm:"primaryKey" json:"id"`
	BVID               string    `gorm:"column:bvid" json:"bvid"`
	Name               string    `json:"name"`
	Singer             string    `json:"singer"`
	SingerID           string    `json:"singerId"`
	Cover              string    `json:"cover"`
	CoverLocal         string    `json:"coverLocal"`
	SourceID           string    `json:"sourceId"`           // Foreign key to StreamSource
	StreamURL          string    `json:"streamUrl"`          // Cache of the stream URL (for backward compatibility)
	StreamURLExpiresAt time.Time `json:"streamUrlExpiresAt"` // Expiration of cached URL
	Lyric              string    `json:"lyric"`
	LyricOffset        int       `json:"lyricOffset"`
	SkipStartTime      float64   `json:"skipStartTime"`
	SkipEndTime        float64   `json:"skipEndTime"`
	PageNumber         int       `json:"pageNumber"` // 分P编号 (1, 2, 3...)
	PageTitle          string    `json:"pageTitle"`  // 分P标题
	VideoTitle         string    `json:"videoTitle"` // 视频主标题
	TotalPages         int       `json:"totalPages"` // 总分P数
	Duration           int64     `json:"duration"`   // Duration of this page in seconds
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// Favorite stores a playlist of songs by id to keep schema simple.
type Favorite struct {
	ID        string          `gorm:"primaryKey" json:"id"`
	Title     string          `json:"title"`
	SongIDs   []SongRef       `gorm:"foreignKey:FavoriteID" json:"songIds"`
	Source    *PlaylistSource `gorm:"foreignKey:FavoriteID;references:ID" json:"source,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type SongRef struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	FavoriteID string `gorm:"index:idx_song_refs_favorite_position,priority:1" json:"favoriteId"`
	SongID     string `json:"songId"`
	Position   int    `gorm:"index;index:idx_song_refs_favorite_position,priority:2" json:"position"`
}

// FavoriteSummary is the lightweight playlist representation used by the UI.
type FavoriteSummary struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	SongCount int             `json:"songCount"`
	Source    *PlaylistSource `json:"source,omitempty"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type FavoriteSongPageRequest struct {
	FavoriteID string `json:"favoriteId"`
	Query      string `json:"query"`
	Offset     int    `json:"offset"`
	Limit      int    `json:"limit"`
}

type FavoriteSongPage struct {
	Items    []Song `json:"items"`
	Total    int    `json:"total"`
	Offset   int    `json:"offset"`
	Limit    int    `json:"limit"`
	Revision string `json:"revision"`
}

type LocalSongSearchRequest struct {
	Query  string `json:"query"`
	Offset int    `json:"offset"`
	Limit  int    `json:"limit"`
}

type LocalSongSearchPage struct {
	Items  []Song `json:"items"`
	Total  int    `json:"total"`
	Offset int    `json:"offset"`
	Limit  int    `json:"limit"`
}

// Theme represents a theme configuration
// Data field stores the complete theme configuration as JSON
// Backend doesn't enforce schema, allowing flexible field changes on frontend
type Theme struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Data       string `gorm:"type:longtext" json:"data"` // JSON string containing theme configuration
	IsDefault  bool   `json:"isDefault"`
	IsReadOnly bool   `json:"isReadOnly"`
}

// PlayerSetting captures basic playback preferences.
type PlayerSetting struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Config    map[string]any `gorm:"column:config;serializer:json" json:"config"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

// Playlist stores the current playback queue state.
type Playlist struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Queue        string    `gorm:"type:longtext" json:"queue"` // JSON array of song IDs
	CurrentIndex int       `json:"currentIndex"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// LoginSession stores persisted login cookie (SESSDATA) for restoring session.
// Single-row table with ID=1.
type LoginSession struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Sessdata  string    `json:"sessdata"`
	SavedAt   time.Time `json:"savedAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PlayHistory stores last played favorite + song.
// Single-row table with ID=1.
type PlayHistory struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	FavoriteID string    `json:"favoriteId"`
	SongID     string    `json:"songId"`
	Timestamp  int64     `json:"timestamp"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// LyricMapping caches text and offset.
type LyricMapping struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Lyric     string    `json:"lyric"`
	OffsetMS  int       `json:"offsetMs"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// LyricLine is a normalized lyric line. Plain-text documents have no lines.
type LyricLine struct {
	StartMS int    `json:"startMs"`
	Text    string `json:"text"`
}

// LyricDocument stores an immutable lyric version. Activating a document is
// handled by LyricPreference so automatic refreshes cannot overwrite manual text.
type LyricDocument struct {
	ID               string            `gorm:"primaryKey" json:"id"`
	SongID           string            `gorm:"index;not null;uniqueIndex:idx_lyric_song_hash" json:"songId"`
	Source           string            `gorm:"index;not null" json:"source"`
	SourceLabel      string            `json:"sourceLabel"`
	Format           string            `gorm:"not null" json:"format"`
	RawText          string            `gorm:"type:longtext;not null" json:"rawText"`
	Lines            []LyricLine       `gorm:"serializer:json;type:longtext" json:"lines"`
	Metadata         map[string]string `gorm:"serializer:json;type:longtext" json:"metadata"`
	ContentHash      string            `gorm:"uniqueIndex:idx_lyric_song_hash;not null" json:"contentHash"`
	ProviderRef      string            `json:"providerRef"`
	SourceURL        string            `json:"sourceUrl"`
	Evidence         map[string]string `gorm:"serializer:json;type:longtext" json:"evidence"`
	Encoding         string            `json:"encoding"`
	Confidence       float64           `json:"confidence"`
	EmbeddedOffsetMS int               `json:"embeddedOffsetMs"`
	IsManual         bool              `gorm:"index" json:"isManual"`
	IsReliable       bool              `gorm:"index" json:"isReliable"`
	RejectedAt       *time.Time        `gorm:"index" json:"rejectedAt,omitempty"`
	RetrievedAt      time.Time         `json:"retrievedAt"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
}

// LyricPreference selects the active version and stores the user's local offset.
type LyricPreference struct {
	SongID           string    `gorm:"primaryKey" json:"songId"`
	ActiveDocumentID string    `gorm:"index" json:"activeDocumentId"`
	OffsetMS         int       `json:"offsetMs"`
	ManualLocked     bool      `gorm:"index" json:"manualLocked"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// LyricView is the complete frontend-facing lyric state for one song.
type LyricView struct {
	SongID       string          `json:"songId"`
	Document     *LyricDocument  `json:"document,omitempty"`
	Candidates   []LyricDocument `json:"candidates"`
	OffsetMS     int             `json:"offsetMs"`
	ManualLocked bool            `json:"manualLocked"`
}

// LyricImportPreview describes decoded input before the user commits it.
type LyricImportPreview struct {
	Text             string            `json:"text"`
	Format           string            `json:"format"`
	Encoding         string            `json:"encoding"`
	Lines            []LyricLine       `json:"lines"`
	Metadata         map[string]string `json:"metadata"`
	EmbeddedOffsetMS int               `json:"embeddedOffsetMs"`
	ValidLineCount   int               `json:"validLineCount"`
	FirstMS          int               `json:"firstMs"`
	LastMS           int               `json:"lastMs"`
	Warnings         []string          `json:"warnings"`
}

// LyricSearchRequest carries identity through asynchronous provider work.
type LyricSearchRequest struct {
	SongID    string `json:"songId"`
	RequestID string `json:"requestId"`
	Force     bool   `json:"force"`
}

// LyricSearchResult lets the frontend reject stale requests deterministically.
type LyricSearchResult struct {
	SongID      string    `json:"songId"`
	RequestID   string    `json:"requestId"`
	View        LyricView `json:"view"`
	AutoApplied bool      `json:"autoApplied"`
	Message     string    `json:"message"`
}

// LyricSearchTask exposes provider work without holding a Wails RPC open.
// Completed tasks are retained for the lifetime of the process so late UI
// subscribers can still read the result after switching songs.
type LyricSearchTask struct {
	RequestID    string             `json:"requestId"`
	SongID       string             `json:"songId"`
	Status       string             `json:"status"`
	Result       *LyricSearchResult `json:"result,omitempty"`
	ErrorCode    string             `json:"errorCode"`
	ErrorMessage string             `json:"errorMessage"`
	Retryable    bool               `json:"retryable"`
	ErrorDetails map[string]string  `json:"errorDetails,omitempty"`
	StartedAt    time.Time          `json:"startedAt"`
	FinishedAt   *time.Time         `json:"finishedAt,omitempty"`
}

// PlaylistSource records a one-way external playlist mirror. Detached sources
// are retained as audit data but are never considered locked again.
type PlaylistSource struct {
	ID               string     `gorm:"primaryKey" json:"id"`
	FavoriteID       string     `gorm:"uniqueIndex;not null" json:"favoriteId"`
	Provider         string     `gorm:"index;not null" json:"provider"`
	RemoteID         string     `gorm:"index;not null" json:"remoteId"`
	RemoteOwnerID    string     `json:"remoteOwnerId"`
	RemoteTitle      string     `json:"remoteTitle"`
	Locked           bool       `gorm:"index" json:"locked"`
	DetachedAt       *time.Time `json:"detachedAt,omitempty"`
	SyncState        string     `gorm:"index" json:"syncState"`
	LastErrorCode    string     `json:"lastErrorCode"`
	LastErrorMessage string     `json:"lastErrorMessage"`
	LastSnapshotHash string     `json:"lastSnapshotHash"`
	RemoteCount      int        `json:"remoteCount"`
	LastSyncedAt     *time.Time `json:"lastSyncedAt,omitempty"`
	LastAttemptedAt  *time.Time `json:"lastAttemptedAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

// PlaylistSourceItem maps a stable remote page key to its local song.
type PlaylistSourceItem struct {
	ID         string    `gorm:"primaryKey" json:"id"`
	SourceID   string    `gorm:"index;not null;uniqueIndex:idx_source_remote_key" json:"sourceId"`
	RemoteKey  string    `gorm:"not null;uniqueIndex:idx_source_remote_key" json:"remoteKey"`
	BVID       string    `gorm:"index;not null" json:"bvid"`
	PageNumber int       `json:"pageNumber"`
	SongID     string    `gorm:"index" json:"songId"`
	Position   int       `gorm:"index" json:"position"`
	State      string    `gorm:"index" json:"state"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// PlaylistSyncRun is an append-only synchronization audit record.
type PlaylistSyncRun struct {
	ID               string     `gorm:"primaryKey" json:"id"`
	SourceID         string     `gorm:"index;not null" json:"sourceId"`
	Status           string     `gorm:"index;not null" json:"status"`
	SnapshotComplete bool       `json:"snapshotComplete"`
	RemoteCount      int        `json:"remoteCount"`
	ResolvedCount    int        `json:"resolvedCount"`
	AddedCount       int        `json:"addedCount"`
	RemovedCount     int        `json:"removedCount"`
	SkippedCount     int        `json:"skippedCount"`
	PendingCount     int        `json:"pendingCount"`
	ErrorCode        string     `json:"errorCode"`
	ErrorMessage     string     `json:"errorMessage"`
	StartedAt        time.Time  `json:"startedAt"`
	FinishedAt       *time.Time `json:"finishedAt,omitempty"`
}

// PlaylistSyncStatus is returned by sync-related Wails APIs.
type PlaylistSyncStatus struct {
	Source *PlaylistSource  `json:"source,omitempty"`
	Run    *PlaylistSyncRun `json:"run,omitempty"`
}

// PlaylistSyncProgress is process-local progress for imports and synchronizations.
type PlaylistSyncProgress struct {
	Stage               string `json:"stage"`
	FavoriteID          string `json:"favoriteId,omitempty"`
	CompletedVideoCount int    `json:"completedVideoCount"`
	TotalVideoCount     int    `json:"totalVideoCount"`
	SkippedCount        int    `json:"skippedCount"`
}

// FavoriteSyncTask represents one process-level task. A task can contain more
// than one local favorite when they mirror the same remote source.
type FavoriteSyncTask struct {
	ID                 string               `json:"id"`
	FavoriteIDs        []string             `json:"favoriteIds"`
	Status             string               `json:"status"`
	CompletedFavorites int                  `json:"completedFavorites"`
	TotalFavorites     int                  `json:"totalFavorites"`
	Progress           PlaylistSyncProgress `json:"progress"`
	Result             *PlaylistSyncStatus  `json:"result,omitempty"`
	ErrorCode          string               `json:"errorCode"`
	ErrorMessage       string               `json:"errorMessage"`
	Retryable          bool                 `json:"retryable"`
	ErrorDetails       map[string]string    `json:"errorDetails,omitempty"`
	StartedAt          time.Time            `json:"startedAt"`
	FinishedAt         *time.Time           `json:"finishedAt,omitempty"`
}

type BiliFavoriteImportRequest struct {
	RemoteID int64  `json:"remoteId"`
	Name     string `json:"name"`
	Locked   bool   `json:"locked"`
}

type BiliFavoriteImportResult struct {
	Favorite   Favorite           `json:"favorite"`
	SyncStatus PlaylistSyncStatus `json:"syncStatus"`
}

// BiliFavoriteImportTask represents one process-local asynchronous import.
type BiliFavoriteImportTask struct {
	ID           string                    `json:"id"`
	Status       string                    `json:"status"`
	Progress     PlaylistSyncProgress      `json:"progress"`
	Result       *BiliFavoriteImportResult `json:"result,omitempty"`
	ErrorCode    string                    `json:"errorCode"`
	ErrorMessage string                    `json:"errorMessage"`
	Retryable    bool                      `json:"retryable"`
	ErrorDetails map[string]string         `json:"errorDetails,omitempty"`
	StartedAt    time.Time                 `json:"startedAt"`
	FinishedAt   *time.Time                `json:"finishedAt,omitempty"`
}

// BiliFavoriteCollection represents a Bilibili favorite folder
type BiliFavoriteCollection struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Count int    `json:"count"`
	Cover string `json:"cover"`
}

// BiliFavoriteInfo represents a single favorite item (video)
type BiliFavoriteInfo struct {
	BVID  string `json:"bvid"`
	Title string `json:"title"`
	Cover string `json:"cover"`
}

// BiliAudio captures resolved audio URL and cache metadata
type BiliAudio struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
	FromCache bool      `json:"fromCache"`
	Title     string    `json:"title"`
	Format    string    `json:"format"`
	Cover     string    `json:"cover"`
	Duration  int64     `json:"duration"`
	Author    string    `json:"author"`
}

// PageInfo represents a single page (part) of a Bilibili video
type PageInfo struct {
	Page     int    `json:"page"`
	Cid      int64  `json:"cid"`
	Part     string `json:"part"` // 分P标题
	Duration int64  `json:"duration"`
}

// CompleteVideoInfo represents complete information about a Bilibili video
type CompleteVideoInfo struct {
	BVID     string     `json:"bvid"`
	Title    string     `json:"title"` // 主标题
	Cover    string     `json:"cover"`
	Author   string     `json:"author"`
	Duration int64      `json:"duration"` // 总时长
	Pages    []PageInfo `json:"pages"`    // 所有分P信息
}
