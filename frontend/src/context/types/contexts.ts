/**
 * Context 类型定义
 * 定义各个 Context 的状态结构和操作接口
 */

import { Song, Favorite, Theme, UserInfo, PlayerSetting, LyricMapping } from '../../types';

// ========== 播放器 Context 类型 ==========
export interface PlaybackState {
    currentSong: Song | null;
    isPlaying: boolean;
    progress: number;
    duration: number;
}

export interface QueueState {
    songs: Song[];
    currentIndex: number;
}

export interface ControlsState {
    volume: number;
    playMode: 'loop-all' | 'loop-one' | 'shuffle' | 'no-loop';
    skipStartTime: number;
    skipEndTime: number;
    skipEnabled: boolean;
}

export interface PlayerActions {
    // 播放控制
    play: () => void;
    pause: () => void;
    togglePlay: () => void;
    seek: (time: number) => void;

    // 队列控制
    setQueue: (songs: Song[]) => void;
    setCurrentIndex: (index: number) => void;
    nextSong: () => void;
    prevSong: () => void;

    // 状态更新
    setSong: (song: Song | null) => void;
    setIsPlaying: (playing: boolean) => void;
    setProgress: (progress: number) => void;
    setDuration: (duration: number) => void;

    // 控制设置
    setVolume: (volume: number) => void;
    setPlayMode: (mode: ControlsState['playMode']) => void;
    setSkipStartTime: (time: number) => void;
    setSkipEndTime: (time: number) => void;
    setSkipEnabled: (enabled: boolean) => void;
}

export interface PlayerContextValue {
    playback: PlaybackState;
    queue: QueueState;
    controls: ControlsState;
    actions: PlayerActions;
}

// ========== 主题 Context 类型 ==========
export interface ThemeInfo {
    themes: Theme[];
    currentThemeId: string | null;
    colorScheme: 'light' | 'dark';
}

export interface ColorConfig {
    themeColor: string;
    backgroundColor: string;
    panelColor: string;
    controlColor: string;
    textColorPrimary: string;
    textColorSecondary: string;
    favoriteCardColor: string;
    modalColor: string;
}

export interface EffectsConfig {
    backgroundOpacity: number;
    backgroundImageUrl: string;
    backgroundBlur: number;
    panelOpacity: number;
    panelBlur: number;
    controlOpacity: number;
    controlBlur: number;
    cardOpacity: number;
    modalOpacity: number;
    modalBlur: number;
}

export interface LayoutConfig {
    panelRadius: number;
    componentRadius: number;
    modalRadius: number;
    notificationRadius: number;
    coverRadius: number;
    windowControlsPos: 'left' | 'right' | 'hidden';
}

export interface ThemeActions {
    // 主题管理
    setThemes: (themes: Theme[]) => void;
    setCurrentThemeId: (id: string | null) => void;
    applyTheme: (theme: Theme) => void;

    // 颜色设置
    setThemeColor: (color: string) => void;
    setColorScheme: (scheme: 'light' | 'dark') => void;
    setBackgroundColor: (color: string) => void;
    setPanelColor: (color: string) => void;
    setControlColor: (color: string) => void;
    setTextColorPrimary: (color: string) => void;
    setTextColorSecondary: (color: string) => void;
    setFavoriteCardColor: (color: string) => void;
    setModalColor: (color: string) => void;

    // 效果设置
    setBackgroundOpacity: (opacity: number) => void;
    setBackgroundImageUrl: (url: string) => void;
    setBackgroundBlur: (blur: number) => void;
    setPanelOpacity: (opacity: number) => void;
    setPanelBlur: (blur: number) => void;
    setControlOpacity: (opacity: number) => void;
    setControlBlur: (blur: number) => void;
    setCardOpacity: (opacity: number) => void;
    setModalOpacity: (opacity: number) => void;
    setModalBlur: (blur: number) => void;

    // 布局设置
    setPanelRadius: (radius: number) => void;
    setComponentRadius: (radius: number) => void;
    setModalRadius: (radius: number) => void;
    setNotificationRadius: (radius: number) => void;
    setCoverRadius: (radius: number) => void;
    setWindowControlsPos: (pos: LayoutConfig['windowControlsPos']) => void;
}

export interface ThemeContextValue {
    theme: ThemeInfo;
    colors: ColorConfig;
    effects: EffectsConfig;
    layout: LayoutConfig;
    actions: ThemeActions;
}

// ========== UI Context 类型 ==========
export interface ModalState {
    [key: string]: boolean;
}

export interface SearchState {
    query: string;
    globalTerm: string;
    results: Song[];
}

export interface AppState {
    status: string;
    isLoading: boolean;
    errorMessage: string | null;
    userInfo: UserInfo | null;
}

export interface UIActions {
    // 模态框控制
    openModal: (name: string) => void;
    closeModal: (name: string) => void;

    // 搜索控制
    setSearchQuery: (query: string) => void;
    setGlobalSearchTerm: (term: string) => void;
    setGlobalSearchResults: (results: Song[]) => void;

    // 应用状态
    setStatus: (status: string) => void;
    setIsLoading: (loading: boolean) => void;
    setErrorMessage: (message: string | null) => void;
    setUserInfo: (userInfo: UserInfo | null) => void;
}

export interface UIContextValue {
    modals: ModalState;
    search: SearchState;
    app: AppState;
    actions: UIActions;
}

// ========== 数据 Context 类型 ==========
export interface CoreData {
    songs: Song[];
    favorites: Favorite[];
    selectedFavId: string | null;
}

export interface CacheData {
    songs: Map<string, Song>;
    covers: Map<string, string>;
}

export interface SettingsData {
    playerSetting: PlayerSetting | null;
    lyricMapping: LyricMapping | null;
}

export interface DataActions {
    // 核心数据操作
    setSongs: (songs: Song[]) => void;
    setFavorites: (favorites: Favorite[]) => void;
    setSelectedFavId: (favId: string | null) => void;
    addSong: (song: Song) => void;
    removeSong: (songId: string) => void;
    updateSong: (songId: string, updates: Partial<Song>) => void;
    addFavorite: (favorite: Favorite) => void;
    removeFavorite: (favId: string) => void;
    updateFavorite: (favId: string, updates: Partial<Favorite>) => void;

    // 缓存操作
    setCachedSong: (songId: string, song: Song) => void;
    getCachedSong: (songId: string) => Song | undefined;
    setCachedCover: (url: string, base64: string) => void;
    getCachedCover: (url: string) => string | undefined;
    clearSongCache: () => void;
    clearCoverCache: () => void;

    // 设置操作
    setSetting: (setting: PlayerSetting | null) => void;
    setLyricMapping: (mapping: LyricMapping | null) => void;
}

export interface DataContextValue {
    data: CoreData;
    cache: CacheData;
    settings: SettingsData;
    actions: DataActions;
}