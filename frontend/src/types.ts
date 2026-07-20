// Re-export from wailsjs generated models
export { models } from "../wailsjs/go/models";
export { services } from "../wailsjs/go/models";

// Type aliases for convenience
import { models, services } from "../wailsjs/go/models";
import { DEFAULT_TOOLTIP_COLORS } from "./utils/themeDefaults";

// Define clean data types without protobuf methods
export interface Song {
    id: string;
    bvid: string;
    name: string;
    singer: string;
    singerId: string;
    cover: string;
    coverLocal: string;
    sourceId: string;
    streamUrl: string;
    streamUrlExpiresAt: string;
    lyric: string;
    lyricOffset: number;
    skipStartTime: number;
    skipEndTime: number;
    pageNumber: number;
    pageTitle: string;
    videoTitle: string;
    totalPages: number;
	duration?: number;
    createdAt: string;
    updatedAt: string;
}

export interface SongRef {
    id: number;
    favoriteId: string;
    songId: string;
	position: number;
}

export interface PlaylistSource {
	id: string;
	favoriteId: string;
	provider: string;
	remoteId: string;
	remoteOwnerId?: string;
	remoteTitle?: string;
	locked: boolean;
	detachedAt?: string;
	syncState: string;
	lastErrorCode: string;
	lastErrorMessage: string;
	lastSnapshotHash: string;
	remoteCount: number;
	lastSyncedAt?: string;
	lastAttemptedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Favorite {
    id: string;
    title: string;
    songIds: SongRef[];
	source?: PlaylistSource;
    createdAt: string;
    updatedAt: string;
}

export interface LyricLine {
	startMs: number;
	text: string;
}

export interface LyricDocument {
	id: string;
	songId: string;
	source: string;
	sourceLabel: string;
	format: 'lrc' | 'plain';
	rawText: string;
	lines: LyricLine[];
	metadata: Record<string, string>;
	contentHash: string;
	providerRef: string;
	sourceUrl?: string;
	evidence?: Record<string, string>;
	encoding: string;
	confidence: number;
	embeddedOffsetMs: number;
	isManual: boolean;
	isReliable: boolean;
	rejectedAt?: string;
	retrievedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface LyricView {
	songId: string;
	document?: LyricDocument;
	candidates: LyricDocument[];
	offsetMs: number;
	manualLocked: boolean;
}

export interface LyricImportPreview {
	text: string;
	format: 'lrc' | 'plain';
	encoding: string;
	lines: LyricLine[];
	metadata: Record<string, string>;
	embeddedOffsetMs: number;
	validLineCount: number;
	firstMs: number;
	lastMs: number;
	warnings: string[];
}

export interface LyricSearchResult {
	songId: string;
	requestId: string;
	view: LyricView;
	autoApplied: boolean;
	message: string;
}

export interface LyricSearchTask {
	requestId: string;
	songId: string;
	status: 'queued' | 'running' | 'succeeded' | 'failed';
	result?: LyricSearchResult;
	errorCode: string;
	errorMessage: string;
	retryable: boolean;
	errorDetails: Record<string, string>;
	startedAt: string;
	finishedAt?: string;
}

export interface PlaylistSyncRun {
	id: string;
	sourceId: string;
	status: string;
	snapshotComplete: boolean;
	remoteCount: number;
	resolvedCount?: number;
	addedCount: number;
	removedCount: number;
	pendingCount: number;
	errorCode: string;
	errorMessage: string;
	startedAt: string;
	finishedAt?: string;
}

export interface PlaylistSyncStatus {
	source?: PlaylistSource;
	run?: PlaylistSyncRun;
}

export interface FavoriteSyncTask {
	id: string;
	favoriteIds: string[];
	status: 'queued' | 'running' | 'succeeded' | 'failed';
	completedFavorites: number;
	totalFavorites: number;
	result?: PlaylistSyncStatus;
	errorCode: string;
	errorMessage: string;
	retryable: boolean;
	errorDetails: Record<string, string>;
	startedAt: string;
	finishedAt?: string;
}

export interface PlayerSetting {
    id: number;
    config: Record<string, unknown>;
    updatedAt: string;
}

export interface LyricMapping {
    id: string;
    lyric: string;
    offsetMs: number;
    updatedAt: string;
}
export type Playlist = models.Playlist;
export type ExportData = services.ExportData;
export type BiliAudio = models.BiliAudio;

// Extend Theme to include new properties from JSON data
export interface Theme extends models.Theme {
    // 基础设置
    themeColor?: string;
    colorScheme?: string;
    // 背景设置
    backgroundColor?: string;
    backgroundOpacity?: number;
    backgroundImage?: string;
    backgroundImageSourceUrl?: string;
    backgroundBlur?: number;
    // 面板设置
    panelColor?: string;
    panelOpacity?: number;
    panelBlur?: number;
    panelRadius?: number;
    // 控件与文字
    controlColor?: string;
    controlOpacity?: number;
    controlBlur?: number;
    textColorPrimary?: string;
    textColorSecondary?: string;
    tooltipBackgroundColor?: string;
    tooltipTextColor?: string;
    tooltipBorderColor?: string;
    // 歌单卡片
    favoriteCardColor?: string;
    cardOpacity?: number;
    // 其他设置
    componentRadius?: number;
    modalRadius?: number;
    notificationRadius?: number;
    coverRadius?: number;
    // 模态框设置
    modalColor?: string;
    modalOpacity?: number;
    modalBlur?: number;
    // 窗口控制
    windowControlsPos?: string;
}

export interface UserInfo {
    uid: number;
    username: string;
    face: string;
    level: number;
    vipType: number;
}

export interface BVPreview {
    bvid: string;
    title: string;
    cover: string;
    duration: number;
    author?: string;
    url?: string;
    expiresAt?: string;
    isLocal?: boolean;
    pageNumber?: number;
    pageTitle?: string;
    singlePageOnly?: boolean;
}

export interface DerivedStyles {
    panelBackground?: string;
    controlBackground?: string;
    favoriteCardBackground?: string;
    modalBackground?: string;
    modalBlur?: number;
    modalRadius?: number;
    componentRadius?: number;
    textColorPrimary?: string;
    textColorSecondary?: string;
}

// Export classes for runtime use
export const SongClass = models.Song;
export const FavoriteClass = models.Favorite;
export const SongRefClass = models.SongRef;
export const PlayerSettingClass = models.PlayerSetting;
export const LyricMappingClass = models.LyricMapping;

// Type conversion functions
const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

const asString = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'toString' in value) return String(value);
    return '';
};

const asNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const asBoolean = (value: unknown): boolean => value === true;

const asOptionalString = (value: unknown): string | undefined => {
	const result = asString(value);
	return result || undefined;
};

const asStringRecord = (value: unknown): Record<string, string> => {
	const record = asRecord(value);
	return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
};
const stringOr = (value: unknown, fallback: string): string => typeof value === 'string' ? value : fallback;
const numberOr = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function convertSong(value: unknown): Song {
    const s = asRecord(value);
    return {
        id: asString(s.id),
        bvid: asString(s.bvid),
        name: asString(s.name),
        singer: asString(s.singer),
        singerId: asString(s.singerId),
        cover: asString(s.cover),
        coverLocal: asString(s.coverLocal),
        sourceId: asString(s.sourceId),
        streamUrl: asString(s.streamUrl),
        streamUrlExpiresAt: asString(s.streamUrlExpiresAt),
        lyric: asString(s.lyric),
        lyricOffset: asNumber(s.lyricOffset),
        skipStartTime: asNumber(s.skipStartTime),
        skipEndTime: asNumber(s.skipEndTime),
        pageNumber: asNumber(s.pageNumber),
        pageTitle: asString(s.pageTitle),
        videoTitle: asString(s.videoTitle),
        totalPages: asNumber(s.totalPages),
		duration: asNumber(s.duration),
        createdAt: asString(s.createdAt),
        updatedAt: asString(s.updatedAt),
    };
}

export function convertSongs(songs: readonly unknown[]): Song[] {
    return songs.map(convertSong);
}

