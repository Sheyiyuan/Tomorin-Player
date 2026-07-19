import { describe, expect, it } from 'vitest';
import { getNextIndex, removeQueueItem, reorderQueue } from './player';

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
