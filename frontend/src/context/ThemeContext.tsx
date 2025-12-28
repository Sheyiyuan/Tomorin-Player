import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { MantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { Theme } from '../types';
import { DEFAULT_THEMES } from '../utils/constants';

// ========== 类型定义 ==========
export interface ThemeState {
    themes: Theme[];
    currentThemeId: string | null;
    themeColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    backgroundImageUrl: string;
    backgroundBlur: number;
    panelColor: string;
    panelOpacity: number;
    panelBlur: number;
    panelRadius: number;
    componentRadius: number;
    coverRadius: number;
    windowControlsPos: string;
    computedColorScheme: MantineColorScheme;
}

export interface ThemeActions {
    setThemes: (themes: Theme[]) => void;
    setCurrentThemeId: (id: string | null) => void;
    setThemeColor: (color: string) => void;
    setBackgroundColor: (color: string) => void;
    setBackgroundOpacity: (opacity: number) => void;
    setBackgroundImageUrl: (url: string) => void;
    setBackgroundBlur: (blur: number) => void;
    setPanelColor: (color: string) => void;
    setPanelOpacity: (opacity: number) => void;
    setPanelBlur: (blur: number) => void;
    setPanelRadius: (radius: number) => void;
    setComponentRadius: (radius: number) => void;
    setCoverRadius: (radius: number) => void;
    setWindowControlsPos: (pos: string) => void;

    // 工具方法
    applyTheme: (theme: Theme) => void;
    setBackgroundImageUrlSafe: (url: string) => void;
}

export interface ThemeContextValue {
    state: ThemeState;
    actions: ThemeActions;
}

// ========== Context 创建 ==========
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ========== Provider 组件 ==========
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 获取 Mantine 计算的颜色方案
    const computedColorScheme = useComputedColorScheme('light');

    // ========== 初始化数据 ==========
    // 从 localStorage 读取缓存的自定义主题
    const getCachedThemes = (): Theme[] => {
        try {
            const saved = localStorage.getItem('half-beat.customThemes');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('[ThemeContext] 读取缓存主题失败:', e);
        }
        return [];
    };

    const initialThemes = [...DEFAULT_THEMES, ...getCachedThemes()];

    // 优先从 localStorage 读取，否则使用系统偏好
    const getInitialThemeId = (allThemes: Theme[]): string => {
        try {
            const saved = localStorage.getItem('currentThemeId');
            if (saved && allThemes.find(t => t.id === saved)) {
                return saved;
            }
        } catch (e) {
            console.warn('[ThemeContext] 读取 localStorage 失败:', e);
        }
        const fallback = computedColorScheme === "dark" ? "dark" : "light";
        return fallback;
    };

    const initialThemeId = getInitialThemeId(initialThemes);
    const defaultTheme = initialThemes.find(t => t.id === initialThemeId) || DEFAULT_THEMES.find(t => t.id === "light")!;

    const [themes, setThemes] = useState<Theme[]>(initialThemes);
    const [currentThemeId, setCurrentThemeId] = useState<string | null>(defaultTheme.id);
    const [themeColor, setThemeColor] = useState(defaultTheme.themeColor);
    const [backgroundColor, setBackgroundColor] = useState(defaultTheme.backgroundColor);
    const [backgroundOpacity, setBackgroundOpacity] = useState(defaultTheme.backgroundOpacity);
    const [backgroundImageUrl, setBackgroundImageUrl] = useState(defaultTheme.backgroundImage || "");
    const [backgroundBlur, setBackgroundBlur] = useState(defaultTheme.backgroundBlur || 0);
    const [panelColor, setPanelColor] = useState(defaultTheme.panelColor);
    const [panelOpacity, setPanelOpacity] = useState(defaultTheme.panelOpacity);
    const [panelBlur, setPanelBlur] = useState(defaultTheme.panelBlur ?? 0);
    const [panelRadius, setPanelRadius] = useState(defaultTheme.panelRadius ?? 8);
    const [componentRadius, setComponentRadius] = useState(defaultTheme.componentRadius ?? 8);
    const [coverRadius, setCoverRadius] = useState(defaultTheme.coverRadius ?? 8);
    const [windowControlsPos, setWindowControlsPos] = useState(defaultTheme.windowControlsPos || "right");

    // ========== Actions ==========

    /**
     * 应用主题
     */
    const applyTheme = useCallback((theme: Theme) => {
        setThemeColor(theme.themeColor);
        setBackgroundColor(theme.backgroundColor);
        setBackgroundOpacity(theme.backgroundOpacity);
        // 使用后端模型字段名 backgroundImage
        setBackgroundImageUrl(theme.backgroundImage || "");
        setBackgroundBlur(theme.backgroundBlur ?? 0);
        setPanelColor(theme.panelColor);
        setPanelOpacity(theme.panelOpacity);
        setPanelBlur(theme.panelBlur ?? 0);
        setPanelRadius(theme.panelRadius ?? 8);
        setComponentRadius(theme.componentRadius ?? 8);
        setCoverRadius(theme.coverRadius ?? 8);
        setWindowControlsPos(theme.windowControlsPos || "right");
        setCurrentThemeId(theme.id);

        // 只保存主题 ID 到 localStorage，避免字段污染
        localStorage.setItem('currentThemeId', theme.id);
    }, []);

    /**
     * 安全设置背景图片 URL
     */
    const setBackgroundImageUrlSafe = useCallback((url: string) => {
        const trimmedUrl = url.trim();

        // 验证 URL 格式：允许 http://, https://, 和 data: URLs
        if (trimmedUrl &&
            !trimmedUrl.startsWith('http://') &&
            !trimmedUrl.startsWith('https://') &&
            !trimmedUrl.startsWith('data:')) {
            console.warn('Invalid background image URL:', trimmedUrl);
            return;
        }

        setBackgroundImageUrl(trimmedUrl);
        localStorage.setItem('backgroundImageUrl', trimmedUrl);
    }, []);

    // ========== Effect: 清理旧的 localStorage 字段 ==========
    useEffect(() => {
        // 清理旧的污染字段
        const fieldsToClean = [
            'themeColor', 'backgroundColor', 'backgroundOpacity', 'backgroundImageUrl',
            'panelColor', 'panelOpacity'
        ];
        fieldsToClean.forEach(field => {
            try {
                localStorage.removeItem(field);
            } catch (e) {
                // 忽略错误
            }
        });
    }, []);

    // ========== Effect: 当 themes 或 currentThemeId 改变时，自动应用主题 ==========
    useEffect(() => {
        if (themes.length === 0) return;

        // 查找当前主题
        let targetTheme = themes.find(t => t.id === currentThemeId);

        // 如果当前主题不存在，使用第一个主题
        if (!targetTheme) {
            targetTheme = themes[0];
            setCurrentThemeId(targetTheme.id);
            return;  // 等待 setCurrentThemeId 完成后再应用
        }

        // 应用主题
        applyTheme(targetTheme);
    }, [themes, currentThemeId, applyTheme]);

    // ========== Context Value ==========
    const value: ThemeContextValue = {
        state: {
            themes,
            currentThemeId,
            themeColor,
            backgroundColor,
            backgroundOpacity,
            backgroundImageUrl,
            backgroundBlur,
            panelColor,
            panelOpacity,
            panelBlur,
            panelRadius,
            componentRadius,
            coverRadius,
            windowControlsPos,
            computedColorScheme,
        },
        actions: {
            setThemes,
            setCurrentThemeId,
            setThemeColor,
            setBackgroundColor,
            setBackgroundOpacity,
            setBackgroundImageUrl,
            setBackgroundBlur,
            setPanelColor,
            setPanelOpacity,
            setPanelBlur,
            setPanelRadius,
            setComponentRadius,
            setCoverRadius,
            setWindowControlsPos,
            applyTheme,
            setBackgroundImageUrlSafe,
        },
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// ========== Hook ==========
export const useThemeContext = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useThemeContext must be used within ThemeProvider');
    }
    return context;
};
