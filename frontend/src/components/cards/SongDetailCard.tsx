import React, { lazy, Suspense, useState } from "react";
import { ActionIcon, Box, Card, Flex, Image, NumberInput, RangeSlider, ScrollArea, Slider, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { Edit3 } from "lucide-react";
import type { DerivedStyles, Song } from "../../types";
import { useImageProxy } from "../../hooks/ui/useImageProxy";

const SongInfoEditModal = lazy(() => import("../modals/SongInfoEditModal"));

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
    onIntervalChange: (start: number, end: number) => void;
    onSkipStartChange: (value: number) => void;
    onSkipEndChange: (value: number) => void;
    onSongInfoUpdate?: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void | Promise<void>;
    volumeCompensationDb?: number;
    songVolumeOffsetDb?: number | null;
    onSongVolumeOffsetChange?: (songId: string, offsetDb: number | null) => void;
    componentRadius?: number;
    coverRadius?: number;
    controlBackground?: string;
    controlStyles?: React.CSSProperties;
    textColorPrimary?: string;
    textColorSecondary?: string;
    derived?: DerivedStyles;
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
    onIntervalChange,
    onSkipStartChange,
    onSkipEndChange,
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
    derived,
}) => {
    const { getProxiedImageUrlSync } = useImageProxy();
    const [isEditing, setIsEditing] = useState(false);
    const usingGlobalCompensation = !Number.isFinite(songVolumeOffsetDb as number);
    const displayCompensationDb = usingGlobalCompensation ? volumeCompensationDb : (songVolumeOffsetDb as number);
    const inputStyles = {
        input: {
            ...controlStyles,
            color: textColorPrimary,
            borderColor: "transparent",
            borderRadius: componentRadius,
        },
        label: { color: textColorPrimary },
    };
    const songSettingsSliderStyles = {
        root: {
            width: "calc(100% - 48px)",
            marginInline: 24,
            marginBlockStart: 28,
            overflow: "visible",
        },
        label: { zIndex: 10 },
    };

    return (
        <Card
            shadow="sm"
            padding="md"
            w={300}
            withBorder
            h="100%"
            className="glass-panel song-detail-card"
            style={{ ...panelStyles, minHeight: 0, backgroundColor: panelBackground, display: "flex", flexDirection: "column" }}
        >
            {song ? (
                <Stack gap="md" h="100%" miw={0} style={{ minHeight: 0 }}>
                    <Stack className="song-detail-summary" gap={8} align="center">
                        <Box
                            className="song-detail-cover"
                            bg={controlBackground || (computedColorScheme === "dark" ? "dark.6" : "gray.2")}
                            style={{
                                borderRadius: coverRadius,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                ...controlStyles,
                            }}
                        >
                            <Image
                                src={getProxiedImageUrlSync(song.cover || placeholderCover)}
                                alt={`${song.name} 封面`}
                                w="100%"
                                h="100%"
                                radius={coverRadius}
                                fit="cover"
                            />
                        </Box>

                        <Box pos="relative" w="100%" px={30}>
                            <Text fw={700} size="lg" lineClamp={2} ta="center" c={textColorPrimary}>
                                {song.name}
                            </Text>
                            {onSongInfoUpdate && (
                                <Tooltip label="编辑歌曲信息">
                                    <ActionIcon
                                        pos="absolute"
                                        top={0}
                                        right={0}
                                        size="sm"
                                        variant="subtle"
                                        color={themeColor}
                                        onClick={() => setIsEditing(true)}
                                        aria-label="编辑歌曲信息"
                                    >
                                        <Edit3 size={15} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </Box>
                        <Text size="sm" lineClamp={1} ta="center" w="100%" c={textColorSecondary}>
                            {song.singer || "未知艺术家"}
                        </Text>
                        <Text size="xs" lineClamp={1} ta="center" w="100%" c={textColorSecondary}>
                            {[
                                song.bvid || null,
                                song.totalPages > 1 ? `P${song.pageNumber || 1}/${song.totalPages}` : null,
                                (song.duration ?? 0) > 0 ? formatTime(song.duration ?? 0) : null,
                            ].filter(Boolean).join(" · ") || "本地曲目"}
                        </Text>
                    </Stack>

                    <Box
                        className="song-settings-panel"
                        style={{
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            border: "1px solid rgba(127, 127, 127, 0.18)",
                            borderRadius: componentRadius,
                            backgroundColor: controlBackground,
                            overflow: "hidden",
                        }}
                    >
                        <Box className="song-settings-header" px="sm" py="xs">
                            <Text size="sm" fw={600} c={textColorPrimary}>播放设置</Text>
                        </Box>
                        <ScrollArea className="card-scroll-area song-settings-scroll-area" type="auto" scrollbarSize={6} style={{ flex: 1, minHeight: 0 }}>
                            <Stack gap="lg" px="sm" pt="xs" pb="md">
                                <Stack gap="xs">
                                    <Text size="xs" c={textColorSecondary}>播放区间（只播放此段）</Text>
                                    <RangeSlider
                                        value={[song.skipStartTime ?? 0, song.skipEndTime ?? 0]}
                                        onChange={(values) => onIntervalChange(Number(values[0]), Number(values[1]))}
                                        min={0}
                                        max={maxSkipLimit}
                                        step={0.05}
                                        radius={componentRadius}
                                        label={(value) => formatTime(value)}
                                        style={{ "--slider-color": themeColor } as React.CSSProperties}
                                        styles={songSettingsSliderStyles}
                                    />
                                    <Stack gap="xs">
                                        <NumberInput
                                            label="播放开始 (秒)"
                                            value={song.skipStartTime ?? 0}
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
                                            value={song.skipEndTime ?? 0}
                                            onChange={(value) => value !== undefined && onSkipEndChange(Number(value))}
                                            min={0}
                                            max={maxSkipLimit}
                                            step={0.05}
                                            decimalScale={2}
                                            hideControls
                                            size="sm"
                                            styles={inputStyles}
                                        />
                                    </Stack>
                                </Stack>

                                <Stack gap="xs">
                                    <Stack gap={6}>
                                        <Text size="xs" c={textColorSecondary}>单曲音量补偿（dB）</Text>
                                        <Switch
                                            size="sm"
                                            checked={usingGlobalCompensation}
                                            onChange={(event) => {
                                                if (!onSongVolumeOffsetChange) return;
                                                onSongVolumeOffsetChange(song.id, event.currentTarget.checked ? null : volumeCompensationDb);
                                            }}
                                            label="使用全局"
                                            styles={{ label: { color: textColorSecondary, fontSize: 12 } }}
                                        />
                                    </Stack>
                                    <Stack gap="xs">
                                        <Slider
                                            value={displayCompensationDb}
                                            onChange={(value) => onSongVolumeOffsetChange?.(song.id, Number(value))}
                                            min={-12}
                                            max={12}
                                            step={0.5}
                                            label={(value) => `${value} dB`}
                                            style={{ "--slider-color": themeColor } as React.CSSProperties}
                                            styles={songSettingsSliderStyles}
                                        />
                                        <NumberInput
                                            value={displayCompensationDb}
                                            onChange={(value) => {
                                                if (value !== undefined) onSongVolumeOffsetChange?.(song.id, Number(value));
                                            }}
                                            min={-12}
                                            max={12}
                                            step={0.5}
                                            decimalScale={1}
                                            hideControls
                                            w="100%"
                                            size="sm"
                                            styles={inputStyles}
                                        />
                                    </Stack>
                                    <Text size="xs" c={textColorSecondary}>
                                        {usingGlobalCompensation ? `当前：使用全局 ${volumeCompensationDb} dB` : `当前：${displayCompensationDb} dB`}
                                    </Text>
                                </Stack>
                            </Stack>
                        </ScrollArea>
                    </Box>
                </Stack>
            ) : (
                <Flex align="center" justify="center" h="100%">
                    <Text c={textColorSecondary}>选择一首歌曲</Text>
                </Flex>
            )}

            {song && onSongInfoUpdate && isEditing && (
                <Suspense fallback={null}>
                    <SongInfoEditModal
                        key={song.id}
                        opened
                        song={song}
                        themeColor={themeColor}
                        derived={derived}
                        onClose={() => setIsEditing(false)}
                        onSave={onSongInfoUpdate}
                    />
                </Suspense>
            )}
        </Card>
    );
};

export default SongDetailCard;
