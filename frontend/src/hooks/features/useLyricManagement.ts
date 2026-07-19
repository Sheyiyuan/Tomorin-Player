import { useCallback } from 'react';
import { toLyricMappingModel, type Song, type LyricMapping } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';

interface UseLyricManagementProps {
    currentSong: Song | null;
    lyric: LyricMapping | null;
    setLyric: (lyric: LyricMapping | null) => void;
}

export const useLyricManagement = ({
    currentSong,
    lyric,
    setLyric,
}: UseLyricManagementProps) => {
    /**
     * 保存歌词内容
     */
    const saveLyric = useCallback(async (value: string) => {
        if (!currentSong) return;
        const next: LyricMapping = {
            id: currentSong.id,
            lyric: value,
            offsetMs: lyric?.offsetMs ?? 0,
            updatedAt: new Date().toISOString(),
        };
        await Services.SaveLyricMapping(toLyricMappingModel(next));
        setLyric(next);
    }, [currentSong, lyric?.offsetMs, setLyric]);

    /**
     * 保存歌词偏移量
     */
    const saveLyricOffset = useCallback(async (offset: number) => {
        if (!currentSong) return;
        const next: LyricMapping = {
            id: currentSong.id,
            lyric: lyric?.lyric ?? "",
            offsetMs: offset,
            updatedAt: new Date().toISOString(),
        };
        await Services.SaveLyricMapping(toLyricMappingModel(next));
        setLyric(next);
    }, [currentSong, lyric?.lyric, setLyric]);

    return {
        saveLyric,
        saveLyricOffset,
    };
};
