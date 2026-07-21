import React, { memo, useEffect, useMemo, useRef } from "react";
import { ActionIcon, Badge, Box, Button, Flex, Group, ScrollArea, Skeleton, Text, TextInput, Tooltip, Transition, UnstyledButton } from "@mantine/core";
import { Download, ListPlus, SkipForward, SquarePlus, Trash2, Volume2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Favorite, Song } from "../../types";

const ROW_HEIGHT = 44;
const ROW_STRIDE = 47;
const VIRTUALIZE_THRESHOLD = 100;

export type CurrentPlaylistCardProps = {
    panelBackground: string;
    panelStyles: React.CSSProperties;
    currentFav: Favorite | null;
    currentFavSongs?: Song[];
	songTotal?: number;
	getSong?: (index: number) => Song | undefined;
	onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
	isLoading?: boolean;
	loadError?: string;
	onRetryLoad?: () => void;
    currentSongId?: string | null;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onPlaySong: (song: Song) => void;
    onPlayNext?: (song: Song) => void;
    onEnqueueLast?: (song: Song) => void;
    themeColor: string;
    downloadedSongIds: Set<string>;
    onDownloadSong: (song: Song) => void;
    onAddSongToFavorite: (song: Song) => void;
    onRemoveSongFromPlaylist: (song: Song) => void;
    confirmRemoveSongId: string | null;
    onToggleConfirmRemove: (songId: string | null) => void;
    onPlayAll: () => void;
    onDownloadAll: () => void;
    componentRadius?: number;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    textColorPrimary?: string;
    textColorSecondary?: string;
};

interface PlaylistSongRowProps {
	song: Song;
	index: number;
	total: number;
	virtualStart?: number;
	isSelected: boolean;
	isDownloaded: boolean;
	isConfirmingRemove: boolean;
	isLocked: boolean;
	themeColor: string;
	componentRadius: number;
	controlBackground?: string;
	controlStyles?: React.CSSProperties;
	textColorPrimary?: string;
	textColorSecondary?: string;
	onPlaySong: (song: Song) => void;
	onPlayNext?: (song: Song) => void;
	onEnqueueLast?: (song: Song) => void;
	onDownloadSong: (song: Song) => void;
	onAddSongToFavorite: (song: Song) => void;
	onRemoveSongFromPlaylist: (song: Song) => void;
	onToggleConfirmRemove: (songId: string | null) => void;
}

