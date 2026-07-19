import { describe, expect, it, vi } from 'vitest';
import type { Theme } from '../../types';
import { persistThemeSelection } from './useThemeEditor';

const serviceMocks = vi.hoisted(() => ({
    setCurrentTheme: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    SetCurrentTheme: serviceMocks.setCurrentTheme,
}));

const theme: Theme = {
    id: 'custom-theme',
    name: 'Custom',
    data: '{}',
    isDefault: false,
    isReadOnly: false,
};

describe('persistThemeSelection', () => {
    it('applies a theme only after backend persistence succeeds', async () => {
        const applyTheme = vi.fn();
        serviceMocks.setCurrentTheme.mockResolvedValue(undefined);

        await persistThemeSelection(theme, applyTheme);

        expect(serviceMocks.setCurrentTheme).toHaveBeenCalledWith(theme.id);
        expect(applyTheme).toHaveBeenCalledWith(theme);
        expect(serviceMocks.setCurrentTheme.mock.invocationCallOrder[0])
            .toBeLessThan(applyTheme.mock.invocationCallOrder[0]);
    });

    it('does not apply a theme when backend persistence fails', async () => {
        const applyTheme = vi.fn();
        serviceMocks.setCurrentTheme.mockRejectedValue(new Error('save failed'));

        await expect(persistThemeSelection(theme, applyTheme)).rejects.toThrow('save failed');
        expect(applyTheme).not.toHaveBeenCalled();
    });
});
