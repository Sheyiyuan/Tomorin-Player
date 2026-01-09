/**
 * 向后兼容的应用 Context
 * 保持原有的 useAppStore API，内部使用新的分离式 Context
 * 这样可以在不破坏现有代码的情况下进行性能优化
 */

import React, { useMemo } from 'react';
import { usePlayerStore } from './hooks/usePlayerStore';
import { useThemeStore } from './hooks/useThemeStore';
import { useUIStore } from './hooks/useUIStore';
import { useDataStore } from './hooks/useDataStore';
import {
    AppStore,
    PlayerState,
    PlaylistState,
    ThemeState,
    ModalState,
    UIState,
    DataState,
    AppActions,
} from '../store/types';

// ========== 向后兼容的 Context 定义 ==========
export interface AppContextValue {
    store: AppStore;
}

// ========== 向后兼容的 useAppStore Hook ==========
export const useAppStore = (): [AppStore, AppActions] => {
    const player = usePlayerStore();
    const theme = useThemeStore();
    const ui = useUIStore();
    const data = useDataStore();

    // 组合成原有的 store 结构
    const store: AppStore = useMemo(() => ({
        player: {
            queue: player.queue.songs,
            currentIndex: player.queue.currentIndex,
            currentSong: player.playback.currentSong,
            isPlaying: player.playback.isPlaying,
            progress: player.playback.progress,
            duration: player.playback.duration,
            volume: player.controls.volume,
            playMode: player.controls.playMode,
            skipStartTime: player.controls.skipStartTime,
            skipEndTime: player.controls.skipEndTime,
            skipEnabled: player.controls.skipEnabled,
        },
        playlist: {
            favorites: data.data.favorites,
            songs: data.data.songs,
            selectedFavId: data.data.selectedFavId,
            isLoadingFavorites: false, // 这些状态可能需要从其他地方获取
            isLoadingSongs: false,
        },
        theme: {
            themes: theme.theme.themes,
            currentThemeId: theme.theme.currentThemeId,
            themeColor: theme.colors.themeColor,
            colorScheme: theme.theme.colorScheme,
            backgroundColor: theme.colors.backgroundColor,
            backgroundOpacity: theme.effects.backgroundOpacity,
            backgroundImageUrl: theme.effects.backgroundImageUrl,
            backgroundBlur: theme.effects.backgroundBlur,
            panelColor: theme.colors.panelColor,
            panelOpacity: theme.effects.panelOpacity,
            panelBlur: theme.effects.panelBlur,
            panelRadius: theme.layout.panelRadius,
            controlColor: theme.colors.controlColor,
            controlOpacity: theme.effects.controlOpacity,
            controlBlur: theme.effects.controlBlur,
            textColorPrimary: theme.colors.textColorPrimary,
            textColorSecondary: theme.colors.textColorSecondary,
            favoriteCardColor: theme.colors.favoriteCardColor,
            cardOpacity: theme.effects.cardOpacity,
            componentRadius: theme.layout.componentRadius,
            modalRadius: theme.layout.modalRadius,
            notificationRadius: theme.layout.notificationRadius,
            coverRadius: theme.layout.coverRadius,
            modalColor: theme.colors.modalColor,
            modalOpacity: theme.effects.modalOpacity,
            modalBlur: theme.effects.modalBlur,
            windowControlsPos: theme.layout.windowControlsPos,
        },
        modals: {
            loginOpen: ui.modals.loginModal || false,
            settingsOpen: ui.modals.settingsModal || false,
            playlistOpen: ui.modals.playlistModal || false,
            themeManagerOpen: ui.modals.themeManagerModal || false,
            themeEditorOpen: ui.modals.themeEditorModal || false,
            themeDetailOpen: ui.modals.themeDetailModal || false,
            themeDetailData: null,
            themeDetailReadonly: false,
            globalSearchOpen: ui.modals.globalSearchModal || false,
            bvAddOpen: ui.modals.bvAddModal || false,
            favoriteListOpen: ui.modals.playlistManagerModal || false,
            createFavoriteOpen: ui.modals.createFavModal || false,
            addToFavoriteOpen: ui.modals.addFavoriteModal || false,
            downloadManagerOpen: ui.modals.downloadManagerModal || false,
            downloadTasksOpen: ui.modals.downloadTasksModal || false,
            songDetailOpen: ui.modals.downloadModal || false,
            songDetailData: null,
        },
        ui: {
            status: ui.app.status,
            userInfo: ui.app.userInfo,
            isLoading: ui.app.isLoading,
            errorMessage: ui.app.errorMessage,
            searchQuery: ui.search.query,
            globalSearchTerm: ui.search.globalTerm,
            globalSearchResults: ui.search.results,
        },
        data: {
            setting: data.settings.playerSetting,
            lyricMapping: data.settings.lyricMapping,
            cachedSongs: data.cache.songs,
            cachedCovers: data.cache.covers,
        },
        download: {
            tasks: [],
            activeTaskId: null,
        },
        actions: {
            // Player actions
            setSong: player.actions.setSong,
            setQueue: player.actions.setQueue,
            setCurrentIndex: player.actions.setCurrentIndex,
            setIsPlaying: player.actions.setIsPlaying,
            setProgress: player.actions.setProgress,
            setDuration: player.actions.setDuration,
            setVolume: player.actions.setVolume,
            setPlayMode: player.actions.setPlayMode,
            setSkipStartTime: player.actions.setSkipStartTime,
            setSkipEndTime: player.actions.setSkipEndTime,
            setSkipEnabled: player.actions.setSkipEnabled,
            play: player.actions.play,
            pause: player.actions.pause,
            nextSong: player.actions.nextSong,
            prevSong: player.actions.prevSong,
            seek: player.actions.seek,

            // Playlist actions
            setFavorites: data.actions.setFavorites,
            setSongs: data.actions.setSongs,
            setSelectedFavId: data.actions.setSelectedFavId,
            addSong: data.actions.addSong,
            removeSong: data.actions.removeSong,
            updateSong: data.actions.updateSong,
            addFavorite: data.actions.addFavorite,
            removeFavorite: data.actions.removeFavorite,
            updateFavorite: data.actions.updateFavorite,
            setIsLoadingFavorites: () => { }, // 占位符
            setIsLoadingSongs: () => { }, // 占位符

            // Theme actions
            setThemes: theme.actions.setThemes,
            setCurrentThemeId: theme.actions.setCurrentThemeId,
            setThemeColor: theme.actions.setThemeColor,
            setColorScheme: theme.actions.setColorScheme,
            setBackgroundColor: theme.actions.setBackgroundColor,
            setBackgroundOpacity: theme.actions.setBackgroundOpacity,
            setBackgroundImageUrl: theme.actions.setBackgroundImageUrl,
            setBackgroundBlur: theme.actions.setBackgroundBlur,
            setPanelColor: theme.actions.setPanelColor,
            setPanelOpacity: theme.actions.setPanelOpacity,
            setPanelBlur: theme.actions.setPanelBlur,
            setPanelRadius: theme.actions.setPanelRadius,
            setControlColor: theme.actions.setControlColor,
            setControlOpacity: theme.actions.setControlOpacity,
            setControlBlur: theme.actions.setControlBlur,
            setTextColorPrimary: theme.actions.setTextColorPrimary,
            setTextColorSecondary: theme.actions.setTextColorSecondary,
            setFavoriteCardColor: theme.actions.setFavoriteCardColor,
            setCardOpacity: theme.actions.setCardOpacity,
            setComponentRadius: theme.actions.setComponentRadius,
            setModalRadius: theme.actions.setModalRadius,
            setNotificationRadius: theme.actions.setNotificationRadius,
            setCoverRadius: theme.actions.setCoverRadius,
            setModalColor: theme.actions.setModalColor,
            setModalOpacity: theme.actions.setModalOpacity,
            setModalBlur: theme.actions.setModalBlur,
            setWindowControlsPos: theme.actions.setWindowControlsPos,
            applyTheme: theme.actions.applyTheme,

            // Modal actions
            openLogin: () => ui.actions.openModal('loginModal'),
            closeLogin: () => ui.actions.closeModal('loginModal'),
            openSettings: () => ui.actions.openModal('settingsModal'),
            closeSettings: () => ui.actions.closeModal('settingsModal'),
            openPlaylist: () => ui.actions.openModal('playlistModal'),
            closePlaylist: () => ui.actions.closeModal('playlistModal'),
            openThemeManager: () => ui.actions.openModal('themeManagerModal'),
            closeThemeManager: () => ui.actions.closeModal('themeManagerModal'),
            openThemeEditor: () => ui.actions.openModal('themeEditorModal'),
            closeThemeEditor: () => ui.actions.closeModal('themeEditorModal'),
            openThemeDetail: () => ui.actions.openModal('themeDetailModal'),
            closeThemeDetail: () => ui.actions.closeModal('themeDetailModal'),
            openGlobalSearch: () => ui.actions.openModal('globalSearchModal'),
            closeGlobalSearch: () => ui.actions.closeModal('globalSearchModal'),
            openBVAdd: () => ui.actions.openModal('bvAddModal'),
            closeBVAdd: () => ui.actions.closeModal('bvAddModal'),
            openFavoriteList: () => ui.actions.openModal('playlistManagerModal'),
            closeFavoriteList: () => ui.actions.closeModal('playlistManagerModal'),
            openCreateFavorite: () => ui.actions.openModal('createFavModal'),
            closeCreateFavorite: () => ui.actions.closeModal('createFavModal'),
            openAddToFavorite: () => ui.actions.openModal('addFavoriteModal'),
            closeAddToFavorite: () => ui.actions.closeModal('addFavoriteModal'),
            openDownloadManager: () => ui.actions.openModal('downloadManagerModal'),
            closeDownloadManager: () => ui.actions.closeModal('downloadManagerModal'),
            openDownloadTasks: () => ui.actions.openModal('downloadTasksModal'),
            closeDownloadTasks: () => ui.actions.closeModal('downloadTasksModal'),
            openSongDetail: () => ui.actions.openModal('downloadModal'),
            closeSongDetail: () => ui.actions.closeModal('downloadModal'),

            // UI actions
            setStatus: ui.actions.setStatus,
            setUserInfo: ui.actions.setUserInfo,
            setIsLoading: ui.actions.setIsLoading,
            setErrorMessage: ui.actions.setErrorMessage,
            setSearchQuery: ui.actions.setSearchQuery,
            setGlobalSearchTerm: ui.actions.setGlobalSearchTerm,
            setGlobalSearchResults: ui.actions.setGlobalSearchResults,

            // Data actions
            setSetting: data.actions.setSetting,
            setLyricMapping: data.actions.setLyricMapping,
            setCachedSong: data.actions.setCachedSong,
            getCachedSong: data.actions.getCachedSong,
            setCachedCover: data.actions.setCachedCover,
            getCachedCover: data.actions.getCachedCover,
            clearSongCache: data.actions.clearSongCache,
            clearCoverCache: data.actions.clearCoverCache,
        },
    }), [player, theme, ui, data]);

    return [store, store.actions];
};

// ========== 便捷 Hook：访问特定的状态域 ==========
export const usePlayerState = () => {
    const [store] = useAppStore();
    return store.player;
};

export const usePlaylistState = () => {
    const [store] = useAppStore();
    return store.playlist;
};

export const useThemeState = () => {
    const [store] = useAppStore();
    return store.theme;
};

export const useModalState = () => {
    const [store] = useAppStore();
    return store.modals;
};

export const useUIState = () => {
    const [store] = useAppStore();
    return store.ui;
};

export const useDataState = () => {
    const [store] = useAppStore();
    return store.data;
};

// ========== 类型导出 ==========
export type { AppStore, PlayerState, PlaylistState, ThemeState, ModalState, UIState, DataState, AppActions };

// ========== 重新导出新的 Provider ==========
export { AppProvider } from './AppProvider';
