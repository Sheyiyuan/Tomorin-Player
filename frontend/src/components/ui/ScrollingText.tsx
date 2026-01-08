import React from 'react';
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

export const ScrollingText: React.FC<ScrollingTextProps> = ({
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
                ...style,
            }}
        >
            <Text
                {...textProps}
                ref={textRef as any}
                className={textClassName}
                styles={{
                    root: {
                        ...animationStyle,
                        ...(typeof textProps.styles === 'object' && textProps.styles?.root ? textProps.styles.root : {}),
                    }
                }}
                title={text}
            >
                {text}
            </Text>
        </div>
    );
};