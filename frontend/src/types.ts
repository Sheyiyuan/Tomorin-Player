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
    createdAt: string;
    updatedAt: string;
}

export interface SongRef {
    favoriteId: string;
    songId: string;
    addedAt: string;
}

export interface Favorite {
    id: string;
    title: string;
    songIds: SongRef[];
    createdAt: string;
    updatedAt: string;
}

export type PlayerSetting = models.PlayerSetting;
export type LyricMapping = models.LyricMapping;
export type Playlist = models.Playlist;
export type ExportData = services.ExportData;
export type Theme = models.Theme;
export type BiliAudio = models.BiliAudio;

export interface UserInfo {
    uid: number;
    username: string;
    face: string;
    level: number;
    vipType: number;
}

// Export classes for runtime use
export const SongClass = models.Song;
export const FavoriteClass = models.Favorite;
export const SongRefClass = models.SongRef;
export const PlayerSettingClass = models.PlayerSetting;
export const LyricMappingClass = models.LyricMapping;

// Type conversion functions
export function convertSong(s: any): Song {
    return {
        id: s.id || '',
        bvid: s.bvid || '',
        name: s.name || '',
        singer: s.singer || '',
        singerId: s.singerId || '',
        cover: s.cover || '',
        coverLocal: s.coverLocal || '',
        sourceId: s.sourceId || '',
        streamUrl: s.streamUrl || '',
        streamUrlExpiresAt: s.streamUrlExpiresAt?.toString ? s.streamUrlExpiresAt.toString() : s.streamUrlExpiresAt || '',
        lyric: s.lyric || '',
        lyricOffset: s.lyricOffset || 0,
        skipStartTime: s.skipStartTime || 0,
        skipEndTime: s.skipEndTime || 0,
        createdAt: s.createdAt?.toString ? s.createdAt.toString() : s.createdAt || '',
        updatedAt: s.updatedAt?.toString ? s.updatedAt.toString() : s.updatedAt || '',
    };
}

export function convertSongs(songs: any[]): Song[] {
    return songs.map(convertSong);
}

export function convertSongRef(ref: any): SongRef {
    return {
        favoriteId: ref.favoriteId || '',
        songId: ref.songId || '',
        addedAt: ref.addedAt?.toString ? ref.addedAt.toString() : ref.addedAt || '',
    };
}

export function convertFavorite(f: any): Favorite {
    return {
        id: f.id || '',
        title: f.title || '',
        songIds: (f.songIds || []).map(convertSongRef),
        createdAt: f.createdAt?.toString ? f.createdAt.toString() : f.createdAt || '',
        updatedAt: f.updatedAt?.toString ? f.updatedAt.toString() : f.updatedAt || '',
    };
}

export function convertFavorites(favs: any[]): Favorite[] {
    return favs.map(convertFavorite);
}