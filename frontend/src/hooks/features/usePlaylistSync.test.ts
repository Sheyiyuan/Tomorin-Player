import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
	listFavoriteSummaries: vi.fn(),
	listSongs: vi.fn(),
	syncFavorite: vi.fn(),
	getFavoriteSyncTask: vi.fn(),
	getFavoriteSyncStatus: vi.fn(),
	syncStaleBiliFavorites: vi.fn(),
	detachFavoriteSource: vi.fn(),
	duplicateFavorite: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({
	ListFavoriteSummaries: serviceMocks.listFavoriteSummaries,
	ListSongs: serviceMocks.listSongs,
	SyncFavorite: serviceMocks.syncFavorite,
	GetFavoriteSyncTask: serviceMocks.getFavoriteSyncTask,
	GetFavoriteSyncStatus: serviceMocks.getFavoriteSyncStatus,
	SyncStaleBiliFavorites: serviceMocks.syncStaleBiliFavorites,
	DetachFavoriteSource: serviceMocks.detachFavoriteSource,
	DuplicateFavorite: serviceMocks.duplicateFavorite,
}));

vi.mock('../../utils/wails', () => ({ waitForWailsRuntime: vi.fn(async () => undefined) }));
vi.mock('@mantine/notifications', () => ({ notifications: notificationMocks }));

import { usePlaylistSync } from './usePlaylistSync';

const source = {
	id: 'source', favoriteId: 'favorite', provider: 'bilibili', remoteId: '42', locked: true, syncState: 'stale',
	lastErrorCode: '', lastErrorMessage: '', lastSnapshotHash: '', remoteCount: 1, createdAt: '', updatedAt: '',
};

describe('usePlaylistSync', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		serviceMocks.listFavoriteSummaries.mockResolvedValue([]);
		serviceMocks.listSongs.mockResolvedValue([]);
		serviceMocks.syncStaleBiliFavorites.mockResolvedValue([]);
		serviceMocks.getFavoriteSyncStatus.mockResolvedValue({ source });
		serviceMocks.duplicateFavorite.mockResolvedValue({ id: 'copy', title: 'copy', songCount: 0, createdAt: '', updatedAt: '' });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('starts stale sync after 15 seconds and checks again when the app becomes visible', async () => {
		vi.useFakeTimers();
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
		const { unmount } = renderHook(() => usePlaylistSync({ setFavorites: vi.fn(), setSongs: vi.fn() }));
		await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
		expect(serviceMocks.syncStaleBiliFavorites).not.toHaveBeenCalled();
		await act(async () => { await vi.advanceTimersByTimeAsync(1); });
		expect(serviceMocks.syncStaleBiliFavorites).toHaveBeenCalledTimes(1);

		await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
		expect(serviceMocks.syncStaleBiliFavorites).toHaveBeenCalledTimes(2);
		unmount();
	});

	it('renders structured authentication errors without exposing the JSON payload', async () => {
		serviceMocks.syncFavorite.mockResolvedValue({
			id: 'task', favoriteIds: ['favorite'], status: 'failed', completedFavorites: 1, totalFavorites: 1,
			errorCode: 'SYNC_AUTH_REQUIRED', errorMessage: '登录已失效', retryable: false,
		});
		const { result } = renderHook(() => usePlaylistSync({ setFavorites: vi.fn(), setSongs: vi.fn() }));
		await act(async () => { await result.current.sync('favorite'); });

		expect(notificationMocks.show).toHaveBeenCalledWith({
			title: '需要重新登录或授权',
			message: '登录已失效',
			color: 'red',
		});
		await waitFor(() => expect(result.current.syncingIds.has('favorite')).toBe(false));
	});

	it('polls a running task before refreshing the library', async () => {
		serviceMocks.syncFavorite.mockResolvedValue({ id: 'task', favoriteIds: ['favorite'], status: 'queued', completedFavorites: 0, totalFavorites: 1, progress: { stage: 'fetching' } });
		serviceMocks.getFavoriteSyncTask.mockResolvedValue({ id: 'task', favoriteIds: ['favorite'], status: 'succeeded', completedFavorites: 1, totalFavorites: 1, progress: { stage: 'completed', completedVideoCount: 2, totalVideoCount: 2 } });
		const setFavorites = vi.fn();
		const setSongs = vi.fn();
		const { result } = renderHook(() => usePlaylistSync({ setFavorites, setSongs }));
		await act(async () => { await result.current.sync('favorite'); });
		expect(serviceMocks.syncFavorite).toHaveBeenCalledWith('favorite', false);
		expect(serviceMocks.getFavoriteSyncTask).toHaveBeenCalledWith('task');
		expect(serviceMocks.listFavoriteSummaries).toHaveBeenCalled();
		expect(serviceMocks.listSongs).not.toHaveBeenCalled();
		expect(result.current.taskByFavorite.favorite.progress).toMatchObject({ stage: 'completed', completedVideoCount: 2, totalVideoCount: 2 });
	});

	it('reports skipped resources separately without treating them as pending', async () => {
		serviceMocks.syncFavorite.mockResolvedValue({ id: 'task', favoriteIds: ['favorite'], status: 'succeeded', completedFavorites: 1, totalFavorites: 1 });
		serviceMocks.getFavoriteSyncStatus.mockResolvedValue({
			source: { ...source, syncState: 'synced', remoteCount: 2 },
			run: { addedCount: 0, removedCount: 0, skippedCount: 1, pendingCount: 0, remoteCount: 2 },
		});
		const { result } = renderHook(() => usePlaylistSync({ setFavorites: vi.fn(), setSongs: vi.fn() }));

		await act(async () => { await result.current.sync('favorite'); });

		expect(notificationMocks.show).toHaveBeenCalledWith({
			title: '歌单同步完成',
			message: '新增 0 首，移除 0 首，跳过 1 项，待解析 0 项',
			color: 'green',
		});
	});

	it('reports local-copy failures and leaves the original mirror unchanged', async () => {
		serviceMocks.duplicateFavorite.mockRejectedValue(new Error('rpc: {"code":"SYNC_LOCAL_COMMIT_FAILED","message":"数据库暂时不可写","retryable":true}'));
		const favorite = { id: 'favorite', title: 'mirror', songIds: [], source, createdAt: '', updatedAt: '' };
		const { result } = renderHook(() => usePlaylistSync({ setFavorites: vi.fn(), setSongs: vi.fn() }));

		await act(async () => {
			await expect(result.current.createLocalCopy(favorite)).rejects.toThrow();
		});
		expect(notificationMocks.show).toHaveBeenCalledWith({ title: '创建副本失败', message: '数据库暂时不可写', color: 'red' });
	});
});
