import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Song } from '../../types';
import { shouldRefreshStream } from '../../utils/stream';
import { usePlaybackControls } from './usePlaybackControls';

const song = (streamUrl: string, streamUrlExpiresAt: string): Song => ({
    id: 'song-1',
    bvid: 'BV1xx411c7mD',
    name: 'Song',
    singer: '',
    singerId: '',
    cover: '',
    coverLocal: '',
    sourceId: '',
    streamUrl,
    streamUrlExpiresAt,
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

describe('shouldRefreshStream', () => {
    const now = Date.parse('2026-07-18T12:00:00Z');

    it('refreshes missing, direct, invalid, and expiring stream URLs', () => {
        expect(shouldRefreshStream(song('', ''), now)).toBe(true);
        expect(shouldRefreshStream(song('https://example.com/audio.m4s', '2026-07-19T12:00:00Z'), now)).toBe(true);
        expect(shouldRefreshStream(song('http://127.0.0.1:1234/audio?t=x', 'invalid'), now)).toBe(true);
        expect(shouldRefreshStream(song('http://127.0.0.1:1234/audio?t=x', '2026-07-18T12:00:30Z'), now)).toBe(true);
    });

    it('keeps current proxy URLs and non-expiring local files', () => {
        expect(shouldRefreshStream(song('http://127.0.0.1:1234/audio?t=x', '2026-07-18T13:00:00Z'), now)).toBe(false);
        expect(shouldRefreshStream(song('http://127.0.0.1:1234/local?t=x', ''), now)).toBe(false);
    });
});

describe('usePlaybackControls', () => {
    it.each([
        ['missing', song('', '')],
        ['expired', song('http://127.0.0.1:1234/audio?t=x', '2020-01-01T00:00:00Z')],
    ])('resolves a %s stream again when play is pressed', async (_case, currentSong) => {
        const audioRef = { current: document.createElement('audio') };
        const playSong = vi.fn<(songToPlay: Song, list?: Song[]) => Promise<void>>().mockResolvedValue(undefined);
        const queue = [currentSong];
        const { result } = renderHook(() => usePlaybackControls({
            audioRef,
            currentSong,
            currentIndex: 0,
            queue,
            playMode: 'loop',
            intervalStart: 0,
            intervalEnd: 60,
            setIsPlaying: vi.fn(),
            setCurrentIndex: vi.fn(),
            setCurrentSong: vi.fn(),
            setVolume: vi.fn(),
            playSong,
            playbackRetryRef: { current: new Map<string, number>() },
        }));

        await act(async () => {
            await result.current.togglePlay();
        });

        expect(playSong).toHaveBeenCalledWith({ ...currentSong, streamUrl: '' }, queue);
    });
});
