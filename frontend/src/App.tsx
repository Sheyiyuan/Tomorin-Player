import React, { useCallback, useRef, useState, useMemo } from "react";
import { Box } from "@mantine/core";

// Hooks - Core layers
import { useAudioPlayer, useAudioInterval, usePlaylistActions, useSkipIntervalHandler, useDownloadManager, useAudioEvents, usePlaybackControls, useAudioSourceManager, usePlaySong, usePlayModes } from "./hooks/player";
import { useFavoriteSongPages, useSettingsPersistence } from "./hooks/data";

// Hooks - Features
import { useAuth, useBVResolver, useFavoriteActions, useThemeEditor, useSearchAndBV, useBVModal, useSongOperations, useGlobalSearch, useLoginHandlers, useLyrics, usePlaylistSync } from "./hooks/features";

// Hooks - UI aggregation
import { useHitokoto, useUiDerived, useAppLifecycle, useAppEffects, useAppHandlers, useAppPanelsProps, useAppModalsProps, useThemeManagement, useFavoritesManager, useThemeDraftState, useAppSearchState, useAppComputedState } from "./hooks/ui";

// Hooks - Store
import { usePlayerStore } from "./context/hooks/usePlayerStore";
import { useDataStore } from "./context/hooks/useDataStore";
import { useThemeStore } from "./context/hooks/useThemeStore";
import { useUIStore } from "./context/hooks/useUIStore";

// Components
import AppModals from "./components/AppModalsOptimized";
import { AppPanels } from "./components/layouts";

// Utils
import { formatTime, formatTimeWithMs } from "./utils/time";
import { PLACEHOLDER_COVER, DEFAULT_THEMES } from "./utils/constants";
import { favoriteSongCount, Song } from "./types";

// Wails runtime
/**
 * App Component - 应用主组件
 * 
 * 应用编排层：连接领域 Context、业务 Hook 与页面布局。
 */
