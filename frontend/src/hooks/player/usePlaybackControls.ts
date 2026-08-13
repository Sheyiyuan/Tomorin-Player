import { useCallback } from 'react';
import type { Song } from '../../types';
import { getNextIndex } from '../../utils/player';
import { getNextQueueItem, getPreviousQueueItemId } from '../../utils/player';
import type { QueueActivationReason, QueueItem, RepeatMode } from '../../context/types/contexts';
import { shouldRefreshStream } from '../../utils/stream';

interface UsePlaybackControlsProps {
    audioRef: React.MutableRefObject<HTMLAudioElement | null>;
    currentSong: Song | null;
    currentIndex: number;
    queue: Song[];
    playMode: 'loop' | 'random' | 'single';
    intervalStart: number;
    intervalEnd: number;
    setIsPlaying: (playing: boolean) => void;
    setCurrentIndex: (index: number) => void;
    setVolume: (volume: number) => void;
    playSong: (song: Song) => Promise<void>;
    playbackRetryRef: React.MutableRefObject<Map<string, number>>;
    isHandlingErrorRef?: React.MutableRefObject<Set<string>>;
    onBeforePlay?: () => void;
    queueItems?: QueueItem[];
    playOrder?: string[];
    currentQueueItemId?: string | null;
    priorityNext?: string[];
    history?: string[];
    shuffleEnabled?: boolean;
    repeatMode?: RepeatMode;
    activateQueueItem?: (queueItemId: string, reason?: QueueActivationReason) => void;
    setPlayOrder?: (playOrder: string[]) => void;
    setHistory?: (history: string[]) => void;
}

