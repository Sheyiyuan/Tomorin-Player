import React from 'react';
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { GripVertical, Music2, Trash2 } from 'lucide-react';
import type { QueueItem } from '../../context/types/contexts';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface QueueRowProps {
    item: QueueItem;
    index: number;
    isCurrent: boolean;
    isNext: boolean;
    themeColor: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
    onPlay: () => void;
    onRemove: () => void;
    dragDisabled?: boolean;
    virtualStart?: number;
}

export const QueueRow: React.FC<QueueRowProps> = React.memo(({
    item, index, isCurrent, isNext, themeColor, textColorPrimary, textColorSecondary, onPlay, onRemove, dragDisabled = false, virtualStart,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.queueItemId, disabled: dragDisabled });
    return (
    <Group
        ref={setNodeRef}
        component="li"
        role="listitem"
        wrap="nowrap"
        gap="xs"
        data-queue-item-id={item.queueItemId}
        tabIndex={0}
        aria-label={`播放 ${item.song.name}`}
        onClick={onPlay}
        onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                event.preventDefault();
                onPlay();
            }
        }}
        style={{
            minHeight: 62,
            padding: '8px 6px',
            borderInlineStart: `3px solid ${isCurrent ? themeColor : 'transparent'}`,
            background: isCurrent ? `color-mix(in srgb, ${themeColor} 12%, transparent)` : undefined,
            transform: `${virtualStart === undefined ? '' : `translateY(${virtualStart}px)`} ${CSS.Transform.toString(transform) || ''}`.trim() || undefined,
            transition,
            opacity: isDragging ? 0.55 : 1,
            position: virtualStart === undefined ? 'relative' : 'absolute',
            insetInline: virtualStart === undefined ? undefined : 0,
            top: virtualStart === undefined ? undefined : 0,
            zIndex: isDragging ? 2 : 1,
            cursor: 'pointer',
        }}
    >
        <Tooltip label="拖动排序">
            <ActionIcon
                variant="subtle"
                size="sm"
                aria-label={`排序 ${item.song.name}`}
                {...attributes}
                {...listeners}
                disabled={dragDisabled}
                onClick={(event) => event.stopPropagation()}
                style={{ cursor: dragDisabled ? 'not-allowed' : 'grab', color: textColorSecondary, touchAction: 'none' }}
            >
                <GripVertical size={16} />
            </ActionIcon>
        </Tooltip>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left', color: textColorPrimary }}>
            <Group gap={6} wrap="nowrap" mb={2}>
                {isCurrent ? <Music2 size={14} color={themeColor} /> : <Text size="xs" c={textColorSecondary}>{index + 1}</Text>}
                <Text size="sm" fw={isCurrent ? 700 : 500} truncate>{item.song.name}</Text>
            </Group>
            <Text size="xs" c={textColorSecondary} truncate>{item.song.singer || '未知艺术家'}</Text>
        </div>
        {isNext && <Text size="xs" c={themeColor} fw={600}>下一首</Text>}
        <Tooltip label="移除">
            <ActionIcon variant="subtle" color="red" size="sm" aria-label={`移除 ${item.song.name}`} onClick={(event) => { event.stopPropagation(); onRemove(); }}>
                <Trash2 size={15} />
            </ActionIcon>
        </Tooltip>
    </Group>
    );
});

QueueRow.displayName = 'QueueRow';
