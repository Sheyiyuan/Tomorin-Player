import React, { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Card, Center, Loader, Tabs } from "@mantine/core";
import { SongDetailCard, CurrentPlaylistCard, FavoriteListCard } from "../cards";
import { LyricErrorBoundary } from "../lyrics/LyricErrorBoundary";
import type { LyricsPanelProps } from "../lyrics/LyricsPanel";
import type { DerivedStyles, Favorite, FavoriteSyncTask, PlaylistSyncStatus, Song } from "../../types";

const LyricsPanel = lazy(() => import("../lyrics/LyricsPanel"));

interface MainLayoutProps {
    currentSong: Song | null;
    panelBackground: string;
    panelStyles: React.CSSProperties;
    themeColor: string;
    computedColorScheme: "light" | "dark";
    placeholderCover: string;
    maxSkipLimit: number;
    formatTime: (value: number) => string;
    formatTimeWithMs: (value: number) => string;
    onIntervalChange: (start: number, end: number) => void;
    onSkipStartChange: (value: number) => void;
    onSkipEndChange: (value: number) => void;
    onSongInfoUpdate?: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void;
    volumeCompensationDb?: number;
    songVolumeOffsetDb?: number | null;
    onSongVolumeOffsetChange?: (songId: string, offsetDb: number | null) => void;
    lyrics: LyricsPanelProps;
    currentFav: Favorite | null;
	currentFavSongs?: Song[];
	currentFavSongTotal?: number;
	getCurrentFavSong?: (index: number) => Song | undefined;
	onCurrentFavVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
	currentFavSongsLoading?: boolean;
	currentFavSongsError?: string;
	retryCurrentFavSongs?: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onPlaySong: (song: Song) => void;
    onPlayNext?: (song: Song) => void;
    onEnqueueLast?: (song: Song) => void;
    downloadedSongIds: Set<string>;
    onDownloadSong: (song: Song) => void;
    onAddSongToFavorite: (song: Song) => void;
    onRemoveSongFromPlaylist: (song: Song) => void;
    confirmRemoveSongId: string | null;
    onToggleConfirmRemove: (id: string | null) => void;
    onPlayAll: () => void;
    onDownloadAll: () => void;
    favorites: Favorite[];
    selectedFavId: string | null;
    onSelectFavorite: (id: string) => void;
    onPlayFavorite: (favorite: Favorite) => void;
    onCreateFavorite: () => void;
    onEditFavorite: (favorite: Favorite) => void;
    onDeleteFavorite: (id: string) => Promise<void>;
    onToggleConfirmDelete: (id: string | null) => void;
    confirmDeleteFavId: string | null;
    onSyncFavorite: (id: string) => Promise<void>;
	onLoadFavoriteSyncStatus: (id: string) => Promise<void>;
    onDetachFavorite: (id: string) => Promise<void>;
	onDuplicateFavorite: (favorite: Favorite) => Promise<void>;
	onLoginRequired: () => void;
    syncingFavoriteIds: Set<string>;
	syncStatusByFavorite: Record<string, PlaylistSyncStatus>;
	syncTaskByFavorite?: Record<string, FavoriteSyncTask>;
    componentRadius?: number;
    coverRadius?: number;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    favoriteCardBackground?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
    derived?: DerivedStyles;
}