export function convertSongRef(value: unknown): SongRef {
    const ref = asRecord(value);
    return {
        id: asNumber(ref.id),
        favoriteId: asString(ref.favoriteId),
        songId: asString(ref.songId),
		position: asNumber(ref.position),
    };
}

export function convertPlaylistSource(value: unknown): PlaylistSource {
	const source = asRecord(value);
	return {
		id: asString(source.id),
		favoriteId: asString(source.favoriteId),
		provider: asString(source.provider),
		remoteId: asString(source.remoteId),
		remoteOwnerId: asString(source.remoteOwnerId),
		remoteTitle: asString(source.remoteTitle),
		locked: asBoolean(source.locked),
		detachedAt: asOptionalString(source.detachedAt),
		syncState: asString(source.syncState),
		lastErrorCode: asString(source.lastErrorCode),
		lastErrorMessage: asString(source.lastErrorMessage),
		lastSnapshotHash: asString(source.lastSnapshotHash),
		remoteCount: asNumber(source.remoteCount),
		lastSyncedAt: asOptionalString(source.lastSyncedAt),
		lastAttemptedAt: asOptionalString(source.lastAttemptedAt),
		createdAt: asString(source.createdAt),
		updatedAt: asString(source.updatedAt),
	};
}

export function convertFavorite(value: unknown): Favorite {
    const f = asRecord(value);
    return {
        id: asString(f.id),
        title: asString(f.title),
        songIds: Array.isArray(f.songIds) ? f.songIds.map(convertSongRef) : [],
		source: f.source ? convertPlaylistSource(f.source) : undefined,
        createdAt: asString(f.createdAt),
        updatedAt: asString(f.updatedAt),
    };
}

export function convertLyricLine(value: unknown): LyricLine {
	const line = asRecord(value);
	return { startMs: asNumber(line.startMs), text: asString(line.text) };
}

export function convertLyricDocument(value: unknown): LyricDocument {
	const document = asRecord(value);
	return {
		id: asString(document.id),
		songId: asString(document.songId),
		source: asString(document.source),
		sourceLabel: asString(document.sourceLabel),
		format: document.format === 'lrc' ? 'lrc' : 'plain',
		rawText: asString(document.rawText),
		lines: Array.isArray(document.lines) ? document.lines.map(convertLyricLine) : [],
		metadata: asStringRecord(document.metadata),
		contentHash: asString(document.contentHash),
		providerRef: asString(document.providerRef),
		sourceUrl: asString(document.sourceUrl),
		evidence: asStringRecord(document.evidence),
		encoding: asString(document.encoding),
		confidence: asNumber(document.confidence),
		embeddedOffsetMs: asNumber(document.embeddedOffsetMs),
		isManual: asBoolean(document.isManual),
		isReliable: asBoolean(document.isReliable),
		rejectedAt: asOptionalString(document.rejectedAt),
		retrievedAt: asString(document.retrievedAt),
		createdAt: asString(document.createdAt),
		updatedAt: asString(document.updatedAt),
	};
}

export function convertLyricView(value: unknown): LyricView {
	const view = asRecord(value);
	return {
		songId: asString(view.songId),
		document: view.document ? convertLyricDocument(view.document) : undefined,
		candidates: Array.isArray(view.candidates) ? view.candidates.map(convertLyricDocument) : [],
		offsetMs: asNumber(view.offsetMs),
		manualLocked: asBoolean(view.manualLocked),
	};
}

export function convertLyricImportPreview(value: unknown): LyricImportPreview {
	const preview = asRecord(value);
	return {
		text: asString(preview.text),
		format: preview.format === 'lrc' ? 'lrc' : 'plain',
		encoding: asString(preview.encoding),
		lines: Array.isArray(preview.lines) ? preview.lines.map(convertLyricLine) : [],
		metadata: asStringRecord(preview.metadata),
		embeddedOffsetMs: asNumber(preview.embeddedOffsetMs),
		validLineCount: asNumber(preview.validLineCount),
		firstMs: asNumber(preview.firstMs),
		lastMs: asNumber(preview.lastMs),
		warnings: Array.isArray(preview.warnings) ? preview.warnings.map(asString).filter(Boolean) : [],
	};
}

