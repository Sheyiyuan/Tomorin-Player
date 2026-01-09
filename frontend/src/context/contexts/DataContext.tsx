/**
 * 数据 Context
 * 管理数据相关的所有状态：核心数据、缓存数据、设置数据
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    DataContextValue,
    CoreData,
    CacheData,
    SettingsData,
    DataActions,
} from '../types/contexts';
import { Song, Favorite, PlayerSetting, LyricMapping } from '../../types';

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ========== 核心数据状态 ==========
    const [songs, setSongs] = useState<Song[]>([]);
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [selectedFavId, setSelectedFavId] = useState<string | null>(null);

    // ========== 缓存数据状态 ==========
    const [cachedSongs] = useState<Map<string, Song>>(new Map());
    const [cachedCovers] = useState<Map<string, string>>(new Map());

    // ========== 设置数据状态 ==========
    const [playerSetting, setPlayerSetting] = useState<PlayerSetting | null>(null);
    const [lyricMapping, setLyricMapping] = useState<LyricMapping | null>(null);

    // ========== 核心数据操作 ==========
    const setSongsSafe = useCallback((newSongs: Song[]) => {
        setSongs(newSongs);
    }, []);

    const setFavoritesSafe = useCallback((newFavorites: Favorite[]) => {
        setFavorites(newFavorites);
    }, []);

    const setSelectedFavIdSafe = useCallback((favId: string | null) => {
        setSelectedFavId(favId);
    }, []);

    const addSong = useCallback((song: Song) => {
        setSongs(prev => {
            // 避免重复添加
            if (prev.some(s => s.id === song.id)) {
                return prev;
            }
            return [...prev, song];
        });
    }, []);

    const removeSong = useCallback((songId: string) => {
        setSongs(prev => prev.filter(s => s.id !== songId));
    }, []);

    const updateSong = useCallback((songId: string, updates: Partial<Song>) => {
        setSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    }, []);

    const addFavorite = useCallback((favorite: Favorite) => {
        setFavorites(prev => {
            // 避免重复添加
            if (prev.some(f => f.id === favorite.id)) {
                return prev;
            }
            return [...prev, favorite];
        });
    }, []);

    const removeFavorite = useCallback((favId: string) => {
        setFavorites(prev => prev.filter(f => f.id !== favId));
        // 如果删除的是当前选中的收藏夹，清空选中状态
        setSelectedFavId(prev => prev === favId ? null : prev);
    }, []);

    const updateFavorite = useCallback((favId: string, updates: Partial<Favorite>) => {
        setFavorites(prev => prev.map(f => f.id === favId ? { ...f, ...updates } : f));
    }, []);

    // ========== 缓存操作 ==========
    const setCachedSong = useCallback((songId: string, song: Song) => {
        cachedSongs.set(songId, song);
    }, [cachedSongs]);

    const getCachedSong = useCallback((songId: string) => {
        return cachedSongs.get(songId);
    }, [cachedSongs]);

    const setCachedCover = useCallback((url: string, base64: string) => {
        cachedCovers.set(url, base64);
    }, [cachedCovers]);

    const getCachedCover = useCallback((url: string) => {
        return cachedCovers.get(url);
    }, [cachedCovers]);

    const clearSongCache = useCallback(() => {
        cachedSongs.clear();
    }, [cachedSongs]);

    const clearCoverCache = useCallback(() => {
        cachedCovers.clear();
    }, [cachedCovers]);

    // ========== 设置操作 ==========
    const setSetting = useCallback((setting: PlayerSetting | null) => {
        setPlayerSetting(setting);
    }, []);

    const setLyricMappingSafe = useCallback((mapping: LyricMapping | null) => {
        setLyricMapping(mapping);
    }, []);

    // ========== 稳定的 Actions 对象 ==========
    const actions: DataActions = useMemo(() => ({
        // 核心数据操作
        setSongs: setSongsSafe,
        setFavorites: setFavoritesSafe,
        setSelectedFavId: setSelectedFavIdSafe,
        addSong,
        removeSong,
        updateSong,
        addFavorite,
        removeFavorite,
        updateFavorite,

        // 缓存操作
        setCachedSong,
        getCachedSong,
        setCachedCover,
        getCachedCover,
        clearSongCache,
        clearCoverCache,

        // 设置操作
        setSetting,
        setLyricMapping: setLyricMappingSafe,
    }), [
        setSongsSafe, setFavoritesSafe, setSelectedFavIdSafe,
        addSong, removeSong, updateSong,
        addFavorite, removeFavorite, updateFavorite,
        setCachedSong, getCachedSong, setCachedCover, getCachedCover, clearSongCache, clearCoverCache,
        setSetting, setLyricMappingSafe,
    ]);

    // ========== 状态对象 ==========
    const data: CoreData = useMemo(() => ({
        songs,
        favorites,
        selectedFavId,
    }), [songs, favorites, selectedFavId]);

    const cache: CacheData = useMemo(() => ({
        songs: cachedSongs,
        covers: cachedCovers,
    }), [cachedSongs, cachedCovers]);

    const settings: SettingsData = useMemo(() => ({
        playerSetting,
        lyricMapping,
    }), [playerSetting, lyricMapping]);

    // ========== Context Value ==========
    const contextValue: DataContextValue = useMemo(() => ({
        data,
        cache,
        settings,
        actions,
    }), [data, cache, settings, actions]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
        </DataContext.Provider>
    );
};

// ========== Hook ==========
export const useDataContext = (): DataContextValue => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useDataContext must be used within DataProvider');
    }
    return context;
};

export default DataContext;