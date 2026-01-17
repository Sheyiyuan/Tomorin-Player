import React, { useEffect, useRef, useState } from "react";
import { ActionIcon, AspectRatio, Badge, Button, Group, Image, Modal, Paper, ScrollArea, SegmentedControl, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import type { Song, Favorite } from "../../types";
import { useImageProxy } from "../../hooks/ui/useImageProxy";

type GlobalSearchResult = { kind: "song"; song: Song } | { kind: "favorite"; favorite: Favorite };

interface GlobalSearchModalProps {
    opened: boolean;
    themeColor: string;
    globalSearchTerm: string;
    globalSearchResults: GlobalSearchResult[];
    remoteResults: Song[];
    remoteLoading: boolean;
    resolvingBV: boolean;
    onClose: () => void;
    onTermChange: (value: string) => void;
    onResolveBVAndAdd: () => void;
    onRemoteSearch: (options?: { order?: string; page?: number; pageSize?: number }) => void;
    onResultClick: (result: GlobalSearchResult) => void;
    onAddFromRemote: (song: Song) => void;
    onAddSingleRemotePage: (song: Song) => void;
    onLoadRemotePages: (bvid: string) => Promise<Song[]>;
    panelStyles?: any;
    derived?: any;
}

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = React.memo(({
    opened,
    themeColor,
    globalSearchTerm,
    globalSearchResults,
    remoteResults,
    remoteLoading,
    resolvingBV,
    onClose,
    onTermChange,
    onResolveBVAndAdd,
    onRemoteSearch,
    onResultClick,
    onAddFromRemote,
    onAddSingleRemotePage,
    onLoadRemotePages,
    panelStyles,
    derived,
}) => {
    const { getProxiedImageUrlSync } = useImageProxy();
    const lastSearchedBVRef = useRef<string>("");
    const [expandedMap, setExpandedMap] = useState<Record<string, { open: boolean; loading: boolean; pages: Song[]; error?: string }>>({});
    const [activeTab, setActiveTab] = useState<"all" | "local" | "remote">("all");
    const [biliOrder, setBiliOrder] = useState("totalrank");

    const handleEnter = (hasResult: boolean) => {
        if (hasResult) {
            onResultClick(globalSearchResults[0]);
        } else {
            onResolveBVAndAdd();
        }
    };

    const trimmedTerm = globalSearchTerm.trim();
    const bvPattern = /BV[0-9A-Za-z]{10}/;
    const isBVSearch = bvPattern.test(trimmedTerm) || trimmedTerm.includes("bilibili.com");

    // 当输入 BV 号时自动触发搜索（仅搜索一次）
    useEffect(() => {
        if (opened && isBVSearch && trimmedTerm) {
            const extractedBV = trimmedTerm.match(bvPattern)?.[0] || trimmedTerm;

            // 只在BV号改变时触发搜索，避免重复搜索
            if (extractedBV !== lastSearchedBVRef.current) {
                lastSearchedBVRef.current = extractedBV;
                const timer = setTimeout(() => {
                    onRemoteSearch({ order: biliOrder });
                }, 300); // 防抖300ms
                return () => clearTimeout(timer);
            }
        } else if (!isBVSearch) {
            // 如果不再是BV搜索，重置记录
            lastSearchedBVRef.current = "";
        }
    }, [trimmedTerm, isBVSearch, opened, onRemoteSearch, biliOrder]);

    useEffect(() => {
        setExpandedMap({});
        setActiveTab("all");
    }, [globalSearchTerm]);

    useEffect(() => {
        if (!opened) return;
        if (trimmedTerm && !isBVSearch) {
            onRemoteSearch({ order: biliOrder });
        }
    }, [biliOrder, opened, trimmedTerm, isBVSearch, onRemoteSearch]);

    const handleToggleExpand = async (song: Song) => {
        const bvid = song.bvid || "";
        if (!bvid) return;

        const current = expandedMap[bvid];
        if (current?.open) {
            setExpandedMap((prev) => ({
                ...prev,
                [bvid]: { ...current, open: false },
            }));
            return;
        }

        if (current?.pages?.length) {
            setExpandedMap((prev) => ({
                ...prev,
                [bvid]: { ...current, open: true },
            }));
            return;
        }

        setExpandedMap((prev) => ({
            ...prev,
            [bvid]: { open: true, loading: true, pages: [], error: undefined },
        }));

        try {
            const pages = await onLoadRemotePages(bvid);
            setExpandedMap((prev) => ({
                ...prev,
                [bvid]: { open: true, loading: false, pages, error: undefined },
            }));
        } catch (err) {
            setExpandedMap((prev) => ({
                ...prev,
                [bvid]: {
                    open: true,
                    loading: false,
                    pages: [],
                    error: err instanceof Error ? err.message : "加载失败",
                },
            }));
        }
    };

    // 清理：当模态框关闭时重置搜索词（remoteResults会被App自动清理）
    const handleClose = () => {
        onTermChange("");
        onClose();
    };

    const localResults = globalSearchResults;
    const localPreview = localResults.slice(0, 5);
    const remotePreview = remoteResults.slice(0, 5);

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            size="lg"
            centered
            padding="lg"
            title="搜索视频 (BV 号或链接)"
            overlayProps={{ blur: 10, opacity: 0.35 }}
            radius={derived?.componentRadius}
            styles={{
                content: {
                    backgroundColor: derived?.modalBackground,
                    color: derived?.textColorPrimary,
                },
                header: {
                    backgroundColor: "transparent",
                    color: derived?.textColorPrimary,
                },
                title: {
                    fontWeight: 600,
                }
            }}
            className="normal-panel"
        >
            <Stack gap="md">
                <TextInput
                    placeholder="输入 BV 号或完整链接，如 BV1xx... 或 https://www.bilibili.com/video/BV..."
                    value={globalSearchTerm}
                    onChange={(e) => onTermChange(e.currentTarget.value)}
                    leftSection={<Search size={14} />}
                    leftSectionPointerEvents="none"
                    autoFocus
                    disabled={resolvingBV}
                    radius={derived?.componentRadius}
                    styles={{
                        input: {
                            backgroundColor: derived?.controlBackground,
                            color: derived?.textColorPrimary,
                            borderColor: "transparent",
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !resolvingBV) {
                            handleEnter(globalSearchResults.length > 0);
                        }
                    }}
                />
                <Tabs value={activeTab} onChange={(val) => setActiveTab((val as any) || "all")}
                    styles={{
                        tab: { fontSize: 12 },
                    }}
                >
                    <Tabs.List>
                        <Tabs.Tab value="all" disabled={!trimmedTerm}>全部</Tabs.Tab>
                        <Tabs.Tab value="local" disabled={!trimmedTerm}>本地</Tabs.Tab>
                        <Tabs.Tab value="remote" disabled={!trimmedTerm}>B站</Tabs.Tab>
                    </Tabs.List>
                </Tabs>

                <ScrollArea h={380} type="auto">
                    <Stack gap="xs">
                        {/* BV号搜索时：显示解析按钮 */}
                        {trimmedTerm && isBVSearch && (
                            <Paper withBorder p="md" w="100%" radius={derived?.componentRadius} style={{ backgroundColor: 'rgba(0, 123, 255, 0.05)' }}>
                                <Group justify="space-between">
                                    <Stack gap={4}>
                                        <Text size="sm" fw={500}>解析 BV 号并添加到歌单</Text>
                                        <Text size="xs" c="dimmed" lineClamp={1}>{globalSearchTerm}</Text>
                                    </Stack>
                                    <ActionIcon
                                        size="lg"
                                        variant="filled"
                                        color={themeColor}
                                        radius={derived?.componentRadius}
                                        onClick={onResolveBVAndAdd}
                                        loading={resolvingBV}
                                        disabled={resolvingBV}
                                    >
                                        <Search size={16} />
                                    </ActionIcon>
                                </Group>
                            </Paper>
                        )}
                        {/* 本地搜索结果 */}
                        {!trimmedTerm ? (
                            <Stack gap="md" align="center" py="xl">
                                <Text c="dimmed" size="sm" ta="center">
                                    输入 BV 号自动搜索本地和B站
                                </Text>
                                <Text c="dimmed" size="xs" ta="center">
                                    输入关键字搜索本地歌曲
                                </Text>
                            </Stack>
                        ) : (
                            <>
                                {/* 全部 Tab 预览 */}
                                {activeTab === "all" && localPreview.length > 0 && (
                                    <>
                                        <Group justify="space-between" align="center">
                                            <Text size="xs" c="dimmed" fw={500} px="xs">本地结果</Text>
                                            {localResults.length > 5 && (
                                                <Button size="xs" variant="subtle" onClick={() => setActiveTab("local")}>更多</Button>
                                            )}
                                        </Group>
                                        {localPreview.map((item) => (
                                            <Paper
                                                key={item.kind === "song" ? `song-${item.song.id}` : `fav-${item.favorite.id}`}
                                                withBorder
                                                p="sm"
                                                shadow="xs"
                                                style={{ cursor: "pointer" }}
                                                onClick={() => onResultClick(item)}
                                            >
                                                <Group justify="space-between" align="flex-start">
                                                    <Stack gap={4} style={{ flex: 1 }}>
                                                        <Text fw={600} size="sm" lineClamp={1}>
                                                            {item.kind === "song" ? item.song.name || "未命名歌曲" : item.favorite.title || "未命名收藏夹"}
                                                        </Text>
                                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                                            {item.kind === "song"
                                                                ? item.song.singer || item.song.singerId || "未知 UP"
                                                                : `fid: ${item.favorite.id} · 曲目数: ${item.favorite.songIds.length}`}
                                                        </Text>
                                                        {item.kind === "song" && item.song.bvid ? (
                                                            <Text size="xs" c="dimmed">BV: {item.song.bvid}</Text>
                                                        ) : null}
                                                    </Stack>
                                                    <Badge color={item.kind === "song" ? "blue" : "violet"} variant="light">
                                                        {item.kind === "song" ? "歌曲" : "收藏夹"}
                                                    </Badge>
                                                </Group>
                                            </Paper>
                                        ))}
                                    </>
                                )}
                                {activeTab === "all" && remotePreview.length > 0 && (
                                    <>
                                        <Group justify="space-between" align="center" mt={localPreview.length > 0 ? "sm" : 0}>
                                            <Text size="xs" c="dimmed" fw={500} px="xs">
                                                {isBVSearch ? "B站匹配结果" : "B站搜索结果"}
                                            </Text>
                                            {remoteResults.length > 5 && (
                                                <Button size="xs" variant="subtle" onClick={() => setActiveTab("remote")}>更多</Button>
                                            )}
                                        </Group>
                                        {remotePreview.map((s, idx) => {
                                            const bvid = s.bvid || "";
                                            const expandState = bvid ? expandedMap[bvid] : undefined;
                                            const isExpanded = !!expandState?.open;
                                            const isLoadingPages = !!expandState?.loading;
                                            const expandedPages = expandState?.pages || [];
                                            const expandedError = expandState?.error;

                                            return (
                                                <Stack key={`remote-${s.bvid || "no-bvid"}-${idx}`} gap="xs">
                                                    <Paper withBorder p="sm" shadow="xs">
                                                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                                                            <AspectRatio ratio={16 / 9} w={120}>
                                                                <Image
                                                                    src={getProxiedImageUrlSync(s.cover || "")}
                                                                    alt={s.name}
                                                                    fit="cover"
                                                                    radius="sm"
                                                                    fallbackSrc="https://via.placeholder.com/160x90?text=No+Cover"
                                                                />
                                                            </AspectRatio>
                                                            <Stack gap={4} style={{ flex: 1 }}>
                                                                <Text fw={600} size="sm" lineClamp={1}>{s.name || s.videoTitle || '未命名视频'}</Text>
                                                                <Text size="xs" c="dimmed" lineClamp={2}>{s.singer || '未知 UP'} · BV: {s.bvid || '-'}</Text>
                                                            </Stack>
                                                            <Group gap="xs">
                                                                <Badge color="grape" variant="light">B站</Badge>
                                                                <Button
                                                                    size="xs"
                                                                    variant="light"
                                                                    onClick={() => handleToggleExpand(s)}
                                                                    disabled={!bvid || isLoadingPages}
                                                                >
                                                                    {isExpanded ? "收起分P" : "展开分P"}
                                                                </Button>
                                                                <Button
                                                                    size="xs"
                                                                    variant="filled"
                                                                    onClick={() => onAddFromRemote(s)}
                                                                    disabled={!bvid || resolvingBV}
                                                                >
                                                                    全部加入
                                                                </Button>
                                                            </Group>
                                                        </Group>
                                                    </Paper>
                                                    {isExpanded && (
                                                        <Stack gap="xs" pl={12}>
                                                            {isLoadingPages && (
                                                                <Text size="xs" c="dimmed">正在加载分P...</Text>
                                                            )}
                                                            {!isLoadingPages && expandedError && (
                                                                <Text size="xs" c="red">分P加载失败：{expandedError}</Text>
                                                            )}
                                                            {!isLoadingPages && !expandedError && expandedPages.length === 0 && (
                                                                <Text size="xs" c="dimmed">暂无分P信息</Text>
                                                            )}
                                                            {!isLoadingPages && !expandedError && expandedPages.map((p) => (
                                                                <Paper key={`page-${p.bvid}-${p.pageNumber}`} withBorder p="xs" shadow="xs">
                                                                    <Group justify="space-between" align="center">
                                                                        <Stack gap={2} style={{ flex: 1 }}>
                                                                            <Text size="sm" fw={500} lineClamp={1}>{p.name || p.pageTitle || p.videoTitle || '未命名分P'}</Text>
                                                                            <Text size="xs" c="dimmed">P{p.pageNumber || 1} · {p.pageTitle || p.videoTitle || '-'}</Text>
                                                                        </Stack>
                                                                        <Button size="xs" variant="light" onClick={() => onAddSingleRemotePage(p)}>
                                                                            添加此分P
                                                                        </Button>
                                                                    </Group>
                                                                </Paper>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </Stack>
                                            );
                                        })}
                                    </>
                                )}
                                {/* 本地 Tab 全量 */}
                                {activeTab === "local" && localResults.length > 0 && (
                                    <>
                                        <Text size="xs" c="dimmed" fw={500} px="xs">本地结果</Text>
                                        {localResults.map((item) => (
                                            <Paper
                                                key={item.kind === "song" ? `song-${item.song.id}` : `fav-${item.favorite.id}`}
                                                withBorder
                                                p="sm"
                                                shadow="xs"
                                                style={{ cursor: "pointer" }}
                                                onClick={() => onResultClick(item)}
                                            >
                                                <Group justify="space-between" align="flex-start">
                                                    <Stack gap={4} style={{ flex: 1 }}>
                                                        <Text fw={600} size="sm" lineClamp={1}>
                                                            {item.kind === "song" ? item.song.name || "未命名歌曲" : item.favorite.title || "未命名收藏夹"}
                                                        </Text>
                                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                                            {item.kind === "song"
                                                                ? item.song.singer || item.song.singerId || "未知 UP"
                                                                : `fid: ${item.favorite.id} · 曲目数: ${item.favorite.songIds.length}`}
                                                        </Text>
                                                        {item.kind === "song" && item.song.bvid ? (
                                                            <Text size="xs" c="dimmed">BV: {item.song.bvid}</Text>
                                                        ) : null}
                                                    </Stack>
                                                    <Badge color={item.kind === "song" ? "blue" : "violet"} variant="light">
                                                        {item.kind === "song" ? "歌曲" : "收藏夹"}
                                                    </Badge>
                                                </Group>
                                            </Paper>
                                        ))}
                                    </>
                                )}
                                {/* B站 Tab 全量 + 筛选 */}
                                {activeTab === "remote" && (
                                    <>
                                        {!isBVSearch && (
                                            <SegmentedControl
                                                value={biliOrder}
                                                onChange={setBiliOrder}
                                                data={[
                                                    { label: "综合", value: "totalrank" },
                                                    { label: "最新", value: "pubdate" },
                                                    { label: "最多播放", value: "click" },
                                                    { label: "最多收藏", value: "favorite" },
                                                    { label: "最多弹幕", value: "danmaku" },
                                                ]}
                                            />
                                        )}
                                        {remoteResults.length > 0 && (
                                            <Text size="xs" c="dimmed" fw={500} px="xs" mt="sm">
                                                {isBVSearch ? "B站匹配结果" : "B站搜索结果"}
                                            </Text>
                                        )}
                                        {remoteResults.map((s, idx) => {
                                            const bvid = s.bvid || "";
                                            const expandState = bvid ? expandedMap[bvid] : undefined;
                                            const isExpanded = !!expandState?.open;
                                            const isLoadingPages = !!expandState?.loading;
                                            const expandedPages = expandState?.pages || [];
                                            const expandedError = expandState?.error;

                                            return (
                                                <Stack key={`remote-full-${s.bvid || "no-bvid"}-${idx}`} gap="xs">
                                                    <Paper withBorder p="sm" shadow="xs">
                                                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                                                            <AspectRatio ratio={16 / 9} w={120}>
                                                                <Image
                                                                    src={getProxiedImageUrlSync(s.cover || "")}
                                                                    alt={s.name}
                                                                    fit="cover"
                                                                    radius="sm"
                                                                    fallbackSrc="https://via.placeholder.com/160x90?text=No+Cover"
                                                                />
                                                            </AspectRatio>
                                                            <Stack gap={4} style={{ flex: 1 }}>
                                                                <Text fw={600} size="sm" lineClamp={1}>{s.name || s.videoTitle || '未命名视频'}</Text>
                                                                <Text size="xs" c="dimmed" lineClamp={2}>{s.singer || '未知 UP'} · BV: {s.bvid || '-'}</Text>
                                                            </Stack>
                                                            <Group gap="xs">
                                                                <Badge color="grape" variant="light">B站</Badge>
                                                                <Button
                                                                    size="xs"
                                                                    variant="light"
                                                                    onClick={() => handleToggleExpand(s)}
                                                                    disabled={!bvid || isLoadingPages}
                                                                >
                                                                    {isExpanded ? "收起分P" : "展开分P"}
                                                                </Button>
                                                                <Button
                                                                    size="xs"
                                                                    variant="filled"
                                                                    onClick={() => onAddFromRemote(s)}
                                                                    disabled={!bvid || resolvingBV}
                                                                >
                                                                    全部加入
                                                                </Button>
                                                            </Group>
                                                        </Group>
                                                    </Paper>
                                                    {isExpanded && (
                                                        <Stack gap="xs" pl={12}>
                                                            {isLoadingPages && (
                                                                <Text size="xs" c="dimmed">正在加载分P...</Text>
                                                            )}
                                                            {!isLoadingPages && expandedError && (
                                                                <Text size="xs" c="red">分P加载失败：{expandedError}</Text>
                                                            )}
                                                            {!isLoadingPages && !expandedError && expandedPages.length === 0 && (
                                                                <Text size="xs" c="dimmed">暂无分P信息</Text>
                                                            )}
                                                            {!isLoadingPages && !expandedError && expandedPages.map((p) => (
                                                                <Paper key={`page-${p.bvid}-${p.pageNumber}`} withBorder p="xs" shadow="xs">
                                                                    <Group justify="space-between" align="center">
                                                                        <Stack gap={2} style={{ flex: 1 }}>
                                                                            <Text size="sm" fw={500} lineClamp={1}>{p.name || p.pageTitle || p.videoTitle || '未命名分P'}</Text>
                                                                            <Text size="xs" c="dimmed">P{p.pageNumber || 1} · {p.pageTitle || p.videoTitle || '-'}</Text>
                                                                        </Stack>
                                                                        <Button size="xs" variant="light" onClick={() => onAddSingleRemotePage(p)}>
                                                                            添加此分P
                                                                        </Button>
                                                                    </Group>
                                                                </Paper>
                                                            ))}
                                                        </Stack>
                                                    )}
                                                </Stack>
                                            );
                                        })}
                                    </>
                                )}
                                {/* 加载提示 */}
                                {remoteLoading && (
                                    <Text size="sm" c="dimmed" ta="center" py="md">
                                        正在搜索 B站...
                                    </Text>
                                )}
                                {/* 无结果提示 */}
                                {!remoteLoading && localResults.length === 0 && remoteResults.length === 0 && trimmedTerm && (
                                    <Text size="sm" c="dimmed" ta="center" py="md">
                                        {isBVSearch ? "未找到匹配的歌曲" : "未找到匹配的本地歌曲，点击上方按钮从B站搜索"}
                                    </Text>
                                )}
                            </>
                        )}
                    </Stack>
                </ScrollArea>
            </Stack>
        </Modal>
    );
});

export default GlobalSearchModal;
