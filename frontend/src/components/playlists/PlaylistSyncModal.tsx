import React, { useEffect, useState } from 'react';
import { Badge, Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { Copy, LogIn, RefreshCw, Trash2 } from 'lucide-react';
import { favoriteSongCount, type DerivedStyles, type Favorite, type FavoriteSyncTask, type PlaylistSyncStatus } from '../../types';
import ThemedModal from '../modals/ThemedModal';
import PlaylistTaskProgress from './PlaylistTaskProgress';

interface PlaylistSyncModalProps {
    favorite: Favorite | null;
	status?: PlaylistSyncStatus;
	task?: FavoriteSyncTask;
    opened: boolean;
    syncing: boolean;
    themeColor: string;
    derived?: DerivedStyles;
    onClose: () => void;
    onSync: (favoriteId: string) => Promise<void>;
	onDetach: (favoriteId: string) => Promise<void>;
	onDuplicate: (favorite: Favorite) => Promise<void>;
	onDelete: (favoriteId: string) => void;
	onLoginRequired: () => void;
}

const formatLastSync = (value?: string): string => {
    if (!value) return '尚未完成同步';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const PlaylistSyncModal: React.FC<PlaylistSyncModalProps> = ({ favorite, status, task, opened, syncing, themeColor, derived, onClose, onSync, onDetach, onDuplicate, onDelete, onLoginRequired }) => {
    const [acknowledged, setAcknowledged] = useState(false);
	const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
    const source = status?.source ?? favorite?.source;

	useEffect(() => {
		setAcknowledged(false);
		setDeleteAcknowledged(false);
	}, [favorite?.id, opened]);

    return (
        <ThemedModal derived={derived} opened={opened} onClose={onClose} title="歌单同步" centered size="md">
            {favorite && source && (
                <Stack gap="md">
                    <Stack gap={4}>
						<Group justify="space-between"><Text fw={600}>{favorite.title}</Text><Badge color={source.syncState === 'error' ? 'red' : source.syncState === 'stale' || source.syncState === 'auth-required' ? 'yellow' : themeColor}>{source.syncState === 'syncing' ? '同步中' : source.syncState === 'auth-required' ? '需要登录' : source.syncState === 'stale' ? '等待更新' : source.syncState === 'error' ? '同步失败' : '已同步'}</Badge></Group>
                        <Text size="sm" c="dimmed">Bilibili fid: {source.remoteId}</Text>
						{source.remoteTitle && <Text size="sm" c="dimmed">远端标题：{source.remoteTitle}</Text>}
                        <Text size="sm" c="dimmed">上次同步：{formatLastSync(source.lastSyncedAt)}</Text>
						<Text size="sm" c="dimmed">最近尝试：{formatLastSync(source.lastAttemptedAt)}</Text>
						<Text size="sm" c="dimmed">远端 {status?.run?.remoteCount ?? source.remoteCount} 项 · 已解析 {status?.run?.resolvedCount ?? favoriteSongCount(favorite)} 首 · 本地 {favoriteSongCount(favorite)} 首</Text>
                        {source.lastErrorMessage && <Text size="sm" c="red" role="status">{source.lastErrorMessage}</Text>}
                        {status?.run && (
							<Text size="sm" c="dimmed">
								最近变化：新增 {status.run.addedCount} 首，移除 {status.run.removedCount} 首，跳过 {status.run.skippedCount} 项，待解析 {status.run.pendingCount} 项
							</Text>
						)}
                    </Stack>
					{syncing && task && (
						<PlaylistTaskProgress
							progress={task.progress}
							themeColor={themeColor}
							completedFavorites={task.completedFavorites}
							totalFavorites={task.totalFavorites}
						/>
					)}
                    <Button leftSection={<RefreshCw size={16} />} color={themeColor} loading={syncing} onClick={() => onSync(favorite.id)}>立即同步</Button>
					{source.syncState === 'auth-required' && <Button leftSection={<LogIn size={16} />} variant="light" color={themeColor} onClick={onLoginRequired}>重新登录</Button>}
					<Button leftSection={<Copy size={16} />} variant="light" color={themeColor} onClick={() => { void onDuplicate(favorite).catch(() => undefined); }}>创建本地副本</Button>
                    <Stack gap="xs" pt="sm" style={{ borderTop: '1px solid rgba(127,127,127,.2)' }}>
                        <Text size="sm" fw={600}>转换为本地歌单</Text>
                        <Text size="xs" c="dimmed">保留当前歌单 ID 和全部曲目，并永久解除同步。此操作不可撤销；重新关联需要再次导入。</Text>
                        <Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.currentTarget.checked)} label="我已了解转换不可撤销" color={themeColor} />
						<Button color="red" variant="light" disabled={!acknowledged || syncing} onClick={() => { void onDetach(favorite.id).then(onClose).catch(() => undefined); }}>确认转换为本地歌单</Button>
                    </Stack>
					<Stack gap="xs" pt="sm" style={{ borderTop: '1px solid rgba(127,127,127,.2)' }}>
						<Text size="sm" fw={600}>删除本地镜像</Text>
						<Text size="xs" c="dimmed">删除此应用内的歌单，不会修改 Bilibili 收藏夹。</Text>
						<Checkbox checked={deleteAcknowledged} onChange={(event) => setDeleteAcknowledged(event.currentTarget.checked)} label="我确认只删除本地镜像" color="red" />
						<Button leftSection={<Trash2 size={16} />} color="red" disabled={!deleteAcknowledged || syncing} onClick={() => { onDelete(favorite.id); onClose(); }}>删除本地镜像</Button>
					</Stack>
                </Stack>
            )}
        </ThemedModal>
    );
};

export default PlaylistSyncModal;
