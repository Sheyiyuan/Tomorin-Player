import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerProvider, usePlayerContext } from '../../context/contexts/PlayerContext';
import type { Song } from '../../types';
import { usePlaybackControls } from './usePlaybackControls';
import { usePlaySong } from './usePlaySong';

const serviceMocks = vi.hoisted(() => ({
    getLocalAudioURL: vi.fn(),
    savePlayHistory: vi.fn(),
    savePlaylist: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    GetLocalAudioURL: serviceMocks.getLocalAudioURL,
    SavePlayHistory: serviceMocks.savePlayHistory,
    SavePlaylist: serviceMocks.savePlaylist,
}));

const makeSong = (id: string, name = id): Song => ({
    id,
    bvid: 'BV1xx411c7mD',
    name,
    singer: '',
    singerId: '',
    cover: '',
    coverLocal: '',
    sourceId: '',
    streamUrl: 'http://127.0.0.1:1234/audio?token=valid',
    streamUrlExpiresAt: '2030-01-01T00:00:00Z',
    lyric: '',
    lyricOffset: 0,
    skipStartTime: 0,
    skipEndTime: 0,
    pageNumber: 1,
    pageTitle: '',
    videoTitle: '',
    totalPages: 1,
    createdAt: '',
    updatedAt: '',
});

const wrapper = ({ children }: PropsWithChildren) => <PlayerProvider>{children}</PlayerProvider>;

const useQueuePlayback = () => {
    const store = usePlayerContext();
    const { playSong } = usePlaySong({
        selectedFavId: null,
        setCurrentSong: store.actions.setSong,
        setIsPlaying: store.actions.setIsPlaying,
        setStatus: vi.fn(),
        setSongs: vi.fn(),
    });
    const controls = usePlaybackControls({
        audioRef: { current: document.createElement('audio') },
        currentSong: store.playback.currentSong,
        currentIndex: store.queue.currentIndex,
        queue: store.queue.songs,
        playMode: store.controls.playMode,
        intervalStart: 0,
        intervalEnd: 60,
        setIsPlaying: store.actions.setIsPlaying,
        setCurrentIndex: store.actions.setCurrentIndex,
        setVolume: store.actions.setVolume,
        playSong,
        playbackRetryRef: { current: new Map<string, number>() },
        isHandlingErrorRef: { current: new Set<string>() },
        queueItems: store.queue.items,
        playOrder: store.queue.playOrder,
        currentQueueItemId: store.queue.currentQueueItemId,
        priorityNext: store.queue.priorityNext,
        history: store.queue.history,
        shuffleEnabled: store.queue.shuffleEnabled,
        repeatMode: store.queue.repeatMode,
        activateQueueItem: store.actions.activateQueueItem,
        setPlayOrder: store.actions.setPlayOrder,
        setHistory: store.actions.setHistory,
    });
    return { store, playSong, ...controls };
};

