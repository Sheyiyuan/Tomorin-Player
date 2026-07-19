import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Favorite, Song } from '../../types';
import { usePlaylistActions } from './usePlaylistActions';

vi.mock('../../../wailsjs/go/services/Service', () => ({}));

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

const favorite: Favorite = {
    id: 'favorite-1',
    title: 'Favorite',
    songIds: [],
    createdAt: '',
    updatedAt: '',
};

const renderActions = (addSongToFavorite: (favoriteId: string, songToAdd: Song) => Promise<void>) => {
    const closeModal = vi.fn();
    const setPendingFavoriteSong = vi.fn();
    const setStatus = vi.fn();
    const hook = renderHook(() => usePlaylistActions({
        queue: [song],
        setQueue: vi.fn(),
        currentIndex: 0,
        setCurrentIndex: vi.fn(),
        currentSong: song,
        setCurrentSong: vi.fn(),
        setIsPlaying: vi.fn(),
        currentFav: favorite,
        setFavorites: vi.fn(),
        setStatus,
        setConfirmRemoveSongId: vi.fn(),
        openModal: vi.fn(),
        closeModal,
        playSong: vi.fn().mockResolvedValue(undefined),
        addSongToFavorite,
        setPendingFavoriteSong,
        pendingFavoriteSong: null,
    }));
    return { ...hook, closeModal, setPendingFavoriteSong, setStatus };
};

describe('usePlaylistActions add-to-favorite flow', () => {
    it('closes the modal only after the shared mutation succeeds', async () => {
        const addSongToFavorite = vi.fn().mockResolvedValue(undefined);
        const { result, closeModal, setPendingFavoriteSong } = renderActions(addSongToFavorite);

        await act(async () => result.current.addToFavoriteFromModal(favorite));

        expect(addSongToFavorite).toHaveBeenCalledWith(favorite.id, song);
        expect(setPendingFavoriteSong).toHaveBeenCalledWith(null);
        expect(closeModal).toHaveBeenCalledWith('addFavoriteModal');
    });

    it('keeps the modal open when the shared mutation fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const addSongToFavorite = vi.fn().mockRejectedValue(new Error('save failed'));
        const { result, closeModal, setPendingFavoriteSong, setStatus } = renderActions(addSongToFavorite);

        await act(async () => result.current.addToFavoriteFromModal(favorite));

        expect(closeModal).not.toHaveBeenCalled();
        expect(setPendingFavoriteSong).not.toHaveBeenCalledWith(null);
        expect(setStatus).toHaveBeenCalledWith(expect.stringContaining('添加失败'));
    });
});
