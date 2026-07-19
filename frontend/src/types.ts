// Re-export from wailsjs generated models
export { models } from "../wailsjs/go/models";
export { services } from "../wailsjs/go/models";

// Type aliases for convenience
import { models, services } from "../wailsjs/go/models";

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
    createdAt: string;
    updatedAt: string;
}

export interface SongRef {
    id: number;
    favoriteId: string;
    songId: string;
}

export interface Favorite {
    id: string;
    title: string;
    songIds: SongRef[];
    createdAt: string;
    updatedAt: string;
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
    };
}

export function convertFavorite(value: unknown): Favorite {
    const f = asRecord(value);
    return {
        id: asString(f.id),
        title: asString(f.title),
        songIds: Array.isArray(f.songIds) ? f.songIds.map(convertSongRef) : [],
        createdAt: asString(f.createdAt),
        updatedAt: asString(f.updatedAt),
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
