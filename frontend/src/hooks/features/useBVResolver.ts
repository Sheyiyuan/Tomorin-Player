/**
 * BV 号解析 Hook
 * 管理 Bilibili 视频解析和预览
 */

import { useState, useCallback } from 'react';
import * as Services from '../../../wailsjs/go/services/Service';
import { notifications } from '@mantine/notifications';

export interface BVPreview {
    bvid: string;
    title: string;
    cover: string;
    url: string;
    expiresAt: string;
    duration: number;
}

export interface UseBVResolverReturn {
    bvPreview: BVPreview | null;
    bvModalOpen: boolean;
    bvSongName: string;
    bvSinger: string;
    bvTargetFavId: string | null;
    resolvingBV: boolean;
    sliceStart: number;
    sliceEnd: number;
    isSlicePreviewing: boolean;
    slicePreviewPosition: number;

    setBvPreview: React.Dispatch<React.SetStateAction<BVPreview | null>>;
    setBvModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setBvSongName: React.Dispatch<React.SetStateAction<string>>;
    setBvSinger: React.Dispatch<React.SetStateAction<string>>;
    setBvTargetFavId: React.Dispatch<React.SetStateAction<string | null>>;
    setResolvingBV: React.Dispatch<React.SetStateAction<boolean>>;
    setSliceStart: React.Dispatch<React.SetStateAction<number>>;
    setSliceEnd: React.Dispatch<React.SetStateAction<number>>;
    setIsSlicePreviewing: React.Dispatch<React.SetStateAction<boolean>>;
    setSlicePreviewPosition: React.Dispatch<React.SetStateAction<number>>;

    resolveBV: (input: string) => Promise<void>;
    resetBVState: () => void;
}

export const useBVResolver = () => {
    const [bvPreview, setBvPreview] = useState<BVPreview | null>(null);
    const [bvModalOpen, setBvModalOpen] = useState(false);
    const [bvSongName, setBvSongName] = useState('');
    const [bvSinger, setBvSinger] = useState('');
    const [bvTargetFavId, setBvTargetFavId] = useState<string | null>(null);
    const [resolvingBV, setResolvingBV] = useState(false);
    const [sliceStart, setSliceStart] = useState(0);
    const [sliceEnd, setSliceEnd] = useState(0);
    const [isSlicePreviewing, setIsSlicePreviewing] = useState(false);
    const [slicePreviewPosition, setSlicePreviewPosition] = useState(0);

    // 解析 BV 号
    const resolveBV = useCallback(async (input: string) => {
        if (!input.trim()) {
            notifications.show({
                title: '输入为空',
                message: '请输入 BV 号',
                color: 'orange',
            });
            return;
        }

        setResolvingBV(true);
        try {
            const result = await Services.ResolveBiliAudio(input);
            setBvPreview({
                bvid: input,
                title: result.title,
                cover: result.cover,
                url: result.url,
                expiresAt: result.expiresAt,
                duration: result.duration || 0,
            });
            setBvSongName(result.title);
            setBvModalOpen(true);
        } catch (error) {
            console.error('解析 BV 号失败:', error);
            notifications.show({
                title: '解析失败',
                message: error instanceof Error ? error.message : '未知错误',
                color: 'red',
            });
        } finally {
            setResolvingBV(false);
        }
    }, []);

    // 重置状态
    const resetBVState = useCallback(() => {
        setBvPreview(null);
        setBvModalOpen(false);
        setBvSongName('');
        setBvSinger('');
        setBvTargetFavId(null);
        setSliceStart(0);
        setSliceEnd(0);
        setIsSlicePreviewing(false);
        setSlicePreviewPosition(0);
    }, []);

    return {
        bvPreview,
        bvModalOpen,
        bvSongName,
        bvSinger,
        bvTargetFavId,
        resolvingBV,
        sliceStart,
        sliceEnd,
        isSlicePreviewing,
        slicePreviewPosition,

        setBvPreview,
        setBvModalOpen,
        setBvSongName,
        setBvSinger,
        setBvTargetFavId,
        setResolvingBV,
        setSliceStart,
        setSliceEnd,
        setIsSlicePreviewing,
        setSlicePreviewPosition,

        resolveBV,
        resetBVState,
    };
};
