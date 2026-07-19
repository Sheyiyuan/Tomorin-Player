/**
 * 播放器 Context
 * 管理播放器相关的所有状态：播放状态、队列、控制设置
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import {
    PlayerContextValue,
    PlaybackState,
    QueueState,
    ControlsState,
    PlayerActions,
} from '../types/contexts';
import { Song } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ========== 播放状态 ==========
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // ========== 队列状态 ==========
    const [songs, setSongs] = useState<Song[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playlistHydrated, setPlaylistHydrated] = useState(false);

    // ========== 控制状态 ==========
    const [volume, setVolume] = useState(0.5);
    const [playMode, setPlayMode] = useState<ControlsState['playMode']>('loop');
    // ========== 队列控制操作 ==========
    const setQueue = useCallback<React.Dispatch<React.SetStateAction<Song[]>>>((nextQueue) => {
        setSongs(nextQueue);
    }, []);

    const setCurrentIndexSafe = useCallback((index: number) => {
        setCurrentIndex(Math.max(0, index));
    }, []);

    useEffect(() => {
        if (!playlistHydrated) return;

        const queueJSON = JSON.stringify(songs.map((song) => song.id));
        const persistedIndex = songs.length === 0 ? 0 : Math.min(currentIndex, songs.length - 1);
        Services.SavePlaylist(queueJSON, persistedIndex)
            .catch((error) => console.warn('保存播放列表失败', error));
    }, [songs, currentIndex, playlistHydrated]);

    // ========== 稳定的 Actions 对象 ==========
    const actions: PlayerActions = useMemo(() => ({
        // 队列控制
        setQueue,
        setCurrentIndex: setCurrentIndexSafe,
        setPlaylistHydrated,

        // 状态更新
        setSong: setCurrentSong,
        setIsPlaying,
        setProgress,
        setDuration,

        // 控制设置
        setVolume,
        setPlayMode,
    }), [
        setQueue, setCurrentIndexSafe,
    ]);

    // ========== 状态对象 ==========
    const playback: PlaybackState = useMemo(() => ({
        currentSong,
        isPlaying,
        progress,
        duration,
    }), [currentSong, isPlaying, progress, duration]);

    const queue: QueueState = useMemo(() => ({
        songs,
        currentIndex,
    }), [songs, currentIndex]);

    const controls: ControlsState = useMemo(() => ({
        volume,
        playMode,
    }), [volume, playMode]);

    // ========== Context Value ==========
    const contextValue: PlayerContextValue = useMemo(() => ({
        playback,
        queue,
        controls,
        actions,
    }), [playback, queue, controls, actions]);

    return (
        <PlayerContext.Provider value={contextValue}>
            {children}
        </PlayerContext.Provider>
    );
};

// ========== Hook ==========
export const usePlayerContext = (): PlayerContextValue => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayerContext must be used within PlayerProvider');
    }
    return context;
};

export default PlayerContext;
