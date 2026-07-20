import { describe, expect, it } from 'vitest';
import type { QueueItem } from '../context/types/contexts';
import type { Song } from '../types';
import { buildPlayOrder, createQueueItemId, fisherYates, getNextIndex, getNextQueueItem, getPreviousQueueItemId, removeQueueItem, reorderQueue } from './player';

const queueItem = (id: string): QueueItem => ({ queueItemId: id, song: { id } as Song });

describe('queue operations', () => {
    const queue = ['a', 'b', 'c', 'd'];

    it('adjusts the current index when items move across it', () => {
        expect(reorderQueue(queue, 2, 0, 3)).toEqual({ queue: ['b', 'c', 'd', 'a'], currentIndex: 1 });
        expect(reorderQueue(queue, 1, 3, 0)).toEqual({ queue: ['d', 'a', 'b', 'c'], currentIndex: 2 });
        expect(reorderQueue(queue, 1, 1, 3)).toEqual({ queue: ['a', 'c', 'd', 'b'], currentIndex: 3 });
    });

    it('adjusts the current index when items are removed', () => {
        expect(removeQueueItem(queue, 2, 0)).toEqual({ queue: ['b', 'c', 'd'], currentIndex: 1, removedCurrent: false });
        expect(removeQueueItem(queue, 3, 3)).toEqual({ queue: ['a', 'b', 'c'], currentIndex: 2, removedCurrent: true });
        expect(removeQueueItem(['a'], 0, 0)).toEqual({ queue: [], currentIndex: 0, removedCurrent: true });
    });
});

describe('next song selection', () => {
    it('selects loop, random, and single-mode indices', () => {
        expect(getNextIndex(3, 2, 'loop', false)).toBe(0);
        expect(getNextIndex(3, 1, 'random', false, () => 0.8)).toBe(2);
        expect(getNextIndex(3, 1, 'single', true)).toBe(1);
        expect(getNextIndex(3, 1, 'single', false)).toBe(2);
        expect(getNextIndex(0, 0, 'loop', false)).toBeNull();
    });
});

describe('stable playback order', () => {
    const items = ['a', 'b', 'c', 'd'].map(queueItem);

    it('shuffles without mutating or dropping values', () => {
        const source = ['a', 'b', 'c', 'd'];
        const shuffled = fisherYates(source, () => 0);
        expect(source).toEqual(['a', 'b', 'c', 'd']);
        expect([...shuffled].sort()).toEqual(source);
    });

    it('creates distinct runtime UUIDs for duplicate queue entries', () => {
        const first = createQueueItemId();
        const second = createQueueItemId();
        expect(first).not.toBe(second);
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$|^queue-/i);
    });

    it('keeps the current item first and shuffles only the future', () => {
        const order = buildPlayOrder(items, 'b', true, null, () => 0);
        expect(order[0]).toBe('b');
        expect(new Set(order)).toEqual(new Set(['a', 'b', 'c', 'd']));
    });

    it('consumes priority-next in FIFO order', () => {
        const navigation = getNextQueueItem(items, ['a', 'b', 'c', 'd'], 'a', ['d', 'c'], true, 'all');
        expect(navigation.nextQueueItemId).toBe('d');
    });

    it('uses real history before the effective order', () => {
        expect(getPreviousQueueItemId(['a', 'd'], items, ['a', 'b', 'c', 'd'], 'c')).toBe('d');
    });
});
