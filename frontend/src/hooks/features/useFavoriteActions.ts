import { useCallback, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { models } from '../../../wailsjs/go/models';
import {
	Favorite,
	Song,
	convertBiliFavoriteImportTask,
	convertFavoriteSummaries,
	convertFavoriteSummary,
	type PlaylistSyncProgress,
} from '../../types';
import { useMyFavoriteImport } from './useMyFavoriteImport';
import type { ModalName } from '../../context/types/contexts';
import { parseDomainError } from '../../utils/domainError';

interface UseFavoriteActionsProps {
    favorites: Favorite[];
    setFavorites: (favorites: Favorite[]) => void;
	songs?: Song[];
	setSongs?: (songs: Song[]) => void;
    selectedFavId: string | null;
    setSelectedFavId: (id: string | null) => void;
    setStatus: (status: string) => void;
	themeColor?: string;
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

const waitForImportTaskPoll = (): Promise<void> => new Promise((resolve) => {
	window.setTimeout(resolve, 150);
});

export const useFavoriteActions = ({
    favorites,
    setFavorites,
    selectedFavId,
    setSelectedFavId,
    setStatus,
    openModal,
    closeModal,
}: UseFavoriteActionsProps) => {
	const createFavoriteLockRef = useRef(false);
	const [isCreatingFavorite, setIsCreatingFavorite] = useState(false);
	const [favoriteImportProgress, setFavoriteImportProgress] = useState<PlaylistSyncProgress>();

    // 使用我的收藏夹导入 Hook
    const myFavoriteImport = useMyFavoriteImport();

	const refreshSummaries = useCallback(async () => {
		const summaries = convertFavoriteSummaries(await Services.ListFavoriteSummaries());
		setFavorites(summaries);
		return summaries;
	}, [setFavorites]);

    const deleteFavorite = useCallback(async (id: string, setConfirmDeleteFavId: (id: string | null) => void) => {
        try {
            await Services.DeleteFavorite(id);

            // 删除歌单后清理未被引用的歌曲
            const deletedCount = await Services.DeleteUnreferencedSongs();
            console.log('[deleteFavorite] 清理了', deletedCount, '首未被引用的歌曲');

			await refreshSummaries();

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
    }, [refreshSummaries, selectedFavId, setSelectedFavId]);

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
			const updated = convertFavoriteSummary(await Services.RenameFavorite(target.id, name));
			setFavorites(favorites.map((favorite) => favorite.id === updated.id ? updated : favorite));
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
				const created = convertFavoriteSummary(await Services.CreateLocalFavorite(name));
				setFavorites([...favorites, created]);
				setSelectedFavId(created.id);
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
				const created = convertFavoriteSummary(await Services.DuplicateFavorite(source.id, name));
				setFavorites([...favorites, created]);
				setSelectedFavId(created.id);
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
			setFavoriteImportProgress({ stage: 'queued', completedVideoCount: 0, totalVideoCount: 0, skippedCount: 0 });
			let task = convertBiliFavoriteImportTask(await Services.StartBiliFavoriteImport(new models.BiliFavoriteImportRequest({ remoteId: mediaID, name: rawName.trim(), locked: keepSynced })));
			setFavoriteImportProgress(task.progress);
			while (task.status === 'queued' || task.status === 'running') {
				await waitForImportTaskPoll();
				task = convertBiliFavoriteImportTask(await Services.GetBiliFavoriteImportTask(task.id));
				setFavoriteImportProgress(task.progress);
			}
			if (task.status === 'failed') {
				throw new Error(JSON.stringify({
					code: task.errorCode,
					message: task.errorMessage || '导入任务失败',
					retryable: task.retryable,
					details: task.errorDetails,
				}));
			}
			if (!task.result) throw new Error('导入任务未返回结果');
			const importResult = task.result;
			const imported = importResult.favorite;
				await refreshSummaries();
				setSelectedFavId(imported.id);
				setStatus("");
				const syncRun = importResult.syncStatus?.run;
				notifications.show({
					title: syncRun?.pendingCount ? "导入完成，部分曲目待解析" : "导入完成",
					message: syncRun
						? `${keepSynced ? "已创建只读同步歌单" : "已创建本地歌单"} · 新增 ${syncRun.addedCount} 首 · 跳过 ${syncRun.skippedCount} 项 · 待解析 ${syncRun.pendingCount} 项`
						: keepSynced ? "已创建只读同步歌单" : "已创建本地歌单",
					color: syncRun?.pendingCount ? "yellow" : "green",
				});
                closeModal("createFavModal");
                return;
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
			setFavoriteImportProgress(undefined);
		}
    }, [favorites, setFavorites, setSelectedFavId, openModal, closeModal, setStatus, refreshSummaries]);

	const addToFavorite = useCallback(async (favId: string, song: Song) => {
		const target = favorites.find((f: Favorite) => f.id === favId);
		if (!target) return;

		try {
			const memberships = await Services.GetFavoriteMemberships(song.id);
			if (memberships.includes(favId)) {
				notifications.show({
					title: "已在歌单中",
					message: "",
					color: "blue",
				});
				return;
			}
			const updated = convertFavoriteSummary(await Services.AddSongsToFavorite(favId, [song.id]));
			setFavorites(favorites.map((favorite) => favorite.id === favId ? updated : favorite));
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
		favoriteImportProgress,
        addToFavorite,

        // 导出我的收藏夹导入功能
        myFavoriteImport,
    };
};
