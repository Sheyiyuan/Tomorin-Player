import { useMemo } from "react";
import type { DerivedStyles, Favorite, PlaylistSyncStatus, Song, UserInfo } from "../../types";
import type { ModalName, PlayMode, QueueItem, RepeatMode } from '../../context/types/contexts';
import type { useLyrics } from "../features/useLyrics";

const NOOP = () => undefined;
const NOOP_INDEX = (_index: number) => undefined;
const NOOP_ID = (_id: string) => undefined;
const NOOP_REORDER = (_from: string, _to: string) => undefined;
const NOOP_SONG = (_song: Song) => undefined;

interface UseAppPanelsPropsParams {
    // TopBar deps
    userInfo: UserInfo | null;
    hitokoto: string;
    setGlobalSearchTerm: (val: string) => void;
    openModal: (name: ModalName) => void;
    themeColor: string;
    setUserInfo: (val: UserInfo | null) => void;
    setStatus: (val: string) => void;
    windowControlsPos?: string;

    // MainLayout deps
    currentSong: Song | null;
    panelBackground: string;
    panelStyles: React.CSSProperties;
    computedColorScheme: "light" | "dark";
    placeholderCover: string;
    maxSkipLimit: number;
    formatTime: (v: number) => string;
    formatTimeWithMs: (v: number) => string;
    handleIntervalChange: (start: number, end: number) => void;
    handleSkipStartChange: (val: number) => void;
    handleSkipEndChange: (val: number) => void;
    handleSongInfoUpdate: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void;
    globalVolumeCompensationDb: number;
    songVolumeOffsetDb: number | null;
    onSongVolumeOffsetChange: (songId: string, offsetDb: number | null) => void;
    currentFav: Favorite | null;
    currentFavSongs: Song[];
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    downloadedSongIds: Set<string>;
    handleDownloadSong: (song: Song) => Promise<void>;
    handleAddSongToFavorite: (song: Song) => void;
    handleRemoveSongFromPlaylist: (song: Song) => void;
    confirmRemoveSongId: string | null;
    setConfirmRemoveSongId: (id: string | null) => void;
    playFavorite: (fav: Favorite) => void;
    handleDownloadAllFavorite: (fav: Favorite) => Promise<void>;
    favorites: Favorite[];
    selectedFavId: string | null;
    setSelectedFavId: (id: string | null) => void;
    setConfirmDeleteFavId: (id: string | null) => void;
    playSingleSong: (song: Song, songFavorite?: Favorite) => Promise<void>;
    createFavorite: () => void;
    handleEditFavorite: (fav: Favorite) => void;
    handleDeleteFavorite: (id: string) => Promise<void>;
    confirmDeleteFavId: string | null;

    // ControlsPanel deps
    progressInInterval: number;
    intervalStart: number;
    intervalLength: number;
    duration: number;
    seek: (val: number) => void;
    playPrev: () => void;
    togglePlay: () => void;
    playNext: () => void;
    isPlaying: boolean;
    playMode: PlayMode;
    handlePlayModeToggle: () => void;
    handleAddCurrentSongToFavorite: () => void;
    handleDownloadCurrentSong: () => void;
    handleManageDownload: () => void;
    volume: number;
    changeVolume: (val: number) => void;
    songsCount: number;
    queueItems?: QueueItem[];
    playOrder?: string[];
    currentQueueItemId?: string | null;
    priorityNext?: string[];
    shuffleEnabled?: boolean;
    repeatMode?: RepeatMode;
    onPlayQueueItem?: (index: number) => void;
    onRemoveQueueItem?: (queueItemId: string) => void;
    onReorderQueueItems?: (fromQueueItemId: string, toQueueItemId: string) => void;
    onClearUpcoming?: () => void;
    onToggleShuffle?: () => void;
    onToggleRepeatMode?: () => void;
    onPlayNextSong?: (song: Song) => void;
    onEnqueueLastSong?: (song: Song) => void;
    componentRadius?: number;
    coverRadius?: number;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    favoriteCardBackground?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
	lyricsState: ReturnType<typeof useLyrics>;
	getLyricProgress: () => number;
	onLyricSeek: (value: number) => void;
	onSyncFavorite: (id: string) => Promise<void>;
	onLoadFavoriteSyncStatus: (id: string) => Promise<void>;
	onDetachFavorite: (id: string) => Promise<void>;
	onDuplicateFavorite: (favorite: Favorite) => Promise<void>;
	syncingFavoriteIds: Set<string>;
	syncStatusByFavorite: Record<string, PlaylistSyncStatus>;
	derived: DerivedStyles;
}

