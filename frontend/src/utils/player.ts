import type { PlayMode } from '../context/types/contexts';

export interface QueueChange<T> {
    queue: T[];
    currentIndex: number;
}

export const reorderQueue = <T>(
    queue: readonly T[],
    currentIndex: number,
    fromIndex: number,
    toIndex: number,
): QueueChange<T> => {
    if (
        fromIndex < 0 || fromIndex >= queue.length ||
        toIndex < 0 || toIndex >= queue.length ||
        fromIndex === toIndex
    ) {
        return { queue: [...queue], currentIndex };
    }

    const nextQueue = [...queue];
    const [movedItem] = nextQueue.splice(fromIndex, 1);
    nextQueue.splice(toIndex, 0, movedItem);

    let nextIndex = currentIndex;
    if (currentIndex === fromIndex) nextIndex = toIndex;
    else if (fromIndex < currentIndex && toIndex >= currentIndex) nextIndex--;
    else if (fromIndex > currentIndex && toIndex <= currentIndex) nextIndex++;

    return { queue: nextQueue, currentIndex: nextIndex };
};

export interface QueueRemoval<T> extends QueueChange<T> {
    removedCurrent: boolean;
}

export const removeQueueItem = <T>(
    queue: readonly T[],
    currentIndex: number,
    removeIndex: number,
): QueueRemoval<T> => {
    if (removeIndex < 0 || removeIndex >= queue.length) {
        return { queue: [...queue], currentIndex, removedCurrent: false };
    }

    const nextQueue = queue.filter((_, index) => index !== removeIndex);
    const removedCurrent = removeIndex === currentIndex;
    let nextIndex = currentIndex;
    if (nextQueue.length === 0) nextIndex = 0;
    else if (removeIndex < currentIndex) nextIndex = currentIndex - 1;
    else if (removedCurrent) nextIndex = Math.min(removeIndex, nextQueue.length - 1);

    return { queue: nextQueue, currentIndex: nextIndex, removedCurrent };
};

export const getNextIndex = (
    queueLength: number,
    currentIndex: number,
    playMode: PlayMode,
    repeatSingle: boolean,
    random: () => number = Math.random,
): number | null => {
    if (queueLength <= 0) return null;
    if (playMode === 'single' && repeatSingle) return Math.min(Math.max(currentIndex, 0), queueLength - 1);
    if (playMode === 'random') return Math.min(Math.floor(random() * queueLength), queueLength - 1);
    return (Math.max(currentIndex, 0) + 1) % queueLength;
};
