import { useCallback } from 'react';
import type { Song } from '../../types';
import { convertSongs, toSongModel } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';

interface UseSongOperationsProps {
    currentSong: Song | null;
    songs: Song[];
    setSongs: (songs: Song[]) => void;
    setCurrentSong: (song: Song | null) => void;
}

export const useSongOperations = ({
    currentSong,
    songs,
    setSongs,
    setCurrentSong,
}: UseSongOperationsProps) => {
    /**
     * 更新歌曲信息（名称、歌手、封面等）
     */
    const updateSongInfo = useCallback(async (songId: string, updates: { name?: string; singer?: string; cover?: string }) => {
        const song = songs.find(s => s.id === songId);
        if (!song) return;

        const updated = {
            ...song,
            name: updates.name !== undefined ? updates.name : song.name,
            singer: updates.singer !== undefined ? updates.singer : song.singer,
            cover: updates.cover !== undefined ? updates.cover : song.cover,
            updatedAt: new Date().toISOString(),
        };

        await Services.UpsertSongs([toSongModel(updated)]);
        const rawRefreshed = await Services.ListSongs();
        setSongs(convertSongs(rawRefreshed || []));

        // 如果更新的是当前播放的歌曲，也更新 currentSong
        if (currentSong?.id === songId) {
            setCurrentSong(updated);
        }
    }, [songs, currentSong, setSongs, setCurrentSong]);

    return {
        updateSongInfo,
    };
};
