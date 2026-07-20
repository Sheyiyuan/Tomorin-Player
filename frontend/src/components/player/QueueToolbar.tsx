import React from 'react';
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { LocateFixed, Trash2 } from 'lucide-react';

export interface QueueToolbarProps {
    count: number;
    currentIndex: number;
    themeColor: string;
    textColorPrimary?: string;
    onLocateCurrent: () => void;
    onClearUpcoming: () => void;
}

export const QueueToolbar: React.FC<QueueToolbarProps> = ({ count, currentIndex, themeColor, textColorPrimary, onLocateCurrent, onClearUpcoming }) => (
    <Group justify="space-between" wrap="nowrap" px="sm" py="xs" style={{ borderBottom: '1px solid color-mix(in srgb, currentColor 12%, transparent)' }}>
        <div style={{ minWidth: 0 }}>
            <Text fw={700} size="sm" c={textColorPrimary}>播放队列</Text>
            <Text size="xs" c="dimmed">{count ? `${Math.max(currentIndex + 1, 1)} / ${count}` : '暂无歌曲'}</Text>
        </div>
        <Group gap={2} wrap="nowrap">
            <Tooltip label="定位当前">
                <ActionIcon variant="subtle" color={themeColor} aria-label="定位当前歌曲" onClick={onLocateCurrent}><LocateFixed size={16} /></ActionIcon>
            </Tooltip>
            <Tooltip label="清空待播">
                <ActionIcon variant="subtle" color="red" aria-label="清空待播" disabled={count <= 1} onClick={onClearUpcoming}><Trash2 size={16} /></ActionIcon>
            </Tooltip>
        </Group>
    </Group>
);

export default QueueToolbar;