describe('queue insert-next playback integration', () => {
    beforeEach(() => {
        serviceMocks.getLocalAudioURL.mockResolvedValue('');
        serviceMocks.savePlayHistory.mockResolvedValue(undefined);
        serviceMocks.savePlaylist.mockResolvedValue(undefined);
    });

    it('plays an inserted duplicate instance once and continues from that instance', async () => {
        const a = makeSong('a');
        const b = makeSong('b');
        const c = makeSong('c');
        const { result } = renderHook(useQueuePlayback, { wrapper });

        act(() => result.current.store.actions.setQueue([a, b, c]));
        const originalBId = result.current.store.queue.items[1].queueItemId;
        const cId = result.current.store.queue.items[2].queueItemId;
        act(() => result.current.store.actions.activateQueueItem(originalBId, 'manual'));
        let insertedBId = '';
        act(() => {
            insertedBId = result.current.store.actions.enqueueNext({ ...b, name: 'Inserted B' });
        });

        await act(async () => result.current.playNext());

        expect(result.current.store.queue.currentQueueItemId).toBe(insertedBId);
        expect(result.current.store.queue.priorityNext).toEqual([]);
        await waitFor(() => expect(result.current.store.playback.currentSong?.name).toBe('Inserted B'));

        await act(async () => result.current.playNext());

        expect(result.current.store.queue.currentQueueItemId).toBe(cId);
        await waitFor(() => expect(result.current.store.playback.currentSong?.id).toBe('c'));
    });

    it('does not jump to an earlier instance of an inserted song', async () => {
        const a = makeSong('a');
        const b = makeSong('b');
        const c = makeSong('c');
        const { result } = renderHook(useQueuePlayback, { wrapper });

        act(() => result.current.store.actions.setQueue([a, b, c]));
        const originalAId = result.current.store.queue.items[0].queueItemId;
        const currentBId = result.current.store.queue.items[1].queueItemId;
        act(() => result.current.store.actions.activateQueueItem(currentBId, 'manual'));
        let insertedAId = '';
        act(() => {
            insertedAId = result.current.store.actions.enqueueNext({ ...a, name: 'Inserted A' });
        });

        await act(async () => result.current.playNext());

        expect(result.current.store.queue.currentQueueItemId).toBe(insertedAId);
        expect(result.current.store.queue.currentQueueItemId).not.toBe(originalAId);
        await waitFor(() => expect(result.current.store.playback.currentSong?.name).toBe('Inserted A'));
    });

    it('consumes consecutive insertions in FIFO order', async () => {
        const current = makeSong('current');
        const x = makeSong('x');
        const y = makeSong('y');
        const z = makeSong('z');
        const { result } = renderHook(useQueuePlayback, { wrapper });

        act(() => result.current.store.actions.setQueue([current]));
        const insertedIds: string[] = [];
        act(() => {
            insertedIds.push(result.current.store.actions.enqueueNext(x));
            insertedIds.push(result.current.store.actions.enqueueNext(y));
            insertedIds.push(result.current.store.actions.enqueueNext(z));
        });

        for (const [index, queueItemId] of insertedIds.entries()) {
            await act(async () => result.current.playNext());
            expect(result.current.store.queue.currentQueueItemId).toBe(queueItemId);
            expect(result.current.store.queue.priorityNext).toEqual(insertedIds.slice(index + 1));
            await waitFor(() => expect(result.current.store.playback.currentSong?.id).toBe([x, y, z][index].id));
        }
    });

    it('keeps the current queue instance while refreshing playback data', async () => {
        const repeated = makeSong('repeated');
        const { result } = renderHook(useQueuePlayback, { wrapper });

        act(() => result.current.store.actions.setQueue([repeated, { ...repeated }]));
        const secondId = result.current.store.queue.items[1].queueItemId;
        act(() => result.current.store.actions.activateQueueItem(secondId, 'manual'));

        await act(async () => {
            await result.current.playSong(repeated);
        });

        expect(result.current.store.queue.currentQueueItemId).toBe(secondId);
    });

    it('prioritizes an inserted instance in shuffle mode and then resumes the stable order', async () => {
        const songs = ['a', 'b', 'c', 'd'].map((id) => makeSong(id));
        const priority = makeSong('priority');
        const { result } = renderHook(useQueuePlayback, { wrapper });

        act(() => result.current.store.actions.setQueue(songs));
        const currentId = result.current.store.queue.items[1].queueItemId;
        act(() => result.current.store.actions.activateQueueItem(currentId, 'manual'));
        act(() => result.current.store.actions.setShuffleEnabled(true));
        let priorityId = '';
        act(() => {
            priorityId = result.current.store.actions.enqueueNext(priority);
        });

        await act(async () => result.current.playNext());
        expect(result.current.store.queue.currentQueueItemId).toBe(priorityId);
        await waitFor(() => expect(result.current.store.playback.currentSong?.id).toBe('priority'));

        const priorityIndex = result.current.store.queue.playOrder.indexOf(priorityId);
        const expectedNextId = result.current.store.queue.playOrder[priorityIndex + 1];
        expect(expectedNextId).toBeTruthy();
        await act(async () => result.current.playNext());
        expect(result.current.store.queue.currentQueueItemId).toBe(expectedNextId);
    });

    it('lets a manual next action enter a priority item in single-repeat mode', async () => {
        const current = makeSong('current');
        const next = makeSong('next');
        const priority = makeSong('priority');
        const { result } = renderHook(useQueuePlayback, { wrapper });

        act(() => result.current.store.actions.setQueue([current, next]));
        act(() => result.current.store.actions.setRepeatMode('one'));
        let priorityId = '';
        act(() => {
            priorityId = result.current.store.actions.enqueueNext(priority);
        });

        await act(async () => result.current.playNext());

        expect(result.current.store.queue.currentQueueItemId).toBe(priorityId);
        expect(result.current.store.queue.priorityNext).toEqual([]);
        await waitFor(() => expect(result.current.store.playback.currentSong?.id).toBe('priority'));
    });
});
