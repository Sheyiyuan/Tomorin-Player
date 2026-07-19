import { describe, expect, it } from 'vitest';
import { mergePlayerSetting } from './types';

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
