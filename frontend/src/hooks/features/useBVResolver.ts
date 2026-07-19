/**
 * BV 号解析 Hook
 * 管理 Bilibili 视频解析，支持搜索本地和远程结果
 */

import { useState, useCallback } from 'react';
import type { BVPreview } from '../../types';
import { useUIStore } from '../../context/hooks/useUIStore';

export type { BVPreview } from '../../types';

export interface UseBVResolverReturn {
    bvPreview: BVPreview | null;
    bvSongName: string;
    bvSinger: string;
    bvTargetFavId: string | null;
    resolvingBV: boolean;
    sliceStart: number;
    sliceEnd: number;

    setBvPreview: React.Dispatch<React.SetStateAction<BVPreview | null>>;
    openBvModal: () => void;
    closeBvModal: () => void;
    setBvSongName: React.Dispatch<React.SetStateAction<string>>;
    setBvSinger: React.Dispatch<React.SetStateAction<string>>;
    setBvTargetFavId: React.Dispatch<React.SetStateAction<string | null>>;
    setResolvingBV: React.Dispatch<React.SetStateAction<boolean>>;
    setSliceStart: React.Dispatch<React.SetStateAction<number>>;
    setSliceEnd: React.Dispatch<React.SetStateAction<number>>;
}

export const useBVResolver = () => {
    const [bvPreview, setBvPreview] = useState<BVPreview | null>(null);
    const { openModal, closeModal } = useUIStore().actions;
    const [bvSongName, setBvSongName] = useState('');
    const [bvSinger, setBvSinger] = useState('');
    const [bvTargetFavId, setBvTargetFavId] = useState<string | null>(null);
    const [resolvingBV, setResolvingBV] = useState(false);
    const [sliceStart, setSliceStart] = useState(0);
    const [sliceEnd, setSliceEnd] = useState(0);
    const openBvModal = useCallback(() => openModal('bvAddModal'), [openModal]);
    const closeBvModal = useCallback(() => closeModal('bvAddModal'), [closeModal]);

    return {
        bvPreview,
        bvSongName,
        bvSinger,
        bvTargetFavId,
        resolvingBV,
        sliceStart,
        sliceEnd,

        setBvPreview,
        openBvModal,
        closeBvModal,
        setBvSongName,
        setBvSinger,
        setBvTargetFavId,
        setResolvingBV,
        setSliceStart,
        setSliceEnd,
    };
};
