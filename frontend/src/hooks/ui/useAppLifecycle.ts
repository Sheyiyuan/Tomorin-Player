import { useEffect } from "react";
import type { MutableRefObject } from "react";
import * as Services from "../../../wailsjs/go/services/Service";
import { DEFAULT_THEMES } from "../../utils/constants";
import type { Theme, Favorite, Song, UserInfo, PlayerSetting } from "../../types";
import { convertSongs, convertFavorites, convertThemes, convertPlayerSetting, convertUserInfo } from "../../types";
import type { PlayMode } from "../../context/types/contexts";
import { waitForWailsRuntime } from "../../utils/wails";

interface UseAppLifecycleParams {
    setUserInfo: (u: UserInfo | null) => void;
    saveCachedCustomThemes: (themes: Theme[]) => void;
    setSetting: (s: PlayerSetting | null) => void;
    setVolume: (v: number) => void;
    setPlayMode: (v: PlayMode) => void;
    setShuffleEnabled?: (v: boolean) => void;
    setRepeatMode?: (v: 'all' | 'one') => void;
    setThemes: (t: Theme[]) => void;
    applyThemeToUi: (theme: Theme) => void;
    settingsLoadedRef: MutableRefObject<boolean>;
    modalsSettingsModal: boolean;
    setCacheSize: (v: number) => void;
    setStatus: (v: string) => void;
    setSongs: (list: Song[]) => void;
    setFavorites: (list: Favorite[]) => void;
    setQueue: (list: Song[]) => void;
    setCurrentIndex: (idx: number) => void;
    setPlaylistHydrated: (hydrated: boolean) => void;
    setCurrentSong: (song: Song | null) => void;
    setSelectedFavId: (id: string | null) => void;
    skipPersistRef: MutableRefObject<boolean>;
}

