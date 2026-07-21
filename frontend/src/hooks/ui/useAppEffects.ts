import { useEffect } from "react";
import type { MutableRefObject } from "react";
import * as Services from "../../../wailsjs/go/services/Service";
import type { Song } from "../../types";

interface UseAppEffectsParams {
    intervalStart: number;
    intervalEnd: number;
    intervalLength: number;
    intervalRef: MutableRefObject<{ start: number; end: number; length: number } | null>;
    currentSong: Song | null;
    songs: Song[];
    setDownloadedSongIds: (v: Set<string>) => void;
    prevSongIdRef: MutableRefObject<string | null>;
}

export const useAppEffects = ({
    intervalStart,
    intervalEnd,
    intervalLength,
    intervalRef,
    currentSong,
    songs,
    setDownloadedSongIds,
    prevSongIdRef,
}: UseAppEffectsParams) => {
    // 同步区间值到 ref
    useEffect(() => {
        intervalRef.current = { start: intervalStart, end: intervalEnd, length: intervalLength };
    }, [intervalStart, intervalEnd, intervalLength, intervalRef]);

    // 批量下载状态
    useEffect(() => {
        (async () => {
            if (songs.length === 0) {
                setDownloadedSongIds(new Set());
                return;
            }
            try {
                const results = await Services.GetDownloadedSongIDs(songs.map((song) => song.id));
                const downloadedIds = new Set(results);
                setDownloadedSongIds(downloadedIds);
            } catch (e) {
                console.warn("批量检查下载状态失败", e);
            }
        })();
    }, [songs, setDownloadedSongIds]);

    // 记录当前歌曲 ID
    useEffect(() => {
        prevSongIdRef.current = currentSong?.id ?? null;
    }, [currentSong?.id, prevSongIdRef]);
};
