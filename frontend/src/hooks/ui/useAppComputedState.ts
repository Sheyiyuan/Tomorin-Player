/**
 * useAppComputedState - 应用派生值计算
 * 集中所有需要 memo 和 useMemo 的派生值计算
 */

import { useMemo } from 'react';

interface UseAppComputedStateProps {
    duration: number;
    backgroundImageUrl: string;
    backgroundBlur: number;
    backgroundWithOpacity: string;
}

export const useAppComputedState = ({
    duration,
    backgroundImageUrl,
    backgroundBlur,
    backgroundWithOpacity,
}: UseAppComputedStateProps) => {
    // 播放区间相关派生值
    const maxSkipLimit = duration > 0 ? duration : 1;

    // 背景样式
    const backgroundStyle = useMemo(() => ({
        backgroundColor: backgroundWithOpacity,
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed" as const,
        filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
        transform: "none",
    }), [backgroundWithOpacity, backgroundImageUrl, backgroundBlur]);

    return {
        maxSkipLimit,
        backgroundStyle,
    };
};