const PlaylistSongRow = memo(({
	song, index, total, virtualStart, isSelected, isDownloaded, isConfirmingRemove, isLocked,
	themeColor, componentRadius, controlBackground, controlStyles, textColorPrimary, textColorSecondary,
	onPlaySong, onPlayNext, onEnqueueLast, onDownloadSong, onAddSongToFavorite, onRemoveSongFromPlaylist, onToggleConfirmRemove,
}: PlaylistSongRowProps) => (
	<Box
		component="li"
		className="queue-song-row"
		aria-current={isSelected ? "true" : undefined}
		aria-posinset={index + 1}
		aria-setsize={total}
		data-current={isSelected ? "true" : undefined}
		style={{
			...controlStyles,
			position: virtualStart === undefined ? "relative" : "absolute",
			insetInline: virtualStart === undefined ? undefined : 0,
			top: virtualStart === undefined ? undefined : 0,
			transform: virtualStart === undefined ? undefined : `translateY(${virtualStart}px)`,
			height: ROW_HEIGHT,
			marginBlockEnd: virtualStart === undefined ? ROW_STRIDE - ROW_HEIGHT : undefined,
			backgroundColor: controlBackground,
			borderInlineStartColor: isSelected ? themeColor : "transparent",
			borderRadius: componentRadius,
			boxShadow: isSelected ? `inset 0 0 0 999px color-mix(in srgb, ${themeColor} 10%, transparent)` : undefined,
		}}
	>
		<UnstyledButton className="queue-song-main" onClick={() => onPlaySong(song)} aria-label={`播放 ${song.name}`} style={{ color: textColorPrimary }}>
			<Box className="queue-song-index" aria-hidden="true" style={{ color: isSelected ? themeColor : textColorSecondary }}>
				{isSelected ? <Volume2 size={14} /> : <Text component="span" size="xs">{index + 1}</Text>}
			</Box>
			<Text className="queue-song-title" fw={isSelected ? 600 : 500} size="sm" truncate title={song.name}>{song.name}</Text>
			<Text className="queue-song-artist" size="xs" style={{ color: textColorSecondary }} truncate title={song.singer || "未知歌手"}>{song.singer || "未知歌手"}</Text>
		</UnstyledButton>
		<Group className="queue-song-actions" gap={2} wrap="nowrap">
			<Tooltip label="下一首播放"><ActionIcon variant="subtle" size="sm" radius={componentRadius} onClick={() => onPlayNext?.(song)} aria-label="下一首播放" style={{ color: textColorPrimary }}><SkipForward size={14} /></ActionIcon></Tooltip>
			<Tooltip label="添加到队列末尾"><ActionIcon variant="subtle" size="sm" radius={componentRadius} onClick={() => onEnqueueLast?.(song)} aria-label="添加到队列末尾" style={{ color: textColorPrimary }}><ListPlus size={14} /></ActionIcon></Tooltip>
			<Tooltip label={isDownloaded ? "已下载：管理下载文件" : "下载歌曲"}>
				<ActionIcon variant={isDownloaded ? "filled" : "subtle"} color={themeColor} size="sm" radius={componentRadius} onClick={() => onDownloadSong(song)} aria-label={isDownloaded ? "已下载：管理下载文件" : "下载歌曲"} style={{ ...(isDownloaded ? { backgroundColor: themeColor } : undefined), color: isDownloaded ? "white" : textColorPrimary }}><Download size={14} /></ActionIcon>
			</Tooltip>
			<Tooltip label="添加到收藏"><ActionIcon variant="subtle" size="sm" radius={componentRadius} onClick={() => onAddSongToFavorite(song)} aria-label="添加到收藏" style={{ color: textColorPrimary }}><SquarePlus size={14} /></ActionIcon></Tooltip>
			<Transition mounted={!isConfirmingRemove} transition="fade" duration={200}>
				{(styles) => <ActionIcon variant="subtle" size="sm" radius={componentRadius} onClick={() => onToggleConfirmRemove(song.id)} aria-label="移出歌单" disabled={isLocked} style={{ ...styles, color: "red" }}><Trash2 size={14} /></ActionIcon>}
			</Transition>
			<Transition mounted={isConfirmingRemove} transition="fade" duration={200}>
				{(styles) => <ActionIcon color="red" variant="filled" size="sm" radius={componentRadius} onClick={() => onRemoveSongFromPlaylist(song)} aria-label="确认移出" style={styles}><Trash2 size={14} /></ActionIcon>}
			</Transition>
		</Group>
	</Box>
));

PlaylistSongRow.displayName = "PlaylistSongRow";

