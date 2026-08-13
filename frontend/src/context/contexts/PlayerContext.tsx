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
    QueueActivationReason,
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
    const playOrderRef = useRef(playOrder);
    const historyRef = useRef(history);
    const priorityNextRef = useRef(priorityNext);
    const shuffleEnabledRef = useRef(shuffleEnabled);
    const repeatModeRef = useRef(repeatMode);
    itemsRef.current = items;
    currentQueueItemIdRef.current = currentQueueItemId;
    playOrderRef.current = playOrder;
    historyRef.current = history;
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
        const previous = itemsRef.current;
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
        const nextIds = nextItems.map((item) => item.queueItemId);
        const current = currentQueueItemIdRef.current;
        const nextCurrent = current && nextIds.includes(current) ? current : nextIds[0] ?? null;
        const retainedOrder = playOrderRef.current.filter((id) => nextIds.includes(id));
        const nextOrder = retainedOrder.length === nextIds.length && retainedOrder.length > 0
            ? retainedOrder
            : buildPlayOrder(nextItems, nextCurrent, shuffleEnabledRef.current);
        const nextPriority = priorityNextRef.current.filter((id, index, values) =>
            nextIds.includes(id) && values.indexOf(id) === index,
        );
        const nextHistory = historyRef.current.filter((id) => nextIds.includes(id));

        itemsRef.current = nextItems;
        currentQueueItemIdRef.current = nextCurrent;
        playOrderRef.current = nextOrder;
        priorityNextRef.current = nextPriority;
        historyRef.current = nextHistory;
        setItems(nextItems);
        setCurrentQueueItemIdState(nextCurrent);
        setPlayOrder(nextOrder);
        setPriorityNext(nextPriority);
        setHistory(nextHistory);
    }, []);

    const setCurrentIndexSafe = useCallback((index: number) => {
        const currentItems = itemsRef.current;
        const safeIndex = Math.min(Math.max(0, index), Math.max(0, currentItems.length - 1));
        const nextId = currentItems[safeIndex]?.queueItemId ?? null;
        currentQueueItemIdRef.current = nextId;
        setCurrentQueueItemIdState(nextId);
    }, []);

    const setCurrentQueueItemId = useCallback((queueItemId: string | null, recordHistory = true) => {
        const current = currentQueueItemIdRef.current;
        if (queueItemId === current) return;
        if (recordHistory && current) {
            const nextHistory = [...historyRef.current, current].slice(-500);
            historyRef.current = nextHistory;
            setHistory(nextHistory);
        }
        currentQueueItemIdRef.current = queueItemId;
        setCurrentQueueItemIdState(queueItemId);
    }, []);

    const activateQueueItem = useCallback((queueItemId: string, reason: QueueActivationReason = 'manual') => {
        const item = itemsRef.current.find((candidate) => candidate.queueItemId === queueItemId);
        if (!item) return;

        if (reason !== 'previous') {
            const nextPriority = priorityNextRef.current.filter((id) => id !== queueItemId);
            priorityNextRef.current = nextPriority;
            setPriorityNext(nextPriority);
        }

        setCurrentQueueItemId(queueItemId, reason !== 'previous' && reason !== 'fallback');
        setCurrentSong(item.song);
    }, [setCurrentQueueItemId]);

    const setPlayOrderSafe = useCallback((nextOrder: string[]) => {
        playOrderRef.current = nextOrder;
        setPlayOrder(nextOrder);
    }, []);

    const setHistorySafe = useCallback((nextHistory: string[]) => {
        historyRef.current = nextHistory;
        setHistory(nextHistory);
    }, []);

    const playQueueItemAt = useCallback((index: number) => {
        const item = itemsRef.current[index];
        if (item) activateQueueItem(item.queueItemId, 'manual');
    }, [activateQueueItem]);

    const enqueueNext = useCallback((song: Song) => {
        const item = { queueItemId: createQueueItemId(), song };
        const previousPriority = priorityNextRef.current;
        const anchorId = previousPriority[previousPriority.length - 1] ?? currentQueueItemIdRef.current;
        const anchorItemIndex = anchorId
            ? itemsRef.current.findIndex((candidate) => candidate.queueItemId === anchorId)
            : -1;
        const nextItems = [...itemsRef.current];
        nextItems.splice(anchorItemIndex >= 0 ? anchorItemIndex + 1 : nextItems.length, 0, item);
        const anchorOrderIndex = anchorId ? playOrderRef.current.indexOf(anchorId) : -1;
        const nextOrder = [...playOrderRef.current];
        nextOrder.splice(anchorOrderIndex >= 0 ? anchorOrderIndex + 1 : nextOrder.length, 0, item.queueItemId);
        const nextPriority = [...previousPriority, item.queueItemId];

        itemsRef.current = nextItems;
        playOrderRef.current = nextOrder;
        priorityNextRef.current = nextPriority;
        setItems(nextItems);
        setPlayOrder(nextOrder);
        setPriorityNext(nextPriority);
        return item.queueItemId;
    }, []);

    const enqueueLast = useCallback((song: Song) => {
        const item = { queueItemId: createQueueItemId(), song };
        const nextItems = [...itemsRef.current, item];
        const nextOrder = [...playOrderRef.current, item.queueItemId];
        itemsRef.current = nextItems;
        playOrderRef.current = nextOrder;
        setItems(nextItems);
        setPlayOrder(nextOrder);
        return item.queueItemId;
    }, []);

    const removeQueueItem = useCallback((queueItemId: string) => {
        if (!itemsRef.current.some((item) => item.queueItemId === queueItemId)) return;
        const currentOrderIndex = playOrderRef.current.indexOf(queueItemId);
        const fallbackId = playOrderRef.current[currentOrderIndex + 1] ?? playOrderRef.current[currentOrderIndex - 1] ?? null;
        const nextItems = itemsRef.current.filter((item) => item.queueItemId !== queueItemId);
        const nextOrder = playOrderRef.current.filter((id) => id !== queueItemId);
        const nextPriority = priorityNextRef.current.filter((id) => id !== queueItemId);
        const nextHistory = historyRef.current.filter((id) => id !== queueItemId);

        itemsRef.current = nextItems;
        playOrderRef.current = nextOrder;
        priorityNextRef.current = nextPriority;
        historyRef.current = nextHistory;
        setItems(nextItems);
        setPlayOrder(nextOrder);
        setPriorityNext(nextPriority);
        setHistory(nextHistory);

        if (currentQueueItemIdRef.current === queueItemId) {
            const fallbackItem = nextItems.find((item) => item.queueItemId === fallbackId);
            if (fallbackItem) activateQueueItem(fallbackItem.queueItemId, 'fallback');
            else {
                setCurrentQueueItemId(null, false);
                setCurrentSong(null);
            }
            setIsPlaying(Boolean(fallbackItem));
        }
    }, [activateQueueItem, setCurrentQueueItemId]);

    const reorderQueueItems = useCallback((fromQueueItemId: string, toQueueItemId: string) => {
        if (!shuffleEnabled) {
            const nextItems = reorderItems(itemsRef.current, fromQueueItemId, toQueueItemId);
            itemsRef.current = nextItems;
            setItems(nextItems);
        }
        const from = playOrderRef.current.indexOf(fromQueueItemId);
        const to = playOrderRef.current.indexOf(toQueueItemId);
        if (from >= 0 && to >= 0 && from !== to) {
            const nextOrder = [...playOrderRef.current];
            const [moved] = nextOrder.splice(from, 1);
            nextOrder.splice(to, 0, moved);
            playOrderRef.current = nextOrder;
            setPlayOrder(nextOrder);
        }
        priorityNextRef.current = [];
        setPriorityNext([]);
    }, [shuffleEnabled]);

    const clearUpcoming = useCallback(() => {
        const currentQueueItemId = currentQueueItemIdRef.current;
        if (!currentQueueItemId) return;
        const currentOrderIndex = playOrderRef.current.indexOf(currentQueueItemId);
        if (currentOrderIndex < 0) return;
        const upcoming = new Set(playOrderRef.current.slice(currentOrderIndex + 1));
        const nextItems = itemsRef.current.filter((item) => !upcoming.has(item.queueItemId));
        const nextOrder = playOrderRef.current.filter((id) => !upcoming.has(id));
        const nextPriority = priorityNextRef.current.filter((id) => !upcoming.has(id));
        itemsRef.current = nextItems;
        playOrderRef.current = nextOrder;
        priorityNextRef.current = nextPriority;
        setItems(nextItems);
        setPlayOrder(nextOrder);
        setPriorityNext(nextPriority);
    }, []);

    const setShuffleEnabled = useCallback((enabled: boolean) => {
        shuffleEnabledRef.current = enabled;
        setShuffleEnabledState(enabled);
        setPlayMode(enabled ? 'random' : repeatModeRef.current === 'one' ? 'single' : 'loop');
        const itemIds = itemsRef.current.map((item) => item.queueItemId);
        const validPrevious = playOrderRef.current.filter((id) => itemIds.includes(id));
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
        const validPriority = priorityNextRef.current.filter((id, index) =>
            order.includes(id) && priorityNextRef.current.indexOf(id) === index,
        );
        const nextOrder = validPriority.length === 0 ? order : (() => {
            const withoutPriority = order.filter((id) => !validPriority.includes(id));
            const priorityInsertIndex = latestCurrentId ? withoutPriority.indexOf(latestCurrentId) : -1;
            withoutPriority.splice(priorityInsertIndex >= 0 ? priorityInsertIndex + 1 : 0, 0, ...validPriority);
            return withoutPriority;
        })();
        playOrderRef.current = nextOrder;
        setPlayOrder(nextOrder);
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
        activateQueueItem,
        setPlayOrder: setPlayOrderSafe,
        setHistory: setHistorySafe,
        playQueueItemAt,
        enqueueNext,
        enqueueLast,
        removeQueueItem,
        reorderQueueItems,
        clearUpcoming,
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
            const nextOrder = buildPlayOrder(itemsRef.current, currentQueueItemIdRef.current, enabled, currentQueueItemIdRef.current);
            playOrderRef.current = nextOrder;
            setPlayOrder(nextOrder);
        },
    }), [
        setQueue, setCurrentIndexSafe, activateQueueItem, setPlayOrderSafe, setHistorySafe,
        playQueueItemAt, enqueueNext, enqueueLast, removeQueueItem, reorderQueueItems, clearUpcoming, setShuffleEnabled, setRepeatMode,
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
