import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Favorite, Song } from '../../types';
import { usePlayModes } from './usePlayModes';

const song: Song = {
	id: 'song', bvid: 'BV1xx411c7mD', name: 'Song', singer: 'Singer', singerId: '', cover: '', coverLocal: '', sourceId: '',
	streamUrl: '', streamUrlExpiresAt: '', lyric: '', lyricOffset: 0, skipStartTime: 0, skipEndTime: 0, pageNumber: 1,
	pageTitle: '', videoTitle: '', totalPages: 1, duration: 0, createdAt: '', updatedAt: '',
};

const favorite: Favorite = { id: 'favorite', title: 'Long list', songIds: [], songCount: 10_000, createdAt: '', updatedAt: '' };

const renderPlayModes = () => {
	const loadFavoriteSongs = vi.fn(async () => [song]);
	const setQueue = vi.fn();
	const setCurrentIndex = vi.fn();
	const playSong = vi.fn(async () => undefined);
	const hook = renderHook(() => usePlayModes({
		loadFavoriteSongs,
		queue: [],
		currentIndex: 0,
		setQueue,
		setCurrentIndex,
		setCurrentSong: vi.fn(),
		setIsPlaying: vi.fn(),
		playSong,
	}));
	return { ...hook, loadFavoriteSongs, setQueue, setCurrentIndex, playSong };
};

describe('usePlayModes lazy hydration', () => {
	it('plays a clicked row without loading the complete playlist', async () => {
		const { result, loadFavoriteSongs, setQueue, setCurrentIndex, playSong } = renderPlayModes();

		await act(async () => result.current.playSingleSong(song));

		expect(loadFavoriteSongs).not.toHaveBeenCalled();
		expect(setQueue).toHaveBeenCalledWith([song]);
		expect(setCurrentIndex).toHaveBeenCalledWith(0);
		expect(playSong).toHaveBeenCalledWith(song, [song]);
	});

	it('loads all pages only for the explicit play-all action', async () => {
		const { result, loadFavoriteSongs } = renderPlayModes();

		await act(async () => result.current.playFavorite(favorite));

		expect(loadFavoriteSongs).toHaveBeenCalledWith(favorite.id);
	});
});
