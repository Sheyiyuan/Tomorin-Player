/**
 * 歌曲缓存管理 Hook
 * 管理歌曲播放时间等信息的本地缓存
 */

import { useCallback, useRef } from 'react';
import type { Song } from '../../types';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import * as Services from '../../../wailsjs/go/services/Service';

export interface SongCacheData {
    skipStartTime: number;
    skipEndTime: number;
    updatedAt: string;
}

export interface UseSongCacheReturn {
    saveSongCache: (song: Song) => void;
    loadSongCache: (songId: string) => SongCacheData | null;
    updateSongWithCache: (
        song: Song,
        updates: Partial<Song>,
        setSongs: React.Dispatch<React.SetStateAction<Song[]>>,
        setQueue: React.Dispatch<React.SetStateAction<Song[]>>
    ) => void;
}

export const useSongCache = () => {
    const saveTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // 保存歌曲缓存到 localStorage
    const saveSongCache = useCallback((song: Song) => {
        try {
            const cacheKey = `${STORAGE_KEYS.SONG_CACHE_PREFIX}${song.id}`;
            const cacheData: SongCacheData = {
                skipStartTime: song.skipStartTime,
                skipEndTime: song.skipEndTime,
                updatedAt: new Date().toISOString(),
            };
            storage.set(cacheKey, cacheData);
        } catch (err) {
            console.warn('写入歌曲缓存失败:', err);
        }
    }, []);

    // 从 localStorage 加载歌曲缓存
    const loadSongCache = useCallback((songId: string): SongCacheData | null => {
        try {
            const cacheKey = `${STORAGE_KEYS.SONG_CACHE_PREFIX}${songId}`;
            return storage.get<SongCacheData>(cacheKey);
        } catch (err) {
            console.warn('读取歌曲缓存失败:', err);
            return null;
        }
    }, []);

    // 更新歌曲并同步缓存（带防抖持久化）
    const updateSongWithCache = useCallback((
        song: Song,
        updates: Partial<Song>,
        setSongs: React.Dispatch<React.SetStateAction<Song[]>>,
        setQueue: React.Dispatch<React.SetStateAction<Song[]>>
    ) => {
        const updated = { ...song, ...updates } as Song;

        // 1. 立即同步更新 songs 列表
        setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));

        // 2. 立即同步更新 queue
        setQueue(prev => prev.map(s => s.id === updated.id ? updated : s));

        // 3. 立即写入 localStorage 缓存
        saveSongCache(updated);

        // 4. 防抖异步持久化到数据库（500ms）
        const saveKey = `${Object.keys(updates).join('_')}_${updated.id}`;
        const existingTimer = saveTimerRef.current.get(saveKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            Services.UpsertSongs([updated as any]).catch((err) => {
                console.error('持久化歌曲失败:', err);
            });
            saveTimerRef.current.delete(saveKey);
        }, 500);

        saveTimerRef.current.set(saveKey, timer);
    }, [saveSongCache]);

    return {
        saveSongCache,
        loadSongCache,
        updateSongWithCache,
    };
};
