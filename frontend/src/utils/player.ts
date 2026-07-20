import type { PlayMode } from '../context/types/contexts';
import type { QueueItem, RepeatMode } from '../context/types/contexts';

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

let queueItemSequence = 0;

export const createQueueItemId = (): string => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        return cryptoApi.randomUUID();
    }
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    queueItemSequence += 1;
    return `queue-${Date.now().toString(36)}-${queueItemSequence.toString(36)}`;
};

export const createQueueItems = (songs: readonly import('../types').Song[]): QueueItem[] =>
    songs.map((song) => ({ queueItemId: createQueueItemId(), song }));

export const fisherYates = <T>(values: readonly T[], random: () => number = Math.random): T[] => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
        [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
};

export const buildPlayOrder = (
    items: readonly QueueItem[],
    currentQueueItemId: string | null,
    shuffleEnabled: boolean,
    previousQueueItemId?: string | null,
    random: () => number = Math.random,
): string[] => {
    const ids = items.map((item) => item.queueItemId);
    if (!shuffleEnabled) return ids;
    const future = ids.filter((id) => id !== currentQueueItemId);
    const shuffled = fisherYates(future, random);
    if (shuffled.length > 1 && previousQueueItemId && shuffled[0] === previousQueueItemId) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    return currentQueueItemId && ids.includes(currentQueueItemId)
        ? [currentQueueItemId, ...shuffled]
        : shuffled;
};

export interface QueueNavigation {
    nextQueueItemId: string | null;
    playOrder: string[];
}

export const getNextQueueItem = (
    items: readonly QueueItem[],
    playOrder: readonly string[],
    currentQueueItemId: string | null,
    priorityNext: readonly string[],
    shuffleEnabled: boolean,
    repeatMode: RepeatMode,
    random: () => number = Math.random,
): QueueNavigation => {
    if (items.length === 0) return { nextQueueItemId: null, playOrder: [] };
    if (priorityNext.length > 0) return { nextQueueItemId: priorityNext[0], playOrder: [...playOrder] };
    if (repeatMode === 'one' && currentQueueItemId) {
        return { nextQueueItemId: currentQueueItemId, playOrder: [...playOrder] };
    }
    const currentIndex = currentQueueItemId ? playOrder.indexOf(currentQueueItemId) : -1;
    if (currentIndex >= 0 && currentIndex < playOrder.length - 1) {
        return { nextQueueItemId: playOrder[currentIndex + 1], playOrder: [...playOrder] };
    }
    const nextOrder = buildPlayOrder(items, null, shuffleEnabled, currentQueueItemId, random);
    return { nextQueueItemId: nextOrder[0] ?? null, playOrder: nextOrder };
};

export const getPreviousQueueItemId = (
    history: readonly string[],
    items: readonly QueueItem[],
    playOrder: readonly string[],
    currentQueueItemId: string | null,
): string | null => {
    const valid = new Set(items.map((item) => item.queueItemId));
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const candidate = history[index];
        if (candidate !== currentQueueItemId && valid.has(candidate)) return candidate;
    }
    const currentIndex = currentQueueItemId ? playOrder.indexOf(currentQueueItemId) : -1;
    if (currentIndex > 0) return playOrder[currentIndex - 1];
    return playOrder.length > 0 ? playOrder[playOrder.length - 1] : null;
};

export const reorderQueueItems = (
    items: readonly QueueItem[],
    fromQueueItemId: string,
    toQueueItemId: string,
): QueueItem[] => {
    const fromIndex = items.findIndex((item) => item.queueItemId === fromQueueItemId);
    const toIndex = items.findIndex((item) => item.queueItemId === toQueueItemId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return [...items];
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};
