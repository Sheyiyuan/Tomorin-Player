import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Favorite, Song } from '../../types';

const getProxiedImageUrlSync = vi.fn((value: string) => value);

vi.mock('./useImageProxy', () => ({
	useImageProxy: () => ({ getProxiedImageUrlSync }),
}));

import { useAppPanelsProps } from './useAppPanelsProps';

const song: Song = {
	id: 'song', bvid: '', name: 'song', singer: '', singerId: '', cover: '', coverLocal: '', sourceId: '', streamUrl: '', streamUrlExpiresAt: '',
	lyric: '', lyricOffset: 0, skipStartTime: 0, skipEndTime: 0, pageNumber: 1, pageTitle: '', videoTitle: '', totalPages: 1, createdAt: '', updatedAt: '',
};

const favorite: Favorite = { id: 'favorite', title: 'favorite', songIds: [], createdAt: '', updatedAt: '' };
const noop = () => undefined;
const asyncNoop = async () => undefined;

const createParams = (): Parameters<typeof useAppPanelsProps>[0] => ({
	userInfo: null,
	hitokoto: '',
	setGlobalSearchTerm: noop,
	openModal: noop,
	themeColor: 'blue',
	setUserInfo: noop,
	setStatus: noop,
	windowControlsPos: 'right',
	currentSong: song,
	panelBackground: '#111',
	panelStyles: {},
	computedColorScheme: 'dark',
	placeholderCover: '',
	maxSkipLimit: 60,
	formatTime: String,
	formatTimeWithMs: String,
	handleIntervalChange: noop,
	handleSkipStartChange: noop,
	handleSkipEndChange: noop,
	handleSongInfoUpdate: noop,
	globalVolumeCompensationDb: 0,
	songVolumeOffsetDb: null,
	onSongVolumeOffsetChange: noop,
	currentFav: favorite,
	currentFavSongs: [song],
	searchQuery: '',
	setSearchQuery: noop,
	downloadedSongIds: new Set(),
	handleDownloadSong: asyncNoop,
	handleAddSongToFavorite: noop,
	handleRemoveSongFromPlaylist: noop,
	confirmRemoveSongId: null,
	setConfirmRemoveSongId: noop,
	playFavorite: noop,
	handleDownloadAllFavorite: asyncNoop,
	favorites: [favorite],
	selectedFavId: favorite.id,
	setSelectedFavId: noop,
	setConfirmDeleteFavId: noop,
	playSingleSong: asyncNoop,
	createFavorite: noop,
	handleEditFavorite: noop,
	handleDeleteFavorite: asyncNoop,
	confirmDeleteFavId: null,
	progressInInterval: 0,
	intervalStart: 0,
	intervalLength: 60,
	duration: 60,
	seek: noop,
	playPrev: noop,
	togglePlay: noop,
	playNext: noop,
	isPlaying: true,
	playMode: 'loop',
	handlePlayModeToggle: noop,
	handleAddCurrentSongToFavorite: noop,
	handleDownloadCurrentSong: noop,
	handleManageDownload: noop,
	volume: 0.5,
	changeVolume: noop,
	songsCount: 1,
	lyricsState: {
		view: null,
		state: 'empty',
		error: null,
		message: '',
		actions: {
			search: asyncNoop,
			cancelSearch: noop,
			previewText: async () => ({ text: '', format: 'plain', encoding: 'utf-8', lines: [], metadata: {}, embeddedOffsetMs: 0, validLineCount: 0, firstMs: 0, lastMs: 0, warnings: [] }),
			previewFile: async () => ({ text: '', format: 'plain', encoding: 'utf-8', lines: [], metadata: {}, embeddedOffsetMs: 0, validLineCount: 0, firstMs: 0, lastMs: 0, warnings: [] }),
			importText: asyncNoop,
			importFile: asyncNoop,
			setOffset: asyncNoop,
			applyCandidate: asyncNoop,
			restoreAutomatic: asyncNoop,
				deleteLyric: asyncNoop,
				rejectCandidate: asyncNoop,
			},
	},
	getLyricProgress: () => 0,
	onLyricSeek: noop,
	onSyncFavorite: asyncNoop,
	onLoadFavoriteSyncStatus: asyncNoop,
	onDetachFavorite: asyncNoop,
	onDuplicateFavorite: asyncNoop,
	syncingFavoriteIds: new Set(),
	syncStatusByFavorite: {},
	derived: {},
});

describe('useAppPanelsProps', () => {
	it('does not rebuild workspace props when only playback progress changes', () => {
		const params = createParams();
		const { result, rerender } = renderHook(({ value }) => useAppPanelsProps(value), { initialProps: { value: params } });
		const mainLayoutProps = result.current.mainLayoutProps;
		const controlsPanelProps = result.current.controlsPanelProps;

		rerender({ value: { ...params, progressInInterval: 1 } });

		expect(result.current.mainLayoutProps).toBe(mainLayoutProps);
		expect(result.current.controlsPanelProps).not.toBe(controlsPanelProps);
		expect(result.current.controlsPanelProps.progressInInterval).toBe(1);
	});
});
