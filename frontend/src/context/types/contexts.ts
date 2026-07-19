/**
 * Context 类型定义
 * 定义各个 Context 的状态结构和操作接口
 */

import type { Dispatch, SetStateAction } from 'react';
import { Song, Favorite, Theme, PlayerSetting, LyricMapping } from '../../types';

export type PlayMode = 'loop' | 'random' | 'single';

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
    playMode: PlayMode;
}

export interface PlayerActions {
    // 队列控制
    setQueue: Dispatch<SetStateAction<Song[]>>;
    setCurrentIndex: (index: number) => void;
    setPlaylistHydrated: (hydrated: boolean) => void;

    // 状态更新
    setSong: (song: Song | null) => void;
    setIsPlaying: (playing: boolean) => void;
    setProgress: (progress: number) => void;
    setDuration: (duration: number) => void;

    // 控制设置
    setVolume: (volume: number) => void;
    setPlayMode: (mode: ControlsState['playMode']) => void;
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
    setThemes: (themes: Theme[]) => void;
    applyTheme: (theme: Theme) => void;
}

export interface ThemeContextValue {
    theme: ThemeInfo;
    colors: ColorConfig;
    effects: EffectsConfig;
    layout: LayoutConfig;
    actions: ThemeActions;
}

// ========== UI Context 类型 ==========
export const MODAL_NAMES = [
    'loginModal',
    'settingsModal',
    'playlistModal',
    'themeManagerModal',
    'themeEditorModal',
    'themeDetailModal',
    'globalSearchModal',
    'bvAddModal',
    'createFavModal',
    'editFavModal',
    'addFavoriteModal',
    'downloadManagerModal',
    'exitConfirmModal',
] as const;

export type ModalName = typeof MODAL_NAMES[number];
export type ModalState = Record<ModalName, boolean>;

export interface UIActions {
    openModal: (name: ModalName) => void;
    closeModal: (name: ModalName) => void;
}

export interface UIContextValue {
    modals: ModalState;
    actions: UIActions;
}

// ========== 数据 Context 类型 ==========
export interface CoreData {
    songs: Song[];
    favorites: Favorite[];
    selectedFavId: string | null;
}

export interface SettingsData {
    playerSetting: PlayerSetting | null;
    lyricMapping: LyricMapping | null;
}

export interface DataActions {
    // 核心数据操作
    setSongs: Dispatch<SetStateAction<Song[]>>;
    setFavorites: Dispatch<SetStateAction<Favorite[]>>;
    setSelectedFavId: (favId: string | null) => void;
    // 设置操作
    setSetting: (setting: PlayerSetting | null) => void;
    setLyricMapping: (mapping: LyricMapping | null) => void;
}

export interface DataContextValue {
    data: CoreData;
    settings: SettingsData;
    actions: DataActions;
}
