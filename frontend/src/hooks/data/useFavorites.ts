/**
 * 收藏夹管理 Hook
 * 管理歌单的增删改查
 */

import { useState, useCallback } from 'react';
import type { Favorite } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';

export interface UseFavoritesReturn {
    favorites: Favorite[];
    setFavorites: React.Dispatch<React.SetStateAction<Favorite[]>>;
    loadFavorites: () => Promise<void>;
    createFavorite: (favorite: Favorite) => Promise<void>;
    updateFavorite: (favorite: Favorite) => Promise<void>;
    deleteFavorite: (favoriteId: string) => Promise<void>;
    refreshFavorites: () => Promise<Favorite[]>;
}

export const useFavorites = () => {
    const [favorites, setFavorites] = useState<Favorite[]>([]);

    // 加载收藏夹列表
    const loadFavorites = useCallback(async () => {
        try {
            const favList = await Services.ListFavorites();
            setFavorites(favList);
        } catch (error) {
            console.error('加载收藏夹列表失败:', error);
            throw error;
        }
    }, []);

    // 创建收藏夹
    const createFavorite = useCallback(async (favorite: Favorite) => {
        try {
            await Services.SaveFavorite(favorite as any);
            await loadFavorites();
        } catch (error) {
            console.error('创建收藏夹失败:', error);
            throw error;
        }
    }, [loadFavorites]);

    // 更新收藏夹
    const updateFavorite = useCallback(async (favorite: Favorite) => {
        try {
            await Services.SaveFavorite(favorite as any);
            setFavorites(prev => prev.map(f => f.id === favorite.id ? favorite : f));
        } catch (error) {
            console.error('更新收藏夹失败:', error);
            throw error;
        }
    }, []);

    // 删除收藏夹
    const deleteFavorite = useCallback(async (favoriteId: string) => {
        try {
            await Services.DeleteFavorite(favoriteId);
            setFavorites(prev => prev.filter(f => f.id !== favoriteId));
        } catch (error) {
            console.error('删除收藏夹失败:', error);
            throw error;
        }
    }, []);

    // 刷新收藏夹列表
    const refreshFavorites = useCallback(async () => {
        const refreshed = await Services.ListFavorites();
        setFavorites(refreshed);
        return refreshed;
    }, []);

    return {
        favorites,
        setFavorites,
        loadFavorites,
        createFavorite,
        updateFavorite,
        deleteFavorite,
        refreshFavorites,
    };
};