export const useAppLifecycle = ({
    setUserInfo,
    saveCachedCustomThemes,
    setSetting,
    setVolume,
    setPlayMode,
    setShuffleEnabled,
    setRepeatMode,
    setThemes,
    applyThemeToUi,
    settingsLoadedRef,
    modalsSettingsModal,
    setCacheSize,
    setStatus,
    setSongs,
    setFavorites,
    setQueue,
    setCurrentIndex,
    setPlaylistHydrated,
    setCurrentSong,
    setSelectedFavId,
    skipPersistRef,
}: UseAppLifecycleParams) => {
    // 初始设置和主题加载
    useEffect(() => {
        // 跳过初始化期间的持久化，等待设置加载完成
        skipPersistRef.current = true;

        const loadCachedCustomThemes = (): Theme[] => {
            try {
                const saved = localStorage.getItem('half-beat.customThemes');
                if (!saved) return [];
                const parsed = JSON.parse(saved);
                if (!Array.isArray(parsed)) return [];
                return convertThemes(parsed);
            } catch (e) {
                console.warn('读取自定义主题缓存失败:', e);
                return [];
            }
        };

        // 等待 Wails 运行时初始化完成
        const runInitialization = async () => {
            try {
                // 最多等待 5 秒 Wails 初始化
                await waitForWailsRuntime(50, 100);
            } catch (err) {
                console.error('[useAppLifecycle] Wails 初始化超时:', err);
                settingsLoadedRef.current = true;
                return;
            }

            // 先加载本地主题缓存，避免后端主题加载慢/失败导致自定义主题丢失
            const cachedCustomThemes = await Promise.all(loadCachedCustomThemes().map(refreshThemeProxyUrl));
            if (cachedCustomThemes.length > 0) {
                const cachedAllThemes = [...DEFAULT_THEMES, ...cachedCustomThemes];
                setThemes(cachedAllThemes);

                // 尽早应用当前主题（如果本地有记录且能命中）
                const cachedThemeId = localStorage.getItem('half-beat.currentThemeId');
                const cachedTarget = cachedThemeId ? cachedAllThemes.find(t => t.id === cachedThemeId) : null;
                if (cachedTarget) {
                    applyThemeToUi(cachedTarget);
                }
            }

            localStorage.removeItem("half-beat.proxyBaseUrl");

            try {
                const cachedUserInfo = localStorage.getItem("half-beat.userInfo");
                if (cachedUserInfo) {
                    setUserInfo(JSON.parse(cachedUserInfo));
                }
            } catch (e) {
                console.warn("恢复用户信息失败:", e);
            }

            const themesPromise = Services.GetThemes();

            Promise.all([Services.GetPlayerSetting(), themesPromise])
                .then(async ([s, customThemesList]) => {
                    const backendCustomThemes = await Promise.all(convertThemes(customThemesList || []).map(refreshThemeProxyUrl));

                    // GetThemes 成功后后端是权威数据源；空列表也代表用户已删除全部自定义主题。
                    saveCachedCustomThemes(backendCustomThemes);
                    const effectiveCustomThemes = backendCustomThemes;
                    const playerSetting = convertPlayerSetting(s);
                    setSetting(playerSetting);
                    const defaultVolume = playerSetting.config.defaultVolume;
                    setVolume(typeof defaultVolume === 'number' ? defaultVolume : 0.5);

                    // 验证并设置播放模式，移除旧的 "order" 模式
                    const validModes = ['loop', 'random', 'single'];
                    const savedMode = playerSetting.config.playMode;
                    const mode: PlayMode = typeof savedMode === 'string' && validModes.includes(savedMode)
                        ? savedMode as PlayMode
                        : 'loop';
                    setPlayMode(mode);
                    const savedShuffle = playerSetting.config.shuffleEnabled;
                    const savedRepeat = playerSetting.config.repeatMode;
                    setShuffleEnabled?.(typeof savedShuffle === 'boolean' ? savedShuffle : mode === 'random');
                    setRepeatMode?.(savedRepeat === 'one' || savedRepeat === 'all'
                        ? savedRepeat
                        : mode === 'single' ? 'one' : 'all');

                    const allThemes = [...DEFAULT_THEMES, ...effectiveCustomThemes];
                    setThemes(allThemes);

                    // 优先从后端配置获取当前主题 ID，如果没有则尝试从 localStorage 获取
                    const configuredThemeId = playerSetting.config.currentThemeId;
                    const preferredThemeId = typeof configuredThemeId === 'string'
                        ? configuredThemeId
                        : localStorage.getItem('half-beat.currentThemeId') || "light";
                    const targetTheme = allThemes.find((t: Theme) => t.id === preferredThemeId) || allThemes[0] || DEFAULT_THEMES[0];

                    // 如果后端记录的主题不存在（例如旧的自定义主题被删除），回退到默认主题并更新后端设置
                    if (targetTheme.id !== preferredThemeId) {
                        Services.SetCurrentTheme(targetTheme.id).catch((err) => console.warn("SetCurrentTheme fallback failed", err));
                    }

                    // 应用主题到 UI（同步所有字段）
                    applyThemeToUi(targetTheme);

                    // 设置加载完成，允许后续持久化
                    skipPersistRef.current = false;
                    settingsLoadedRef.current = true;
                })
                .catch((e) => {
                    console.warn("加载设置失败", e);
                    skipPersistRef.current = false;
                    settingsLoadedRef.current = true;
                });
        };

        // 异步执行初始化
        runInitialization();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 设置弹窗打开时刷新缓存大小
    useEffect(() => {
        if (modalsSettingsModal) {
            (async () => {
                try {
                    const size = await Services.GetAudioCacheSize();
                    setCacheSize(size);
                } catch (e) {
                    console.warn("获取缓存大小失败", e);
                }
            })();
        }
    }, [modalsSettingsModal, setCacheSize]);

    // 初始化数据、登录、Seed、播放列表/历史恢复
    useEffect(() => {
        (async () => {
            try {
                // 等待 Wails 运行时准备好
                await waitForWailsRuntime(50, 100);

                setStatus("正在加载...");

                const loggedIn = await Services.IsLoggedIn();
                // 仅记录登陆状态，不自动弹出登陆模态框
                // 需要登陆时由具体功能模块在操作时主动弹出
                if (loggedIn) {
                    try {
                        const info = await Services.GetUserInfo();
                        const user = convertUserInfo(info);
                        setUserInfo(user);
                        localStorage.setItem("half-beat.userInfo", JSON.stringify(user));
                    } catch (e) {
                        console.warn("获取用户信息失败:", e);
                    }
                }

                try {
                    await Services.Seed();
                } catch (seedErr) {
                    console.warn("Seed 失败", seedErr);
                }

                const [songList, favList] = await Promise.all([
                    Services.ListSongs(),
                    Services.ListFavorites(),
                ]);

                const songsWithCache = convertSongs(songList).map((song) => {
                    try {
                        const cacheKey = `half-beat.song.${song.id}`;
                        const cached = localStorage.getItem(cacheKey);
                        if (cached) {
                            const cacheData = JSON.parse(cached);
                            return {
                                ...song,
                                skipStartTime: cacheData.skipStartTime ?? song.skipStartTime,
                                skipEndTime: cacheData.skipEndTime ?? song.skipEndTime,
                            };
                        }
                    } catch (err) {
                        console.warn(`恢复歌曲 ${song.id} 缓存失败:`, err);
                    }
                    return song;
                });

                setSongs(convertSongs(songsWithCache));
                setFavorites(convertFavorites(favList));

                try {
                    const savedPlaylist = await Services.GetPlaylist();
                    if (savedPlaylist && savedPlaylist.queue) {
                        const queueIds = JSON.parse(savedPlaylist.queue || "[]");
                        if (queueIds.length > 0) {
                            const restoredQueue = queueIds
                                .map((id: string) => songsWithCache.find((s) => s.id === id))
                                .filter(Boolean) as Song[];

                            if (restoredQueue.length > 0) {
                                setQueue(restoredQueue);
                                const validIndex = Math.min(savedPlaylist.currentIndex || 0, restoredQueue.length - 1);
                                setCurrentIndex(validIndex);
                                setCurrentSong(restoredQueue[validIndex]);
                                setStatus("播放列表已恢复");
                                return;
                            }
                        }
                    }
                } catch (playlistErr) {
                    console.warn("恢复播放列表失败", playlistErr);
                }

                try {
                    const history = await Services.GetPlayHistory();
                    if (history && history.songId) {
                        const lastSong = songsWithCache.find((s) => s.id === history.songId);
                        if (lastSong) {
                            if (history.favoriteId) {
                                const favIdx = favList.findIndex((f) => f.id === history.favoriteId);
                                if (favIdx >= 0) {
                                    setSelectedFavId(history.favoriteId);
                                }
                            }
                            const songIdx = songsWithCache.findIndex((s) => s.id === history.songId);
                            if (songIdx >= 0) {
                                setQueue(songsWithCache);
                                setCurrentIndex(songIdx);
                                setCurrentSong(lastSong);
                                return;
                            }
                        }
                    }
                } catch (historyErr) {
                    console.warn("恢复播放历史失败", historyErr);
                }

                if (songsWithCache.length) {
                    setQueue(songsWithCache);
                    setCurrentIndex(0);
                    setCurrentSong(songsWithCache[0]);
                }
                setStatus(songsWithCache.length ? "就绪" : "请添加歌曲");
            } catch (e: unknown) {
                console.error(e);
                setStatus(`错误: ${e instanceof Error ? e.message : String(e)}`);
            } finally {
                setPlaylistHydrated(true);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
};

export const refreshThemeProxyUrl = async (theme: Theme): Promise<Theme> => {
    const current = theme.backgroundImage || '';
    if (!isLoopbackProxyUrl(current)) return theme;

    try {
        const refreshed = await Services.RefreshProxyURL(current);
        if (!refreshed) return { ...theme, backgroundImage: '' };

        let data = theme.data;
        if (data) {
            try {
                const parsed = JSON.parse(data) as Record<string, unknown>;
                parsed.backgroundImage = refreshed;
                data = JSON.stringify(parsed);
            } catch {
                // Keep malformed legacy data unchanged; the expanded field is still usable.
            }
        }
        return { ...theme, data, backgroundImage: refreshed };
    } catch {
        return { ...theme, backgroundImage: '' };
    }
};

const isLoopbackProxyUrl = (value: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' && url.hostname === '127.0.0.1' &&
            ['/image', '/theme-image', '/audio', '/local'].includes(url.pathname);
    } catch {
        return false;
    }
};
