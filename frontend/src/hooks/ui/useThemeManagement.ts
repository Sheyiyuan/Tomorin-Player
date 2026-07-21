/**
 * useThemeManagement - 主题管理逻辑聚合
 * 将 App.tsx 中分散的主题编辑、应用和缓存逻辑集中到一个 Hook
 */

import { useCallback } from 'react';
import { Theme } from '../../types';

interface UseThemeManagementProps {
    themes: Theme[];
}

export const useThemeManagement = ({
    themes,
}: UseThemeManagementProps) => {
    // 从状态中提取自定义主题（非默认）
    const getCustomThemes = useCallback(() => {
        return themes.filter((t) => !t.isDefault);
    }, [themes]);

    // 保存自定义主题到 localStorage
    const saveCachedCustomThemes = useCallback((themesToCache: Theme[]) => {
        try {
            localStorage.setItem('half-beat.customThemes', JSON.stringify(themesToCache));
        } catch (e) {
            console.warn('保存自定义主题缓存失败', e);
        }
    }, []);

    return {
        getCustomThemes,
        saveCachedCustomThemes,
    };
};
