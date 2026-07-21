import React, { lazy, Suspense, useState } from "react";
import { ActionIcon, Badge, Card, Group, Menu, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { Copy, LockKeyhole, MoreVertical, Play, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { DerivedStyles, Favorite, FavoriteSyncTask, PlaylistSyncStatus, favoriteSongCount } from "../../types";

const PlaylistSyncModal = lazy(() => import("../playlists/PlaylistSyncModal"));

export type FavoriteListCardProps = {
    panelBackground: string;
    panelStyles: React.CSSProperties;
    favorites: Favorite[];
    selectedFavId: string | null;
    onSelectFavorite: (id: string) => void;
    onPlayFavorite: (fav: Favorite) => void;
    onCreateFavorite: () => void;
    onEditFavorite: (fav: Favorite) => void;
    onDeleteFavorite: (id: string) => Promise<void>;
    onToggleConfirmDelete: (id: string | null) => void;
    confirmDeleteFavId: string | null;
    onSyncFavorite: (id: string) => Promise<void>;
	onLoadSyncStatus: (id: string) => Promise<void>;
    onDetachFavorite: (id: string) => Promise<void>;
	onDuplicateFavorite: (favorite: Favorite) => Promise<void>;
	onLoginRequired: () => void;
    syncingIds: Set<string>;
	syncStatusByFavorite: Record<string, PlaylistSyncStatus>;
	syncTaskByFavorite?: Record<string, FavoriteSyncTask>;
    themeColor: string;
    componentRadius?: number;
    controlBackground?: string;
    favoriteCardBackground?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
    derived?: DerivedStyles;
};

const FavoriteListCard: React.FC<FavoriteListCardProps> = ({
    panelBackground, panelStyles, favorites, selectedFavId, onSelectFavorite, onPlayFavorite,
    onCreateFavorite, onEditFavorite, onDeleteFavorite, onToggleConfirmDelete, confirmDeleteFavId,
	onSyncFavorite, onLoadSyncStatus, onDetachFavorite, onDuplicateFavorite, onLoginRequired, syncingIds, syncStatusByFavorite, syncTaskByFavorite = {}, themeColor, componentRadius = 6,
	favoriteCardBackground, textColorPrimary, textColorSecondary, derived,
}) => {
    const [syncFavorite, setSyncFavorite] = useState<Favorite | null>(null);
	const [openedMenuFavoriteId, setOpenedMenuFavoriteId] = useState<string | null>(null);
    const selectFavorite = (favoriteId: string) => {
        onSelectFavorite(favoriteId);
        onToggleConfirmDelete(null);
		setOpenedMenuFavoriteId(null);
    };

    return (
        <Card shadow="sm" padding="md" withBorder h="100%" className="glass-panel favorite-list-card" style={{ ...panelStyles, display: "flex", flexDirection: "column", minHeight: 0, backgroundColor: panelBackground }}>
            <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm" style={{ color: textColorPrimary }}>我的歌单</Text>
                <Tooltip label="新建歌单"><ActionIcon variant="light" color={themeColor} onClick={onCreateFavorite} radius={componentRadius} aria-label="新建歌单"><Plus size={16} /></ActionIcon></Tooltip>
            </Group>
            <ScrollArea className="card-scroll-area favorite-list-scroll-area" type="auto" scrollbarSize={6} style={{ flex: 1, minHeight: 0 }}>
                <Stack gap={6} pb="sm">
                    {favorites.map((favorite) => {
                        const isSelected = selectedFavId === favorite.id;
                        const isConfirmDelete = confirmDeleteFavId === favorite.id;
                        const locked = favorite.source?.locked === true;
                        const syncing = syncingIds.has(favorite.id);
                        const syncState = syncStatusByFavorite[favorite.id]?.source?.syncState ?? favorite.source?.syncState;
                        return (
							<Card key={favorite.id} padding="xs" radius={componentRadius} withBorder role="button" tabIndex={0} aria-pressed={isSelected} aria-label={`选择歌单 ${favorite.title}`} onClick={() => selectFavorite(favorite.id)} onDoubleClick={() => onPlayFavorite(favorite)} onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectFavorite(favorite.id); }
							}} style={{ height: 58, cursor: "pointer", backgroundColor: favoriteCardBackground || "transparent", borderColor: "transparent", borderInlineStart: isSelected ? `3px solid ${themeColor}` : "3px solid transparent", boxShadow: isSelected ? `inset 0 0 0 999px color-mix(in srgb, ${themeColor} 10%, transparent)` : undefined }}>
                                <Group h="100%" gap="xs" wrap="nowrap">
									<Tooltip label={`播放 ${favorite.title}`}><ActionIcon variant="subtle" color={themeColor} aria-label={`播放 ${favorite.title}`} onClick={(event) => { event.stopPropagation(); onPlayFavorite(favorite); }}><Play size={15} /></ActionIcon></Tooltip>
                                    <Stack gap={2} miw={0} style={{ flex: 1 }}>
										<Group gap={5} wrap="nowrap"><Text fw={600} size="sm" c={textColorPrimary} truncate>{favorite.title}</Text>{locked && <LockKeyhole size={12} color={textColorSecondary} aria-label="同步歌单" />}</Group>
										<Group gap={5}><Text size="xs" c={textColorSecondary}>{favoriteSongCount(favorite)} 首</Text>{locked && <Badge size="xs" variant="transparent" color={syncState === "error" ? "red" : syncState === "stale" || syncState === "auth-required" ? "yellow" : themeColor}>{syncing ? "同步中" : syncState === "auth-required" ? "需登录" : syncState === "error" ? "失败" : syncState === "stale" ? "待更新" : "已同步"}</Badge>}</Group>
                                    </Stack>
                                    <Menu
										position="bottom-end"
										withinPortal
										opened={openedMenuFavoriteId === favorite.id}
										onChange={(opened) => {
											setOpenedMenuFavoriteId(opened ? favorite.id : null);
											if (!opened && isConfirmDelete) onToggleConfirmDelete(null);
										}}
									>
										<Tooltip label="更多操作"><Menu.Target><ActionIcon variant="subtle" c={textColorPrimary} aria-label={`${favorite.title} 更多操作`} onClick={(event) => event.stopPropagation()}><MoreVertical size={16} /></ActionIcon></Menu.Target></Tooltip>
                                        <Menu.Dropdown onClick={(event) => event.stopPropagation()} style={{ backgroundColor: derived?.modalBackground, color: textColorPrimary }}>
                                            {locked && <Menu.Item leftSection={<RefreshCw size={14} />} onClick={() => { setSyncFavorite(favorite); void onSyncFavorite(favorite.id); }}>立即同步</Menu.Item>}
											{locked && <Menu.Item leftSection={<Settings2 size={14} />} onClick={() => { setSyncFavorite(favorite); void onLoadSyncStatus(favorite.id); }}>同步详情</Menu.Item>}
											{locked && <Menu.Item leftSection={<Copy size={14} />} onClick={() => { void onDuplicateFavorite(favorite).catch(() => undefined); }}>创建本地副本</Menu.Item>}
                                            {!locked && <Menu.Item leftSection={<Settings2 size={14} />} onClick={() => { onEditFavorite(favorite); onToggleConfirmDelete(null); }}>重命名</Menu.Item>}
											<Menu.Item
												color="red"
												leftSection={<Trash2 size={14} />}
												closeMenuOnClick={isConfirmDelete}
												onClick={() => {
													if (isConfirmDelete) {
														void onDeleteFavorite(favorite.id);
													} else {
														onToggleConfirmDelete(favorite.id);
													}
												}}
											>
												{isConfirmDelete ? locked ? "再次点击，仅删除本地镜像" : "再次点击确认删除" : locked ? "删除本地镜像" : "删除歌单"}
											</Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                </Group>
                            </Card>
                        );
                    })}
                    {favorites.length === 0 && <Text size="sm" c="dimmed" ta="center" py="xl">还没有歌单</Text>}
                </Stack>
            </ScrollArea>
				<Suspense fallback={null}><PlaylistSyncModal favorite={syncFavorite} status={syncFavorite ? syncStatusByFavorite[syncFavorite.id] : undefined} task={syncFavorite ? syncTaskByFavorite[syncFavorite.id] : undefined} opened={Boolean(syncFavorite)} syncing={syncFavorite ? syncingIds.has(syncFavorite.id) : false} themeColor={themeColor} derived={derived} onClose={() => setSyncFavorite(null)} onSync={onSyncFavorite} onDetach={onDetachFavorite} onDuplicate={onDuplicateFavorite} onDelete={onDeleteFavorite} onLoginRequired={onLoginRequired} /></Suspense>
        </Card>
    );
};

export default FavoriteListCard;
