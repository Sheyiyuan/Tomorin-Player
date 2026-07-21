import React, { useMemo } from 'react';
import { ScrollArea, Text } from '@mantine/core';
import type { QueueItem } from '../../context/types/contexts';
import { QueueRow } from './QueueRow';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface QueueListProps {
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
    viewportRef?: React.RefObject<HTMLDivElement | null>;
}

export const QueueList: React.FC<QueueListProps> = ({
    items, playOrder, currentQueueItemId, priorityNext, shuffleEnabled, themeColor, textColorPrimary, textColorSecondary,
    onPlayAt, onRemove, onReorder, viewportRef,
}) => {
    const localViewportRef = React.useRef<HTMLDivElement | null>(null);
    const activeViewportRef = viewportRef ?? localViewportRef;
    const displayItems = useMemo(() => {
        const byId = new Map(items.map((item) => [item.queueItemId, item]));
        const ordered = playOrder.map((id) => byId.get(id)).filter((item): item is QueueItem => Boolean(item));
        const missing = items.filter((item) => !playOrder.includes(item.queueItemId));
        return [...ordered, ...missing];
    }, [items, playOrder]);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
    };
    const currentDisplayIndex = displayItems.findIndex((item) => item.queueItemId === currentQueueItemId);
    const nextQueueItemId = priorityNext[0] ?? displayItems[currentDisplayIndex + 1]?.queueItemId;
    const shouldVirtualize = displayItems.length > 100;
    const virtualizer = useVirtualizer({
        count: displayItems.length,
        getScrollElement: () => activeViewportRef.current,
        estimateSize: () => 62,
        overscan: 10,
        enabled: shouldVirtualize,
    });
    const renderedRows = shouldVirtualize
        ? virtualizer.getVirtualItems().map((virtualRow) => ({ index: virtualRow.index, start: virtualRow.start }))
        : displayItems.map((_, index) => ({ index, start: undefined }));

    if (displayItems.length === 0) {
        return <Text size="sm" c={textColorSecondary} ta="center" py="xl">播放队列为空</Text>;
    }

    return (
        <ScrollArea viewportRef={activeViewportRef} h={Math.min(420, displayItems.length * 62)} type="auto" offsetScrollbars>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayItems.map((item) => item.queueItemId)} strategy={verticalListSortingStrategy}>
            <ul role="list" aria-label="播放队列" style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative', height: shouldVirtualize ? virtualizer.getTotalSize() : undefined }}>
                {renderedRows.map(({ index, start }) => {
                    const item = displayItems[index];
                    const isCurrent = item.queueItemId === currentQueueItemId;
                    return (
                        <QueueRow
                            key={item.queueItemId}
                            item={item}
                            index={index}
                            isCurrent={isCurrent}
                            isNext={!isCurrent && item.queueItemId === nextQueueItemId}
                            themeColor={themeColor}
                            textColorPrimary={textColorPrimary}
                            textColorSecondary={textColorSecondary}
                            onPlay={() => onPlayAt(items.findIndex((candidate) => candidate.queueItemId === item.queueItemId))}
                            onRemove={() => onRemove(item.queueItemId)}
                            dragDisabled={shuffleEnabled && index <= currentDisplayIndex}
                            virtualStart={start}
                        />
                    );
                })}
            </ul>
            </SortableContext>
            </DndContext>
        </ScrollArea>
    );
};

export default QueueList;