const CurrentPlaylistCard: React.FC<CurrentPlaylistCardProps> = ({
    currentFav, currentFavSongs = [], songTotal, getSong, onVisibleRangeChange, isLoading = false, loadError, onRetryLoad,
    currentSongId, searchQuery, onSearchChange, onPlaySong, onPlayNext, onEnqueueLast, themeColor,
    downloadedSongIds, onDownloadSong, onAddSongToFavorite, onRemoveSongFromPlaylist, confirmRemoveSongId,
    onToggleConfirmRemove, onPlayAll, onDownloadAll, componentRadius = 8, controlBackground, controlStyles,
    textColorPrimary, textColorSecondary,
}) => {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const total = songTotal ?? currentFavSongs.length;
	const songAt = getSong ?? ((index: number) => currentFavSongs[index]);
	const virtualized = total > VIRTUALIZE_THRESHOLD;
	const virtualizer = useVirtualizer({
		count: virtualized ? total : 0,
		getScrollElement: () => viewportRef.current,
		estimateSize: () => ROW_STRIDE,
		overscan: 12,
	});
	const virtualRows = virtualizer.getVirtualItems();
	const renderedRows = useMemo(() => virtualized
		? virtualRows.map((row) => ({ index: row.index, start: row.start }))
		: Array.from({ length: total }, (_, index) => ({ index, start: undefined })), [total, virtualRows, virtualized]);

	useEffect(() => {
		if (renderedRows.length === 0) return;
		onVisibleRangeChange?.(renderedRows[0].index, renderedRows[renderedRows.length - 1].index);
	}, [onVisibleRangeChange, renderedRows]);

	useEffect(() => {
		if (viewportRef.current) viewportRef.current.scrollTop = 0;
	}, [currentFav?.id, searchQuery]);

    return (
		<Box flex={1} miw={0} h="100%" className="current-playlist-card" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm" style={{ color: textColorPrimary, flex: 1, minWidth: 0 }} lineClamp={1}>{currentFav?.title || "选择歌单"}</Text>
				{currentFav?.source?.locked && <Badge size="xs" variant="light" color={themeColor}>只读同步</Badge>}
                <Group gap="xs">
                    <Button size="xs" variant="light" color={themeColor} disabled={!currentFav || total === 0} onClick={onPlayAll} radius={componentRadius}>播放全部</Button>
                    <Button size="xs" variant="light" color={themeColor} disabled={!currentFav || total === 0} onClick={onDownloadAll} radius={componentRadius}>下载全部</Button>
                </Group>
            </Group>
            <TextInput placeholder="搜索歌曲..." value={searchQuery} onChange={(event) => onSearchChange(event.currentTarget.value)} size="sm" mb="sm" radius={componentRadius} styles={{ input: { backgroundColor: controlBackground, color: textColorPrimary, borderColor: "transparent" } }} />
			{loadError && total > 0 && (
				<Group role="alert" justify="space-between" gap="xs" mb="xs">
					<Text c="red" size="xs">部分歌曲加载失败</Text>
					<Button size="compact-xs" variant="subtle" color={themeColor} onClick={onRetryLoad}>重试</Button>
				</Group>
			)}
            <ScrollArea viewportRef={viewportRef} className="card-scroll-area current-playlist-scroll-area" type="auto" scrollbarSize={6} style={{ flex: 1, minHeight: 0 }}>
                {!currentFav ? (
					<Flex align="center" justify="center" h="100%"><Text style={{ color: textColorSecondary }}>请从左侧选择一个歌单</Text></Flex>
				) : loadError && total === 0 ? (
					<Flex direction="column" gap="xs" align="center" justify="center" py="xl"><Text c="red" size="sm">加载歌单失败</Text><Button size="xs" variant="light" color={themeColor} onClick={onRetryLoad}>重试</Button></Flex>
				) : isLoading && total === 0 ? (
					<Box aria-label="正在加载歌单">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} h={ROW_HEIGHT} mb={3} radius={componentRadius} />)}</Box>
				) : total === 0 ? (
					<Flex align="center" justify="center" py="md"><Text c="dimmed" size="sm">未找到匹配的歌曲</Text></Flex>
				) : (
                    <Box component="ul" className="queue-song-list" aria-label="当前歌单" style={{ position: "relative", display: "block", height: virtualized ? virtualizer.getTotalSize() : undefined }}>
						{renderedRows.map(({ index, start }) => {
							const song = songAt(index);
							if (!song) return <Skeleton component="li" aria-label={`正在加载第 ${index + 1} 首`} aria-posinset={index + 1} aria-setsize={total} key={`loading-${index}`} h={ROW_HEIGHT} pos={start === undefined ? "relative" : "absolute"} top={start === undefined ? undefined : 0} style={{ insetInline: 0, transform: start === undefined ? undefined : `translateY(${start}px)`, marginBlockEnd: start === undefined ? ROW_STRIDE - ROW_HEIGHT : undefined }} radius={componentRadius} />;
							return <PlaylistSongRow key={song.id} song={song} index={index} total={total} virtualStart={start} isSelected={currentSongId === song.id} isDownloaded={downloadedSongIds.has(song.id)} isConfirmingRemove={confirmRemoveSongId === song.id} isLocked={currentFav.source?.locked === true} themeColor={themeColor} componentRadius={componentRadius} controlBackground={controlBackground} controlStyles={controlStyles} textColorPrimary={textColorPrimary} textColorSecondary={textColorSecondary} onPlaySong={onPlaySong} onPlayNext={onPlayNext} onEnqueueLast={onEnqueueLast} onDownloadSong={onDownloadSong} onAddSongToFavorite={onAddSongToFavorite} onRemoveSongFromPlaylist={onRemoveSongFromPlaylist} onToggleConfirmRemove={onToggleConfirmRemove} />;
						})}
                    </Box>
                )}
            </ScrollArea>
		</Box>
    );
};

export default memo(CurrentPlaylistCard);
