import React, { useRef } from "react";
import { ActionIcon, Box, Group, Slider, Stack, Text, Tooltip } from "@mantine/core";
import { Download, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, SquarePlus, Volume1, Volume2, VolumeX } from "lucide-react";
import type { Song } from "../../types";
import type { QueueItem, RepeatMode } from "../../context/types/contexts";
import { QueuePopover } from "../player";

export type PlayerBarProps = {
    themeColor: string;
    currentSong: Song | null;
    progressInInterval: number;
    intervalStart: number;
    intervalLength: number;
    duration: number;
    formatTime: (seconds: number) => string;
    formatTimeWithMs: (seconds: number) => string;
    seek: (value: number) => void;
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
    componentRadius?: number;
    controlStyles?: React.CSSProperties;
    textColorPrimary?: string;
    textColorSecondary?: string;
};

const PlayerBar: React.FC<PlayerBarProps> = ({
    themeColor, currentSong, progressInInterval, intervalStart,
    intervalLength, duration, formatTime, seek, playPrev, togglePlay, playNext, isPlaying,
    playMode, onTogglePlayMode, onAddToFavorite, onDownloadSong, onManageDownload,
    downloadedSongIds, volume, changeVolume, songsCount, componentRadius = 6,
    controlStyles, textColorPrimary, textColorSecondary, queueItems = [], playOrder = [], currentQueueItemId = null,
    priorityNext = [], shuffleEnabled = playMode === 'random', repeatMode = playMode === 'single' ? 'one' : 'all', onPlayQueueItem,
    onRemoveQueueItem, onReorderQueueItems, onClearUpcoming, onToggleShuffle, onToggleRepeatMode,
}) => {
    const [queueOpened, setQueueOpened] = React.useState(false);
    const isDownloaded = currentSong ? downloadedSongIds.has(currentSong.id) : false;
    const previousVolumeRef = useRef(volume || 0.5);
    const isMuted = volume === 0;
    const iconButtonStyle = { ...controlStyles, borderColor: "transparent", color: textColorPrimary };
    const volumeIcon = isMuted ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />;

    const changePlayerVolume = (next: number) => {
        if (next > 0) previousVolumeRef.current = next;
        changeVolume(next);
    };

    return (
        <Stack className="player-bar" gap={2} h="100%" miw={0}>
            <Group className="player-progress" gap="xs" wrap="nowrap">
                <Text size="xs" c={textColorSecondary} w={42} ta="right">{formatTime(progressInInterval)}</Text>
				<Slider aria-label="播放进度" value={progressInInterval} onChange={(value) => seek(intervalStart + value)} min={0} max={intervalLength || 1} step={0.05} radius={componentRadius} label={(value) => formatTime(intervalStart + value)} style={{ '--slider-color': themeColor, flex: 1 } as React.CSSProperties} />
                <Text size="xs" c={textColorSecondary} w={42}>{formatTime(intervalLength || duration)}</Text>
            </Group>
            <Box className="player-bar-main" style={{ flex: 1 }}>
                <Group className="player-track-identity" gap="xs" wrap="nowrap" miw={0}>
                    <Text size="sm" fw={600} c={textColorPrimary} truncate title={currentSong ? `${currentSong.name} · ${currentSong.singer}` : undefined}>{currentSong ? `${currentSong.name} · ${currentSong.singer || "未知艺术家"}` : "未选择歌曲"}</Text>
                </Group>

                <Group className="player-transport" gap={4} wrap="nowrap">
                    <Tooltip label="上一首"><ActionIcon variant="subtle" color={themeColor} radius={componentRadius} size={32} onClick={playPrev} aria-label="上一首" style={iconButtonStyle}><SkipBack size={17} /></ActionIcon></Tooltip>
					<Tooltip label={isPlaying ? "暂停" : "播放"}><ActionIcon variant="filled" radius={componentRadius} size={42} color={themeColor} onClick={togglePlay} disabled={!currentSong} aria-label={isPlaying ? "暂停" : "播放"}>{isPlaying ? <Pause size={19} /> : <Play size={19} />}</ActionIcon></Tooltip>
                    <Tooltip label="下一首"><ActionIcon variant="subtle" color={themeColor} radius={componentRadius} size={32} onClick={playNext} aria-label="下一首" style={iconButtonStyle}><SkipForward size={17} /></ActionIcon></Tooltip>
                </Group>

                <Group className="player-actions" gap={4} wrap="nowrap" justify="flex-end">
                    <Tooltip label="添加到收藏"><ActionIcon variant="default" size={32} radius={componentRadius} onClick={onAddToFavorite} aria-label="添加到收藏" disabled={!currentSong} style={iconButtonStyle}><SquarePlus size={16} /></ActionIcon></Tooltip>
                    <QueuePopover
                        target={<ActionIcon variant="default" size={32} radius={componentRadius} onClick={() => setQueueOpened((opened) => !opened)} aria-label={`打开播放队列，共 ${songsCount} 首`} aria-expanded={queueOpened} disabled={songsCount === 0} style={{ ...iconButtonStyle, position: 'relative' }}><ListMusic size={16} /><Text component="span" size="xs" aria-hidden="true" style={{ position: 'absolute', insetInlineEnd: 2, insetBlockStart: 0, fontSize: 8, lineHeight: 1 }}>{songsCount > 99 ? '99+' : songsCount}</Text></ActionIcon>}
                        targetTooltip={`播放队列 · ${songsCount}`}
                        opened={queueOpened}
                        onChange={setQueueOpened}
                        items={queueItems}
                        playOrder={playOrder}
                        currentQueueItemId={currentQueueItemId}
                        priorityNext={priorityNext}
                        shuffleEnabled={shuffleEnabled}
                        themeColor={themeColor}
                        textColorPrimary={textColorPrimary}
                        textColorSecondary={textColorSecondary}
                        onPlayAt={(index) => { onPlayQueueItem?.(index); setQueueOpened(false); }}
                        onRemove={(queueItemId) => onRemoveQueueItem?.(queueItemId)}
                        onReorder={(fromQueueItemId, toQueueItemId) => onReorderQueueItems?.(fromQueueItemId, toQueueItemId)}
                        onClearUpcoming={() => onClearUpcoming?.()}
                    />
                    <Tooltip label={isDownloaded ? "管理下载文件" : "下载当前歌曲"}><ActionIcon variant={isDownloaded ? "filled" : "default"} color={isDownloaded ? themeColor : undefined} size={32} radius={componentRadius} onClick={isDownloaded ? onManageDownload : onDownloadSong} aria-label={isDownloaded ? "管理下载文件" : "下载当前歌曲"} disabled={!currentSong} style={isDownloaded ? undefined : iconButtonStyle}><Download size={16} /></ActionIcon></Tooltip>
                    <Tooltip label={shuffleEnabled ? "关闭随机播放" : "开启随机播放"}><ActionIcon variant={shuffleEnabled ? "filled" : "default"} color={shuffleEnabled ? themeColor : undefined} size={32} radius={componentRadius} onClick={onToggleShuffle || onTogglePlayMode} aria-label={shuffleEnabled ? "关闭随机播放" : "开启随机播放"} style={shuffleEnabled ? undefined : iconButtonStyle}><Shuffle size={16} /></ActionIcon></Tooltip>
                    <Tooltip label={repeatMode === 'one' ? "单曲循环" : "列表循环"}><ActionIcon variant="default" size={32} radius={componentRadius} onClick={onToggleRepeatMode || onTogglePlayMode} aria-label={repeatMode === 'one' ? "单曲循环" : "列表循环"} style={iconButtonStyle}>{repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}</ActionIcon></Tooltip>
                    <Group className="player-volume" gap={4} wrap="nowrap">
                        <Tooltip label={isMuted ? "取消静音" : "静音"}><ActionIcon variant="default" size={32} radius={componentRadius} onClick={() => changePlayerVolume(isMuted ? previousVolumeRef.current : 0)} aria-label={isMuted ? "取消静音" : "静音"} style={iconButtonStyle}>{volumeIcon}</ActionIcon></Tooltip>
						<Slider aria-label="音量" value={Math.round(volume * 100)} onChange={(value) => changePlayerVolume(value / 100)} min={0} max={100} step={1} radius={componentRadius} label={(value) => `${value}%`} w={92} style={{ '--slider-color': themeColor } as React.CSSProperties} styles={{ label: { top: "calc(100% + 4px)" } }} />
                    </Group>
                </Group>
            </Box>
        </Stack>
    );
};

export default PlayerBar;
