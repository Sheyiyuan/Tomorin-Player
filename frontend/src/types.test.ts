import { describe, expect, it } from 'vitest';
import { convertBiliFavoriteImportTask, convertPlaylistSyncProgress, convertPlaylistSyncRun, mergePlayerSetting } from './types';

describe('mergePlayerSetting', () => {
    it('preserves unknown configuration fields', () => {
        const merged = mergePlayerSetting({
            id: 1,
            config: { futureOption: { enabled: true }, defaultVolume: 0.5 },
            updatedAt: '',
        }, { defaultVolume: 0.8 });

        expect(merged.config).toMatchObject({
            futureOption: { enabled: true },
            defaultVolume: 0.8,
        });
    });
});

describe('convertPlaylistSyncRun', () => {
	it('converts skipped counts and defaults old exported runs to zero', () => {
		expect(convertPlaylistSyncRun({ skippedCount: 2 }).skippedCount).toBe(2);
		expect(convertPlaylistSyncRun({}).skippedCount).toBe(0);
	});
});

describe('playlist task conversion', () => {
	it('normalizes real progress and asynchronous import results', () => {
		expect(convertPlaylistSyncProgress({ stage: 'resolving', completedVideoCount: 2, totalVideoCount: 4, skippedCount: 1 })).toEqual({
			stage: 'resolving', favoriteId: undefined, completedVideoCount: 2, totalVideoCount: 4, skippedCount: 1,
		});
		const task = convertBiliFavoriteImportTask({
			id: 'task', status: 'succeeded', progress: { stage: 'completed', completedVideoCount: 4, totalVideoCount: 4 },
			result: { favorite: { id: 'favorite', songIds: [] }, syncStatus: {} },
		});
		expect(task.status).toBe('succeeded');
		expect(task.result?.favorite.id).toBe('favorite');
	});
});
