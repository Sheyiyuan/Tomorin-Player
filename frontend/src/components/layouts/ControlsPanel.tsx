import React from "react";
import { Box, Paper } from "@mantine/core";
import { PlayerBar } from ".";
import { Song } from "../../types";
import type { QueueItem, RepeatMode } from "../../context/types/contexts";

interface ControlsPanelProps {
    themeColor: string;
    currentSong: Song | null;
    progressInInterval: number;
    intervalStart: number;
    intervalLength: number;
    duration: number;
    formatTime: (ms: number) => string;
    formatTimeWithMs: (ms: number) => string;
    seek: (pos: number) => void;
    playPrev: () => void;
    togglePlay: () => void;
    playNext: () => void;
    isPlaying: boolean;
    playMode: "loop" | "random" | "single";
    onTogglePlayMode: () => void;
    onAddToFavorite: () => void;
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
    onDownloadSong: () => void;
    onManageDownload: () => void;
    downloadedSongIds: Set<string>;
    volume: number;
    changeVolume: (value: number) => void;
    songsCount: number;
    panelBackground: string;
    panelStyles: React.CSSProperties;
    componentRadius?: number;
    controlStyles?: React.CSSProperties;
    textColorPrimary?: string;
    textColorSecondary?: string;
}

const ControlsPanel: React.FC<ControlsPanelProps> = ({
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
    onTogglePlayMode,
    onAddToFavorite,
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
    onDownloadSong,
    onManageDownload,
    downloadedSongIds,
    volume,
    changeVolume,
    songsCount,
    panelBackground,
    panelStyles,
    componentRadius,
    controlStyles,
    textColorPrimary,
    textColorSecondary,
}) => {
    return (
        <Box
            pos="sticky"
            bottom={0}
			className="controls-panel"
			style={{ zIndex: 20, flexShrink: 0, minWidth: 0, overflow: "visible", height: 96 }}
        >
			<Paper
				aria-hidden="true"
				shadow="sm"
				withBorder
				className="glass-panel controls-panel-background"
				style={{ ...panelStyles, position: "absolute", inset: 0, zIndex: 0, backgroundColor: panelBackground, overflow: "hidden" }}
			/>
			<Box className="controls-panel-content" p="xs" h="100%" style={{ position: "relative", zIndex: 1, overflow: "visible" }}>
				<PlayerBar
					themeColor={themeColor}
					currentSong={currentSong}
					progressInInterval={progressInInterval}
					intervalStart={intervalStart}
					intervalLength={intervalLength}
					duration={duration}
					formatTime={formatTime}
					formatTimeWithMs={formatTimeWithMs}
					seek={seek}
					playPrev={playPrev}
					togglePlay={togglePlay}
					playNext={playNext}
					isPlaying={isPlaying}
					playMode={playMode}
					onTogglePlayMode={onTogglePlayMode}
					onAddToFavorite={onAddToFavorite}
                    queueItems={queueItems}
                    playOrder={playOrder}
                    currentQueueItemId={currentQueueItemId}
                    priorityNext={priorityNext}
                    shuffleEnabled={shuffleEnabled}
                    repeatMode={repeatMode}
                    onPlayQueueItem={onPlayQueueItem}
                    onRemoveQueueItem={onRemoveQueueItem}
                    onReorderQueueItems={onReorderQueueItems}
                    onClearUpcoming={onClearUpcoming}
                    onToggleShuffle={onToggleShuffle}
                    onToggleRepeatMode={onToggleRepeatMode}
					onDownloadSong={onDownloadSong}
					onManageDownload={onManageDownload}
					downloadedSongIds={downloadedSongIds}
					volume={volume}
					changeVolume={changeVolume}
					songsCount={songsCount}
					componentRadius={componentRadius}
					controlStyles={controlStyles}
					textColorPrimary={textColorPrimary}
					textColorSecondary={textColorSecondary}
				/>
			</Box>
		</Box>
    );
};

export default ControlsPanel;
