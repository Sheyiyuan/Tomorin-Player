import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LyricView, Song } from '../../types';

const serviceMocks = vi.hoisted(() => ({
    getActiveLyric: vi.fn(),
    searchLyrics: vi.fn(),
	getLyricSearch: vi.fn(),
	setLyricOffset: vi.fn(),
	rejectLyricCandidate: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    GetActiveLyric: serviceMocks.getActiveLyric,
    SearchLyrics: serviceMocks.searchLyrics,
	GetLyricSearch: serviceMocks.getLyricSearch,
	SetLyricOffset: serviceMocks.setLyricOffset,
	RejectLyricCandidate: serviceMocks.rejectLyricCandidate,
}));

vi.mock('@mantine/notifications', () => ({ notifications: notificationMocks }));

import { useLyrics } from './useLyrics';

const createSong = (id: string): Song => ({
    id, bvid: '', name: id, singer: '', singerId: '', cover: '', coverLocal: '', sourceId: '', streamUrl: '', streamUrlExpiresAt: '',
    lyric: '', lyricOffset: 0, skipStartTime: 0, skipEndTime: 0, pageNumber: 1, pageTitle: '', videoTitle: '', totalPages: 1,
    createdAt: '', updatedAt: '',
});

const createView = (songId: string): LyricView => ({
    songId, offsetMs: 0, manualLocked: true, candidates: [],
	    document: { id: `${songId}-document`, songId, source: 'manual', sourceLabel: '本地', format: 'plain', rawText: songId, lines: [], metadata: {}, contentHash: songId, providerRef: '', encoding: 'utf-8', confidence: 1, embeddedOffsetMs: 0, isManual: true, isReliable: true, createdAt: '', updatedAt: '' },
});

describe('useLyrics', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		serviceMocks.setLyricOffset.mockImplementation(async (songId: string, offsetMs: number) => ({ ...createView(songId), offsetMs }));
		serviceMocks.rejectLyricCandidate.mockImplementation(async (songId: string) => ({ songId, offsetMs: 0, manualLocked: false, candidates: [] }));
	});

    it('ignores a local result that resolves after the current song changes', async () => {
        let resolveFirst: ((value: LyricView) => void) | undefined;
        const first = new Promise<LyricView>((resolve) => { resolveFirst = resolve; });
        serviceMocks.getActiveLyric.mockImplementation((songId: string) => songId === 'one' ? first : Promise.resolve(createView('two')));

        const { result, rerender } = renderHook(({ song }) => useLyrics(song), { initialProps: { song: createSong('one') as Song | null } });
        rerender({ song: createSong('two') });
        await waitFor(() => expect(result.current.view?.songId).toBe('two'));
        await act(async () => { resolveFirst?.(createView('one')); await first; });
        expect(result.current.view?.songId).toBe('two');
    });

	it('keeps the active lyric and exposes a retryable provider error', async () => {
		const automaticView: LyricView = {
			...createView('one'),
			manualLocked: false,
			document: {
				...createView('one').document!,
				id: 'automatic',
				source: 'lrclib',
				sourceLabel: 'LRCLIB',
				isManual: false,
				retrievedAt: '2020-01-01T00:00:00.000Z',
			},
		};
		serviceMocks.getActiveLyric.mockResolvedValue(automaticView);
		serviceMocks.searchLyrics.mockImplementation(async (request: { requestId: string; songId: string }) => ({
			requestId: request.requestId,
			songId: request.songId,
			status: 'failed',
			errorCode: 'LYRIC_PROVIDER_UNAVAILABLE',
			errorMessage: '歌词服务暂时不可用',
			retryable: true,
		}));

		const currentSong = createSong('one');
		const { result } = renderHook(() => useLyrics(currentSong));
		await waitFor(() => expect(result.current.state).toBe('error'));
		expect(result.current.view?.document?.id).toBe('automatic');
		expect(result.current.error).toBe('歌词服务暂时不可用');
		expect(result.current.message).toBe('自动获取失败，可重试');
	});

	it('rolls back an optimistic offset when persistence fails', async () => {
		serviceMocks.getActiveLyric.mockResolvedValue(createView('one'));
		serviceMocks.setLyricOffset.mockRejectedValue(new Error('save failed'));
		const currentSong = createSong('one');
		const { result } = renderHook(() => useLyrics(currentSong));
		await waitFor(() => expect(result.current.view?.songId).toBe('one'));

		await act(async () => {
			await expect(result.current.actions.setOffset(500)).rejects.toThrow('save failed');
		});

		expect(result.current.view?.offsetMs).toBe(0);
		expect(notificationMocks.show).toHaveBeenCalledWith(expect.objectContaining({ title: '偏移保存失败', message: 'save failed' }));
	});

	it('ignores an automatic result that completes after switching songs', async () => {
		let resolveSearch: ((value: unknown) => void) | undefined;
		let requestId = '';
		const pendingSearch = new Promise((resolve) => { resolveSearch = resolve; });
		serviceMocks.getActiveLyric.mockImplementation((songId: string) => Promise.resolve(createView(songId)));
		serviceMocks.searchLyrics.mockImplementation((request: { requestId: string }) => {
			requestId = request.requestId;
			return Promise.resolve({ requestId, songId: 'one', status: 'queued' });
		});
		serviceMocks.getLyricSearch.mockReturnValue(pendingSearch);
		const { result, rerender } = renderHook(({ song }) => useLyrics(song), { initialProps: { song: createSong('one') as Song | null } });
		await waitFor(() => expect(result.current.view?.songId).toBe('one'));
		let searchPromise: Promise<void> | undefined;
		act(() => { searchPromise = result.current.actions.search(); });
		await waitFor(() => expect(serviceMocks.getLyricSearch).toHaveBeenCalledWith(requestId));
		rerender({ song: createSong('two') });
		await waitFor(() => expect(result.current.view?.songId).toBe('two'));
		resolveSearch?.({ status: 'succeeded', requestId, songId: 'one', result: { songId: 'one', requestId, view: createView('one'), autoApplied: true, message: 'old' } });
		await act(async () => { await searchPromise; });
		expect(result.current.view?.songId).toBe('two');
	});

	it('marks an automatic lyric as wrong and returns to the empty state', async () => {
		const currentSong = createSong('one');
		const automaticView: LyricView = {
			...createView('one'),
			manualLocked: false,
			document: { ...createView('one').document!, id: 'wrong', source: 'lrclib', sourceLabel: 'LRCLIB', isManual: false, retrievedAt: new Date().toISOString() },
		};
		serviceMocks.getActiveLyric.mockResolvedValue(automaticView);
		const { result } = renderHook(() => useLyrics(currentSong));
		await waitFor(() => expect(result.current.view?.document?.id).toBe('wrong'));

		await act(async () => { await result.current.actions.rejectCandidate('wrong'); });

		expect(serviceMocks.rejectLyricCandidate).toHaveBeenCalledWith('one', 'wrong');
		expect(result.current.state).toBe('empty');
		expect(result.current.message).toContain('手动导入');
	});
});
