import { useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { toSongModel, type Song } from '../../types';
import { parseDomainError } from '../../utils/domainError';

interface UseSkipIntervalHandlerProps {
    currentSong: Song | null;
    setCurrentSong: (song: Song) => void;
    setSongs: (songs: Song[] | ((prev: Song[]) => Song[])) => void;
	setQueue: (songs: Song[] | ((prev: Song[]) => Song[])) => void;
	saveTimerRef: React.MutableRefObject<Map<string, NodeJS.Timeout>>;
	onSongUpdated?: (song: Song) => void;
}

export const useSkipIntervalHandler = ({
    currentSong,
    setCurrentSong,
    setSongs,
	setQueue,
	saveTimerRef,
	onSongUpdated,
}: UseSkipIntervalHandlerProps) => {
    const currentSongRef = useRef(currentSong);
    const persistedTimesRef = useRef(new Map<string, Pick<Song, 'skipStartTime' | 'skipEndTime'>>());
    const revisionsRef = useRef(new Map<string, number>());

    useEffect(() => {
        currentSongRef.current = currentSong;
        if (currentSong && !saveTimerRef.current.has(`skip_${currentSong.id}`)) {
            persistedTimesRef.current.set(currentSong.id, {
                skipStartTime: currentSong.skipStartTime,
                skipEndTime: currentSong.skipEndTime,
            });
        }
    }, [currentSong, saveTimerRef]);

    useEffect(() => () => {
        saveTimerRef.current.forEach(clearTimeout);
        saveTimerRef.current.clear();
    }, [saveTimerRef]);

    const updateSongSkipTimes = useCallback((updates: Partial<Pick<Song, 'skipStartTime' | 'skipEndTime'>>) => {
        const baseSong = currentSongRef.current;
        if (!baseSong) return;

        if (!persistedTimesRef.current.has(baseSong.id)) {
            persistedTimesRef.current.set(baseSong.id, {
                skipStartTime: baseSong.skipStartTime,
                skipEndTime: baseSong.skipEndTime,
            });
        }

        const updated: Song = {
            ...baseSong,
            ...updates,
        };
        currentSongRef.current = updated;
        const revision = (revisionsRef.current.get(updated.id) ?? 0) + 1;
        revisionsRef.current.set(updated.id, revision);

        // 1. 立即同步更新 currentSong
        setCurrentSong(updated);

        // 2. 立即同步更新 songs 列表
        setSongs(prevSongs =>
            prevSongs.map(s => s.id === updated.id ? updated : s)
        );

        // 3. 立即同步更新 queue
		setQueue(prevQueue =>
			prevQueue.map(s => s.id === updated.id ? updated : s)
		);
		onSongUpdated?.(updated);

        // 4. 立即写入 localStorage 缓存
        cacheSkipTimes(updated.id, updated);

        // 5. 防抖异步持久化到数据库（500ms 后保存）
        const saveKey = `skip_${updated.id}`;
        const existingTimer = saveTimerRef.current.get(saveKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            try {
                await Services.UpsertSongs([toSongModel(updated)]);
                if (revisionsRef.current.get(updated.id) === revision) {
                    persistedTimesRef.current.set(updated.id, {
                        skipStartTime: updated.skipStartTime,
                        skipEndTime: updated.skipEndTime,
                    });
                }
            } catch (err) {
                if (revisionsRef.current.get(updated.id) !== revision) return;

                const persisted = persistedTimesRef.current.get(updated.id);
                if (persisted) {
                    const rollback = (song: Song): Song => song.id === updated.id
                        ? { ...song, ...persisted }
                        : song;
                    const activeSong = currentSongRef.current;
                    if (activeSong?.id === updated.id) {
                        const rolledBackSong = rollback(activeSong);
                        currentSongRef.current = rolledBackSong;
                        setCurrentSong(rolledBackSong);
                    }
					setSongs(prevSongs => prevSongs.map(rollback));
					setQueue(prevQueue => prevQueue.map(rollback));
					onSongUpdated?.({ ...updated, ...persisted });
					cacheSkipTimes(updated.id, persisted);
                }
                notifications.show({
                    title: "播放区间保存失败",
                    message: parseDomainError(err).message,
                    color: "red",
                });
            } finally {
                if (saveTimerRef.current.get(saveKey) === timer) {
                    saveTimerRef.current.delete(saveKey);
                }
            }
        }, 500);

        saveTimerRef.current.set(saveKey, timer);
	}, [setCurrentSong, setSongs, setQueue, saveTimerRef, onSongUpdated]);

    const handleIntervalChange = useCallback((start: number, end: number) => {
        if (!currentSong) return;
        const roundedStart = Math.round(start * 20) / 20;
        const roundedEnd = Math.round(end * 20) / 20;
        updateSongSkipTimes({
            skipStartTime: roundedStart,
            skipEndTime: roundedEnd,
        });
        // 局部区间状态将由 currentSong 更新派生得到，无需额外 setter
    }, [currentSong, updateSongSkipTimes]);

    const handleSkipStartChange = useCallback((value: number) => {
        if (!currentSong) return;
        const roundedValue = Math.round(value * 20) / 20;
        updateSongSkipTimes({
            skipStartTime: roundedValue,
        });
        // 局部区间状态将由 currentSong 更新派生得到，无需额外 setter
    }, [currentSong, updateSongSkipTimes]);

    const handleSkipEndChange = useCallback((value: number) => {
        if (!currentSong) return;
        const roundedValue = Math.round(value * 20) / 20;
        updateSongSkipTimes({
            skipEndTime: roundedValue,
        });
        // 局部区间状态将由 currentSong 更新派生得到，无需额外 setter
    }, [currentSong, updateSongSkipTimes]);

    return {
        handleIntervalChange,
        handleSkipStartChange,
        handleSkipEndChange,
    };
};

const cacheSkipTimes = (
    songId: string,
    times: Pick<Song, 'skipStartTime' | 'skipEndTime'>,
): void => {
    try {
        localStorage.setItem(`half-beat.song.${songId}`, JSON.stringify({
            ...times,
            updatedAt: new Date().toISOString(),
        }));
    } catch (err) {
        console.warn("写入缓存失败:", err);
    }
};
