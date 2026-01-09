/**
 * 播放器状态选择器 Hook
 * 提供细粒度的状态订阅，减少不必要的重新渲染
 */

import { usePlayerContext } from '../contexts/PlayerContext';
import { PlayerContextValue } from '../types/contexts';

// ========== 基础选择器 Hook ==========
export const usePlayerStore = <T = PlayerContextValue>(
    selector?: (state: PlayerContextValue) => T
): T => {
    const context = usePlayerContext();

    if (selector) {
        return selector(context);
    }

    return context as T;
};

// ========== 便捷选择器 Hooks ==========

// 播放状态选择器
export const usePlayback = () => usePlayerStore(state => state.playback);
export const useCurrentSong = () => usePlayerStore(state => state.playback.currentSong);
export const useIsPlaying = () => usePlayerStore(state => state.playback.isPlaying);
export const useProgress = () => usePlayerStore(state => state.playback.progress);
export const useDuration = () => usePlayerStore(state => state.playback.duration);

// 队列选择器
export const useQueue = () => usePlayerStore(state => state.queue);
export const useQueueSongs = () => usePlayerStore(state => state.queue.songs);
export const useCurrentIndex = () => usePlayerStore(state => state.queue.currentIndex);

// 控制选择器
export const useControls = () => usePlayerStore(state => state.controls);
export const useVolume = () => usePlayerStore(state => state.controls.volume);
export const usePlayMode = () => usePlayerStore(state => state.controls.playMode);
export const useSkipSettings = () => usePlayerStore(state => ({
    skipStartTime: state.controls.skipStartTime,
    skipEndTime: state.controls.skipEndTime,
    skipEnabled: state.controls.skipEnabled,
}));

// 操作选择器
export const usePlayerActions = () => usePlayerStore(state => state.actions);

// 组合选择器（用于需要多个状态的组件）
export const usePlayerStatus = () => usePlayerStore(state => ({
    currentSong: state.playback.currentSong,
    isPlaying: state.playback.isPlaying,
    progress: state.playback.progress,
    duration: state.playback.duration,
}));

export const useQueueStatus = () => usePlayerStore(state => ({
    songs: state.queue.songs,
    currentIndex: state.queue.currentIndex,
    currentSong: state.playback.currentSong,
}));

export const usePlayerControls = () => usePlayerStore(state => ({
    volume: state.controls.volume,
    playMode: state.controls.playMode,
    actions: {
        play: state.actions.play,
        pause: state.actions.pause,
        togglePlay: state.actions.togglePlay,
        nextSong: state.actions.nextSong,
        prevSong: state.actions.prevSong,
        setVolume: state.actions.setVolume,
        setPlayMode: state.actions.setPlayMode,
    },
}));