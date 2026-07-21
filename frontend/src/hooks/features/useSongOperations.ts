import { useCallback } from 'react';
import type { Song } from '../../types';
import { toSongModel } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';

interface UseSongOperationsProps {
    currentSong: Song | null;
    songs: Song[];
	setSongs: (songs: Song[] | ((current: Song[]) => Song[])) => void;
    setCurrentSong: (song: Song | null) => void;
	onSongUpdated?: (song: Song) => void;
}

export const useSongOperations = ({
    currentSong,
    songs,
	setSongs,
	setCurrentSong,
	onSongUpdated,
}: UseSongOperationsProps) => {
    /**
     * 更新歌曲信息（名称、歌手、封面等）
     */
    const updateSongInfo = useCallback(async (songId: string, updates: { name?: string; singer?: string; cover?: string }) => {
		const song = currentSong?.id === songId ? currentSong : songs.find(s => s.id === songId);
        if (!song) return;

        const updated = {
            ...song,
            name: updates.name !== undefined ? updates.name : song.name,
            singer: updates.singer !== undefined ? updates.singer : song.singer,
            cover: updates.cover !== undefined ? updates.cover : song.cover,
            updatedAt: new Date().toISOString(),
        };

		await Services.UpsertSongs([toSongModel(updated)]);
		setSongs((current) => current.map((candidate) => candidate.id === songId ? updated : candidate));
		onSongUpdated?.(updated);

        // 如果更新的是当前播放的歌曲，也更新 currentSong
        if (currentSong?.id === songId) {
            setCurrentSong(updated);
        }
	}, [songs, currentSong, setSongs, setCurrentSong, onSongUpdated]);

    return {
        updateSongInfo,
    };
};
