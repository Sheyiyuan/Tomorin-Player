import React, { memo } from 'react';
import { Text, TextProps } from '@mantine/core';
import { useScrollingText } from '../../hooks/ui/useScrollingText';

interface ScrollingTextProps extends Omit<TextProps, 'children'> {
    text: string;
    containerWidth?: number;
    speed?: number;
    pauseDuration?: number;
    enabled?: boolean;
    fallbackColor?: string;
}

const ScrollingTextComponent: React.FC<ScrollingTextProps> = ({
    text,
    containerWidth = 300,
    speed = 30,
    pauseDuration = 1.5,
    enabled = true,
    fallbackColor,
    style,
    ...textProps
}) => {
    const {
        containerRef,
        textRef,
        shouldScroll,
        containerClassName,
        textClassName,
        containerStyle,
        animationStyle,
    } = useScrollingText({
        text,
        containerWidth,
        speed,
        pauseDuration,
        enabled,
    });

    return (
        <div
            ref={containerRef}
            className={containerClassName}
            style={{
                ...containerStyle,
                ['--text-bg-color' as any]: fallbackColor || 'rgba(0, 0, 0, 0.9)',
                ...(style as React.CSSProperties),
            }}
        >
            <div
                ref={textRef as any}
                className={textClassName}
                style={animationStyle as React.CSSProperties}
            >
                <Text
                    {...textProps}
                    title={text}
                >
                    {text}
                </Text>
            </div>
        </div>
    );
};

// 使用 React.memo 优化，只在关键 props 变化时重新渲染
export const ScrollingText = memo(ScrollingTextComponent, (prevProps, nextProps) => {
    // 自定义比较函数，只比较影响渲染的关键属性
    return (
        prevProps.text === nextProps.text &&
        prevProps.containerWidth === nextProps.containerWidth &&
        prevProps.speed === nextProps.speed &&
        prevProps.pauseDuration === nextProps.pauseDuration &&
        prevProps.enabled === nextProps.enabled &&
        prevProps.fallbackColor === nextProps.fallbackColor
    );
});