export const useAppPanelsProps = (params: UseAppPanelsPropsParams) => {
	const {
		userInfo,
		hitokoto,
		setGlobalSearchTerm,
		openModal,
		themeColor,
		setUserInfo,
		setStatus,
		windowControlsPos,
		currentSong,
		panelBackground,
		panelStyles,
		computedColorScheme,
		placeholderCover,
		maxSkipLimit,
		formatTime,
		formatTimeWithMs,
		handleIntervalChange,
		handleSkipStartChange,
		handleSkipEndChange,
		handleSongInfoUpdate,
		globalVolumeCompensationDb,
		songVolumeOffsetDb,
		onSongVolumeOffsetChange,
		currentFav,
		currentFavSongs,
		searchQuery,
		setSearchQuery,
		downloadedSongIds,
		handleDownloadSong,
		handleAddSongToFavorite,
		handleRemoveSongFromPlaylist,
		confirmRemoveSongId,
		setConfirmRemoveSongId,
		playFavorite,
		handleDownloadAllFavorite,
		favorites,
		selectedFavId,
		setSelectedFavId,
		setConfirmDeleteFavId,
		playSingleSong,
		createFavorite,
		handleEditFavorite,
		handleDeleteFavorite,
		confirmDeleteFavId,
		progressInInterval,
		intervalStart,
		intervalLength,
		duration,
		seek,
		playPrev,
		togglePlay,
		playNext,
		isPlaying,
		playMode,
		handlePlayModeToggle,
		handleAddCurrentSongToFavorite,
		handleDownloadCurrentSong,
		handleManageDownload,
		volume,
		changeVolume,
		songsCount,
		queueItems = [],
		playOrder = [],
		currentQueueItemId = null,
		priorityNext = [],
		shuffleEnabled = playMode === 'random',
		repeatMode = playMode === 'single' ? 'one' : 'all',
		onPlayQueueItem = NOOP_INDEX,
		onRemoveQueueItem = NOOP_ID,
		onReorderQueueItems = NOOP_REORDER,
		onClearUpcoming = NOOP,
		onToggleShuffle = NOOP,
		onToggleRepeatMode = NOOP,
		onPlayNextSong = NOOP_SONG,
		onEnqueueLastSong = NOOP_SONG,
		componentRadius,
		coverRadius,
		controlBackground,
		controlStyles,
		favoriteCardBackground,
		textColorPrimary,
		textColorSecondary,
		lyricsState,
		getLyricProgress,
		onLyricSeek,
		onSyncFavorite,
		onLoadFavoriteSyncStatus,
		onDetachFavorite,
		onDuplicateFavorite,
		syncingFavoriteIds,
		syncStatusByFavorite,
		derived,
	} = params;

	const topBarProps = useMemo(() => ({
            userInfo,
            hitokoto,
            panelBackground,
            panelStyles,
            windowControlsPos,
            onSearchClick: () => {
                setGlobalSearchTerm("");
                openModal("globalSearchModal");
            },
            onThemeClick: () => {
                openModal("themeManagerModal");
            },
            onSettingsClick: () => openModal("settingsModal"),
            onLoginClick: () => openModal("loginModal"),
            onLogout: () => {
                setUserInfo(null);
                setStatus("已退出登录");
            },
            themeColor,
            controlBackground,
			controlStyles,
            textColorPrimary,
            textColorSecondary,
			componentRadius,
		} as const), [userInfo, hitokoto, panelBackground, panelStyles, windowControlsPos, setGlobalSearchTerm, openModal, setUserInfo, setStatus, themeColor, controlBackground, controlStyles, textColorPrimary, textColorSecondary, componentRadius]);

	const mainLayoutProps = useMemo(() => ({
            currentSong,
            panelBackground,
            panelStyles,
            themeColor,
            computedColorScheme,
            placeholderCover,
            maxSkipLimit,
            formatTime,
            formatTimeWithMs,
            onIntervalChange: handleIntervalChange,
            onSkipStartChange: handleSkipStartChange,
            onSkipEndChange: handleSkipEndChange,
            onSongInfoUpdate: handleSongInfoUpdate,
            volumeCompensationDb: globalVolumeCompensationDb,
            songVolumeOffsetDb,
            onSongVolumeOffsetChange,
			lyrics: {
				song: currentSong,
				view: lyricsState.view,
				state: lyricsState.state,
				error: lyricsState.error,
				message: lyricsState.message,
				getProgressSeconds: getLyricProgress,
				seek: onLyricSeek,
				actions: lyricsState.actions,
				themeColor,
					controlBackground,
					textColorPrimary,
					textColorSecondary,
					componentRadius,
					modalBackground: derived.modalBackground,
				modalBlur: derived.modalBlur,
				modalRadius: derived.modalRadius,
			},
            currentFav,
            currentFavSongs,
            searchQuery,
            onSearchChange: setSearchQuery,
            onPlaySong: (song: Song) => {
                // 从歌单点击歌曲时，使用 playSingleSong 避免替换当前播放队列
                const fav = currentFav || favorites.find(f => f.songIds.some(ref => ref.songId === song.id));
                playSingleSong(song, fav);
            },
            onPlayNext: onPlayNextSong,
            onEnqueueLast: onEnqueueLastSong,
            downloadedSongIds,
            onDownloadSong: handleDownloadSong,
            onAddSongToFavorite: handleAddSongToFavorite,
            onRemoveSongFromPlaylist: handleRemoveSongFromPlaylist,
            confirmRemoveSongId,
            onToggleConfirmRemove: setConfirmRemoveSongId,
            onPlayAll: () => {
                if (currentFav) {
                    playFavorite(currentFav);
                }
            },
            onDownloadAll: () => {
                if (currentFav) {
                    handleDownloadAllFavorite(currentFav);
                }
            },
            favorites,
            selectedFavId,
            onSelectFavorite: (id: string | null) => {
                setSelectedFavId(id);
                setConfirmDeleteFavId(null);
            },
            onPlayFavorite: playFavorite,
            onCreateFavorite: createFavorite,
            onEditFavorite: handleEditFavorite,
            onDeleteFavorite: handleDeleteFavorite,
            onToggleConfirmDelete: setConfirmDeleteFavId,
            confirmDeleteFavId,
				onSyncFavorite,
				onLoadFavoriteSyncStatus,
				onDetachFavorite,
			onDuplicateFavorite,
				onLoginRequired: () => openModal("loginModal"),
				syncingFavoriteIds,
				syncStatusByFavorite,
				derived,
			componentRadius,
			coverRadius,
			controlBackground,
			controlStyles,
			favoriteCardBackground,
			textColorPrimary,
			textColorSecondary,
		} as const), [currentSong, panelBackground, panelStyles, themeColor, computedColorScheme, placeholderCover, maxSkipLimit, formatTime, formatTimeWithMs, handleIntervalChange, handleSkipStartChange, handleSkipEndChange, handleSongInfoUpdate, globalVolumeCompensationDb, songVolumeOffsetDb, onSongVolumeOffsetChange, lyricsState.view, lyricsState.state, lyricsState.error, lyricsState.message, lyricsState.actions, getLyricProgress, onLyricSeek, controlBackground, textColorPrimary, textColorSecondary, componentRadius, derived, currentFav, currentFavSongs, searchQuery, setSearchQuery, playSingleSong, onPlayNextSong, onEnqueueLastSong, favorites, downloadedSongIds, handleDownloadSong, handleAddSongToFavorite, handleRemoveSongFromPlaylist, confirmRemoveSongId, setConfirmRemoveSongId, playFavorite, handleDownloadAllFavorite, selectedFavId, setSelectedFavId, setConfirmDeleteFavId, createFavorite, handleEditFavorite, handleDeleteFavorite, confirmDeleteFavId, onSyncFavorite, onLoadFavoriteSyncStatus, onDetachFavorite, onDuplicateFavorite, openModal, syncingFavoriteIds, syncStatusByFavorite, coverRadius, controlStyles, favoriteCardBackground]);

	const controlsPanelProps = useMemo(() => ({
            themeColor,
            currentSong,
            progressInInterval,
            intervalStart,
            intervalLength,
            duration,
            formatTime,
            formatTimeWithMs,
            seek,
            playPrev,
            togglePlay,
            playNext,
            isPlaying,
            playMode,
            onTogglePlayMode: handlePlayModeToggle,
            onAddToFavorite: handleAddCurrentSongToFavorite,
            onDownloadSong: handleDownloadCurrentSong,
            onManageDownload: handleManageDownload,
            downloadedSongIds,
            volume,
            changeVolume,
			songsCount,
			queueItems,
			playOrder,
			currentQueueItemId,
			priorityNext,
			shuffleEnabled,
			repeatMode,
			onPlayQueueItem,
			onRemoveQueueItem,
			onReorderQueueItems,
			onClearUpcoming,
			onToggleShuffle,
			onToggleRepeatMode,
			panelBackground,
			panelStyles,
			componentRadius,
			controlStyles,
			textColorPrimary,
			textColorSecondary,
		} as const), [themeColor, currentSong, progressInInterval, intervalStart, intervalLength, duration, formatTime, formatTimeWithMs, seek, playPrev, togglePlay, playNext, isPlaying, playMode, handlePlayModeToggle, handleAddCurrentSongToFavorite, handleDownloadCurrentSong, handleManageDownload, downloadedSongIds, volume, changeVolume, songsCount, queueItems, playOrder, currentQueueItemId, priorityNext, shuffleEnabled, repeatMode, onPlayQueueItem, onRemoveQueueItem, onReorderQueueItems, onClearUpcoming, onToggleShuffle, onToggleRepeatMode, panelBackground, panelStyles, componentRadius, controlStyles, textColorPrimary, textColorSecondary]);

	return { topBarProps, mainLayoutProps, controlsPanelProps } as const;
};
