/**
 * useFavoritesManager - 收藏夹管理状态聚合
 * 将 App.tsx 中分散的收藏夹相关状态集中管理
 */

import { useState, useCallback } from 'react';
import type { Song } from '../../types';

export const useFavoritesManager = () => {
    // ========== 创建收藏夹 ==========
    const [createFavName, setCreateFavName] = useState("新歌单");
    const [createFavMode, setCreateFavMode] = useState<'blank' | 'duplicate' | 'importMine' | 'importFid'>('blank');
    const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
    const [importFid, setImportFid] = useState("");
	const [keepImportedFavoriteSynced, setKeepImportedFavoriteSynced] = useState(true);
    const [confirmDeleteFavId, setConfirmDeleteFavId] = useState<string | null>(null);

    // ========== 编辑收藏夹 ==========
    const [editingFavId, setEditingFavId] = useState<string | null>(null);
    const [editingFavName, setEditingFavName] = useState("");

    // ========== 下载管理 ==========
    const [confirmDeleteDownloaded, setConfirmDeleteDownloaded] = useState<boolean>(false);
    const [downloadedSongIds, setDownloadedSongIds] = useState<Set<string>>(new Set());
    const [managingSong, setManagingSong] = useState<Song | null>(null);
    const [confirmRemoveSongId, setConfirmRemoveSongId] = useState<string | null>(null);

    // 重置创建收藏夹状态
    const resetCreateFavState = useCallback(() => {
        setCreateFavName("新歌单");
        setCreateFavMode("blank");
        setDuplicateSourceId(null);
        setImportFid("");
		setKeepImportedFavoriteSynced(true);
    }, []);

    // 重置编辑收藏夹状态
    const resetEditFavState = useCallback(() => {
        setEditingFavId(null);
        setEditingFavName("");
    }, []);

    // 重置下载管理状态
    const resetDownloadState = useCallback(() => {
        setConfirmDeleteDownloaded(false);
        setManagingSong(null);
        setConfirmRemoveSongId(null);
    }, []);

    return {
        // 创建收藏夹状态
        createFavName,
        setCreateFavName,
        createFavMode,
        setCreateFavMode,
        duplicateSourceId,
        setDuplicateSourceId,
        importFid,
        setImportFid,
		keepImportedFavoriteSynced,
		setKeepImportedFavoriteSynced,
        confirmDeleteFavId,
        setConfirmDeleteFavId,

        // 编辑收藏夹状态
        editingFavId,
        setEditingFavId,
        editingFavName,
        setEditingFavName,

        // 下载管理状态
        confirmDeleteDownloaded,
        setConfirmDeleteDownloaded,
        downloadedSongIds,
        setDownloadedSongIds,
        managingSong,
        setManagingSong,
        confirmRemoveSongId,
        setConfirmRemoveSongId,

        // 重置函数
        resetCreateFavState,
        resetEditFavState,
        resetDownloadState,
    };
};
