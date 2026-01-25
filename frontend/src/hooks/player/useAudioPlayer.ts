/**
 * 音频播放器核心 Hook
 * 管理音频元素和基础播放状态
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import type { Song } from '../../types';

export interface AudioPlayerState {
    isPlaying: boolean;
    progress: number;
    duration: number;
    volume: number;
}

export interface AudioPlayerActions {
    play: () => Promise<void>;
    pause: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
}

export interface UseAudioPlayerReturn {
    audioRef: React.RefObject<HTMLAudioElement>;
    state: AudioPlayerState;
    actions: AudioPlayerActions;
    ensureWebAudioReady?: () => void;
}

export const useAudioPlayer = (currentSong: Song | null, initialVolume?: number, volumeCompensationDb: number = 0) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const originalPlayRef = useRef<((...args: any[]) => Promise<void>) | null>(null);
    const audioMountedRef = useRef(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(initialVolume ?? 0.5);

    // 初始化音频元素（注意：在 Wails/Linux WebKit 下，new Audio() + WebAudio 路由可能导致无声；
    // 挂到 DOM 的 <audio> 更稳）
    useEffect(() => {
        if (!audioRef.current) {
            const el = document.createElement('audio');
            el.crossOrigin = 'anonymous';
            el.preload = 'metadata';
            el.style.position = 'fixed';
            el.style.left = '-99999px';
            el.style.width = '1px';
            el.style.height = '1px';
            el.style.opacity = '0';
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
            audioRef.current = el;
            audioMountedRef.current = true;
        }
    }, []);

    // 在首次播放时建立 WebAudio 链路并确保 resume（避免启动阶段就创建 AudioContext 导致策略/无声问题）
    const ensureWebAudioReady = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (!audioContextRef.current) {
            const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextCtor) {
                audioContextRef.current = new AudioContextCtor();
            }
        }
        const ctx = audioContextRef.current;
        if (!ctx) return;

        if (!gainNodeRef.current) {
            gainNodeRef.current = ctx.createGain();
            gainNodeRef.current.gain.value = 1;
        }

        if (!sourceNodeRef.current) {
            try {
                sourceNodeRef.current = ctx.createMediaElementSource(audio);
                sourceNodeRef.current.connect(gainNodeRef.current);
                gainNodeRef.current.connect(ctx.destination);
            } catch (err) {
                console.warn('创建音频增益节点失败，回退到原生音量控制:', err);
            }
        }

        // 注入 play：无论谁调用 audio.play()，都尽量先 resume
        if (!originalPlayRef.current) {
            originalPlayRef.current = (audio.play as any).bind(audio);
            (audio as any).play = async (...args: any[]) => {
                try {
                    if (ctx.state === 'suspended') {
                        ctx.resume().catch((e: any) => {
                            console.warn('AudioContext resume 失败（可能被浏览器策略阻止）:', e);
                        });
                    }
                } catch (e) {
                    console.warn('AudioContext resume 失败（可能被浏览器策略阻止）:', e);
                }
                return originalPlayRef.current!(...args);
            };
        }
    }, []);

    // 同步音量
    useEffect(() => {
        if (!audioRef.current) return;
        if (gainNodeRef.current) {
            audioRef.current.volume = volume;
            return;
        }
        const db = Number.isFinite(volumeCompensationDb) ? volumeCompensationDb : 0;
        const gain = Math.pow(10, db / 20);
        const effectiveVolume = Math.min(1, Math.max(0, volume * gain));
        audioRef.current.volume = effectiveVolume;
    }, [volume, volumeCompensationDb]);

    // 应用音量补偿（dB）到 GainNode
    useEffect(() => {
        if (!gainNodeRef.current) return;
        const db = Number.isFinite(volumeCompensationDb) ? volumeCompensationDb : 0;
        const gain = Math.pow(10, db / 20);
        const clamped = Math.min(4, Math.max(0.25, gain));
        gainNodeRef.current.gain.value = clamped;
    }, [volumeCompensationDb]);

    const play = useCallback(async () => {
        if (!audioRef.current) return;
        try {
            ensureWebAudioReady();
            audioRef.current.muted = false;
            await audioRef.current.play();
            setIsPlaying(true);
        } catch (error) {
            console.error('播放失败:', error);
            setIsPlaying(false);
        }
    }, [ensureWebAudioReady]);

    // 卸载时清理隐藏 audio
    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            if (audioMountedRef.current && audio?.parentElement) {
                try {
                    audio.pause();
                    audio.src = '';
                    audio.load();
                } catch { }
                audio.parentElement.removeChild(audio);
            }
        };
    }, []);

    const pause = useCallback(() => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        setIsPlaying(false);
    }, []);

    const seek = useCallback((time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        setProgress(time);
    }, []);

    const handleVolumeChange = useCallback((newVolume: number) => {
        setVolume(newVolume);
    }, []);

    return {
        audioRef,
        state: {
            isPlaying,
            progress,
            duration,
            volume,
        },
        actions: {
            play,
            pause,
            seek,
            setVolume: handleVolumeChange,
        },
        ensureWebAudioReady,
        // 内部状态设置器（供其他 hooks 使用）
        setIsPlaying,
        setProgress,
        setDuration,
    };
};
