import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSetting } from '../../types';
import { useSettingsPersistence } from './useSettingsPersistence';

const serviceMocks = vi.hoisted(() => ({
    savePlayerSetting: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    SavePlayerSetting: serviceMocks.savePlayerSetting,
}));

const initialSetting: PlayerSetting = {
    id: 1,
    config: {
        currentThemeId: 'light',
        themes: '[{"id":"custom"}]',
        futureOption: true,
    },
    updatedAt: '',
};

describe('useSettingsPersistence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        serviceMocks.savePlayerSetting.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not auto-save theme changes and merges the latest theme id into later setting writes', async () => {
        const skipPersistRef = { current: false };
        const { result, rerender } = renderHook(
            ({ currentThemeId, volume }: { currentThemeId: string; volume: number }) => {
                const [setting, setSetting] = useState<PlayerSetting>(initialSetting);
                const persistence = useSettingsPersistence({
                    setting,
                    playMode: 'loop',
                    volume,
                    currentThemeId,
                    setSetting,
                    skipPersistRef,
                });
                return persistence;
            },
            { initialProps: { currentThemeId: 'light', volume: 0.5 } },
        );
        result.current.settingsLoadedRef.current = true;

        rerender({ currentThemeId: 'custom', volume: 0.5 });
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(serviceMocks.savePlayerSetting).not.toHaveBeenCalled();

        rerender({ currentThemeId: 'custom', volume: 0.7 });
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(serviceMocks.savePlayerSetting).toHaveBeenCalledTimes(1);
        expect(serviceMocks.savePlayerSetting).toHaveBeenCalledWith(expect.objectContaining({
            config: expect.objectContaining({
                currentThemeId: 'custom',
                defaultVolume: 0.7,
                futureOption: true,
            }),
        }));
        const savedSetting = serviceMocks.savePlayerSetting.mock.calls[0][0] as PlayerSetting;
        expect(savedSetting.config).not.toHaveProperty('themes');
        expect(savedSetting.config).not.toHaveProperty('themeColor');
    });
});
