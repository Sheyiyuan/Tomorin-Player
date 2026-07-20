/**
 * 数据 Context 读取 Hook。
 * selector 只简化返回值，不会阻止 Provider 更新触发组件重渲染。
 */

import { useDataContext } from '../contexts/DataContext';
import { DataContextValue } from '../types/contexts';

// ========== 基础读取 Hook ==========
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