export function convertLyricSearchResult(value: unknown): LyricSearchResult {
	const result = asRecord(value);
	return {
		songId: asString(result.songId),
		requestId: asString(result.requestId),
		view: convertLyricView(result.view),
		autoApplied: asBoolean(result.autoApplied),
		message: asString(result.message),
	};
}

export function convertLyricSearchTask(value: unknown): LyricSearchTask {
	const task = asRecord(value);
	const status = task.status === 'running' || task.status === 'succeeded' || task.status === 'failed' ? task.status : 'queued';
	return {
		requestId: asString(task.requestId),
		songId: asString(task.songId),
		status,
		result: task.result ? convertLyricSearchResult(task.result) : undefined,
		errorCode: asString(task.errorCode),
		errorMessage: asString(task.errorMessage),
		retryable: asBoolean(task.retryable),
		errorDetails: asStringRecord(task.errorDetails),
		startedAt: asString(task.startedAt),
		finishedAt: asOptionalString(task.finishedAt),
	};
}

export function convertPlaylistSyncRun(value: unknown): PlaylistSyncRun {
	const run = asRecord(value);
	return {
		id: asString(run.id), sourceId: asString(run.sourceId), status: asString(run.status),
		snapshotComplete: asBoolean(run.snapshotComplete), remoteCount: asNumber(run.remoteCount),
		resolvedCount: asNumber(run.resolvedCount),
		addedCount: asNumber(run.addedCount), removedCount: asNumber(run.removedCount), pendingCount: asNumber(run.pendingCount),
		errorCode: asString(run.errorCode), errorMessage: asString(run.errorMessage), startedAt: asString(run.startedAt),
		finishedAt: asOptionalString(run.finishedAt),
	};
}

export function convertPlaylistSyncStatus(value: unknown): PlaylistSyncStatus {
	const status = asRecord(value);
	return {
		source: status.source ? convertPlaylistSource(status.source) : undefined,
		run: status.run ? convertPlaylistSyncRun(status.run) : undefined,
	};
}

export function convertFavoriteSyncTask(value: unknown): FavoriteSyncTask {
	const task = asRecord(value);
	const status = task.status === 'running' || task.status === 'succeeded' || task.status === 'failed' ? task.status : 'queued';
	return {
		id: asString(task.id),
		favoriteIds: Array.isArray(task.favoriteIds) ? task.favoriteIds.map(asString).filter(Boolean) : [],
		status,
		completedFavorites: asNumber(task.completedFavorites),
		totalFavorites: asNumber(task.totalFavorites),
		result: task.result ? convertPlaylistSyncStatus(task.result) : undefined,
		errorCode: asString(task.errorCode),
		errorMessage: asString(task.errorMessage),
		retryable: asBoolean(task.retryable),
		errorDetails: asStringRecord(task.errorDetails),
		startedAt: asString(task.startedAt),
		finishedAt: asOptionalString(task.finishedAt),
	};
}

export function convertFavorites(favs: readonly unknown[]): Favorite[] {
    return favs.map(convertFavorite);
}