export const usePlaybackControls = ({
    audioRef,
    currentSong,
    currentIndex,
    queue,
    playMode,
    intervalStart,
    intervalEnd,
    setIsPlaying,
    setCurrentIndex,
    setVolume,
    playSong,
    playbackRetryRef,
    isHandlingErrorRef,
    onBeforePlay,
    queueItems = [],
    playOrder = [],
    currentQueueItemId = null,
    priorityNext = [],
    history = [],
    shuffleEnabled = playMode === 'random',
    activateQueueItem,
    setPlayOrder,
    setHistory,
}: UsePlaybackControlsProps) => {
    /**
     * 播放下一首
     * 注意：single 模式下“播放结束”由 onEnded 做单曲循环；但用户手动点击“下一曲”仍应正常切歌。
     * 
     * 播放模式说明：
     * - loop: 列表循环，播放到最后一首后回到第一首
     * - random: 随机播放，随机选择下一首
     * - single: 单曲循环（onEnded 重播）；手动切歌按列表顺序
     */
    const playNext = useCallback(async () => {
        if (queue.length === 0) return;

        console.log('[playNext] 当前播放模式:', playMode, '队列长度:', queue.length);

        // 特殊处理：播放列表只有一首歌时，无论什么模式都应该重播当前歌曲
        if (queue.length === 1) {
            console.log('[playNext] 列表只有一首歌，重播当前歌曲');
            const song = queue[0];
            const item = queueItems[0];
            if (item) activateQueueItem?.(item.queueItemId, 'next');
            else setCurrentIndex(0);
            if (song.id) {
                playbackRetryRef.current.delete(song.id);
                isHandlingErrorRef?.current.delete(song.id);
            }
            await playSong(song);
            return;
        }

        let nextIdx: number | null = null;
        let selectedByQueueItemId = false;
        if (queueItems.length > 0 && playOrder.length > 0) {
            const navigation = getNextQueueItem(queueItems, playOrder, currentQueueItemId, priorityNext, shuffleEnabled, 'all');
            const nextId = navigation.nextQueueItemId;
            if (nextId) {
                nextIdx = queueItems.findIndex((item) => item.queueItemId === nextId);
                if (navigation.playOrder.join('\u0000') !== playOrder.join('\u0000')) setPlayOrder?.(navigation.playOrder);
                if (activateQueueItem) {
                    activateQueueItem(nextId, 'next');
                    selectedByQueueItemId = true;
                }
            }
        } else {
            nextIdx = getNextIndex(queue.length, currentIndex, playMode, false);
        }
        if (nextIdx === null || nextIdx < 0) return;

        if (!selectedByQueueItemId) setCurrentIndex(nextIdx);
        const nextSong = queue[nextIdx];

        // 清除新歌曲的重试计数和错误处理标记（用户手动切歌）
        if (nextSong.id) {
            playbackRetryRef.current.delete(nextSong.id);
            isHandlingErrorRef?.current.delete(nextSong.id);
        }

        await playSong(nextSong);
    }, [currentIndex, playMode, queue, queueItems, playOrder, currentQueueItemId, priorityNext, shuffleEnabled, setPlayOrder, activateQueueItem, setCurrentIndex, playSong, playbackRetryRef, isHandlingErrorRef]);

    /**
     * 播放上一首
     */
    const playPrev = useCallback(async () => {
        if (queue.length === 0) return;

        console.log('[playPrev] 当前播放模式:', playMode, '队列长度:', queue.length);

        // 特殊处理：播放列表只有一首歌时，直接重播
        if (queue.length === 1) {
            console.log('[playPrev] 列表只有一首歌，重播当前歌曲');
            const song = queue[0];
            const item = queueItems[0];
            if (item) activateQueueItem?.(item.queueItemId, 'previous');
            else setCurrentIndex(0);
            if (song.id) {
                playbackRetryRef.current.delete(song.id);
                isHandlingErrorRef?.current.delete(song.id);
            }
            await playSong(song);
            return;
        }

        let prevIdx = currentIndex - 1;
        let selectedByQueueItemId = false;
        if (queueItems.length > 0 && playOrder.length > 0) {
            const previousId = getPreviousQueueItemId(history, queueItems, playOrder, currentQueueItemId);
            const historyIndex = previousId ? queueItems.findIndex((item) => item.queueItemId === previousId) : -1;
            if (previousId && historyIndex >= 0) {
                prevIdx = historyIndex;
                if (activateQueueItem) {
                    activateQueueItem(previousId, 'previous');
                    selectedByQueueItemId = true;
                }
                const previousHistoryIndex = history.lastIndexOf(previousId);
                if (previousHistoryIndex >= 0) setHistory?.(history.slice(0, previousHistoryIndex));
            }
        }
        if (prevIdx < 0) prevIdx = queue.length - 1;
        if (!selectedByQueueItemId) setCurrentIndex(prevIdx);
        const prevSong = queue[prevIdx];
        // 清除新歌曲的重试计数和错误处理标记（用户手动切歌）
        if (prevSong.id) {
            playbackRetryRef.current.delete(prevSong.id);
            isHandlingErrorRef?.current.delete(prevSong.id);
        }
        await playSong(prevSong);
    }, [currentIndex, queue, playMode, queueItems, playOrder, history, currentQueueItemId, setCurrentIndex, playSong, playbackRetryRef, isHandlingErrorRef, activateQueueItem, setHistory]);

    /**
     * 切换播放/暂停
     */
    const togglePlay = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio || !currentSong) return;
        if (shouldRefreshStream(currentSong)) {
            await playSong({ ...currentSong, streamUrl: '' });
            return;
        }
        const target = Math.max(intervalStart, Math.min(audio.currentTime || 0, intervalEnd));
        audio.currentTime = target;
        if (audio.paused) {
            try {
                onBeforePlay?.();
            } catch (e) {
                console.warn('onBeforePlay 执行失败:', e);
            }
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .catch((err) => {
                        console.error("播放失败:", err);

                        // 如果是 NotSupportedError 或 AbortError，可能是 URL 过期导致的
                        if (err.name === 'NotSupportedError' || err.name === 'AbortError') {
                            console.log("检测到音频加载失败，可能是 URL 过期，尝试刷新...");
                            if (currentSong?.bvid) {
                                setIsPlaying(false);
                                audio.pause();
                                audio.src = '';
                                // 刷新 URL
                                playSong({
                                    ...currentSong,
                                    streamUrl: '',
                                    streamUrlExpiresAt: new Date().toISOString(),
                                } as Song).catch(console.error);
                            }
                            return;
                        }

                        // 如果是 NotAllowedError，尝试静音播放
                        if (err.name === 'NotAllowedError' && !audio.muted) {
                            console.log("尝试静音播放来绕过浏览器限制...");
                            audio.muted = true;
                            try {
                                onBeforePlay?.();
                            } catch (e) {
                                console.warn('onBeforePlay 执行失败:', e);
                            }
                            audio.play()
                                .then(() => {
                                    console.log("静音播放成功");
                                    // 1秒后取消静音
                                    setTimeout(() => {
                                        audio.muted = false;
                                    }, 1000);
                                })
                                .catch((e) => console.error("静音播放失败:", e));
                        }
                    });
            }
        } else {
            audio.pause();
        }
    }, [audioRef, currentSong, intervalStart, intervalEnd, setIsPlaying, playSong, onBeforePlay]);

    /**
     * 改变音量
     */
    const changeVolume = useCallback((v: number) => {
        const audio = audioRef.current;
        const clamped = Math.min(1, Math.max(0, v));
        setVolume(clamped);
        if (audio) audio.volume = clamped;
    }, [audioRef, setVolume]);

    return {
        playNext,
        playPrev,
        togglePlay,
        changeVolume,
    };
};
