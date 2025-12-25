/**
 * 播放列表管理 Hook
 * 管理播放队列、当前歌曲索引、播放模式
 */

import { useState, useCallback, useEffect } from 'react';
import type { Song } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';

export type PlayMode = 'order' | 'random' | 'single';

export interface UsePlaylistReturn {
    queue: Song[];
    currentIndex: number;
    currentSong: Song | null;
    playMode: PlayMode;
    setQueue: (songs: Song[]) => void;
    setCurrentIndex: (index: number) => void;
    setCurrentSong: (song: Song | null) => void;
    setPlayMode: (mode: PlayMode) => void;
    playNext: () => void;
    playPrevious: () => void;
    playSongAt: (index: number) => void;
}

export const usePlaylist = () => {
    const [queue, setQueue] = useState<Song[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [playMode, setPlayMode] = useState<PlayMode>('order');

    // 播放下一首
    const playNext = useCallback(() => {
        if (queue.length === 0) return;

        if (playMode === 'single') {
            // 单曲循环：不切歌
            return;
        }

        if (playMode === 'random') {
            // 随机播放
            const nextIndex = Math.floor(Math.random() * queue.length);
            setCurrentIndex(nextIndex);
            setCurrentSong(queue[nextIndex]);
        } else {
            // 顺序播放
            if (currentIndex < queue.length - 1) {
                const nextIndex = currentIndex + 1;
                setCurrentIndex(nextIndex);
                setCurrentSong(queue[nextIndex]);
            }
        }
    }, [queue, currentIndex, playMode]);

    // 播放上一首
    const playPrevious = useCallback(() => {
        if (queue.length === 0) return;

        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setCurrentIndex(prevIndex);
            setCurrentSong(queue[prevIndex]);
        }
    }, [queue, currentIndex]);

    // 播放指定位置的歌曲
    const playSongAt = useCallback((index: number) => {
        if (index >= 0 && index < queue.length) {
            setCurrentIndex(index);
            setCurrentSong(queue[index]);
        }
    }, [queue]);

    // 自动保存播放列表到后端（防抖）
    useEffect(() => {
        if (queue.length === 0) return;

        const savePlaylist = async () => {
            try {
                const queueIds = queue.map((song) => song.id);
                const queueJSON = JSON.stringify(queueIds);
                await Services.SavePlaylist(queueJSON, currentIndex);
                console.log('播放列表已保存');
            } catch (err) {
                console.warn('保存播放列表失败', err);
            }
        };

        const timeoutId = setTimeout(savePlaylist, 1000);
        return () => clearTimeout(timeoutId);
    }, [queue, currentIndex]);

    return {
        queue,
        currentIndex,
        currentSong,
        playMode,
        setQueue,
        setCurrentIndex,
        setCurrentSong,
        setPlayMode,
        playNext,
        playPrevious,
        playSongAt,
    };
};
