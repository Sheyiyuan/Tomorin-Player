import { useCallback } from 'react';
import type { Song, Favorite } from '../../types';
import type { QueueItem } from '../../context/types/contexts';

interface UsePlayModesProps {
	loadFavoriteSongs: (favoriteId: string) => Promise<Song[]>;
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
	loadFavoriteSongs,
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
	 * 单击歌曲不会隐式加载完整歌单；完整加载只由播放全部触发。
	 */
	const playSingleSong = useCallback(async (song: Song) => {
		// 如果当前播放列表为空
		if (queue.length === 0) {
			const songList = [song];
			setQueue(songList);
			setCurrentIndex(0);
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
	}, [queue, queueItems, setQueue, setCurrentIndex, setCurrentQueueItemId, setCurrentSong, setIsPlaying, playSong]);

    /**
     * 播放歌单
     * 替换整个播放列表为歌单内容
     */
    const playFavorite = useCallback(async (fav: Favorite) => {
		const list = await loadFavoriteSongs(fav.id);
        if (list.length === 0) return;
        // 播放歌单时，替换整个播放列表
        setQueue(list);
        setCurrentIndex(0);
		await playSong(list[0], list);
    }, [loadFavoriteSongs, setQueue, setCurrentIndex, playSong]);

    return {
        playSingleSong,
        playFavorite,
    };
};