export function convertTheme(value: unknown): Theme {
    const t = asRecord(value);
    // 如果 data 字段存在，解析 JSON 配置
    let themeConfig: Record<string, unknown> = {};
    if (t.data) {
        try {
            themeConfig = asRecord(typeof t.data === 'string' ? JSON.parse(t.data) : t.data);
        } catch (e) {
            console.warn('Failed to parse theme data:', e);
        }
    }

    return {
        id: asString(t.id),
        name: asString(t.name),
        data: asString(t.data),
        isDefault: asBoolean(t.isDefault),
        isReadOnly: asBoolean(t.isReadOnly),
        // 展开配置数据到主题对象供前端使用
        themeColor: stringOr(themeConfig.themeColor, '#1f77f0'),
        backgroundColor: stringOr(themeConfig.backgroundColor, '#0a0e27'),
        backgroundOpacity: numberOr(themeConfig.backgroundOpacity, 1),
        backgroundImage: stringOr(themeConfig.backgroundImage, ''),
        backgroundImageSourceUrl: stringOr(themeConfig.backgroundImageSourceUrl, ''),
        backgroundBlur: numberOr(themeConfig.backgroundBlur, 0),
        panelColor: stringOr(themeConfig.panelColor, '#1a1f3a'),
        panelOpacity: numberOr(themeConfig.panelOpacity, 0.6),
        panelBlur: numberOr(themeConfig.panelBlur, 10),
        panelRadius: numberOr(themeConfig.panelRadius, 8),
        controlColor: stringOr(themeConfig.controlColor, '#2a2f4a'),
        controlOpacity: numberOr(themeConfig.controlOpacity, 1),
        controlBlur: numberOr(themeConfig.controlBlur, 0),
        textColorPrimary: stringOr(themeConfig.textColorPrimary, '#ffffff'),
        textColorSecondary: stringOr(themeConfig.textColorSecondary, '#909296'),
        tooltipBackgroundColor: stringOr(themeConfig.tooltipBackgroundColor, DEFAULT_TOOLTIP_COLORS.background),
        tooltipTextColor: stringOr(themeConfig.tooltipTextColor, DEFAULT_TOOLTIP_COLORS.text),
        tooltipBorderColor: stringOr(themeConfig.tooltipBorderColor, DEFAULT_TOOLTIP_COLORS.border),
        favoriteCardColor: stringOr(themeConfig.favoriteCardColor, '#2a2f4a'),
        cardOpacity: numberOr(themeConfig.cardOpacity, 0.5),
        componentRadius: numberOr(themeConfig.componentRadius, 6),
        modalRadius: numberOr(themeConfig.modalRadius, 8),
        notificationRadius: numberOr(themeConfig.notificationRadius, 4),
        coverRadius: numberOr(themeConfig.coverRadius, 4),
        modalColor: stringOr(themeConfig.modalColor, '#1a1f3a'),
        modalOpacity: numberOr(themeConfig.modalOpacity, 0.95),
        modalBlur: numberOr(themeConfig.modalBlur, 10),
        windowControlsPos: stringOr(themeConfig.windowControlsPos, 'left'),
        colorScheme: stringOr(themeConfig.colorScheme, 'dark'),
    };
}

export function convertThemes(themes: readonly unknown[]): Theme[] {
    return themes.map(convertTheme);
}

export const toSongModel = (song: Song): models.Song => Object.assign(new models.Song(), song);
export const toSongModels = (songs: readonly Song[]): models.Song[] => songs.map(toSongModel);
export const toFavoriteModel = (favorite: Favorite): models.Favorite => Object.assign(new models.Favorite(), favorite);
export const toPlayerSettingModel = (setting: PlayerSetting): models.PlayerSetting => Object.assign(new models.PlayerSetting(), setting);
export const toLyricMappingModel = (mapping: LyricMapping): models.LyricMapping => Object.assign(new models.LyricMapping(), mapping);

export const convertPlayerSetting = (value: unknown): PlayerSetting => {
    const setting = asRecord(value);
    return {
        id: asNumber(setting.id) || 1,
        config: asRecord(setting.config),
        updatedAt: asString(setting.updatedAt),
    };
};

export const convertLyricMapping = (value: unknown): LyricMapping => {
    const mapping = asRecord(value);
    return {
        id: asString(mapping.id),
        lyric: asString(mapping.lyric),
        offsetMs: asNumber(mapping.offsetMs),
        updatedAt: asString(mapping.updatedAt),
    };
};

export const convertUserInfo = (value: unknown): UserInfo => {
    const info = asRecord(value);
    return {
        uid: asNumber(info.uid),
        username: asString(info.username),
        face: asString(info.face),
        level: asNumber(info.level),
        vipType: asNumber(info.vip_type ?? info.vipType),
    };
};

export const mergePlayerSetting = (
    setting: PlayerSetting | null,
    configUpdates: Record<string, unknown>,
): PlayerSetting => ({
    id: setting?.id ?? 1,
    config: { ...(setting?.config ?? {}), ...configUpdates },
    updatedAt: new Date().toISOString(),
});
