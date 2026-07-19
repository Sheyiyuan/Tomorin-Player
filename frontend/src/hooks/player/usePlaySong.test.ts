import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../../types';
import { usePlaySong } from './usePlaySong';

const serviceMocks = vi.hoisted(() => ({
    getLocalAudioURL: vi.fn(),
    getAudioCacheID: vi.fn(),
    getPlayURL: vi.fn(),
    upsertSongs: vi.fn(),
    listSongs: vi.fn(),
    savePlayHistory: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    GetLocalAudioURL: serviceMocks.getLocalAudioURL,
    GetAudioCacheID: serviceMocks.getAudioCacheID,
    GetPlayURL: serviceMocks.getPlayURL,
    UpsertSongs: serviceMocks.upsertSongs,
    ListSongs: serviceMocks.listSongs,
    SavePlayHistory: serviceMocks.savePlayHistory,
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
    streamUrl: 'http://127.0.0.1:1234/audio?token=old',
    streamUrlExpiresAt: '',
    lyric: '',
    lyricOffset: 0,
    skipStartTime: 0,
    skipEndTime: 0,
    pageNumber: 2,
    pageTitle: '',
    videoTitle: '',
    totalPages: 2,
    createdAt: '',
    updatedAt: '',
};

describe('usePlaySong', () => {
    beforeEach(() => {
        serviceMocks.getLocalAudioURL.mockResolvedValue('');
        serviceMocks.getAudioCacheID.mockResolvedValue('song-1');
        serviceMocks.getPlayURL.mockResolvedValue({
            ProxyURL: 'http://127.0.0.1:4321/audio?token=new',
            ExpiresAt: '2030-01-01T00:00:00Z',
        });
        serviceMocks.upsertSongs.mockResolvedValue(undefined);
        serviceMocks.listSongs.mockResolvedValue([]);
        serviceMocks.savePlayHistory.mockResolvedValue(undefined);
    });

    it('refreshes a proxy stream that has no expiration metadata', async () => {
        const setCurrentSong = vi.fn();
        const { result } = renderHook(() => usePlaySong({
            queue: [song],
            selectedFavId: null,
            setQueue: vi.fn(),
            setCurrentIndex: vi.fn(),
            setCurrentSong,
            setIsPlaying: vi.fn(),
            setStatus: vi.fn(),
            setSongs: vi.fn(),
        }));

        await act(async () => {
            await result.current.playSong(song);
        });

        expect(serviceMocks.getPlayURL).toHaveBeenCalledWith(song.bvid, 2);
        expect(setCurrentSong).toHaveBeenCalledWith(expect.objectContaining({
            streamUrl: 'http://127.0.0.1:4321/audio?token=new&sid=song-1',
            streamUrlExpiresAt: '2030-01-01T00:00:00Z',
        }));
    });

    it('rejects a direct stream when the song cannot be resolved through the proxy', async () => {
        const directSong: Song = {
            ...song,
            bvid: '',
            streamUrl: 'https://audio.bilivideo.com/direct.m4s',
        };
        const setCurrentSong = vi.fn();
        const setIsPlaying = vi.fn();
        const setStatus = vi.fn();
        const { result } = renderHook(() => usePlaySong({
            queue: [directSong],
            selectedFavId: null,
            setQueue: vi.fn(),
            setCurrentIndex: vi.fn(),
            setCurrentSong,
            setIsPlaying,
            setStatus,
            setSongs: vi.fn(),
        }));

        await act(async () => {
            await result.current.playSong(directSong);
        });

        expect(serviceMocks.getPlayURL).not.toHaveBeenCalled();
        expect(setCurrentSong).not.toHaveBeenCalled();
        expect(setIsPlaying).toHaveBeenCalledWith(false);
        expect(setStatus).toHaveBeenCalledWith(expect.stringContaining('无法通过本地代理'));
    });
});
