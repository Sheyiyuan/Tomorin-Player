import React from "react";
import { Box } from "@mantine/core";
import { SongDetailCard, CurrentPlaylistCard, FavoriteListCard } from "../cards";
import { Song, Favorite } from "../../types";

interface MainLayoutProps {
    // SongDetailCard props
    currentSong: Song | null;
    panelBackground: string;
    panelStyles: React.CSSProperties;
    themeColor: string;
    computedColorScheme: "light" | "dark";
    placeholderCover: string;
    maxSkipLimit: number;
    formatTime: (ms: number) => string;
    formatTimeWithMs: (ms: number) => string;
    onIntervalChange: (start: number, end: number) => void;
    onSkipStartChange: (value: number) => void;
    onSkipEndChange: (value: number) => void;
    onSongInfoUpdate?: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void;
    volumeCompensationDb?: number;
    songVolumeOffsetDb?: number | null;
    onSongVolumeOffsetChange?: (songId: string, offsetDb: number | null) => void;
    componentRadius?: number;
    coverRadius?: number;

    // CurrentPlaylistCard props
    currentFav: Favorite | null;
    currentFavSongs: Song[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onPlaySong: (song: Song) => void;
    downloadedSongIds: Set<string>;
    onDownloadSong: (song: Song) => void;
    onAddSongToFavorite: (song: Song) => void;
    onRemoveSongFromPlaylist: (song: Song) => void;
    confirmRemoveSongId: string | null;
    onToggleConfirmRemove: (id: string | null) => void;
    onPlayAll: () => void;
    onDownloadAll: () => void;

    // FavoriteListCard props
    favorites: Favorite[];
    selectedFavId: string | null;
    onSelectFavorite: (id: string) => void;
    onPlayFavorite: (favorite: Favorite) => void;
    onCreateFavorite: () => void;
    onEditFavorite: (fav: Favorite) => void;
    onDeleteFavorite: (id: string) => Promise<void>;
    onToggleConfirmDelete: (id: string | null) => void;
    confirmDeleteFavId: string | null;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    favoriteCardBackground?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({
    // SongDetailCard props
    currentSong,
    panelBackground,
    panelStyles,
    themeColor,
    computedColorScheme,
    placeholderCover,
    maxSkipLimit,
    formatTime,
    formatTimeWithMs,
    onIntervalChange,
    onSkipStartChange,
    onSkipEndChange,
    onSongInfoUpdate,
    volumeCompensationDb,
    songVolumeOffsetDb,
    onSongVolumeOffsetChange,

    // CurrentPlaylistCard props
    currentFav,
    currentFavSongs,
    searchQuery,
    onSearchChange,
    onPlaySong,
    downloadedSongIds,
    onDownloadSong,
    onAddSongToFavorite,
    onRemoveSongFromPlaylist,
    confirmRemoveSongId,
    onToggleConfirmRemove,
    onPlayAll,
    onDownloadAll,

    // FavoriteListCard props
    favorites,
    selectedFavId,
    onSelectFavorite,
    onPlayFavorite,
    onCreateFavorite,
    onEditFavorite,
    onDeleteFavorite,
    onToggleConfirmDelete,
    confirmDeleteFavId,
    componentRadius,
    coverRadius,
    controlBackground,
    controlStyles,
    favoriteCardBackground,
    textColorPrimary,
    textColorSecondary,
}) => {
    return (
        <Box className="main-layout">
            <SongDetailCard
                song={currentSong}
                panelBackground={panelBackground}
                panelStyles={panelStyles}
                themeColor={themeColor}
                computedColorScheme={computedColorScheme}
                placeholderCover={placeholderCover}
                maxSkipLimit={maxSkipLimit}
                formatTime={formatTime}
                formatTimeWithMs={formatTimeWithMs}
                onIntervalChange={onIntervalChange}
                onSkipStartChange={onSkipStartChange}
                onSkipEndChange={onSkipEndChange}
                onSongInfoUpdate={onSongInfoUpdate}
                volumeCompensationDb={volumeCompensationDb}
                songVolumeOffsetDb={songVolumeOffsetDb}
                onSongVolumeOffsetChange={onSongVolumeOffsetChange}
                componentRadius={componentRadius}
                coverRadius={coverRadius}
                controlBackground={controlBackground}
                controlStyles={controlStyles}
                textColorPrimary={textColorPrimary}
                textColorSecondary={textColorSecondary}
            />

            <CurrentPlaylistCard
                panelBackground={panelBackground}
                panelStyles={panelStyles}
                currentFav={currentFav}
                currentFavSongs={currentFavSongs}
                currentSongId={currentSong?.id}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                onPlaySong={onPlaySong}
                themeColor={themeColor}
                downloadedSongIds={downloadedSongIds}
                onDownloadSong={onDownloadSong}
                onAddSongToFavorite={onAddSongToFavorite}
                onRemoveSongFromPlaylist={onRemoveSongFromPlaylist}
                confirmRemoveSongId={confirmRemoveSongId}
                onToggleConfirmRemove={onToggleConfirmRemove}
                onPlayAll={onPlayAll}
                onDownloadAll={onDownloadAll}
                componentRadius={componentRadius}
                controlBackground={controlBackground}
                controlStyles={controlStyles}
                textColorPrimary={textColorPrimary}
                textColorSecondary={textColorSecondary}
            />

            <FavoriteListCard
                panelBackground={panelBackground}
                panelStyles={panelStyles}
                favorites={favorites}
                selectedFavId={selectedFavId}
                onSelectFavorite={onSelectFavorite}
                onPlayFavorite={onPlayFavorite}
                onCreateFavorite={onCreateFavorite}
                onEditFavorite={onEditFavorite}
                onDeleteFavorite={onDeleteFavorite}
                onToggleConfirmDelete={onToggleConfirmDelete}
                confirmDeleteFavId={confirmDeleteFavId}
                themeColor={themeColor}
                componentRadius={componentRadius}
                controlBackground={controlBackground}
                favoriteCardBackground={favoriteCardBackground}
                textColorPrimary={textColorPrimary}
                textColorSecondary={textColorSecondary}
            />
        </Box>
    );
};

export default MainLayout;
