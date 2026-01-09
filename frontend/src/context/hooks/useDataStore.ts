/**
 * 数据状态选择器 Hook
 * 提供细粒度的数据状态订阅，减少不必要的重新渲染
 */

import { useDataContext } from '../contexts/DataContext';
import { DataContextValue } from '../types/contexts';

// ========== 基础选择器 Hook ==========
export const useDataStore = <T = DataContextValue>(
    selector?: (state: DataContextValue) => T
): T => {
    const context = useDataContext();

    if (selector) {
        return selector(context);
    }

    return context as T;
};

// ========== 便捷选择器 Hooks ==========

// 核心数据选择器
export const useCoreData = () => useDataStore(state => state.data);
export const useSongs = () => useDataStore(state => state.data.songs);
export const useFavorites = () => useDataStore(state => state.data.favorites);
export const useSelectedFavId = () => useDataStore(state => state.data.selectedFavId);

// 缓存数据选择器
export const useCache = () => useDataStore(state => state.cache);
export const useSongCache = () => useDataStore(state => state.cache.songs);
export const useCoverCache = () => useDataStore(state => state.cache.covers);

// 设置数据选择器
export const useSettings = () => useDataStore(state => state.settings);
export const usePlayerSetting = () => useDataStore(state => state.settings.playerSetting);
export const useLyricMapping = () => useDataStore(state => state.settings.lyricMapping);

// 操作选择器
export const useDataActions = () => useDataStore(state => state.actions);

// 组合选择器（用于需要多个状态的组件）
export const useCurrentFavorite = () => useDataStore(state => {
    const { favorites, selectedFavId } = state.data;
    return selectedFavId ? favorites.find(f => f.id === selectedFavId) || null : null;
});

export const useCurrentFavoriteSongs = () => useDataStore(state => {
    const { songs, favorites, selectedFavId } = state.data;
    if (!selectedFavId) return [];

    const currentFav = favorites.find(f => f.id === selectedFavId);
    if (!currentFav) return [];

    return songs.filter(s => currentFav.songIds.some(ref => ref.songId === s.id));
});

export const useSongOperations = () => useDataStore(state => ({
    songs: state.data.songs,
    addSong: state.actions.addSong,
    removeSong: state.actions.removeSong,
    updateSong: state.actions.updateSong,
}));

export const useFavoriteOperations = () => useDataStore(state => ({
    favorites: state.data.favorites,
    selectedFavId: state.data.selectedFavId,
    addFavorite: state.actions.addFavorite,
    removeFavorite: state.actions.removeFavorite,
    updateFavorite: state.actions.updateFavorite,
    setSelectedFavId: state.actions.setSelectedFavId,
}));

export const useCacheOperations = () => useDataStore(state => ({
    setCachedSong: state.actions.setCachedSong,
    getCachedSong: state.actions.getCachedSong,
    setCachedCover: state.actions.setCachedCover,
    getCachedCover: state.actions.getCachedCover,
    clearSongCache: state.actions.clearSongCache,
    clearCoverCache: state.actions.clearCoverCache,
}));