import React, { useState } from "react";
import { ActionIcon, Box, Button, Card, Flex, Group, Image, NumberInput, RangeSlider, ScrollArea, Slider, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { IconEdit, IconCheck, IconX } from "@tabler/icons-react";
import { Song } from "../../types";
import { useImageProxy } from "../../hooks/ui/useImageProxy";

export type SongDetailCardProps = {
    song: Song | null;
    panelBackground: string;
    panelStyles: React.CSSProperties;
    themeColor: string;
    computedColorScheme: string;
    placeholderCover: string;
    maxSkipLimit: number;
    formatTime: (seconds: number) => string;
    formatTimeWithMs: (seconds: number) => string;
    formatTimeLabel: (value: number | string) => string;
    parseTimeLabel: (value: string) => number;
    onIntervalChange: (start: number, end: number) => void;
    onSkipStartChange: (value: number) => void;
    onSkipEndChange: (value: number) => void;
    onStreamUrlChange: (value: string) => void;
    onSongInfoUpdate?: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void;
    volumeCompensationDb?: number;
    songVolumeOffsetDb?: number | null;
    onSongVolumeOffsetChange?: (songId: string, offsetDb: number | null) => void;
    componentRadius?: number;
    coverRadius?: number;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    textColorPrimary?: string;
    textColorSecondary?: string;
};

const SongDetailCard: React.FC<SongDetailCardProps> = ({
    song,
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
    volumeCompensationDb = 0,
    songVolumeOffsetDb,
    onSongVolumeOffsetChange,
    componentRadius = 8,
    coverRadius = 8,
    controlBackground,
    controlStyles,
    textColorPrimary,
    textColorSecondary,
}) => {
    const { getProxiedImageUrlSync } = useImageProxy();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editSinger, setEditSinger] = useState("");
    const [editCover, setEditCover] = useState("");
    const usingGlobalCompensation = !(Number.isFinite(songVolumeOffsetDb as number));
    const displayCompensationDb = usingGlobalCompensation ? volumeCompensationDb : (songVolumeOffsetDb as number);

    const handleStartEdit = () => {
        if (!song) return;
        setEditName(song.name);
        setEditSinger(song.singer);
        setEditCover(song.cover || "");
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (!song || !onSongInfoUpdate) return;

        onSongInfoUpdate(song.id, {
            name: editName.trim() || song.name,
            singer: editSinger.trim() || song.singer,
            cover: editCover.trim() || song.cover,
        });

        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };
    const inputStyles = {
        input: {
            ...controlStyles,
            color: textColorPrimary,
            borderColor: "transparent",
            borderRadius: componentRadius,
        },
        label: {
            color: textColorPrimary,
        }
    };

    return (
        <Card shadow="sm" padding="md" w={300} withBorder h="100%" className="glass-panel" style={{ ...panelStyles, minHeight: 0, backgroundColor: panelBackground, display: "flex", flexDirection: "column" }}>
            {song ? (
                <ScrollArea style={{ flex: 1, minHeight: 0 }}>
                    <Stack gap="md" pb="sm">
                        <Box
                            w="100%"
                            bg={controlBackground || (computedColorScheme === "dark" ? "dark.6" : "gray.2")}
                            style={{
                                aspectRatio: "4 / 3",
                                borderRadius: coverRadius,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                overflow: "hidden",
                                ...controlStyles,
                            }}
                        >
                            <Image
                                src={getProxiedImageUrlSync(song.cover || placeholderCover)}
                                w="100%"
                                h="100%"
                                radius={coverRadius}
                                fit="cover"
                            />
                        </Box>

                        <Stack gap={4}>
                            {isEditing ? (
                                <>
                                    <TextInput
                                        label="歌曲名称"
                                        value={editName}
                                        onChange={(e) => setEditName(e.currentTarget.value)}
                                        placeholder="请输入歌曲名称"
                                        size="sm"
                                        styles={inputStyles}
                                    />
                                    <TextInput
                                        label="歌手"
                                        value={editSinger}
                                        onChange={(e) => setEditSinger(e.currentTarget.value)}
                                        placeholder="请输入歌手名称"
                                        size="sm"
                                        styles={inputStyles}
                                    />
                                    <TextInput
                                        label="封面 URL"
                                        value={editCover}
                                        onChange={(e) => setEditCover(e.currentTarget.value)}
                                        placeholder="请输入封面图片链接"
                                        size="sm"
                                        styles={inputStyles}
                                    />
                                    <Group gap="xs" mt="xs">
                                        <Button
                                            size="xs"
                                            color={themeColor}
                                            radius={componentRadius}
                                            leftSection={<IconCheck size={14} />}
                                            onClick={handleSaveEdit}
                                            style={controlStyles}
                                        >
                                            保存
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="light"
                                            color="gray"
                                            radius={componentRadius}
                                            leftSection={<IconX size={14} />}
                                            onClick={handleCancelEdit}
                                            style={{ ...controlStyles, color: textColorPrimary }}
                                        >
                                            取消
                                        </Button>
                                    </Group>
                                </>
                            ) : (
                                <>
                                    <Group gap="xs">
                                        <Text fw={700} size="lg" lineClamp={2} style={{ flex: 1, color: textColorPrimary }}>
                                            {song.name}
                                        </Text>
                                        {onSongInfoUpdate && (
                                            <Tooltip label="编辑歌曲信息">
                                                <ActionIcon
                                                    size="sm"
                                                    variant="subtle"
                                                    color={themeColor}
                                                    onClick={handleStartEdit}
                                                >
                                                    <IconEdit size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                    </Group>
                                    <Text size="sm" lineClamp={1} style={{ color: textColorSecondary }}>{song.singer}</Text>
                                    {song.bvid && (
                                        <Text size="xs" lineClamp={1} style={{ color: textColorSecondary }}>BV: {song.bvid}</Text>
                                    )}
                                </>
                            )}
                        </Stack>

                        <Stack gap="xs">
                            <Text size="xs" style={{ color: textColorSecondary }}>播放区间（只播放此段）</Text>
                            <RangeSlider
                                value={[song?.skipStartTime ?? 0, song?.skipEndTime ?? 0]}
                                onChange={(vals) => onIntervalChange(Number(vals[0]), Number(vals[1]))}
                                min={0}
                                max={maxSkipLimit}
                                step={0.05}
                                radius={componentRadius}
                                label={(value) => formatTime(value)}
                                style={{ '--slider-color': themeColor } as any}
                            />
                            <Group gap="sm" grow>
                                <NumberInput
                                    label="播放开始 (秒)"
                                    value={song?.skipStartTime ?? 0}
                                    onChange={(value) => value !== undefined && onSkipStartChange(Number(value))}
                                    min={0}
                                    max={maxSkipLimit}
                                    step={0.05}
                                    decimalScale={2}
                                    hideControls
                                    size="sm"
                                    styles={inputStyles}
                                />
                                <NumberInput
                                    label="播放结束 (秒)"
                                    value={song?.skipEndTime ?? 0}
                                    onChange={(value) => value !== undefined && onSkipEndChange(Number(value))}
                                    min={0}
                                    max={maxSkipLimit}
                                    step={0.05}
                                    decimalScale={2}
                                    hideControls
                                    size="sm"
                                    styles={inputStyles}
                                />
                            </Group>
                        </Stack>

                        <Stack gap="xs">
                            <Group justify="space-between" align="center">
                                <Text size="xs" style={{ color: textColorSecondary }}>单曲音量补偿（dB）</Text>
                                <Switch
                                    size="sm"
                                    checked={usingGlobalCompensation}
                                    onChange={(event) => {
                                        if (!song || !onSongVolumeOffsetChange) return;
                                        if (event.currentTarget.checked) {
                                            onSongVolumeOffsetChange(song.id, null);
                                        } else {
                                            onSongVolumeOffsetChange(song.id, volumeCompensationDb);
                                        }
                                    }}
                                    label="使用全局"
                                    styles={{
                                        label: { color: textColorSecondary, fontSize: 12 },
                                    }}
                                />
                            </Group>
                            <Group gap="sm" align="center">
                                <Slider
                                    value={displayCompensationDb}
                                    onChange={(value) => {
                                        if (!song || !onSongVolumeOffsetChange) return;
                                        onSongVolumeOffsetChange(song.id, Number(value));
                                    }}
                                    min={-12}
                                    max={12}
                                    step={0.5}
                                    label={(value) => `${value} dB`}
                                    style={{ '--slider-color': themeColor } as any}
                                    w="100%"
                                />
                                <NumberInput
                                    value={displayCompensationDb}
                                    onChange={(value) => {
                                        if (!song || !onSongVolumeOffsetChange || value === undefined) return;
                                        onSongVolumeOffsetChange(song.id, Number(value));
                                    }}
                                    min={-12}
                                    max={12}
                                    step={0.5}
                                    decimalScale={1}
                                    hideControls
                                    w={90}
                                    size="sm"
                                    styles={inputStyles}
                                />
                            </Group>
                            <Text size="xs" style={{ color: textColorSecondary }}>
                                {usingGlobalCompensation ? `当前：使用全局 ${volumeCompensationDb} dB` : `当前：${displayCompensationDb} dB`}
                            </Text>
                        </Stack>


                    </Stack>
                </ScrollArea>
            ) : (
                <Flex align="center" justify="center" h="100%">
                    <Text style={{ color: textColorSecondary }}>选择一首歌曲</Text>
                </Flex>
            )}
        </Card>
    );
};

export default SongDetailCard;
