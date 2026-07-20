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

    const externalStyle: React.CSSProperties = style && typeof style === 'object' && !Array.isArray(style)
        ? style
        : {};
    const mergedStyle: React.CSSProperties & { '--text-bg-color': string } = {
        ...containerStyle,
        '--text-bg-color': fallbackColor || 'rgba(0, 0, 0, 0.9)',
        ...externalStyle,
    };

    return (
        <div
            ref={containerRef}
            className={containerClassName}
            style={mergedStyle}
        >
            <Text
                {...textProps}
                component="span"
                ref={textRef}
                className={textClassName}
                style={animationStyle as React.CSSProperties}
                title={text}
            >
                {text}
            </Text>
        </div>
    );
};
