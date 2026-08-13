import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../../types';
import { PlayerProvider, usePlayerContext } from './PlayerContext';

const serviceMocks = vi.hoisted(() => ({ savePlaylist: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    SavePlaylist: serviceMocks.savePlaylist,
}));

const song: Song = {
    id: 'song-1',
    bvid: 'BV1xx411c7mD',
    name: 'Song',
    singer: '',
    singerId: '',
    cover: '',
    coverLocal: '',
    sourceId: '',
    streamUrl: '',
    streamUrlExpiresAt: '',
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
};

const wrapper = ({ children }: PropsWithChildren) => <PlayerProvider>{children}</PlayerProvider>;

describe('PlayerContext queue persistence', () => {
    beforeEach(() => serviceMocks.savePlaylist.mockResolvedValue(undefined));

    it('waits for hydration and persists a cleared queue once', async () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });

        act(() => result.current.actions.setQueue([song]));
        expect(serviceMocks.savePlaylist).not.toHaveBeenCalled();

        act(() => result.current.actions.setPlaylistHydrated(true));
        await waitFor(() => expect(serviceMocks.savePlaylist).toHaveBeenCalledWith('["song-1"]', 0));

        serviceMocks.savePlaylist.mockClear();
        act(() => result.current.actions.setQueue([]));
        await waitFor(() => expect(serviceMocks.savePlaylist).toHaveBeenCalledTimes(1));
        expect(serviceMocks.savePlaylist).toHaveBeenCalledWith('[]', 0);
    });

    it('gives duplicate songs distinct queue identities', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });

        act(() => result.current.actions.setQueue([song, song]));

        expect(result.current.queue.items).toHaveLength(2);
        expect(result.current.queue.items[0].queueItemId).not.toBe(result.current.queue.items[1].queueItemId);
    });

    it('keeps priority-next additions in FIFO order', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });
        const second = { ...song, id: 'song-2', name: 'Second' };
        const third = { ...song, id: 'song-3', name: 'Third' };

        act(() => result.current.actions.setQueue([song]));
        act(() => {
            result.current.actions.enqueueNext(second);
            result.current.actions.enqueueNext(third);
        });

        const prioritySongs = result.current.queue.priorityNext.map((id) =>
            result.current.queue.items.find((item) => item.queueItemId === id)?.song.id,
        );
        expect(prioritySongs).toEqual(['song-2', 'song-3']);
    });

    it('consumes a priority item when it is activated manually', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });
        const second = { ...song, id: 'song-2', name: 'Second' };

        act(() => result.current.actions.setQueue([song]));
        let insertedId = '';
        act(() => {
            insertedId = result.current.actions.enqueueNext(second);
        });
        act(() => result.current.actions.activateQueueItem(insertedId, 'manual'));

        expect(result.current.queue.currentQueueItemId).toBe(insertedId);
        expect(result.current.playback.currentSong).toEqual(second);
        expect(result.current.queue.priorityNext).toEqual([]);
    });

    it('keeps priority items when a non-priority item is activated manually', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });
        const second = { ...song, id: 'song-2', name: 'Second' };
        const priority = { ...song, id: 'song-3', name: 'Priority' };

        act(() => result.current.actions.setQueue([song, second]));
        const secondId = result.current.queue.items[1].queueItemId;
        let priorityId = '';
        act(() => {
            priorityId = result.current.actions.enqueueNext(priority);
        });
        act(() => result.current.actions.activateQueueItem(secondId, 'manual'));

        expect(result.current.queue.currentQueueItemId).toBe(secondId);
        expect(result.current.queue.priorityNext).toEqual([priorityId]);
    });

    it('removes deleted priority items from navigation state', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });
        const second = { ...song, id: 'song-2', name: 'Second' };

        act(() => result.current.actions.setQueue([song]));
        let insertedId = '';
        act(() => {
            insertedId = result.current.actions.enqueueNext(second);
        });
        act(() => result.current.actions.removeQueueItem(insertedId));

        expect(result.current.queue.items.some((item) => item.queueItemId === insertedId)).toBe(false);
        expect(result.current.queue.priorityNext).toEqual([]);
        expect(result.current.queue.playOrder).not.toContain(insertedId);
    });

    it('consumes a priority fallback when the current item is deleted', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });
        const second = { ...song, id: 'song-2', name: 'Second' };
        const priority = { ...song, id: 'song-3', name: 'Priority' };

        act(() => result.current.actions.setQueue([song, second]));
        const currentId = result.current.queue.currentQueueItemId;
        let priorityId = '';
        act(() => {
            priorityId = result.current.actions.enqueueNext(priority);
        });
        act(() => {
            if (currentId) result.current.actions.removeQueueItem(currentId);
        });

        expect(result.current.queue.currentQueueItemId).toBe(priorityId);
        expect(result.current.playback.currentSong).toEqual(priority);
        expect(result.current.queue.priorityNext).toEqual([]);
    });

    it('keeps no stale priority IDs after clearing or reordering upcoming items', () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });
        const second = { ...song, id: 'song-2', name: 'Second' };
        const priority = { ...song, id: 'song-3', name: 'Priority' };

        act(() => result.current.actions.setQueue([song, second]));
        let priorityId = '';
        act(() => {
            priorityId = result.current.actions.enqueueNext(priority);
        });
        const secondId = result.current.queue.items.find((item) => item.song.id === second.id)?.queueItemId;
        act(() => {
            if (secondId) result.current.actions.reorderQueueItems(priorityId, secondId);
        });
        expect(result.current.queue.priorityNext).toEqual([]);

        act(() => {
            result.current.actions.enqueueNext(priority);
            result.current.actions.clearUpcoming();
        });
        expect(result.current.queue.priorityNext).toEqual([]);
        expect(result.current.queue.items).toHaveLength(1);
    });
});
