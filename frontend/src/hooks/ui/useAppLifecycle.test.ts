import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Theme } from '../../types';
import { DEFAULT_THEMES } from '../../utils/constants';
import { refreshThemeProxyUrl, useAppLifecycle } from './useAppLifecycle';

const serviceMocks = vi.hoisted(() => ({
    getThemes: vi.fn(),
    getPlayerSetting: vi.fn(),
    isLoggedIn: vi.fn(),
    seed: vi.fn(),
	listSongs: vi.fn(),
	listFavoriteSummaries: vi.fn(),
	getSongsByIDs: vi.fn(),
    getPlaylist: vi.fn(),
    getPlayHistory: vi.fn(),
	refreshProxyURL: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    GetThemes: serviceMocks.getThemes,
    GetPlayerSetting: serviceMocks.getPlayerSetting,
    IsLoggedIn: serviceMocks.isLoggedIn,
    Seed: serviceMocks.seed,
	ListSongs: serviceMocks.listSongs,
	ListFavoriteSummaries: serviceMocks.listFavoriteSummaries,
	GetSongsByIDs: serviceMocks.getSongsByIDs,
    GetPlaylist: serviceMocks.getPlaylist,
    GetPlayHistory: serviceMocks.getPlayHistory,
	RefreshProxyURL: serviceMocks.refreshProxyURL,
}));
vi.mock('../../utils/wails', () => ({
    waitForWailsRuntime: vi.fn().mockResolvedValue(undefined),
}));

describe('useAppLifecycle theme hydration', () => {
	it('refreshes a persisted local theme image while preserving its empty source URL', async () => {
		const oldProxy = 'http://127.0.0.1:1234/theme-image?token=old';
		const currentProxy = 'http://127.0.0.1:5678/theme-image?token=current';
		const theme: Theme = {
			id: 'local-image',
			name: 'Local image',
			backgroundImage: oldProxy,
			backgroundImageSourceUrl: '',
			data: JSON.stringify({ backgroundImage: oldProxy, backgroundImageSourceUrl: '' }),
			isDefault: false,
			isReadOnly: false,
		};
		serviceMocks.refreshProxyURL.mockResolvedValue(currentProxy);

		const refreshed = await refreshThemeProxyUrl(theme);

		expect(serviceMocks.refreshProxyURL).toHaveBeenCalledWith(oldProxy);
		expect(refreshed.backgroundImage).toBe(currentProxy);
		expect(refreshed.backgroundImageSourceUrl).toBe('');
		expect(JSON.parse(refreshed.data || '{}')).toMatchObject({
			backgroundImage: currentProxy,
			backgroundImageSourceUrl: '',
		});
	});

    it('treats an empty backend theme list as authoritative', async () => {
        localStorage.setItem('half-beat.customThemes', JSON.stringify([{
            id: 'deleted-theme',
            name: 'Deleted',
            data: '{}',
            isDefault: false,
            isReadOnly: false,
        }]));
        serviceMocks.getThemes.mockResolvedValue([]);
        serviceMocks.getPlayerSetting.mockResolvedValue({
            id: 1,
            config: { currentThemeId: 'light', defaultVolume: 0.5, playMode: 'loop' },
            updatedAt: '',
        });
        serviceMocks.isLoggedIn.mockResolvedValue(false);
        serviceMocks.seed.mockResolvedValue(undefined);
        serviceMocks.listSongs.mockResolvedValue([]);
		serviceMocks.listFavoriteSummaries.mockResolvedValue([]);
		serviceMocks.getSongsByIDs.mockResolvedValue([]);
        serviceMocks.getPlaylist.mockResolvedValue({ queue: '[]', currentIndex: 0 });
        serviceMocks.getPlayHistory.mockResolvedValue({});

        const setThemes = vi.fn();
        const saveCachedCustomThemes = vi.fn();
        const settingsLoadedRef = { current: false };
        const skipPersistRef = { current: false };
        renderHook(() => useAppLifecycle({
            setUserInfo: vi.fn(),
            saveCachedCustomThemes,
            setSetting: vi.fn(),
            setVolume: vi.fn(),
            setPlayMode: vi.fn(),
            setThemes,
            applyThemeToUi: vi.fn(),
            settingsLoadedRef,
            modalsSettingsModal: false,
            setCacheSize: vi.fn(),
            setStatus: vi.fn(),
            setSongs: vi.fn(),
            setFavorites: vi.fn(),
            setQueue: vi.fn(),
            setCurrentIndex: vi.fn(),
            setPlaylistHydrated: vi.fn(),
            setCurrentSong: vi.fn(),
            setSelectedFavId: vi.fn(),
            skipPersistRef,
        }));

		await waitFor(() => expect(saveCachedCustomThemes).toHaveBeenCalledWith([]));
		expect(serviceMocks.listFavoriteSummaries).toHaveBeenCalled();
		expect(serviceMocks.listSongs).not.toHaveBeenCalled();
        const lastThemes = setThemes.mock.calls.at(-1)?.[0];
        expect(lastThemes).toHaveLength(DEFAULT_THEMES.length);
        expect(lastThemes).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'deleted-theme' }),
        ]));
    });
});
