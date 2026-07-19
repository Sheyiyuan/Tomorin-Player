import React, { useRef, useState, useMemo } from "react";
import { Box } from "@mantine/core";

// Hooks - Core layers
import { useAudioPlayer, useAudioInterval, usePlaylistActions, useSkipIntervalHandler, useDownloadManager, useAudioEvents, usePlaybackControls, useAudioSourceManager, usePlaySong, usePlayModes } from "./hooks/player";
import { useSettingsPersistence } from "./hooks/data";

// Hooks - Features
import { useAuth, useBVResolver, useFavoriteActions, useThemeEditor, useSearchAndBV, useBVModal, useLyricManagement, useSongOperations, useLyricLoader, useGlobalSearch, useLoginHandlers } from "./hooks/features";

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
import { Song } from "./types";

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
    const { songs: queue, currentIndex } = playerStore.queue;
    const { currentSong, isPlaying, progress, duration } = playerStore.playback;
    const { playMode, volume } = playerStore.controls;
    const {
        setQueue,
        setCurrentIndex,
        setPlaylistHydrated,
        setSong: setCurrentSong,
        setPlayMode,
        setIsPlaying,
        setProgress,
        setDuration,
        setVolume: setPlayerVolume,
    } = playerStore.actions;

    // ========== 设置状态（提前，用于音量补偿计算） ==========
    const dataStore = useDataStore();
    const { songs, favorites, selectedFavId } = dataStore.data;
    const { playerSetting: setting, lyricMapping: lyric } = dataStore.settings;
    const { setSongs, setFavorites, setSelectedFavId, setSetting, setLyricMapping: setLyric } = dataStore.actions;
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
    const { createFavName, setCreateFavName, createFavMode, setCreateFavMode, duplicateSourceId, setDuplicateSourceId, importFid, setImportFid, confirmDeleteFavId, setConfirmDeleteFavId, editingFavId, setEditingFavId, editingFavName, setEditingFavName, setConfirmDeleteDownloaded, downloadedSongIds, setDownloadedSongIds, managingSong, setManagingSong, confirmRemoveSongId, setConfirmRemoveSongId } = favoritesState;
    // ========== 主题管理 ==========
    const themeManagement = useThemeManagement({ themes });
    const { saveCachedCustomThemes, getCustomThemes } = themeManagement;

    // ========== 业务逻辑 Hooks ==========
    const favoriteActions = useFavoriteActions({ favorites, setFavorites, songs, setSongs, selectedFavId, setSelectedFavId, setStatus, themeColor, openModal, closeModal });
    const currentFav = selectedFavId ? (favorites.find((favorite) => favorite.id === selectedFavId) ?? null) : null;
    const currentFavSongs = currentFav ? songs.filter((song) => currentFav.songIds.some((ref) => ref.songId === song.id)) : [];

    const { playSong } = usePlaySong({ queue, selectedFavId, setQueue, setCurrentIndex, setCurrentSong, setIsPlaying, setStatus, setSongs });

    const songOperations = useSongOperations({ currentSong, songs, setSongs, setCurrentSong });
    const { updateSongInfo } = songOperations;

    const playlistActions = usePlaylistActions({ queue, setQueue, currentIndex, setCurrentIndex, currentSong, setCurrentSong, setIsPlaying, currentFav, setFavorites, setStatus, setConfirmRemoveSongId, openModal, closeModal, playSong, addSongToFavorite: favoriteActions.addToFavorite, setPendingFavoriteSong, pendingFavoriteSong });

    const themeEditor = useThemeEditor({ themes, setThemes, defaultThemes: DEFAULT_THEMES, currentThemeId, computedColorScheme: colorScheme, saveCachedCustomThemes, applyThemeToUi: applyTheme, getCustomThemesFromState: getCustomThemes, themeDraft, openModal, closeModal });

    const bvModal = useBVModal({ bvPreview, sliceStart, sliceEnd, bvSongName, bvSinger, bvTargetFavId, favorites, closeBvModal, setBvPreview, setBvSongName, setBvSinger, setSliceStart, setSliceEnd, setSongs, setFavorites, setSelectedFavId });

    const skipIntervalHandler = useSkipIntervalHandler({ currentSong, setCurrentSong, setSongs, setQueue, saveTimerRef });

    const downloadManager = useDownloadManager({ currentSong, currentFavSongs, downloadedSongIds, managingSong, setStatus, setDownloadedSongIds, setManagingSong, setConfirmDeleteDownloaded, openModal, closeModal });

    const { playSingleSong, playFavorite } = usePlayModes({ songs, queue, currentIndex, setQueue, setCurrentIndex, setCurrentSong, setIsPlaying, playSong });

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

    useLyricManagement({ currentSong, lyric, setLyric });

    const playbackControls = usePlaybackControls({ audioRef, currentSong, currentIndex, queue, playMode, intervalStart, intervalEnd, setIsPlaying, setCurrentIndex, setCurrentSong, setVolume, playSong, playbackRetryRef, isHandlingErrorRef, onBeforePlay: audioPlayer.ensureWebAudioReady });
    const { playNext, playPrev, togglePlay, changeVolume } = playbackControls;

    const settingsPersistence = useSettingsPersistence({ setting, playMode, volume, currentThemeId: currentThemeId || "", setSetting, skipPersistRef });
    const { persistSettings, settingsLoadedRef } = settingsPersistence;

    const clampDb = (value: number) => {
        if (!Number.isFinite(value)) return 0;
        return Math.min(12, Math.max(-12, value));
    };

    const handleGlobalVolumeCompensationChange = async (value: number) => {
        const nextValue = clampDb(value);
        await persistSettings({ config: { volumeCompensationDb: nextValue } });
    };

    const handleSongVolumeOffsetChange = async (songId: string, value: number | null) => {
        const current = songVolumeOffsets || {};
        const nextOffsets = { ...current } as Record<string, number>;
        if (value === null) {
            delete nextOffsets[songId];
        } else {
            nextOffsets[songId] = clampDb(value);
        }
        await persistSettings({ config: { songVolumeOffsets: nextOffsets } });
    };

    useLyricLoader({ currentSong, setLyric });

    const { globalSearchResults } = useGlobalSearch({ globalSearchTerm, songs, favorites });
    const { handleLoginSuccess } = useLoginHandlers({ closeModal, setUserInfo, setStatus });

    // ========== UI 派生值 ==========
    const { backgroundWithOpacity, panelBackground, controlBackground, favoriteCardBackground, modalBackground, modalBlur: derivedModalBlur, themeColorLight, panelStyles, controlStyles, componentRadius: derivedComponentRadius, coverRadius: derivedCoverRadius, modalRadius: derivedModalRadius, textColorPrimary: derivedTextColorPrimary, textColorSecondary: derivedTextColorSecondary } = useUiDerived({
        themeColor, backgroundColor, backgroundOpacity, backgroundImageUrl, panelColor, panelOpacity, panelBlur, panelRadius, controlColor, controlOpacity, controlBlur, textColorPrimary, textColorSecondary, favoriteCardColor, cardOpacity, modalRadius, notificationRadius, componentRadius, coverRadius, modalColor, modalOpacity, modalBlur,
    });

    const { maxSkipLimit, backgroundStyle } = useAppComputedState({
        duration, backgroundImageUrl, backgroundBlur, backgroundWithOpacity, songs, searchQuery,
    });

    // ========== 应用生命周期 ==========
    useAppLifecycle({ setUserInfo, saveCachedCustomThemes, setSetting, setVolume, setPlayMode, setThemes, applyThemeToUi: applyTheme, skipPersistRef, settingsLoadedRef, modalsSettingsModal: modals.settingsModal, setCacheSize, setStatus, setSongs, setFavorites, setQueue, setCurrentIndex, setPlaylistHydrated, setCurrentSong, setSelectedFavId });

    useAppEffects({ intervalStart, intervalEnd, intervalLength, intervalRef, currentSong, songs, setDownloadedSongIds, prevSongIdRef });

    useAudioEvents({
        audioRef,
        currentSong,
        queue,
        currentIndex,
        playMode,
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

    const handlers = useAppHandlers({ themeEditor, favoriteActions, editingFavId, editingFavName, setEditingFavId, setEditingFavName, createFavName, setCreateFavName, createFavMode, setCreateFavMode, duplicateSourceId, setDuplicateSourceId, importFid, setImportFid, openModal, setConfirmDeleteFavId, skipIntervalHandler, playMode, setPlayMode, downloadManager, setConfirmDeleteDownloaded, setManagingSong, closeModal, playlistActions, searchAndBV, newFavName, setNewFavName, setFavorites, setBvTargetFavId, bvPreview, sliceStart, sliceEnd, setSliceStart, setSliceEnd, setCacheSize, bvModal });

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

    const { topBarProps, mainLayoutProps, controlsPanelProps } = useAppPanelsProps({ userInfo, hitokoto, setGlobalSearchTerm, openModal, themeColor, setUserInfo, setStatus, windowControlsPos, currentSong, panelBackground, panelStyles, controlBackground, controlStyles, favoriteCardBackground, textColorPrimary: derivedTextColorPrimary, textColorSecondary: derivedTextColorSecondary, componentRadius: derivedComponentRadius, coverRadius: derivedCoverRadius, computedColorScheme: colorScheme, placeholderCover: PLACEHOLDER_COVER, maxSkipLimit, formatTime, formatTimeWithMs, handleIntervalChange, handleSkipStartChange, handleSkipEndChange, handleSongInfoUpdate: updateSongInfo, currentFav, currentFavSongs, searchQuery, setSearchQuery, downloadedSongIds, handleDownloadSong, handleAddSongToFavorite, handleAddCurrentSongToFavorite, handleRemoveSongFromPlaylist, confirmRemoveSongId, setConfirmRemoveSongId, playFavorite, handleDownloadAllFavorite, favorites, selectedFavId, setSelectedFavId, setConfirmDeleteFavId, playSingleSong, createFavorite, handleEditFavorite, handleDeleteFavorite, confirmDeleteFavId, progressInInterval, intervalStart, intervalLength, duration, seek, playPrev, togglePlay, playNext, isPlaying, playMode, handlePlayModeToggle, handleDownloadCurrentSong, handleManageDownload, volume, changeVolume, songsCount: songs.length, globalVolumeCompensationDb: volumeCompensationDb, songVolumeOffsetDb: currentSongVolumeOffsetDb, onSongVolumeOffsetChange: handleSongVolumeOffsetChange });

    const appModalsProps = useAppModalsProps({
        modals,
        closeModal,
        themes,
        currentThemeId,
        themeColor,
        themeColorLight,
        themeEditor,
        favoritesState,
        searchState,
        bvResolver,
        handlers,
        myFavoriteImport,
        favorites,
        queue,
        currentIndex,
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
