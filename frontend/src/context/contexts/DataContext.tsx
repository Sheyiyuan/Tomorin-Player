/**
 * 数据 Context
 * 管理数据相关的所有状态：核心数据、缓存数据、设置数据
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    DataContextValue,
    CoreData,
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

    // ========== 设置数据状态 ==========
    const [playerSetting, setPlayerSetting] = useState<PlayerSetting | null>(null);
    const [lyricMapping, setLyricMapping] = useState<LyricMapping | null>(null);

    // ========== 核心数据操作 ==========
    const setSelectedFavIdSafe = useCallback((favId: string | null) => {
        setSelectedFavId(favId);
    }, []);

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
        setSongs,
        setFavorites,
        setSelectedFavId: setSelectedFavIdSafe,
        // 设置操作
        setSetting,
        setLyricMapping: setLyricMappingSafe,
    }), [
        setSelectedFavIdSafe,
        setSetting, setLyricMappingSafe,
    ]);

    // ========== 状态对象 ==========
    const data: CoreData = useMemo(() => ({
        songs,
        favorites,
        selectedFavId,
    }), [songs, favorites, selectedFavId]);

    const settings: SettingsData = useMemo(() => ({
        playerSetting,
        lyricMapping,
    }), [playerSetting, lyricMapping]);

    // ========== Context Value ==========
    const contextValue: DataContextValue = useMemo(() => ({
        data,
        settings,
        actions,
    }), [data, settings, actions]);

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
