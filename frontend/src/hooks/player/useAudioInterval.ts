/**
 * 播放区间控制 Hook
 * 管理歌曲的开始和结束播放时间
 */

import { useRef, useMemo, useEffect } from 'react';
import type { Song } from '../../types';

export interface PlayInterval {
    start: number;
    end: number;
    length: number;
}

export interface UseAudioIntervalReturn {
    intervalRef: React.RefObject<PlayInterval>;
    intervalStart: number;
    intervalEnd: number;
    intervalLength: number;
    progressInInterval: number;
}

export const useAudioInterval = (
    currentSong: Song | null,
    duration: number,
    progress: number
): UseAudioIntervalReturn => {
    const intervalRef = useRef<PlayInterval>({ start: 0, end: 0, length: 0 });

    // 播放区间相关派生值
    const rawIntervalStart = currentSong?.skipStartTime ?? 0;
    const rawIntervalEndRaw = currentSong?.skipEndTime ?? 0; // 0 作为"播放到结尾"的哨兵值

    const intervalStart = useMemo(
        () => Math.min(Math.max(rawIntervalStart, 0), duration || 0),
        [rawIntervalStart, duration]
    );

    const rawIntervalEndEffective = rawIntervalEndRaw === 0 ? (duration || 0) : rawIntervalEndRaw;
    const intervalEnd = useMemo(
        () => Math.min(Math.max(rawIntervalEndEffective, intervalStart), duration || 0),
        [rawIntervalEndEffective, intervalStart, duration]
    );

    const intervalLength = useMemo(
        () => Math.max(0, intervalEnd - intervalStart),
        [intervalEnd, intervalStart]
    );

    const progressInInterval = useMemo(
        () => Math.max(0, Math.min(intervalLength || (duration || 0), progress - intervalStart)),
        [intervalLength, duration, progress, intervalStart]
    );

    // 同步区间值到 ref，确保音频事件处理中总能获取最新值
    useEffect(() => {
        intervalRef.current = { start: intervalStart, end: intervalEnd, length: intervalLength };
    }, [intervalStart, intervalEnd, intervalLength]);

    return {
        intervalRef,
        intervalStart,
        intervalEnd,
        intervalLength,
        progressInInterval,
    };
};
