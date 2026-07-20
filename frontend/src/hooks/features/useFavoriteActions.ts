import { useCallback, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { models } from '../../../wailsjs/go/models';
import { Favorite, Song, convertFavorite, convertFavorites, convertSongs, toFavoriteModel } from '../../types';
import { useMyFavoriteImport } from './useMyFavoriteImport';
import type { ModalName } from '../../context/types/contexts';
import { parseDomainError } from '../../utils/domainError';

interface UseFavoriteActionsProps {
    favorites: Favorite[];
    setFavorites: (favorites: Favorite[]) => void;
    songs: Song[];
    setSongs: (songs: Song[]) => void;
    selectedFavId: string | null;
    setSelectedFavId: (id: string | null) => void;
    setStatus: (status: string) => void;
    themeColor: string;
    openModal: (name: ModalName) => void;
    closeModal: (name: ModalName) => void;
}

interface CreateFavoriteOptions {
    name: string;
    mode: 'blank' | 'duplicate' | 'importMine' | 'importFid';
    duplicateSourceId?: string | null;
    importFid?: string;
    selectedMyFavId?: number | null;
	keepSynced?: boolean;
}

export const useFavoriteActions = ({
    favorites,
    setFavorites,
    songs,
    setSongs,
    selectedFavId,
    setSelectedFavId,
    setStatus,
    themeColor,
    openModal,
    closeModal,
}: UseFavoriteActionsProps) => {
	const createFavoriteLockRef = useRef(false);
	const [isCreatingFavorite, setIsCreatingFavorite] = useState(false);

    // 使用我的收藏夹导入 Hook
    const myFavoriteImport = useMyFavoriteImport({
        themeColor,
        songs,
        onStatusChange: setStatus,
    });

    const deleteFavorite = useCallback(async (id: string, setConfirmDeleteFavId: (id: string | null) => void) => {
        try {
            await Services.DeleteFavorite(id);

            // 删除歌单后清理未被引用的歌曲
            const deletedCount = await Services.DeleteUnreferencedSongs();
            console.log('[deleteFavorite] 清理了', deletedCount, '首未被引用的歌曲');

            // 刷新歌单和歌曲列表
            const rawRefreshed = await Services.ListFavorites();
            setFavorites(convertFavorites(rawRefreshed || []));

            // 刷新歌曲列表（因为可能有歌曲被清理）
            const rawRefreshedSongs = await Services.ListSongs();
            setSongs(convertSongs(rawRefreshedSongs || []));

            if (selectedFavId === id) {
                setSelectedFavId(null);
            }
            setConfirmDeleteFavId(null);

            const message = deletedCount > 0
                ? `已删除歌单，并清理了 ${deletedCount} 首未被引用的歌曲`
                : "已删除歌单";
            notifications.show({
                title: "删除成功",
                message,
                color: "green"
            });
        } catch (error) {
			const parsed = parseDomainError(error);
			notifications.show({ title: "删除失败", message: parsed.message, color: "red" });
        }
    }, [setFavorites, selectedFavId, setSelectedFavId, setSongs]);

    const editFavorite = useCallback((fav: Favorite, setEditingFavId: (id: string | null) => void, setEditingFavName: (name: string) => void) => {
        setEditingFavId(fav.id);
        setEditingFavName(fav.title);
        openModal("editFavModal");
    }, [openModal]);

    const saveEditFavorite = useCallback(async (editingFavId: string | null, editingFavName: string) => {
        if (!editingFavId) return;
        const name = editingFavName.trim() || "未命名歌单";
        try {
            const target = favorites.find((f: Favorite) => f.id === editingFavId);
            if (!target) {
                notifications.show({ title: "未找到歌单", message: "", color: "red" });
                return;
            }
            const updated = { ...target, title: name };
            await Services.SaveFavorite(toFavoriteModel(updated));
            const rawRefreshed = await Services.ListFavorites();
            setFavorites(convertFavorites(rawRefreshed || []));
            closeModal("editFavModal");
            notifications.show({ title: "已保存", message: "", color: "green" });
        } catch (error) {
			const parsed = parseDomainError(error);
			notifications.show({ title: "保存失败", message: parsed.message, color: "red" });
        }
    }, [favorites, setFavorites, closeModal]);

    const createFavorite = useCallback(async (options: CreateFavoriteOptions) => {
		if (createFavoriteLockRef.current) return;
		createFavoriteLockRef.current = true;
		setIsCreatingFavorite(true);

        const { name: rawName, mode, duplicateSourceId, importFid, selectedMyFavId, keepSynced = true } = options;
        const name = (rawName || "").trim() || "新歌单";

        try {
            if (mode === "blank") {
                await Services.SaveFavorite(toFavoriteModel({
                    id: "",
                    title: name,
                    songIds: [],
					source: undefined,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }));
            } else if (mode === "duplicate") {
                if (!duplicateSourceId) {
                    notifications.show({ title: "请选择要复制的歌单", message: "", color: "orange" });
                    return;
                }
                const source = favorites.find((f: Favorite) => f.id === duplicateSourceId);
                if (!source) {
                    notifications.show({ title: "未找到源歌单", message: "", color: "red" });
                    return;
                }
                const cloned = {
                    id: "",
                    title: name,
					source: undefined,
                    songIds: source.songIds.map((ref, position) => ({ id: 0, songId: ref.songId, favoriteId: "", position })),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await Services.SaveFavorite(toFavoriteModel(cloned));
            } else if (mode === "importMine" || mode === "importFid") {
                let mediaID: number | null = null;

                // 处理导入我的收藏夹
                if (mode === "importMine") {
                    // 动态检查登陆状态，而不仅依赖传入的 isLoggedIn
                    const loggedIn = await Services.IsLoggedIn();
                    if (!loggedIn) {
                        notifications.show({ title: "需要登录", message: "", color: "blue" });
                        openModal("loginModal");
                        return;
                    }
                    if (!selectedMyFavId) {
                        notifications.show({ title: "请选择收藏夹", message: "", color: "orange" });
                        return;
                    }
					mediaID = selectedMyFavId;
                } else {
                    // 处理导入公开收藏夹
                    if (!importFid?.trim()) {
                        notifications.show({ title: "请输入 fid", message: "", color: "orange" });
                        return;
                    }
					const parsed = Number(importFid.trim());
					if (!Number.isSafeInteger(parsed) || parsed <= 0) {
						notifications.show({ title: "fid 格式不正确", message: "请输入有效的数字 ID", color: "red" });
						return;
					}
					mediaID = parsed;
                }
				if (mediaID === null) return;
				setStatus("正在导入并解析收藏夹...");
				const importResult = await Services.ImportBiliFavorite(new models.BiliFavoriteImportRequest({ remoteId: mediaID, name: rawName.trim(), locked: keepSynced }));
				const imported = convertFavorite(importResult.favorite);
                const rawRefreshedSongs = await Services.ListSongs();
                setSongs(convertSongs(rawRefreshedSongs || []));
                const rawRefreshedFavs = await Services.ListFavorites();
                setFavorites(convertFavorites(rawRefreshedFavs || []));
				setSelectedFavId(imported.id);
				setStatus("");
				notifications.show({
					title: "导入完成",
					message: importResult.syncStatus?.run
						? `${keepSynced ? "已创建只读同步歌单" : "已创建本地歌单"} · 新增 ${importResult.syncStatus.run.addedCount} 首`
						: keepSynced ? "已创建只读同步歌单" : "已创建本地歌单",
					color: "green",
				});
                closeModal("createFavModal");
                return;
            }

            const rawRefreshedFavs = await Services.ListFavorites();
            setFavorites(convertFavorites(rawRefreshedFavs || []));
            const created = rawRefreshedFavs.find((favorite) => favorite.title === name) || rawRefreshedFavs[rawRefreshedFavs.length - 1];
            if (created) {
                setSelectedFavId(created.id);
            }
            closeModal("createFavModal");
        } catch (error) {
			setStatus("");
			const parsed = parseDomainError(error);
			notifications.show({
				title: parsed.code === 'SYNC_AUTH_REQUIRED' || parsed.code === 'SYNC_PERMISSION_DENIED' ? "无法访问收藏夹" : "创建失败",
				message: parsed.message,
				color: "red",
			});
		} finally {
			createFavoriteLockRef.current = false;
			setIsCreatingFavorite(false);
        }
    }, [favorites, setFavorites, setSongs, setSelectedFavId, openModal, closeModal, setStatus]);

    const addToFavorite = useCallback(async (favId: string, song: Song) => {
        const target = favorites.find((f: Favorite) => f.id === favId);
        if (!target) return;

        const alreadyExists = target.songIds.some((ref) => ref.songId === song.id);
        if (alreadyExists) {
            notifications.show({
                title: "已在歌单中",
                message: "",
                color: "blue",
            });
            return;
        }

        const updated = {
            ...target,
			source: target.source,
            songIds: [...target.songIds, { id: 0, songId: song.id, favoriteId: favId, position: target.songIds.length }],
        };

        try {
            await Services.SaveFavorite(toFavoriteModel(updated));
            const rawRefreshed = await Services.ListFavorites();
            setFavorites(convertFavorites(rawRefreshed || []));
            notifications.show({
                title: "已添加到歌单",
                message: "",
                color: "green",
            });
        } catch (error) {
			const parsed = parseDomainError(error);
            notifications.show({
                title: "添加失败",
				message: parsed.message,
                color: "red",
            });
            throw error;
        }
    }, [favorites, setFavorites]);

    return {
        deleteFavorite,
        editFavorite,
        saveEditFavorite,
        createFavorite,
		isCreatingFavorite,
        addToFavorite,

        // 导出我的收藏夹导入功能
        myFavoriteImport,
    };
};
