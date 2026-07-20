import { useCallback, useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import {
    convertFavorite,
    convertFavorites,
	convertFavoriteSyncTask,
    convertPlaylistSyncStatus,
    convertSongs,
	toFavoriteModel,
    type Favorite,
    type PlaylistSyncStatus,
    type Song,
} from '../../types';
import { waitForWailsRuntime } from '../../utils/wails';
import { parseDomainError } from '../../utils/domainError';

interface UsePlaylistSyncOptions {
    setFavorites: (favorites: Favorite[]) => void;
    setSongs: (songs: Song[]) => void;
}

const waitForSyncTaskPoll = (): Promise<void> => new Promise((resolve) => {
	window.setTimeout(resolve, 150);
});

export const usePlaylistSync = ({ setFavorites, setSongs }: UsePlaylistSyncOptions) => {
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
    const [statusByFavorite, setStatusByFavorite] = useState<Record<string, PlaylistSyncStatus>>({});

    const refreshLibrary = useCallback(async () => {
        const [favorites, songs] = await Promise.all([Services.ListFavorites(), Services.ListSongs()]);
        setFavorites(convertFavorites(favorites ?? []));
        setSongs(convertSongs(songs ?? []));
    }, [setFavorites, setSongs]);

    const sync = useCallback(async (favoriteId: string) => {
        setSyncingIds((current) => new Set(current).add(favoriteId));
        try {
			let task = convertFavoriteSyncTask(await Services.SyncFavorite(favoriteId, false));
			setSyncingIds((current) => {
				const next = new Set(current);
				for (const id of task.favoriteIds) next.add(id);
				return next;
			});
			while (task.status === 'queued' || task.status === 'running') {
				await waitForSyncTaskPoll();
				task = convertFavoriteSyncTask(await Services.GetFavoriteSyncTask(task.id));
			}
			const status = convertPlaylistSyncStatus(await Services.GetFavoriteSyncStatus(favoriteId));
            setStatusByFavorite((current) => ({ ...current, [favoriteId]: status }));
			if (task.status === 'failed') {
				const title = task.errorCode === 'SYNC_AUTH_REQUIRED' || task.errorCode === 'SYNC_PERMISSION_DENIED'
					? '需要重新登录或授权'
					: task.errorCode === 'SYNC_RATE_LIMITED' ? '同步过于频繁' : '同步失败';
				notifications.show({
					title,
					message: task.errorMessage || status.source?.lastErrorMessage || '同步任务失败',
					color: task.errorCode === 'SYNC_RATE_LIMITED' ? 'yellow' : 'red',
				});
				return;
			}
            await refreshLibrary();
            notifications.show({
                title: status.run?.pendingCount ? '同步完成，部分曲目待解析' : '歌单同步完成',
                message: status.run ? `新增 ${status.run.addedCount} 首，移除 ${status.run.removedCount} 首` : '',
                color: status.run?.pendingCount ? 'yellow' : 'green',
            });
        } catch (cause) {
            const fallback = convertPlaylistSyncStatus(await Services.GetFavoriteSyncStatus(favoriteId).catch(() => ({})));
            setStatusByFavorite((current) => ({ ...current, [favoriteId]: fallback }));
			const parsed = parseDomainError(cause);
			notifications.show({
				title: parsed.code === 'SYNC_AUTH_REQUIRED' || parsed.code === 'SYNC_PERMISSION_DENIED' ? '需要重新登录或授权' : parsed.code === 'SYNC_RATE_LIMITED' ? '同步过于频繁' : '同步失败',
				message: parsed.message,
				color: parsed.code === 'SYNC_RATE_LIMITED' ? 'yellow' : 'red',
			});
        } finally {
            setSyncingIds((current) => {
                const next = new Set(current);
                next.delete(favoriteId);
                return next;
            });
        }
    }, [refreshLibrary]);

	const loadStatus = useCallback(async (favoriteId: string) => {
		try {
			const status = convertPlaylistSyncStatus(await Services.GetFavoriteSyncStatus(favoriteId));
			setStatusByFavorite((current) => ({ ...current, [favoriteId]: status }));
		} catch (cause) {
			const parsed = parseDomainError(cause);
			notifications.show({ title: '无法读取同步详情', message: parsed.message, color: 'red' });
		}
	}, []);

    const detach = useCallback(async (favoriteId: string) => {
		try {
			const favorite = convertFavorite(await Services.DetachFavoriteSource(favoriteId, true));
			await refreshLibrary();
			notifications.show({ title: '已转换为本地歌单', message: `${favorite.title} 不再自动同步`, color: 'green' });
		} catch (cause) {
			const parsed = parseDomainError(cause);
			notifications.show({ title: '转换失败', message: parsed.message, color: 'red' });
			throw cause;
		}
    }, [refreshLibrary]);

	const createLocalCopy = useCallback(async (favorite: Favorite) => {
		try {
			await Services.SaveFavorite(toFavoriteModel({
				id: '',
				title: `${favorite.title}（本地副本）`,
				songIds: favorite.songIds.map((reference, position) => ({ ...reference, id: 0, favoriteId: '', position })),
				source: undefined,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}));
			await refreshLibrary();
			notifications.show({ title: '已创建本地副本', message: favorite.title, color: 'green' });
		} catch (cause) {
			const parsed = parseDomainError(cause);
			notifications.show({ title: '创建副本失败', message: parsed.message, color: 'red' });
			throw cause;
		}
	}, [refreshLibrary]);

    useEffect(() => {
        let active = true;
        const runStaleSync = async () => {
            try {
                await waitForWailsRuntime(50, 100);
                const statuses = await Services.SyncStaleBiliFavorites(360);
                if (!active) return;
                const converted = statuses.map(convertPlaylistSyncStatus);
                setStatusByFavorite((current) => {
                    const next = { ...current };
                    for (const status of converted) {
                        if (status.source?.favoriteId) next[status.source.favoriteId] = status;
                    }
                    return next;
                });
                if (converted.length > 0) await refreshLibrary();
            } catch (cause) {
                console.warn('[playlist-sync] scheduled sync skipped:', cause);
            }
        };
		const startupTimer = window.setTimeout(() => { void runStaleSync(); }, 15_000);
        const timer = window.setInterval(() => { void runStaleSync(); }, 6 * 60 * 60 * 1000);
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') void runStaleSync();
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            active = false;
			window.clearTimeout(startupTimer);
            window.clearInterval(timer);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshLibrary]);

	return { syncingIds, statusByFavorite, sync, loadStatus, detach, createLocalCopy, refreshLibrary };
};
