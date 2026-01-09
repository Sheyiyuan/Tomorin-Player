/**
 * 播放器 Context
 * 管理播放器相关的所有状态：播放状态、队列、控制设置
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    PlayerContextValue,
    PlaybackState,
    QueueState,
    ControlsState,
    PlayerActions,
} from '../types/contexts';
import { Song } from '../../types';

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

    // ========== 控制状态 ==========
    const [volume, setVolume] = useState(1);
    const [playMode, setPlayMode] = useState<ControlsState['playMode']>('loop-all');
    const [skipStartTime, setSkipStartTime] = useState(0);
    const [skipEndTime, setSkipEndTime] = useState(0);
    const [skipEnabled, setSkipEnabled] = useState(false);

    // ========== 播放控制操作 ==========
    const play = useCallback(() => {
        setIsPlaying(true);
    }, []);

    const pause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const seek = useCallback((time: number) => {
        setProgress(time);
    }, []);

    // ========== 队列控制操作 ==========
    const setQueue = useCallback((newSongs: Song[]) => {
        setSongs(newSongs);
        if (newSongs.length > 0 && currentIndex >= newSongs.length) {
            setCurrentIndex(0);
            setCurrentSong(newSongs[0]);
        }
    }, [currentIndex]);

    const setCurrentIndexSafe = useCallback((index: number) => {
        if (index >= 0 && index < songs.length) {
            setCurrentIndex(index);
            setCurrentSong(songs[index]);
        }
    }, [songs]);

    const nextSong = useCallback(() => {
        if (songs.length === 0) return;

        let nextIndex: number;
        switch (playMode) {
            case 'shuffle':
                nextIndex = Math.floor(Math.random() * songs.length);
                break;
            case 'loop-one':
                nextIndex = currentIndex; // 保持当前歌曲
                break;
            case 'no-loop':
                nextIndex = currentIndex + 1;
                if (nextIndex >= songs.length) {
                    setIsPlaying(false);
                    return;
                }
                break;
            case 'loop-all':
            default:
                nextIndex = (currentIndex + 1) % songs.length;
                break;
        }

        setCurrentIndex(nextIndex);
        setCurrentSong(songs[nextIndex]);
    }, [songs, currentIndex, playMode]);

    const prevSong = useCallback(() => {
        if (songs.length === 0) return;

        let prevIndex: number;
        switch (playMode) {
            case 'shuffle':
                prevIndex = Math.floor(Math.random() * songs.length);
                break;
            case 'loop-one':
                prevIndex = currentIndex; // 保持当前歌曲
                break;
            case 'no-loop':
                prevIndex = currentIndex - 1;
                if (prevIndex < 0) {
                    prevIndex = 0;
                }
                break;
            case 'loop-all':
            default:
                prevIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1;
                break;
        }

        setCurrentIndex(prevIndex);
        setCurrentSong(songs[prevIndex]);
    }, [songs, currentIndex, playMode]);

    // ========== 稳定的 Actions 对象 ==========
    const actions: PlayerActions = useMemo(() => ({
        // 播放控制
        play,
        pause,
        togglePlay,
        seek,

        // 队列控制
        setQueue,
        setCurrentIndex: setCurrentIndexSafe,
        nextSong,
        prevSong,

        // 状态更新
        setSong: setCurrentSong,
        setIsPlaying,
        setProgress,
        setDuration,

        // 控制设置
        setVolume,
        setPlayMode,
        setSkipStartTime,
        setSkipEndTime,
        setSkipEnabled,
    }), [
        play, pause, togglePlay, seek,
        setQueue, setCurrentIndexSafe, nextSong, prevSong,
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
        skipStartTime,
        skipEndTime,
        skipEnabled,
    }), [volume, playMode, skipStartTime, skipEndTime, skipEnabled]);

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