const MainLayout: React.FC<MainLayoutProps> = (props) => {
	const [activeTab, setActiveTab] = useState<string>("queue");
	const workspaceCardRef = useRef<HTMLDivElement | null>(null);
	const workspaceTabsRef = useRef<HTMLDivElement | null>(null);
	const resetWorkspaceScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const workspace = event.currentTarget;
		if (workspace !== workspaceCardRef.current && workspace !== workspaceTabsRef.current) return;
		if (workspace.scrollTop !== 0) workspace.scrollTop = 0;
		if (workspace.scrollLeft !== 0) workspace.scrollLeft = 0;
	}, []);
    const sharedCardStyle = { ...props.panelStyles, minHeight: 0, backgroundColor: props.panelBackground };

    return (
        <main className="main-layout" aria-label="播放器工作区">
            <SongDetailCard
                song={props.currentSong}
                panelBackground={props.panelBackground}
                panelStyles={props.panelStyles}
                themeColor={props.themeColor}
                computedColorScheme={props.computedColorScheme}
                placeholderCover={props.placeholderCover}
                maxSkipLimit={props.maxSkipLimit}
                formatTime={props.formatTime}
                formatTimeWithMs={props.formatTimeWithMs}
                onIntervalChange={props.onIntervalChange}
                onSkipStartChange={props.onSkipStartChange}
                onSkipEndChange={props.onSkipEndChange}
                onSongInfoUpdate={props.onSongInfoUpdate}
                volumeCompensationDb={props.volumeCompensationDb}
                songVolumeOffsetDb={props.songVolumeOffsetDb}
                onSongVolumeOffsetChange={props.onSongVolumeOffsetChange}
                componentRadius={props.componentRadius}
                coverRadius={props.coverRadius}
                controlBackground={props.controlBackground}
                controlStyles={props.controlStyles}
                textColorPrimary={props.textColorPrimary}
                textColorSecondary={props.textColorSecondary}
				derived={props.derived}
            />

			<Card ref={workspaceCardRef} onScroll={resetWorkspaceScroll} shadow="sm" padding={0} withBorder h="100%" className="glass-panel workspace-card" style={sharedCardStyle}>
					<Tabs value={activeTab} onChange={(value) => {
						if (!value) return;
						setActiveTab(value);
					}} ref={workspaceTabsRef} onScroll={resetWorkspaceScroll} className="workspace-tabs" color={props.themeColor} keepMounted>
                    <Tabs.List className="workspace-tabs-list" px="md" pt="xs">
                        <Tabs.Tab value="queue">歌单</Tabs.Tab>
                        <Tabs.Tab value="lyrics">歌词</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="queue" className="workspace-tab-panel" p="md">
                        <CurrentPlaylistCard
                            panelBackground={props.panelBackground}
                            panelStyles={props.panelStyles}
                            currentFav={props.currentFav}
								currentFavSongs={props.currentFavSongs}
								songTotal={props.currentFavSongTotal ?? props.currentFavSongs?.length}
								getSong={props.getCurrentFavSong}
								onVisibleRangeChange={props.onCurrentFavVisibleRangeChange}
								isLoading={props.currentFavSongsLoading ?? false}
								loadError={props.currentFavSongsError}
								onRetryLoad={props.retryCurrentFavSongs}
                            currentSongId={props.currentSong?.id}
                            searchQuery={props.searchQuery}
                            onSearchChange={props.onSearchChange}
                            onPlaySong={props.onPlaySong}
                            onPlayNext={props.onPlayNext}
                            onEnqueueLast={props.onEnqueueLast}
                            themeColor={props.themeColor}
                            downloadedSongIds={props.downloadedSongIds}
                            onDownloadSong={props.onDownloadSong}
                            onAddSongToFavorite={props.onAddSongToFavorite}
                            onRemoveSongFromPlaylist={props.onRemoveSongFromPlaylist}
                            confirmRemoveSongId={props.confirmRemoveSongId}
                            onToggleConfirmRemove={props.onToggleConfirmRemove}
                            onPlayAll={props.onPlayAll}
                            onDownloadAll={props.onDownloadAll}
                            componentRadius={props.componentRadius}
                            controlBackground={props.controlBackground}
                            controlStyles={props.controlStyles}
                            textColorPrimary={props.textColorPrimary}
                            textColorSecondary={props.textColorSecondary}
                        />
                    </Tabs.Panel>
                    <Tabs.Panel value="lyrics" className="workspace-tab-panel">
							<LyricErrorBoundary color={props.themeColor}><Suspense fallback={<Center h="100%"><Loader size="sm" color={props.themeColor} /></Center>}><LyricsPanel {...props.lyrics} /></Suspense></LyricErrorBoundary>
                    </Tabs.Panel>
                </Tabs>
            </Card>

            <FavoriteListCard
                panelBackground={props.panelBackground}
                panelStyles={props.panelStyles}
                favorites={props.favorites}
                selectedFavId={props.selectedFavId}
                onSelectFavorite={props.onSelectFavorite}
                onPlayFavorite={props.onPlayFavorite}
                onCreateFavorite={props.onCreateFavorite}
                onEditFavorite={props.onEditFavorite}
                onDeleteFavorite={props.onDeleteFavorite}
                onToggleConfirmDelete={props.onToggleConfirmDelete}
                confirmDeleteFavId={props.confirmDeleteFavId}
                onSyncFavorite={props.onSyncFavorite}
				onLoadSyncStatus={props.onLoadFavoriteSyncStatus}
                onDetachFavorite={props.onDetachFavorite}
				onDuplicateFavorite={props.onDuplicateFavorite}
				onLoginRequired={props.onLoginRequired}
                syncingIds={props.syncingFavoriteIds}
				syncStatusByFavorite={props.syncStatusByFavorite}
				syncTaskByFavorite={props.syncTaskByFavorite ?? {}}
                themeColor={props.themeColor}
                componentRadius={props.componentRadius}
                controlBackground={props.controlBackground}
                favoriteCardBackground={props.favoriteCardBackground}
                textColorPrimary={props.textColorPrimary}
                textColorSecondary={props.textColorSecondary}
                derived={props.derived}
            />
        </main>
    );
};

export default React.memo(MainLayout);
