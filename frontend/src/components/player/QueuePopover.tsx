import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Paper, Popover, Text, Tooltip } from '@mantine/core';
import type { QueueItem } from '../../context/types/contexts';
import { QueueList } from './QueueList';
import { QueueToolbar } from './QueueToolbar';

export interface QueuePopoverProps {
    target: React.ReactElement;
    targetTooltip: string;
    opened: boolean;
    onChange: (opened: boolean) => void;
    items: QueueItem[];
    playOrder: string[];
    currentQueueItemId: string | null;
    priorityNext: string[];
    shuffleEnabled: boolean;
    themeColor: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
    onPlayAt: (index: number) => void;
    onRemove: (queueItemId: string) => void;
    onReorder: (fromQueueItemId: string, toQueueItemId: string) => void;
    onClearUpcoming: () => void;
}

export const QueuePopover: React.FC<QueuePopoverProps> = ({
    target, targetTooltip, opened, onChange, items, playOrder, currentQueueItemId, priorityNext, shuffleEnabled, themeColor,
    textColorPrimary, textColorSecondary, onPlayAt, onRemove, onReorder, onClearUpcoming,
}) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const wasOpenedRef = useRef(false);
    const [hasManualScroll, setHasManualScroll] = useState(false);
    const orderedItems = useMemo(() => {
        const byId = new Map(items.map((item) => [item.queueItemId, item]));
        return playOrder.map((id) => byId.get(id)).filter((item): item is QueueItem => Boolean(item));
    }, [items, playOrder]);
    const currentIndex = Math.max(orderedItems.findIndex((item) => item.queueItemId === currentQueueItemId), 0);
    const remainingSeconds = orderedItems.slice(currentIndex + 1).reduce((total, item) => {
        const duration = item.song.duration ?? Math.max(0, item.song.skipEndTime - item.song.skipStartTime);
        return total + (Number.isFinite(duration) ? duration : 0);
    }, 0);
    const remainingLabel = (() => {
        const total = Math.round(remainingSeconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        return hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            : `${minutes}:${seconds.toString().padStart(2, '0')}`;
    })();

    const scrollToCurrent = React.useCallback((behavior?: ScrollBehavior) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const top = Math.max(0, currentIndex * 62 - (viewport.clientHeight / 2) + 31);
        if (typeof viewport.scrollTo === 'function') viewport.scrollTo({ top, behavior });
        else viewport.scrollTop = top;
        const row = viewport.querySelector<HTMLElement>(`[data-queue-item-id="${currentQueueItemId}"]`);
        if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'center', behavior });
    }, [currentIndex, currentQueueItemId]);

    const locateCurrent = () => {
        setHasManualScroll(false);
        scrollToCurrent('smooth');
    };

    useEffect(() => {
        const justOpened = opened && !wasOpenedRef.current;
        wasOpenedRef.current = opened;
        if (!justOpened) return;
        setHasManualScroll(false);
        scrollToCurrent();
    }, [opened, scrollToCurrent]);

    useEffect(() => {
        if (!opened || hasManualScroll) return;
        scrollToCurrent();
    }, [opened, hasManualScroll, scrollToCurrent]);

    return (
        <Popover opened={opened} onChange={onChange} position="top-end" withArrow shadow="md" trapFocus={false} withinPortal>
            <Popover.Target>
                <span style={{ display: 'inline-flex' }}>
                    <Tooltip label={targetTooltip}>{target}</Tooltip>
                </span>
            </Popover.Target>
            <Popover.Dropdown p={0} style={{ width: 'min(430px, calc(100vw - 24px))' }}>
                <Paper withBorder radius={6} style={{ overflow: 'hidden' }}>
                    <QueueToolbar count={items.length} currentIndex={currentIndex} themeColor={themeColor} textColorPrimary={textColorPrimary} onLocateCurrent={locateCurrent} onClearUpcoming={onClearUpcoming} />
                    <div onWheel={() => setHasManualScroll(true)} onTouchMove={() => setHasManualScroll(true)}>
                        <QueueList
                            items={items}
                            playOrder={playOrder}
                            currentQueueItemId={currentQueueItemId}
                            priorityNext={priorityNext}
                            shuffleEnabled={shuffleEnabled}
                            themeColor={themeColor}
                            textColorPrimary={textColorPrimary}
                            textColorSecondary={textColorSecondary}
                            onPlayAt={onPlayAt}
                            onRemove={onRemove}
                            onReorder={onReorder}
                            viewportRef={viewportRef}
                        />
                    </div>
                    <Group justify="space-between" px="sm" py={6}>
                        <Text size="xs" c={textColorSecondary}>{Math.max(items.length - currentIndex - 1, 0)} 首待播</Text>
                        <Text size="xs" c={textColorSecondary}>预计剩余 {remainingLabel}</Text>
                    </Group>
                </Paper>
            </Popover.Dropdown>
        </Popover>
    );
};

export default QueuePopover;
