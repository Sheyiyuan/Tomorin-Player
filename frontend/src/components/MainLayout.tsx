import React from "react";
import { Flex } from "@mantine/core";
import SongDetailCard from "./SongDetailCard";
import CurrentPlaylistCard from "./CurrentPlaylistCard";
import FavoriteListCard from "./FavoriteListCard";
import { Song, Favorite, SongClass } from "../types";

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
    formatTimeLabel: (value: number | string) => string;
    parseTimeLabel: (value: string) => number;
    onIntervalChange: (start: number, end: number) => void;
    onSkipStartChange: (value: number) => void;
    onSkipEndChange: (value: number) => void;
    onStreamUrlChange: (url: string) => void;
    onSongInfoUpdate?: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void;
    coverRadius?: number;

    // CurrentPlaylistCard props
    currentFav: Favorite | null;
    currentFavSongs: Song[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onPlaySong: (song: Song) => void;
    onAddSong: () => void;
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
    onPlaySongInFavorite: (song: Song, list: Song[]) => void;
    onAddCurrentToFavorite: (favId: string) => void;
    onCreateFavorite: () => void;
    onEditFavorite: (fav: Favorite) => void;
    onDeleteFavorite: (id: string) => Promise<void>;
    onToggleConfirmDelete: (id: string | null) => void;
    confirmDeleteFavId: string | null;
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
    formatTimeLabel,
    parseTimeLabel,
    onIntervalChange,
    onSkipStartChange,
    onSkipEndChange,
    onStreamUrlChange,
    onSongInfoUpdate,

    // CurrentPlaylistCard props
    currentFav,
    currentFavSongs,
    searchQuery,
    onSearchChange,
    onPlaySong,
    onAddSong,
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
    onPlaySongInFavorite,
    onAddCurrentToFavorite,
    onCreateFavorite,
    onEditFavorite,
    onDeleteFavorite,
    onToggleConfirmDelete,
    confirmDeleteFavId,
    coverRadius,
}) => {
    return (
        <Flex flex={1} gap="md" miw={0} style={{ minHeight: 0 }}>
            <SongDetailCard
                song={currentSong}
                panelBackground={panelBackground}
                panelStyles={panelStyles}
                themeColor={themeColor}
                computedColorScheme={computedColorScheme}
                placeholderCover={placeholderCover}
                maxSkipLimit={maxSkipLimit}
                formatTime={formatTime}
                formatTimeLabel={formatTimeLabel}
                parseTimeLabel={parseTimeLabel}
                onIntervalChange={onIntervalChange}
                onSkipStartChange={onSkipStartChange}
                onSkipEndChange={onSkipEndChange}
                onStreamUrlChange={onStreamUrlChange}
                onSongInfoUpdate={onSongInfoUpdate}
                coverRadius={coverRadius}
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
                onAddSong={onAddSong}
                themeColor={themeColor}
                downloadedSongIds={downloadedSongIds}
                onDownloadSong={onDownloadSong}
                onAddSongToFavorite={onAddSongToFavorite}
                onRemoveSongFromPlaylist={onRemoveSongFromPlaylist}
                confirmRemoveSongId={confirmRemoveSongId}
                onToggleConfirmRemove={onToggleConfirmRemove}
                onPlayAll={onPlayAll}
                onDownloadAll={onDownloadAll}
            />

            <FavoriteListCard
                panelBackground={panelBackground}
                panelStyles={panelStyles}
                favorites={favorites}
                selectedFavId={selectedFavId}
                onSelectFavorite={onSelectFavorite}
                onPlayFavorite={onPlayFavorite}
                onPlaySongInFavorite={onPlaySongInFavorite}
                onAddCurrentToFavorite={onAddCurrentToFavorite}
                onCreateFavorite={onCreateFavorite}
                onEditFavorite={onEditFavorite}
                onDeleteFavorite={onDeleteFavorite}
                onToggleConfirmDelete={onToggleConfirmDelete}
                confirmDeleteFavId={confirmDeleteFavId}
                currentSong={currentSong}
                themeColor={themeColor}
            />
        </Flex>
    );
};

export default MainLayout;
