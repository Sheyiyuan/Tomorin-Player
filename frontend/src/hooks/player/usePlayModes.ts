import { useCallback } from 'react';
import type { Song, Favorite } from '../../types';
import type { QueueItem } from '../../context/types/contexts';

interface UsePlayModesProps {
    songs: Song[];
    queue: Song[];
    currentIndex: number;
    setQueue: (queue: Song[]) => void;
    setCurrentIndex: (index: number) => void;
    setCurrentSong: (song: Song | null) => void;
    setIsPlaying: (playing: boolean) => void;
    playSong: (song: Song, list?: Song[]) => Promise<void>;
    queueItems?: QueueItem[];
    setCurrentQueueItemId?: (queueItemId: string | null, recordHistory?: boolean) => void;
}

/**
 * 不同播放模式的 Hook
 * playSingleSong - 播放单曲（智能插入队列）
 * playFavorite - 播放整个歌单
 */
export const usePlayModes = ({
    songs,
    queue,
    currentIndex: _currentIndex,
    setQueue,
    setCurrentIndex,
    setCurrentSong,
    setIsPlaying,
    playSong,
    queueItems = [],
    setCurrentQueueItemId,
}: UsePlayModesProps) => {
    /**
     * 播放单曲
     * 如果播放列表为空，添加歌曲所在歌单；否则插入到当前播放歌曲的下一首
     */
    const playSingleSong = useCallback(async (song: Song, songFavorite?: Favorite) => {
        // 如果当前播放列表为空
        if (queue.length === 0) {
            // 添加歌曲所在歌单到播放列表
            let songList: Song[] = [];
            if (songFavorite) {
                songList = songFavorite.songIds
                    .map((reference) => songs.find((candidate) => candidate.id === reference.songId))
                    .filter((candidate): candidate is Song => Boolean(candidate));
            }
            // 如果没有歌单或歌单为空，只播放单曲
            if (songList.length === 0) {
                songList = [song];
            }
            setQueue(songList);
            const idx = songList.findIndex((s) => s.id === song.id);
            setCurrentIndex(idx >= 0 ? idx : 0);
            await playSong(song, songList);
        } else {
            const existingItem = queueItems.find((item) => item.song === song);
            if (existingItem) {
                const existingIndex = queueItems.findIndex((item) => item.queueItemId === existingItem.queueItemId);
                setCurrentQueueItemId?.(existingItem.queueItemId);
                setCurrentIndex(existingIndex);
                setCurrentSong(existingItem.song);
                setIsPlaying(true);
                await playSong(existingItem.song, queue);
                return;
            }

            // 队列外歌曲创建新的队列项并立即播放，允许歌曲重复出现。
            const newQueue = [...queue, song];
            const insertIdx = newQueue.length - 1;
            setQueue(newQueue);
            setCurrentIndex(insertIdx);
            setCurrentSong(song);
            setIsPlaying(true);
            await playSong(song, newQueue);
        }
    }, [songs, queue, queueItems, setQueue, setCurrentIndex, setCurrentQueueItemId, setCurrentSong, setIsPlaying, playSong]);

    /**
     * 播放歌单
     * 替换整个播放列表为歌单内容
     */
    const playFavorite = useCallback((fav: Favorite) => {
        const list = fav.songIds
            .map((reference) => songs.find((candidate) => candidate.id === reference.songId))
            .filter((candidate): candidate is Song => Boolean(candidate));
        if (list.length === 0) return;
        // 播放歌单时，替换整个播放列表
        setQueue(list);
        setCurrentIndex(0);
        playSong(list[0], list);
    }, [songs, setQueue, setCurrentIndex, playSong]);

    return {
        playSingleSong,
        playFavorite,
    };
};
