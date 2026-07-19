import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../../types';
import { useSkipIntervalHandler } from './useSkipIntervalHandler';

const serviceMocks = vi.hoisted(() => ({
    upsertSongs: vi.fn(),
}));
const notificationMocks = vi.hoisted(() => ({
    show: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    UpsertSongs: serviceMocks.upsertSongs,
}));
vi.mock('@mantine/notifications', () => ({
    notifications: notificationMocks,
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
    skipStartTime: 1,
    skipEndTime: 59,
    pageNumber: 1,
    pageTitle: '',
    videoTitle: '',
    totalPages: 1,
    createdAt: '',
    updatedAt: '',
};

const useSkipHarness = () => {
    const [currentSong, setCurrentSong] = useState<Song>(song);
    const [songs, setSongs] = useState<Song[]>([song]);
    const [queue, setQueue] = useState<Song[]>([song]);
    const saveTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const handlers = useSkipIntervalHandler({
        currentSong,
        setCurrentSong,
        setSongs,
        setQueue,
        saveTimerRef,
    });
    return { currentSong, songs, queue, ...handlers };
};

describe('useSkipIntervalHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        serviceMocks.upsertSongs.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    it('coalesces start and end changes into one write with the latest values', async () => {
        const { result } = renderHook(useSkipHarness);

        act(() => result.current.handleSkipStartChange(5));
        act(() => result.current.handleSkipEndChange(55));
        await act(async () => vi.advanceTimersByTimeAsync(500));

        expect(serviceMocks.upsertSongs).toHaveBeenCalledTimes(1);
        expect(serviceMocks.upsertSongs).toHaveBeenCalledWith([
            expect.objectContaining({ skipStartTime: 5, skipEndTime: 55 }),
        ]);
    });

    it('rolls back all song state when the latest write fails', async () => {
        serviceMocks.upsertSongs.mockRejectedValue(new Error('database unavailable'));
        const { result } = renderHook(useSkipHarness);

        act(() => result.current.handleIntervalChange(8, 50));
        expect(result.current.currentSong).toEqual(expect.objectContaining({
            skipStartTime: 8,
            skipEndTime: 50,
        }));

        await act(async () => vi.advanceTimersByTimeAsync(500));

        expect(result.current.currentSong).toEqual(expect.objectContaining({
            skipStartTime: 1,
            skipEndTime: 59,
        }));
        expect(result.current.songs[0].skipStartTime).toBe(1);
        expect(result.current.queue[0].skipEndTime).toBe(59);
        expect(notificationMocks.show).toHaveBeenCalledWith(expect.objectContaining({
            title: '播放区间保存失败',
        }));
    });
});
