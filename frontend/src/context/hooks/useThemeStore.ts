/**
 * 主题状态选择器 Hook
 * 提供细粒度的主题状态订阅，减少不必要的重新渲染
 */

import { useThemeContext } from '../contexts/ThemeContext';
import { ThemeContextValue } from '../types/contexts';

// ========== 基础选择器 Hook ==========
export const useThemeStore = <T = ThemeContextValue>(
    selector?: (state: ThemeContextValue) => T
): T => {
    const context = useThemeContext();

    if (selector) {
        return selector(context);
    }

    return context as T;
};

// ========== 便捷选择器 Hooks ==========

// 主题信息选择器
export const useThemeInfo = () => useThemeStore(state => state.theme);
export const useThemes = () => useThemeStore(state => state.theme.themes);
export const useCurrentThemeId = () => useThemeStore(state => state.theme.currentThemeId);
export const useColorScheme = () => useThemeStore(state => state.theme.colorScheme);

// 颜色配置选择器
export const useColors = () => useThemeStore(state => state.colors);
export const useThemeColor = () => useThemeStore(state => state.colors.themeColor);
export const useBackgroundColor = () => useThemeStore(state => state.colors.backgroundColor);
export const usePanelColor = () => useThemeStore(state => state.colors.panelColor);
export const useTextColors = () => useThemeStore(state => ({
    primary: state.colors.textColorPrimary,
    secondary: state.colors.textColorSecondary,
}));

// 效果配置选择器
export const useEffects = () => useThemeStore(state => state.effects);
export const useBackgroundEffects = () => useThemeStore(state => ({
    opacity: state.effects.backgroundOpacity,
    imageUrl: state.effects.backgroundImageUrl,
    blur: state.effects.backgroundBlur,
}));
export const usePanelEffects = () => useThemeStore(state => ({
    opacity: state.effects.panelOpacity,
    blur: state.effects.panelBlur,
}));

// 布局配置选择器
export const useLayout = () => useThemeStore(state => state.layout);
export const useRadius = () => useThemeStore(state => ({
    panel: state.layout.panelRadius,
    component: state.layout.componentRadius,
    modal: state.layout.modalRadius,
    cover: state.layout.coverRadius,
}));

// 操作选择器
export const useThemeActions = () => useThemeStore(state => state.actions);

// 组合选择器（用于需要多个状态的组件）
export const useCurrentTheme = () => useThemeStore(state => {
    const currentTheme = state.theme.themes.find(t => t.id === state.theme.currentThemeId);
    return currentTheme || null;
});

export const useThemeStyles = () => useThemeStore(state => ({
    themeColor: state.colors.themeColor,
    backgroundColor: state.colors.backgroundColor,
    panelColor: state.colors.panelColor,
    textColorPrimary: state.colors.textColorPrimary,
    textColorSecondary: state.colors.textColorSecondary,
    backgroundOpacity: state.effects.backgroundOpacity,
    backgroundImageUrl: state.effects.backgroundImageUrl,
    panelOpacity: state.effects.panelOpacity,
    componentRadius: state.layout.componentRadius,
    coverRadius: state.layout.coverRadius,
}));

export const useUIColors = () => useThemeStore(state => ({
    theme: state.colors.themeColor,
    background: state.colors.backgroundColor,
    panel: state.colors.panelColor,
    control: state.colors.controlColor,
    modal: state.colors.modalColor,
    favoriteCard: state.colors.favoriteCardColor,
    textPrimary: state.colors.textColorPrimary,
    textSecondary: state.colors.textColorSecondary,
}));