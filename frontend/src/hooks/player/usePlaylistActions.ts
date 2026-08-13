import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { Song, Favorite, convertFavoriteSummary } from '../../types';
import type { ModalName } from '../../context/types/contexts';
import { removeQueueItem, reorderQueue } from '../../utils/player';
import { parseDomainError } from '../../utils/domainError';

interface UsePlaylistActionsProps {
    queue: Song[];
    setQueue: (queue: Song[]) => void;
    currentIndex: number;
    setCurrentIndex: (index: number) => void;
    currentSong: Song | null;
    setCurrentSong: (song: Song | null) => void;
    setIsPlaying: (playing: boolean) => void;
    currentFav: Favorite | null;
	setFavorites: (favorites: Favorite[] | ((current: Favorite[]) => Favorite[])) => void;
    setStatus: (status: string) => void;
    setConfirmRemoveSongId: (id: string | null) => void;
    openModal: (name: ModalName) => void;
    closeModal: (name: ModalName) => void;
    playSong: (song: Song) => Promise<void>;
    addSongToFavorite: (favId: string, song: Song) => Promise<void>;
    setPendingFavoriteSong: (song: Song | null) => void;
    pendingFavoriteSong: Song | null;
}

export const usePlaylistActions = ({
    queue,
    setQueue,
    currentIndex,
    setCurrentIndex,
    currentSong,
    setCurrentSong,
    setIsPlaying,
    currentFav,
    setFavorites,
    setStatus,
    setConfirmRemoveSongId,
    openModal,
    closeModal,
    playSong,
    addSongToFavorite,
    setPendingFavoriteSong,
    pendingFavoriteSong,
}: UsePlaylistActionsProps) => {

    const addSongToFavoriteFromList = useCallback((song: Song) => {
        setPendingFavoriteSong(song);
        openModal("addFavoriteModal");
    }, [setPendingFavoriteSong, openModal]);

    const addCurrentSongToFavorite = useCallback(() => {
        if (!currentSong) return;
        setPendingFavoriteSong(null);
        openModal("addFavoriteModal");
    }, [currentSong, setPendingFavoriteSong, openModal]);

    const removeSongFromPlaylist = useCallback(async (song: Song) => {
        if (!currentFav) return;
        try {
			const updatedFavorite = convertFavoriteSummary(await Services.RemoveSongFromFavorite(currentFav.id, song.id));
			setFavorites((favorites) => favorites.map((favorite) => favorite.id === currentFav.id ? updatedFavorite : favorite));
            setConfirmRemoveSongId(null);
            notifications.show({ title: '已移出歌单', message: song.name, color: 'green' });
        } catch (e: unknown) {
			const parsed = parseDomainError(e);
			notifications.show({ title: '移出失败', message: parsed.message, color: 'red' });
        }
    }, [currentFav, setFavorites, setConfirmRemoveSongId]);

    const addToFavoriteFromModal = useCallback(async (fav: Favorite) => {
        try {
            // 优先使用 pendingFavoriteSong，如果没有则使用 currentSong
            const targetSong = pendingFavoriteSong || currentSong;
            if (!targetSong) return;
            await addSongToFavorite(fav.id, targetSong);

            setStatus(`已添加到歌单: ${fav.title}`);
            setPendingFavoriteSong(null);
            closeModal("addFavoriteModal");
        } catch (error) {
            console.error('Failed to add song to favorite:', error);
			setStatus(`添加失败: ${parseDomainError(error).message}`);
        }
    }, [pendingFavoriteSong, currentSong, addSongToFavorite, setStatus, setPendingFavoriteSong, closeModal]);

    const playlistSelect = useCallback((song: Song, index: number) => {
        setCurrentIndex(index);
        setIsPlaying(true);
        playSong(song);
    }, [setCurrentIndex, setIsPlaying, playSong]);

    const playlistReorder = useCallback((fromIndex: number, toIndex: number) => {
        const result = reorderQueue(queue, currentIndex, fromIndex, toIndex);
        setQueue(result.queue);
        setCurrentIndex(result.currentIndex);
    }, [queue, setQueue, currentIndex, setCurrentIndex]);

    const playlistRemove = useCallback((index: number) => {
        const result = removeQueueItem(queue, currentIndex, index);
        const newQueue = result.queue;
        setQueue(newQueue);
        setCurrentIndex(result.currentIndex);

        // 如果删除的是当前播放的歌曲
        if (index === currentIndex) {
            if (newQueue.length === 0) {
                setCurrentSong(null);
                setIsPlaying(false);
            } else if (index >= newQueue.length) {
                // 删除的是最后一首，播放前一首
                setIsPlaying(true);
                playSong(newQueue[result.currentIndex]);
            } else {
                // 播放同一位置的下一首
                setIsPlaying(true);
                playSong(newQueue[result.currentIndex]);
            }
        }
    }, [queue, setQueue, currentIndex, setCurrentIndex, setIsPlaying, setCurrentSong, playSong]);

    return {
        addSongToFavoriteFromList,
        addCurrentSongToFavorite,
        removeSongFromPlaylist,
        addToFavoriteFromModal,
        playlistSelect,
        playlistReorder,
        playlistRemove,
    };
};
