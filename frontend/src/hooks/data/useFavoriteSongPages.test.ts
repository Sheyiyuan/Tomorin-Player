import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({ listFavoriteSongs: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({
	ListFavoriteSongs: serviceMocks.listFavoriteSongs,
}));

import { useFavoriteSongPages } from './useFavoriteSongPages';

const rawSong = (id: string) => ({ id, name: id, singer: 'Singer' });
const rawPage = (ids: string[], total: number, offset = 0, limit = 100, revision = 'r1') => ({
	items: ids.map(rawSong),
	total,
	offset,
	limit,
	revision,
});

describe('useFavoriteSongPages', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('loads only the first 100-song page initially', async () => {
		serviceMocks.listFavoriteSongs.mockResolvedValue(rawPage(['song-0'], 250));
		const { result } = renderHook(() => useFavoriteSongPages({ favoriteId: 'favorite', favoriteSongCount: 250, query: '' }));

		await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
		expect(serviceMocks.listFavoriteSongs).toHaveBeenCalledTimes(1);
		expect(serviceMocks.listFavoriteSongs.mock.calls[0][0]).toMatchObject({ favoriteId: 'favorite', offset: 0, limit: 100 });
		expect(result.current.total).toBe(250);
		expect(result.current.getSong(0)?.id).toBe('song-0');
	});

	it('patches a loaded song without refetching its page', async () => {
		serviceMocks.listFavoriteSongs.mockResolvedValue(rawPage(['song-0'], 1));
		const { result } = renderHook(() => useFavoriteSongPages({ favoriteId: 'favorite', favoriteSongCount: 1, query: '' }));
		await waitFor(() => expect(result.current.getSong(0)?.id).toBe('song-0'));

		act(() => result.current.patchSong({ ...result.current.getSong(0)!, name: 'Updated title' }));

		expect(result.current.getSong(0)?.name).toBe('Updated title');
		expect(serviceMocks.listFavoriteSongs).toHaveBeenCalledTimes(1);
	});

	it('loads the next page when the visible range approaches it', async () => {
		serviceMocks.listFavoriteSongs.mockImplementation((request: { offset: number }) => Promise.resolve(
			request.offset === 0 ? rawPage(['song-0'], 250) : rawPage(['song-100'], 250, 100),
		));
		const { result } = renderHook(() => useFavoriteSongPages({ favoriteId: 'favorite', favoriteSongCount: 250, query: '' }));
		await waitFor(() => expect(result.current.getSong(0)?.id).toBe('song-0'));

		act(() => result.current.loadRange(90, 100));
		await waitFor(() => expect(result.current.getSong(100)?.id).toBe('song-100'));
		expect(serviceMocks.listFavoriteSongs.mock.calls.filter(([request]) => request.offset === 100)).toHaveLength(1);
	});

	it('coalesces duplicate requests for the same page', async () => {
		let resolveSecondPage: ((page: ReturnType<typeof rawPage>) => void) | undefined;
		serviceMocks.listFavoriteSongs.mockImplementation((request: { offset: number }) => {
			if (request.offset === 0) return Promise.resolve(rawPage(['song-0'], 250));
			return new Promise((resolve) => { resolveSecondPage = resolve; });
		});
		const { result } = renderHook(() => useFavoriteSongPages({ favoriteId: 'favorite', favoriteSongCount: 250, query: '' }));
		await waitFor(() => expect(result.current.getSong(0)?.id).toBe('song-0'));

		act(() => {
			result.current.loadRange(100, 100);
			result.current.loadRange(100, 100);
		});
		expect(serviceMocks.listFavoriteSongs.mock.calls.filter(([request]) => request.offset === 100)).toHaveLength(1);
		await act(async () => resolveSecondPage?.(rawPage(['song-100'], 250, 100)));
	});

	it('retries the page that failed instead of reloading the first page', async () => {
		let secondPageAttempts = 0;
		serviceMocks.listFavoriteSongs.mockImplementation((request: { offset: number }) => {
			if (request.offset === 0) return Promise.resolve(rawPage(['song-0'], 250));
			secondPageAttempts += 1;
			return secondPageAttempts === 1
				? Promise.reject(new Error('page unavailable'))
				: Promise.resolve(rawPage(['song-100'], 250, 100));
		});
		const { result } = renderHook(() => useFavoriteSongPages({ favoriteId: 'favorite', favoriteSongCount: 250, query: '' }));
		await waitFor(() => expect(result.current.getSong(0)?.id).toBe('song-0'));

		act(() => result.current.loadRange(100, 100));
		await waitFor(() => expect(result.current.error).toBe('page unavailable'));
		act(() => result.current.retry());
		await waitFor(() => expect(result.current.getSong(100)?.id).toBe('song-100'));

		expect(serviceMocks.listFavoriteSongs.mock.calls.filter(([request]) => request.offset === 0)).toHaveLength(1);
		expect(serviceMocks.listFavoriteSongs.mock.calls.filter(([request]) => request.offset === 100)).toHaveLength(2);
	});

	it('ignores a stale response after switching playlists', async () => {
		let resolveFirst: ((page: ReturnType<typeof rawPage>) => void) | undefined;
		serviceMocks.listFavoriteSongs.mockImplementation((request: { favoriteId: string }) => {
			if (request.favoriteId === 'first') return new Promise((resolve) => { resolveFirst = resolve; });
			return Promise.resolve(rawPage(['second-song'], 2, 0, 100, 'second-revision'));
		});
		const { result, rerender } = renderHook(
			({ favoriteId }) => useFavoriteSongPages({ favoriteId, favoriteSongCount: favoriteId === 'first' ? 999 : 2, query: '' }),
			{ initialProps: { favoriteId: 'first' } },
		);

		rerender({ favoriteId: 'second' });
		await waitFor(() => expect(result.current.getSong(0)?.id).toBe('second-song'));
		await act(async () => resolveFirst?.(rawPage(['first-song'], 999)));

		expect(result.current.total).toBe(2);
		expect(result.current.getSong(0)?.id).toBe('second-song');
	});

	it('debounces a playlist-wide search for 200ms and resets the page', async () => {
		serviceMocks.listFavoriteSongs.mockImplementation((request: { query: string }) => Promise.resolve(
			request.query ? rawPage(['match'], 1, 0, 100, 'search') : rawPage(['song-0'], 250),
		));
		const { result, rerender } = renderHook(
			({ query }) => useFavoriteSongPages({ favoriteId: 'favorite', favoriteSongCount: 250, query }),
			{ initialProps: { query: '' } },
		);
		await waitFor(() => expect(result.current.getSong(0)?.id).toBe('song-0'));
		vi.useFakeTimers();

		rerender({ query: 'needle' });
		act(() => vi.advanceTimersByTime(199));
		expect(serviceMocks.listFavoriteSongs.mock.calls.some(([request]) => request.query === 'needle')).toBe(false);
		await act(async () => {
			vi.advanceTimersByTime(1);
			await Promise.resolve();
		});

		expect(serviceMocks.listFavoriteSongs.mock.calls.some(([request]) => request.query === 'needle' && request.offset === 0)).toBe(true);
		expect(result.current.total).toBe(1);
		expect(result.current.getSong(0)?.id).toBe('match');
	});

	it('loads all songs in 200-row pages only for explicit bulk actions', async () => {
		serviceMocks.listFavoriteSongs.mockImplementation((request: { offset: number; limit: number }) => {
			const remaining = 450 - request.offset;
			const count = Math.max(0, Math.min(request.limit, remaining));
			return Promise.resolve(rawPage(Array.from({ length: count }, (_, index) => `song-${request.offset + index}`), 450, request.offset, request.limit));
		});
		const { result } = renderHook(() => useFavoriteSongPages({ query: '' }));

		const songs = await act(async () => result.current.loadAll('favorite'));

		expect(songs).toHaveLength(450);
		expect(serviceMocks.listFavoriteSongs.mock.calls.map(([request]) => [request.offset, request.limit])).toEqual([[0, 200], [200, 200], [400, 200]]);
	});
});
