/**
 * 播放器 Context
 * 管理播放器相关的所有状态：播放状态、队列、控制设置
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import {
    PlayerContextValue,
    PlaybackState,
    QueueState,
    ControlsState,
    PlayerActions,
    QueueItem,
    RepeatMode,
} from '../types/contexts';
import { Song } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';
import { buildPlayOrder, createQueueItemId, fisherYates, reorderQueueItems as reorderItems } from '../../utils/player';

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ========== 播放状态 ==========
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    // ========== 队列状态 ==========
    const [items, setItems] = useState<QueueItem[]>([]);
    const [currentQueueItemId, setCurrentQueueItemIdState] = useState<string | null>(null);
    const [playOrder, setPlayOrder] = useState<string[]>([]);
    const [history, setHistory] = useState<string[]>([]);
    const [priorityNext, setPriorityNext] = useState<string[]>([]);
    const [shuffleEnabled, setShuffleEnabledState] = useState(false);
    const [repeatMode, setRepeatModeState] = useState<RepeatMode>('all');
    const [playlistHydrated, setPlaylistHydrated] = useState(false);
    const itemsRef = useRef(items);
    const currentQueueItemIdRef = useRef(currentQueueItemId);
    const priorityNextRef = useRef(priorityNext);
    const shuffleEnabledRef = useRef(shuffleEnabled);
    const repeatModeRef = useRef(repeatMode);
    itemsRef.current = items;
    currentQueueItemIdRef.current = currentQueueItemId;
    priorityNextRef.current = priorityNext;
    shuffleEnabledRef.current = shuffleEnabled;
    repeatModeRef.current = repeatMode;

    const songs = useMemo(() => items.map((item) => item.song), [items]);
    const currentIndex = useMemo(() => {
        if (!currentQueueItemId) return 0;
        const index = items.findIndex((item) => item.queueItemId === currentQueueItemId);
        return index >= 0 ? index : 0;
    }, [items, currentQueueItemId]);

    // ========== 控制状态 ==========
    const [volume, setVolume] = useState(0.5);
    const [playMode, setPlayMode] = useState<ControlsState['playMode']>('loop');
    // ========== 队列控制操作 ==========
    const setQueue = useCallback<React.Dispatch<React.SetStateAction<Song[]>>>((nextQueue) => {
        setItems((previous) => {
            const resolved = typeof nextQueue === 'function' ? nextQueue(previous.map((item) => item.song)) : nextQueue;
            const used = new Set<string>();
            const nextItems = resolved.map((song) => {
                const match = previous.find((item) => !used.has(item.queueItemId) && item.song.id === song.id);
                if (match) {
                    used.add(match.queueItemId);
                    return { ...match, song };
                }
                return { queueItemId: createQueueItemId(), song };
            });
            itemsRef.current = nextItems;
            setCurrentQueueItemIdState((current) => {
                const nextCurrent = current && nextItems.some((item) => item.queueItemId === current)
                    ? current
                    : nextItems[0]?.queueItemId ?? null;
                currentQueueItemIdRef.current = nextCurrent;
                return nextCurrent;
            });
            setPlayOrder((currentOrder) => {
                const nextIds = nextItems.map((item) => item.queueItemId);
                const retained = currentOrder.filter((id) => nextIds.includes(id));
                return retained.length === nextIds.length && retained.length > 0
                    ? retained
                    : buildPlayOrder(nextItems, nextItems[0]?.queueItemId ?? null, shuffleEnabledRef.current);
            });
            return nextItems;
        });
    }, []);

    const setCurrentIndexSafe = useCallback((index: number) => {
        setItems((currentItems) => {
            const safeIndex = Math.min(Math.max(0, index), Math.max(0, currentItems.length - 1));
            const nextId = currentItems[safeIndex]?.queueItemId ?? null;
            currentQueueItemIdRef.current = nextId;
            setCurrentQueueItemIdState(nextId);
            return currentItems;
        });
    }, []);

    const setCurrentQueueItemId = useCallback((queueItemId: string | null, recordHistory = true) => {
        setCurrentQueueItemIdState((current) => {
            if (queueItemId === current) return current;
            if (recordHistory && current) {
                setHistory((previous) => [...previous, current].slice(-500));
            }
            currentQueueItemIdRef.current = queueItemId;
            return queueItemId;
        });
    }, []);

    const playQueueItemAt = useCallback((index: number) => {
        const item = items[index];
        if (item) setCurrentQueueItemId(item.queueItemId);
    }, [items, setCurrentQueueItemId]);

    const enqueueNext = useCallback((song: Song) => {
        const item = { queueItemId: createQueueItemId(), song };
        setPriorityNext((previousPriority) => {
            const anchorId = previousPriority[previousPriority.length - 1] ?? currentQueueItemId;
            setItems((previous) => {
                const anchorIndex = anchorId ? previous.findIndex((candidate) => candidate.queueItemId === anchorId) : -1;
                const next = [...previous];
                next.splice(anchorIndex >= 0 ? anchorIndex + 1 : next.length, 0, item);
                return next;
            });
            setPlayOrder((previous) => {
                const anchorIndex = anchorId ? previous.indexOf(anchorId) : -1;
                const next = [...previous];
                next.splice(anchorIndex >= 0 ? anchorIndex + 1 : next.length, 0, item.queueItemId);
                return next;
            });
            return [...previousPriority, item.queueItemId];
        });
        return item.queueItemId;
    }, [currentQueueItemId]);

    const enqueueLast = useCallback((song: Song) => {
        const item = { queueItemId: createQueueItemId(), song };
        setItems((previous) => [...previous, item]);
        setPlayOrder((previous) => [...previous, item.queueItemId]);
        return item.queueItemId;
    }, []);

    const removeQueueItem = useCallback((queueItemId: string) => {
        if (currentQueueItemId === queueItemId) {
            const currentOrderIndex = playOrder.indexOf(queueItemId);
            const fallbackId = playOrder[currentOrderIndex + 1] ?? playOrder[currentOrderIndex - 1] ?? null;
            const fallbackItem = items.find((item) => item.queueItemId === fallbackId);
            setCurrentQueueItemIdState(fallbackId);
            setCurrentSong(fallbackItem?.song ?? null);
            setIsPlaying(Boolean(fallbackItem));
        }
        setItems((previous) => previous.filter((item) => item.queueItemId !== queueItemId));
        setPlayOrder((previous) => previous.filter((id) => id !== queueItemId));
        setPriorityNext((previous) => previous.filter((id) => id !== queueItemId));
        setHistory((previous) => previous.filter((id) => id !== queueItemId));
        setCurrentQueueItemIdState((current) => current === queueItemId ? null : current);
    }, [currentQueueItemId, items, playOrder]);

    const reorderQueueItems = useCallback((fromQueueItemId: string, toQueueItemId: string) => {
        if (!shuffleEnabled) {
            setItems((previous) => reorderItems(previous, fromQueueItemId, toQueueItemId));
        }
        setPlayOrder((previous) => {
            const from = previous.indexOf(fromQueueItemId);
            const to = previous.indexOf(toQueueItemId);
            if (from < 0 || to < 0 || from === to) return previous;
            const next = [...previous];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
        setPriorityNext([]);
    }, [shuffleEnabled]);

    const clearUpcoming = useCallback(() => {
        if (!currentQueueItemId) return;
        const currentOrderIndex = playOrder.indexOf(currentQueueItemId);
        if (currentOrderIndex < 0) return;
        const upcoming = new Set(playOrder.slice(currentOrderIndex + 1));
        setItems((previous) => previous.filter((item) => !upcoming.has(item.queueItemId)));
        setPlayOrder((previous) => previous.filter((id) => !upcoming.has(id)));
        setPriorityNext((previous) => previous.filter((id) => !upcoming.has(id)));
    }, [currentQueueItemId, playOrder]);

    const consumePriorityNext = useCallback(() => {
        let consumed: string | null = null;
        setPriorityNext((previous) => {
            consumed = previous[0] ?? null;
            return previous.slice(1);
        });
        return consumed;
    }, []);

    const setShuffleEnabled = useCallback((enabled: boolean) => {
        shuffleEnabledRef.current = enabled;
        setShuffleEnabledState(enabled);
        setPlayMode(enabled ? 'random' : repeatModeRef.current === 'one' ? 'single' : 'loop');
        setPlayOrder((previousOrder) => {
            const itemIds = itemsRef.current.map((item) => item.queueItemId);
            const validPrevious = previousOrder.filter((id) => itemIds.includes(id));
            const latestCurrentId = currentQueueItemIdRef.current;
            const currentIndexValue = latestCurrentId ? validPrevious.indexOf(latestCurrentId) : -1;
            const playedPrefix = currentIndexValue >= 0 ? validPrevious.slice(0, currentIndexValue) : [];
            const playedSet = new Set([...playedPrefix, ...(latestCurrentId ? [latestCurrentId] : [])]);
            const future = enabled
                ? fisherYates(validPrevious.slice(currentIndexValue + 1))
                : itemIds.filter((id) => !playedSet.has(id));
            const order = latestCurrentId
                ? [...playedPrefix, latestCurrentId, ...future]
                : enabled ? fisherYates(itemIds) : itemIds;
            const validPriority = priorityNextRef.current.filter((id, index) => order.includes(id) && priorityNextRef.current.indexOf(id) === index);
            if (validPriority.length === 0) return order;
            const withoutPriority = order.filter((id) => !validPriority.includes(id));
            const priorityInsertIndex = latestCurrentId ? withoutPriority.indexOf(latestCurrentId) : -1;
            withoutPriority.splice(priorityInsertIndex >= 0 ? priorityInsertIndex + 1 : 0, 0, ...validPriority);
            return withoutPriority;
        });
    }, []);

    const toggleShuffle = useCallback(() => setShuffleEnabled(!shuffleEnabledRef.current), [setShuffleEnabled]);
    const setRepeatMode = useCallback((mode: RepeatMode) => {
        repeatModeRef.current = mode;
        setRepeatModeState(mode);
        if (!shuffleEnabledRef.current) setPlayMode(mode === 'one' ? 'single' : 'loop');
    }, []);
    const toggleRepeatMode = useCallback(() => {
        setRepeatModeState((mode) => {
            const next = mode === 'all' ? 'one' : 'all';
            repeatModeRef.current = next;
            if (!shuffleEnabledRef.current) setPlayMode(next === 'one' ? 'single' : 'loop');
            return next;
        });
    }, []);

    useEffect(() => {
        if (!playlistHydrated) return;

        const queueJSON = JSON.stringify(songs.map((song) => song.id));
        const persistedIndex = songs.length === 0 ? 0 : Math.min(currentIndex, songs.length - 1);
        Services.SavePlaylist(queueJSON, persistedIndex)
            .catch((error) => console.warn('保存播放列表失败', error));
    }, [songs, currentIndex, playlistHydrated]);

    // ========== 稳定的 Actions 对象 ==========
    const actions: PlayerActions = useMemo(() => ({
        // 队列控制
        setQueue,
        setCurrentIndex: setCurrentIndexSafe,
        setPlaylistHydrated,
        setCurrentQueueItemId,
        setPlayOrder,
        setHistory,
        playQueueItemAt,
        enqueueNext,
        enqueueLast,
        removeQueueItem,
        reorderQueueItems,
        clearUpcoming,
        consumePriorityNext,
        setShuffleEnabled,
        setRepeatMode,
        toggleShuffle,
        toggleRepeatMode,

        // 状态更新
        setSong: setCurrentSong,
        setIsPlaying,
        setProgress,
        setDuration,

        // 控制设置
        setVolume,
        setPlayMode: (mode) => {
            setPlayMode(mode);
            const enabled = mode === 'random';
            shuffleEnabledRef.current = enabled;
            repeatModeRef.current = mode === 'single' ? 'one' : 'all';
            setShuffleEnabledState(enabled);
            setRepeatModeState(mode === 'single' ? 'one' : 'all');
            setPlayOrder(buildPlayOrder(itemsRef.current, currentQueueItemIdRef.current, enabled, currentQueueItemIdRef.current));
        },
    }), [
        setQueue, setCurrentIndexSafe, setCurrentQueueItemId, playQueueItemAt, enqueueNext, enqueueLast,
        removeQueueItem, reorderQueueItems, clearUpcoming, consumePriorityNext, setShuffleEnabled, setRepeatMode,
        toggleShuffle, toggleRepeatMode,
    ]);

    // ========== 状态对象 ==========
    const playback: PlaybackState = useMemo(() => ({
        currentSong,
        isPlaying,
        progress,
        duration,
    }), [currentSong, isPlaying, progress, duration]);

    const queue: QueueState = useMemo(() => ({
        songs,
        currentIndex,
        items,
        playOrder,
        currentQueueItemId,
        history,
        priorityNext,
        shuffleEnabled,
        repeatMode,
    }), [songs, currentIndex, items, playOrder, currentQueueItemId, history, priorityNext, shuffleEnabled, repeatMode]);

    const controls: ControlsState = useMemo(() => ({
        volume,
        playMode,
    }), [volume, playMode]);

    // ========== Context Value ==========
    const contextValue: PlayerContextValue = useMemo(() => ({
        playback,
        queue,
        controls,
        actions,
    }), [playback, queue, controls, actions]);

    return (
        <PlayerContext.Provider value={contextValue}>
            {children}
        </PlayerContext.Provider>
    );
};

// ========== Hook ==========
export const usePlayerContext = (): PlayerContextValue => {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayerContext must be used within PlayerProvider');
    }
    return context;
};

export default PlayerContext;
