import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface UseScrollingTextOptions {
    text: string;
    containerWidth?: number;
    speed?: number; // 像素/秒
    pauseDuration?: number; // 暂停时间(秒)
    enabled?: boolean;
}

interface ScrollingTextResult {
    containerRef: React.RefObject<HTMLDivElement>;
    textRef: React.RefObject<HTMLSpanElement>;
    containerClassName: string;
    textClassName: string;
    containerStyle: React.CSSProperties;
    animationStyle: React.CSSProperties;
    shouldScroll: boolean;
}

// 防抖函数
const debounce = <T extends (...args: any[]) => void>(func: T, wait: number): T => {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    }) as T;
};

// 缓存文本宽度测量结果
const textWidthCache = new Map<string, number>();

export const useScrollingText = ({
    text,
    containerWidth = 300,
    speed = 60, // 60像素/秒
    pauseDuration = 2, // 2秒暂停
    enabled = true,
}: UseScrollingTextOptions): ScrollingTextResult => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);
    const [animationDuration, setAnimationDuration] = useState(10);
    const [scrollDistance, setScrollDistance] = useState(0);
    const measureTimeoutRef = useRef<NodeJS.Timeout>();

    // 生成缓存键
    const cacheKey = useMemo(() => `${text}-${containerWidth}`, [text, containerWidth]);

    // 防抖的测量函数
    const debouncedMeasure = useCallback(
        debounce(() => {
            if (!enabled || !text || !containerRef.current || !textRef.current) {
                setShouldScroll(false);
                return;
            }

            // 检查缓存
            const cachedWidth = textWidthCache.get(cacheKey);
            if (cachedWidth !== undefined) {
                const needsScroll = cachedWidth > containerWidth;
                setShouldScroll(needsScroll);

                if (needsScroll) {
                    const distance = cachedWidth - containerWidth;
                    setScrollDistance(distance);
                    const scrollTime = distance / speed;
                    const totalDuration = scrollTime + (pauseDuration * 2);
                    setAnimationDuration(totalDuration);
                }
                return;
            }

            const container = containerRef.current;
            const textElement = textRef.current;

            // 临时移除动画以获取准确测量
            const originalAnimation = textElement.style.animation;
            const originalTransform = textElement.style.transform;

            textElement.style.animation = 'none';
            textElement.style.transform = 'translateX(0)';

            // 使用 requestAnimationFrame 确保样式已应用
            requestAnimationFrame(() => {
                const containerRect = container.getBoundingClientRect();
                const textRect = textElement.getBoundingClientRect();

                const containerWidthPx = containerRect.width;
                const textWidthPx = textRect.width;

                // 缓存测量结果
                textWidthCache.set(cacheKey, textWidthPx);

                // 限制缓存大小
                if (textWidthCache.size > 100) {
                    const firstKey = textWidthCache.keys().next().value;
                    textWidthCache.delete(firstKey);
                }

                // 恢复原始样式
                textElement.style.animation = originalAnimation;
                textElement.style.transform = originalTransform;

                // 只有当文本宽度超过容器宽度时才启用滚动
                const needsScroll = textWidthPx > containerWidthPx && textWidthPx > 0;
                setShouldScroll(needsScroll);

                if (needsScroll) {
                    // 计算滚动距离（文本宽度 - 容器宽度）
                    const distance = textWidthPx - containerWidthPx;
                    setScrollDistance(distance);

                    // 根据滚动距离和速度计算动画时长
                    // 总时长 = 滚动时间 + 两端暂停时间
                    const scrollTime = distance / speed;
                    const totalDuration = scrollTime + (pauseDuration * 2);

                    setAnimationDuration(totalDuration);
                }
            });
        }, 300), // 300ms 防抖
        [enabled, text, containerWidth, speed, pauseDuration, cacheKey]
    );

    useEffect(() => {
        // 清除之前的定时器
        if (measureTimeoutRef.current) {
            clearTimeout(measureTimeoutRef.current);
        }

        // 延迟测量，确保DOM已渲染
        measureTimeoutRef.current = setTimeout(debouncedMeasure, 100);

        return () => {
            if (measureTimeoutRef.current) {
                clearTimeout(measureTimeoutRef.current);
            }
        };
    }, [debouncedMeasure]);

    // 防抖的窗口大小变化处理
    const debouncedHandleResize = useCallback(
        debounce(() => {
            // 清除相关缓存
            textWidthCache.delete(cacheKey);
            debouncedMeasure();
        }, 300),
        [cacheKey, debouncedMeasure]
    );

    useEffect(() => {
        window.addEventListener('resize', debouncedHandleResize);
        return () => {
            window.removeEventListener('resize', debouncedHandleResize);
        };
    }, [debouncedHandleResize]);

    // 使用 useMemo 优化样式对象
    const containerClassName = useMemo(
        () => `scrolling-text-container ${shouldScroll ? 'has-scrolling' : ''}`,
        [shouldScroll]
    );

    const textClassName = useMemo(
        () => `scrolling-text ${shouldScroll ? 'animate' : ''}`,
        [shouldScroll]
    );

    const containerStyle: React.CSSProperties = useMemo(() => ({
        maxWidth: containerWidth,
        '--container-width': `${containerWidth}px`,
        '--scroll-distance': `-${scrollDistance}px`,
    } as React.CSSProperties), [containerWidth, scrollDistance]);

    const animationStyle: React.CSSProperties = useMemo(() => shouldScroll ? {
        '--animation-duration': `${animationDuration}s`,
        '--animation-delay': `${pauseDuration}s`,
        animation: `smoothScroll ${animationDuration}s linear infinite`,
        animationDelay: `${pauseDuration}s`,
        // 启用硬件加速
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
    } : {
        // 禁用硬件加速以节省资源
        willChange: 'auto',
    }, [shouldScroll, animationDuration, pauseDuration]);

    return {
        containerRef,
        textRef,
        containerClassName,
        textClassName,
        containerStyle,
        animationStyle,
        shouldScroll,
    };
};