const App: React.FC = () => {
    // ========== 聚合状态管理 ==========
    const themeDraft = useThemeDraftState();
    const favoritesState = useFavoritesManager();
    const searchState = useAppSearchState();

    // ========== 播放器层 ==========
    const playerStore = usePlayerStore();
    const { songs: queue, currentIndex, items: queueItems, shuffleEnabled, repeatMode } = playerStore.queue;
    const { currentSong, isPlaying, progress, duration } = playerStore.playback;
    const { playMode, volume } = playerStore.controls;
    const {
        setQueue,
        setCurrentIndex,
        setPlaylistHydrated,
        activateQueueItem,
        setSong: setCurrentSong,
        setPlayMode,
        setIsPlaying,
        setProgress,
        setDuration,
        setVolume: setPlayerVolume,
        setShuffleEnabled,
        setRepeatMode,
        enqueueNext,
        enqueueLast,
        removeQueueItem,
        reorderQueueItems,
        clearUpcoming,
    } = playerStore.actions;

    // ========== 设置状态（提前，用于音量补偿计算） ==========
    const dataStore = useDataStore();
    const { songs, favorites, selectedFavId } = dataStore.data;
    const { playerSetting: setting } = dataStore.settings;
	const { setSongs, setFavorites, setSelectedFavId, setSetting } = dataStore.actions;
    const [pendingFavoriteSong, setPendingFavoriteSong] = useState<Song | null>(null);

    const volumeCompensationDb = useMemo(() => {
        const raw = setting?.config?.volumeCompensationDb;
        return Number.isFinite(raw) ? Number(raw) : 0;
    }, [setting]);

    const songVolumeOffsets = useMemo(() => {
        const raw = setting?.config?.songVolumeOffsets;
        if (raw && typeof raw === 'object') {
            return raw as Record<string, number>;
        }
        return {} as Record<string, number>;
    }, [setting]);

    const currentSongVolumeOffsetDb = useMemo(() => {
        if (!currentSong?.id) return null;
        const v = songVolumeOffsets[currentSong.id];
        return Number.isFinite(v) ? Number(v) : null;
    }, [currentSong?.id, songVolumeOffsets]);

    const effectiveVolumeCompensationDb = currentSongVolumeOffsetDb ?? volumeCompensationDb;

    const audioPlayer = useAudioPlayer({
        isPlaying,
        progress,
        duration,
        volume,
        setIsPlaying,
        setProgress,
        setDuration,
        setVolume: setPlayerVolume,
    }, effectiveVolumeCompensationDb);
    const { audioRef, actions: audioActions } = audioPlayer;
    const { seek, setVolume } = audioActions;
	const getLyricProgress = useCallback(() => audioRef.current?.currentTime ?? 0, [audioRef]);

    const interval = useAudioInterval(currentSong, duration, progress);
    const { intervalRef, intervalStart, intervalEnd, intervalLength, progressInInterval } = interval;

    // ========== 上下文 ==========
    const themeStore = useThemeStore();

    // 主题状态
    const { themes, currentThemeId, colorScheme } = themeStore.theme;
    const { themeColor, backgroundColor, panelColor, controlColor, textColorPrimary, textColorSecondary, favoriteCardColor, modalColor } = themeStore.colors;
    const { backgroundOpacity, backgroundImageUrl, backgroundBlur, panelOpacity, panelBlur, controlOpacity, controlBlur, cardOpacity, modalOpacity, modalBlur } = themeStore.effects;
    const { panelRadius, modalRadius, notificationRadius, componentRadius, coverRadius, windowControlsPos } = themeStore.layout;

    const { setThemes, applyTheme } = themeStore.actions;

    const auth = useAuth();
    const { userInfo, setUserInfo } = auth;

    const bvResolver = useBVResolver();
    const { bvPreview, bvSongName, bvSinger, bvTargetFavId, sliceStart, sliceEnd, setBvPreview, openBvModal, closeBvModal, setBvSongName, setBvSinger, setBvTargetFavId, setResolvingBV, setSliceStart, setSliceEnd } = bvResolver;

    const hitokoto = useHitokoto();

    const { modals, actions: uiActions } = useUIStore();
    const { openModal, closeModal } = uiActions;

    // ========== 内部状态 ==========

    // ========== Refs ==========
    const playingRef = useRef<string | null>(null);
    const playbackRetryRef = useRef<Map<string, number>>(new Map());
    const isHandlingErrorRef = useRef<Set<string>>(new Set());
    const prevSongIdRef = useRef<string | null>(null);
    const skipPersistRef = useRef(true);
    const saveTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // ========== 导出聚合状态 ==========
    const { searchQuery, setSearchQuery, globalSearchTerm, setGlobalSearchTerm, setRemoteResults, setRemoteLoading, newFavName, setNewFavName, setCacheSize, status, setStatus } = searchState;
	const { createFavName, setCreateFavName, createFavMode, setCreateFavMode, duplicateSourceId, setDuplicateSourceId, importFid, setImportFid, keepImportedFavoriteSynced, setKeepImportedFavoriteSynced, confirmDeleteFavId, setConfirmDeleteFavId, editingFavId, setEditingFavId, editingFavName, setEditingFavName, setConfirmDeleteDownloaded, downloadedSongIds, setDownloadedSongIds, managingSong, setManagingSong, confirmRemoveSongId, setConfirmRemoveSongId } = favoritesState;
    // ========== 主题管理 ==========
    const themeManagement = useThemeManagement({ themes });
    const { saveCachedCustomThemes, getCustomThemes } = themeManagement;

    // ========== 业务逻辑 Hooks ==========
	const favoriteActions = useFavoriteActions({ favorites, setFavorites, selectedFavId, setSelectedFavId, setStatus, openModal, closeModal });
	const currentFav = useMemo(
		() => selectedFavId ? (favorites.find((favorite) => favorite.id === selectedFavId) ?? null) : null,
		[favorites, selectedFavId],
	);
	const mergeLoadedSongs = useCallback((loadedSongs: Song[]) => {
		setSongs((current) => {
			const byID = new Map(current.map((song) => [song.id, song]));
			for (const song of loadedSongs) {
				byID.delete(song.id);
				byID.set(song.id, song);
			}
			return [...byID.values()].slice(-2_000);
		});
	}, [setSongs]);
	const favoriteSongPages = useFavoriteSongPages({
		favoriteId: currentFav?.id,
		favoriteRevision: currentFav?.updatedAt,
		favoriteSongCount: currentFav ? favoriteSongCount(currentFav) : 0,
		query: searchQuery,
		onSongsLoaded: mergeLoadedSongs,
	});
	const lyricsState = useLyrics(currentSong);
	const playlistSync = usePlaylistSync({ setFavorites });

	const { playSong } = usePlaySong({ selectedFavId, setCurrentSong, setIsPlaying, setStatus, setSongs, onSongUpdated: favoriteSongPages.patchSong });

	const songOperations = useSongOperations({ currentSong, songs, setSongs, setCurrentSong, onSongUpdated: favoriteSongPages.patchSong });
    const { updateSongInfo } = songOperations;

    const playlistActions = usePlaylistActions({ queue, setQueue, currentIndex, setCurrentIndex, currentSong, setCurrentSong, setIsPlaying, currentFav, setFavorites, setStatus, setConfirmRemoveSongId, openModal, closeModal, playSong, addSongToFavorite: favoriteActions.addToFavorite, setPendingFavoriteSong, pendingFavoriteSong });

    const themeEditor = useThemeEditor({ themes, setThemes, defaultThemes: DEFAULT_THEMES, currentThemeId, computedColorScheme: colorScheme, saveCachedCustomThemes, applyThemeToUi: applyTheme, getCustomThemesFromState: getCustomThemes, themeDraft, openModal, closeModal });

    const bvModal = useBVModal({ bvPreview, sliceStart, sliceEnd, bvSongName, bvSinger, bvTargetFavId, favorites, closeBvModal, setBvPreview, setBvSongName, setBvSinger, setSliceStart, setSliceEnd, setSongs, setFavorites, setSelectedFavId });

	const skipIntervalHandler = useSkipIntervalHandler({ currentSong, setCurrentSong, setSongs, setQueue, saveTimerRef, onSongUpdated: favoriteSongPages.patchSong });

	const downloadManager = useDownloadManager({ currentSong, loadFavoriteSongs: favoriteSongPages.loadAll, downloadedSongIds, managingSong, setStatus, setDownloadedSongIds, setManagingSong, setConfirmDeleteDownloaded, openModal, closeModal });

	const { playSingleSong, playFavorite } = usePlayModes({ loadFavoriteSongs: favoriteSongPages.loadAll, queue, setQueue, setCurrentIndex, playSong, queueItems, enqueueLast, activateQueueItem });

    useAudioSourceManager({
        audioRef,
        currentSong,
        playingRef,
        playbackRetryRef,
        isPlaying,
        setIsPlaying,
        onBeforePlay: audioPlayer.ensureWebAudioReady,
    });

    const searchAndBV = useSearchAndBV({ themeColor, selectedFavId, favorites, globalSearchTerm, setGlobalSearchTerm, setRemoteResults, setRemoteLoading, setBvPreview, setBvSongName, setBvSinger, setBvTargetFavId, openBvModal, setResolvingBV, playSingleSong, playFavorite, setSelectedFavId, closeModal });

    const playbackControls = usePlaybackControls({ audioRef, currentSong, currentIndex, queue, playMode, intervalStart, intervalEnd, setIsPlaying, setCurrentIndex, setVolume, playSong, playbackRetryRef, isHandlingErrorRef, onBeforePlay: audioPlayer.ensureWebAudioReady, queueItems, playOrder: playerStore.queue.playOrder, currentQueueItemId: playerStore.queue.currentQueueItemId, priorityNext: playerStore.queue.priorityNext, history: playerStore.queue.history, shuffleEnabled, repeatMode, activateQueueItem, setPlayOrder: playerStore.actions.setPlayOrder, setHistory: playerStore.actions.setHistory });
    const { playNext, playPrev, togglePlay, changeVolume } = playbackControls;

    const handlePlayQueueItem = useCallback((index: number) => {
        const item = queueItems[index];
        if (!item) return;
        activateQueueItem(item.queueItemId, 'manual');
        void playSong(item.song);
    }, [queueItems, activateQueueItem, playSong]);

    const handleRemoveQueueItem = useCallback((queueItemId: string) => {
        const index = queueItems.findIndex((item) => item.queueItemId === queueItemId);
        if (index < 0) return;
        const isCurrent = queueItems[index]?.queueItemId === playerStore.queue.currentQueueItemId;
        const nextQueue = queueItems.filter((item) => item.queueItemId !== queueItemId);
        const orderIndex = playerStore.queue.playOrder.indexOf(queueItemId);
        const fallbackId = playerStore.queue.playOrder[orderIndex + 1] ?? playerStore.queue.playOrder[orderIndex - 1] ?? null;
        const fallback = nextQueue.find((item) => item.queueItemId === fallbackId) ?? null;
        removeQueueItem(queueItemId);
        if (isCurrent && fallback) void playSong(fallback.song);
    }, [queueItems, playerStore.queue.currentQueueItemId, playerStore.queue.playOrder, removeQueueItem, playSong]);

    const handleClearUpcoming = useCallback(() => clearUpcoming(), [clearUpcoming]);
    const handleToggleShuffle = useCallback(() => setShuffleEnabled(!shuffleEnabled), [setShuffleEnabled, shuffleEnabled]);
    const handleToggleRepeatMode = useCallback(() => setRepeatMode(repeatMode === 'all' ? 'one' : 'all'), [setRepeatMode, repeatMode]);

    const settingsPersistence = useSettingsPersistence({ setting, playMode, shuffleEnabled, repeatMode, volume, currentThemeId: currentThemeId || "", setSetting, skipPersistRef });
    const { persistSettings, settingsLoadedRef } = settingsPersistence;

    const clampDb = (value: number) => {
        if (!Number.isFinite(value)) return 0;
        return Math.min(12, Math.max(-12, value));
    };

    const handleGlobalVolumeCompensationChange = useCallback(async (value: number) => {
        const nextValue = clampDb(value);
        await persistSettings({ config: { volumeCompensationDb: nextValue } });
    }, [persistSettings]);

    const handleSongVolumeOffsetChange = useCallback(async (songId: string, value: number | null) => {
        const current = songVolumeOffsets || {};
        const nextOffsets = { ...current } as Record<string, number>;
        if (value === null) {
            delete nextOffsets[songId];
        } else {
            nextOffsets[songId] = clampDb(value);
        }
        await persistSettings({ config: { songVolumeOffsets: nextOffsets } });
    }, [persistSettings, songVolumeOffsets]);

	const { globalSearchResults } = useGlobalSearch({ globalSearchTerm, favorites });
    const { handleLoginSuccess } = useLoginHandlers({ closeModal, setUserInfo, setStatus });

    // ========== UI 派生值 ==========
    const { backgroundWithOpacity, panelBackground, controlBackground, favoriteCardBackground, modalBackground, modalBlur: derivedModalBlur, panelStyles, controlStyles, componentRadius: derivedComponentRadius, coverRadius: derivedCoverRadius, modalRadius: derivedModalRadius, textColorPrimary: derivedTextColorPrimary, textColorSecondary: derivedTextColorSecondary } = useUiDerived({
        themeColor, backgroundColor, backgroundOpacity, backgroundImageUrl, panelColor, panelOpacity, panelBlur, panelRadius, controlColor, controlOpacity, controlBlur, textColorPrimary, textColorSecondary, favoriteCardColor, cardOpacity, modalRadius, notificationRadius, componentRadius, coverRadius, modalColor, modalOpacity, modalBlur,
    });

    const { maxSkipLimit, backgroundStyle } = useAppComputedState({
		duration, backgroundImageUrl, backgroundBlur, backgroundWithOpacity,
    });

    // ========== 应用生命周期 ==========
    useAppLifecycle({ setUserInfo, saveCachedCustomThemes, setSetting, setVolume, setPlayMode, setShuffleEnabled, setRepeatMode, setThemes, applyThemeToUi: applyTheme, skipPersistRef, settingsLoadedRef, modalsSettingsModal: modals.settingsModal, setCacheSize, setStatus, setSongs, setFavorites, setQueue, setCurrentIndex, setPlaylistHydrated, setCurrentSong, setSelectedFavId });

    useAppEffects({ intervalStart, intervalEnd, intervalLength, intervalRef, currentSong, songs, setDownloadedSongIds, prevSongIdRef });

    useAudioEvents({
        audioRef,
        currentSong,
        queue,
        currentIndex,
        playMode,
        repeatMode,
        isPlaying,
        intervalRef: intervalRef as React.MutableRefObject<{ start: number; end: number; length: number }>,
        setIsPlaying,
        setProgress,
        setDuration,
        setCurrentIndex,
        setCurrentSong,
        setStatus,
        playbackRetryRef,
        isHandlingErrorRef,
        playSong,
        playNext,
        onBeforePlay: audioPlayer.ensureWebAudioReady,
    });

    // ========== Handlers ==========
    const myFavoriteImport = favoriteActions.myFavoriteImport;

	const handlers = useAppHandlers({ themeEditor, favoriteActions, editingFavId, editingFavName, setEditingFavId, setEditingFavName, createFavName, setCreateFavName, createFavMode, setCreateFavMode, duplicateSourceId, setDuplicateSourceId, importFid, setImportFid, keepImportedFavoriteSynced, setKeepImportedFavoriteSynced, openModal, setConfirmDeleteFavId, skipIntervalHandler, playMode, setPlayMode, downloadManager, setConfirmDeleteDownloaded, setManagingSong, closeModal, playlistActions, searchAndBV, newFavName, setNewFavName, setFavorites, setBvTargetFavId, bvPreview, sliceStart, sliceEnd, setSliceStart, setSliceEnd, setCacheSize, bvModal });

    const { handleDeleteFavorite, handleEditFavorite, createFavorite, handleIntervalChange, handleSkipStartChange, handleSkipEndChange, handlePlayModeToggle, handleDownloadCurrentSong, handleManageDownload, handleDownloadSong, handleDownloadAllFavorite, handleAddSongToFavorite, handleAddCurrentSongToFavorite, handleRemoveSongFromPlaylist } = handlers;

    const onLoginSuccess = async () => {
        myFavoriteImport.clearCollections?.();
        await handleLoginSuccess();
    };

    // ========== 构建 Props ==========
    const derivedStyles = useMemo(() => ({
        panelBackground,
        controlBackground,
        favoriteCardBackground,
        modalBackground,
        modalBlur: derivedModalBlur,
        modalRadius: derivedModalRadius,
        componentRadius: derivedComponentRadius,
        textColorPrimary: derivedTextColorPrimary,
        textColorSecondary: derivedTextColorSecondary,
    }), [panelBackground, controlBackground, favoriteCardBackground, modalBackground, derivedModalBlur, derivedModalRadius, derivedComponentRadius, derivedTextColorPrimary, derivedTextColorSecondary]);

	const { topBarProps, mainLayoutProps, controlsPanelProps } = useAppPanelsProps({ userInfo, hitokoto, setGlobalSearchTerm, openModal, themeColor, setUserInfo, setStatus, windowControlsPos, currentSong, panelBackground, panelStyles, controlBackground, controlStyles, favoriteCardBackground, textColorPrimary: derivedTextColorPrimary, textColorSecondary: derivedTextColorSecondary, componentRadius: derivedComponentRadius, coverRadius: derivedCoverRadius, computedColorScheme: colorScheme, placeholderCover: PLACEHOLDER_COVER, maxSkipLimit, formatTime, formatTimeWithMs, handleIntervalChange, handleSkipStartChange, handleSkipEndChange, handleSongInfoUpdate: updateSongInfo, currentFav, currentFavSongTotal: favoriteSongPages.total, getCurrentFavSong: favoriteSongPages.getSong, onCurrentFavVisibleRangeChange: favoriteSongPages.loadRange, currentFavSongsLoading: favoriteSongPages.isInitialLoading, currentFavSongsError: favoriteSongPages.error, retryCurrentFavSongs: favoriteSongPages.retry, searchQuery, setSearchQuery, downloadedSongIds, handleDownloadSong, handleAddSongToFavorite, handleAddCurrentSongToFavorite, handleRemoveSongFromPlaylist, confirmRemoveSongId, setConfirmRemoveSongId, playFavorite, handleDownloadAllFavorite, favorites, selectedFavId, setSelectedFavId, setConfirmDeleteFavId, playSingleSong, createFavorite, handleEditFavorite, handleDeleteFavorite, confirmDeleteFavId, progressInInterval, intervalStart, intervalLength, duration, seek, playPrev, togglePlay, playNext, isPlaying, playMode, handlePlayModeToggle, handleDownloadCurrentSong, handleManageDownload, volume, changeVolume, songsCount: queueItems.length, queueItems, playOrder: playerStore.queue.playOrder, currentQueueItemId: playerStore.queue.currentQueueItemId, priorityNext: playerStore.queue.priorityNext, shuffleEnabled, repeatMode, onPlayQueueItem: handlePlayQueueItem, onRemoveQueueItem: handleRemoveQueueItem, onReorderQueueItems: (from, to) => reorderQueueItems(from, to), onClearUpcoming: handleClearUpcoming, onToggleShuffle: handleToggleShuffle, onToggleRepeatMode: handleToggleRepeatMode, onPlayNextSong: (song) => { enqueueNext(song); }, onEnqueueLastSong: (song) => { enqueueLast(song); }, globalVolumeCompensationDb: volumeCompensationDb, songVolumeOffsetDb: currentSongVolumeOffsetDb, onSongVolumeOffsetChange: handleSongVolumeOffsetChange, lyricsState, getLyricProgress, onLyricSeek: seek, onSyncFavorite: playlistSync.sync, onLoadFavoriteSyncStatus: playlistSync.loadStatus, onDetachFavorite: playlistSync.detach, onDuplicateFavorite: playlistSync.createLocalCopy, syncingFavoriteIds: playlistSync.syncingIds, syncStatusByFavorite: playlistSync.statusByFavorite, syncTaskByFavorite: playlistSync.taskByFavorite, derived: derivedStyles });

    const appModalsProps = useAppModalsProps({
        modals,
        closeModal,
        themes,
        currentThemeId,
        themeColor,
        themeEditor,
        favoritesState,
        searchState,
        bvResolver,
        handlers,
		myFavoriteImport,
		isCreatingFavorite: favoriteActions.isCreatingFavorite,
		favoriteImportProgress: favoriteActions.favoriteImportProgress,
        favorites,
        currentSong,
        pendingFavoriteSong,
        globalSearchResults,
        onLoginSuccess,
        volumeCompensationDb,
        onVolumeCompensationChange: handleGlobalVolumeCompensationChange,
        derived: derivedStyles,
        formatTime,
        formatTimeWithMs,
    });

    // ========== 渲染 ==========
    return (
        <Box className="app-shell" mih="100vh" w="100%" style={{ position: "relative", backgroundColor: "transparent" }}>
            <Box style={{ position: "fixed", inset: 0, zIndex: -1, ...backgroundStyle }} />
            <Box className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
                {status}
            </Box>
            <AppModals {...appModalsProps} />
            <AppPanels topBarProps={topBarProps} mainLayoutProps={mainLayoutProps} controlsPanelProps={controlsPanelProps} />
        </Box>
    );
};

export default App;
