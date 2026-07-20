import React from "react";
import { ActionIcon, Badge, Box, Button, Flex, Group, ScrollArea, Text, TextInput, Tooltip, Transition, UnstyledButton } from "@mantine/core";
import { Download, ListPlus, SkipForward, SquarePlus, Trash2, Volume2 } from "lucide-react";
import { Favorite, Song } from "../../types";

export type CurrentPlaylistCardProps = {
    panelBackground: string;
    panelStyles: React.CSSProperties;
    currentFav: Favorite | null;
    currentFavSongs: Song[];
    currentSongId?: string | null;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onPlaySong: (song: Song) => void;  // 只需要 song 参数，不再需要 list
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

const CurrentPlaylistCard: React.FC<CurrentPlaylistCardProps> = ({
    currentFav,
    currentFavSongs,
    currentSongId,
    searchQuery,
    onSearchChange,
    onPlaySong,
    onPlayNext,
    onEnqueueLast,
    themeColor,
    downloadedSongIds,
    onDownloadSong,
    onAddSongToFavorite,
    onRemoveSongFromPlaylist,
    confirmRemoveSongId,
    onToggleConfirmRemove,
    onPlayAll,
    onDownloadAll,
    componentRadius = 8,
    controlBackground,
    controlStyles,
    textColorPrimary,
    textColorSecondary,
}) => {
    // 过滤当前歌单的歌曲，基于实时搜索词（名称或歌手）
    const normalizedQuery = (searchQuery || "").trim().toLowerCase();
    const displayedSongs = normalizedQuery
        ? currentFavSongs.filter((s) =>
            (s.name || "").toLowerCase().includes(normalizedQuery) ||
            (s.singer || "").toLowerCase().includes(normalizedQuery)
        )
        : currentFavSongs;

    return (
		<Box flex={1} miw={0} h="100%" className="current-playlist-card" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm" style={{ color: textColorPrimary, flex: 1, minWidth: 0 }} lineClamp={1}>
                    {currentFav?.title || "选择歌单"}
                </Text>
				{currentFav?.source?.locked && <Badge size="xs" variant="light" color={themeColor}>只读同步</Badge>}
                <Group gap="xs">
                    <Button size="xs" variant="light" color={themeColor} disabled={!currentFav} onClick={onPlayAll} radius={componentRadius}>播放全部</Button>
                    <Button size="xs" variant="light" color={themeColor} disabled={!currentFav} onClick={onDownloadAll} radius={componentRadius}>下载全部</Button>
                </Group>
            </Group>
            <TextInput
                placeholder="搜索歌曲..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.currentTarget.value)}
                size="sm"
                mb="sm"
                radius={componentRadius}
                styles={{
                    input: {
                        backgroundColor: controlBackground,
                        color: textColorPrimary,
                        borderColor: "transparent",
                    }
                }}
            />
            <ScrollArea className="card-scroll-area current-playlist-scroll-area" type="auto" scrollbarSize={6} style={{ flex: 1, minHeight: 0 }}>
                {currentFav ? (
                    <Box component="ul" className="queue-song-list" aria-label="当前歌单">
                        {displayedSongs.length === 0 && (
                            <Flex component="li" align="center" justify="center" py="md">
                                <Text c="dimmed" size="sm">未找到匹配的歌曲</Text>
                            </Flex>
                        )}
                        {displayedSongs.map((s, index) => {
                            const isDownloaded = downloadedSongIds.has(s.id);
                            const isConfirmingRemove = confirmRemoveSongId === s.id;
                            const isSelected = currentSongId === s.id;
                            return (
                                <Box
                                    component="li"
                                    key={s.id}
                                    className="queue-song-row"
                                    aria-current={isSelected ? "true" : undefined}
                                    data-current={isSelected ? "true" : undefined}
                                    style={{
                                        ...controlStyles,
                                        backgroundColor: controlBackground,
                                        borderInlineStartColor: isSelected ? themeColor : "transparent",
                                        borderRadius: componentRadius,
                                        boxShadow: isSelected ? `inset 0 0 0 999px color-mix(in srgb, ${themeColor} 10%, transparent)` : undefined,
                                    }}
                                >
                                    <UnstyledButton
                                        className="queue-song-main"
                                        onClick={() => onPlaySong(s)}
                                        aria-label={`播放 ${s.name}`}
                                        style={{ color: textColorPrimary }}
                                    >
                                        <Box className="queue-song-index" aria-hidden="true" style={{ color: isSelected ? themeColor : textColorSecondary }}>
                                            {isSelected ? <Volume2 size={14} /> : <Text component="span" size="xs">{index + 1}</Text>}
                                        </Box>
                                        <Text className="queue-song-title" fw={isSelected ? 600 : 500} size="sm" truncate title={s.name}>
                                            {s.name}
                                        </Text>
                                        <Text className="queue-song-artist" size="xs" style={{ color: textColorSecondary }} truncate title={s.singer || "未知歌手"}>
                                            {s.singer || "未知歌手"}
                                        </Text>
                                    </UnstyledButton>
                                    <Group className="queue-song-actions" gap={2} wrap="nowrap">
                                        <Tooltip label="下一首播放">
                                            <ActionIcon variant="subtle" size="sm" radius={componentRadius} onClick={() => onPlayNext?.(s)} aria-label="下一首播放" style={{ color: textColorPrimary }}>
                                                <SkipForward size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label="添加到队列末尾">
                                            <ActionIcon variant="subtle" size="sm" radius={componentRadius} onClick={() => onEnqueueLast?.(s)} aria-label="添加到队列末尾" style={{ color: textColorPrimary }}>
                                                <ListPlus size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={isDownloaded ? "已下载：管理下载文件" : "下载歌曲"}>
                                            <ActionIcon
                                                variant={isDownloaded ? "filled" : "subtle"}
                                                color={themeColor}
                                                size="sm"
                                                radius={componentRadius}
                                                onClick={() => onDownloadSong(s)}
                                                aria-label={isDownloaded ? "已下载：管理下载文件" : "下载歌曲"}
                                                style={{
                                                    ...(isDownloaded ? { backgroundColor: themeColor } : undefined),
                                                    color: isDownloaded ? "white" : textColorPrimary,
                                                }}
                                            >
                                                <Download size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label="添加到收藏">
                                            <ActionIcon
                                                variant="subtle"
                                                size="sm"
                                                radius={componentRadius}
                                                onClick={() => onAddSongToFavorite(s)}
                                                aria-label="添加到收藏"
                                                style={{ color: textColorPrimary }}
                                            >
                                                <SquarePlus size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Transition
                                            mounted={!isConfirmingRemove}
                                            transition="fade"
                                            duration={200}
                                        >
                                            {(styles) => (
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    radius={componentRadius}
                                                    onClick={() => onToggleConfirmRemove(s.id)}
                                                    aria-label="移出歌单"
												disabled={currentFav?.source?.locked === true}
                                                    style={{
                                                        ...styles,
                                                        color: "red",
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </ActionIcon>
                                            )}
                                        </Transition>
                                        <Transition
                                            mounted={isConfirmingRemove}
                                            transition="fade"
                                            duration={200}
                                        >
                                            {(styles) => (
                                                <ActionIcon
                                                    color="red"
                                                    variant="filled"
                                                    size="sm"
                                                    radius={componentRadius}
                                                    onClick={() => onRemoveSongFromPlaylist(s)}
                                                    aria-label="确认移出"
                                                    style={styles}
                                                >
                                                    <Trash2 size={14} />
                                                </ActionIcon>
                                            )}
                                        </Transition>
                                    </Group>
                                </Box>
                            );
                        })}
                    </Box>
                ) : (
                    <Flex align="center" justify="center" h="100%">
                        <Text style={{ color: textColorSecondary }}>请从左侧选择一个歌单</Text>
                    </Flex>
                )}
            </ScrollArea>
		</Box>
    );
};

export default CurrentPlaylistCard;
