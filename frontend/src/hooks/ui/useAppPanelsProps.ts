import { useMemo } from "react";
import type { Favorite, Song, UserInfo } from "../../types";
import type { ModalName, PlayMode } from '../../context/types/contexts';
import { useImageProxy } from "./useImageProxy";

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
    componentRadius?: number;
    coverRadius?: number;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    favoriteCardBackground?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
}

export const useAppPanelsProps = (params: UseAppPanelsPropsParams) => {
    const { getProxiedImageUrlSync } = useImageProxy();

    return useMemo(() => {
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
            controlBackground,
            favoriteCardBackground,
            textColorPrimary,
            textColorSecondary,
        } = params;

        const topBarProps = {
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
            controlStyles: params.controlStyles,
            textColorPrimary,
            textColorSecondary,
            componentRadius: params.componentRadius,
        } as const;

        const mainLayoutProps = {
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
            currentFav,
            currentFavSongs,
            searchQuery,
            onSearchChange: setSearchQuery,
            onPlaySong: (song: Song) => {
                // 从歌单点击歌曲时，使用 playSingleSong 避免替换当前播放队列
                const fav = currentFav || favorites.find(f => f.songIds.some(ref => ref.songId === song.id));
                playSingleSong(song, fav);
            },
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
            componentRadius: params.componentRadius,
            coverRadius: params.coverRadius,
            controlBackground,
            controlStyles: params.controlStyles,
            favoriteCardBackground,
            textColorPrimary,
            textColorSecondary,
        } as const;

        const controlsPanelProps = {
            themeColor,
            computedColorScheme,
            currentSong,
            cover: currentSong?.cover ? getProxiedImageUrlSync(currentSong.cover) : undefined,
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
            onShowPlaylist: () => openModal("playlistModal"),
            onDownloadSong: handleDownloadCurrentSong,
            onManageDownload: handleManageDownload,
            downloadedSongIds,
            volume,
            changeVolume,
            songsCount,
            panelBackground,
            panelStyles,
            componentRadius: params.componentRadius,
            coverRadius: params.coverRadius,
            controlBackground,
            controlStyles: params.controlStyles,
            textColorPrimary,
            textColorSecondary,
        } as const;

        return { topBarProps, mainLayoutProps, controlsPanelProps } as const;
    }, [params, getProxiedImageUrlSync]);
};
