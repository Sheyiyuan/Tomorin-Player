import { useEffect, useRef, useCallback } from 'react';
import { toPlayerSettingModel, type PlayerSetting } from '../../types';
import * as Services from '../../../wailsjs/go/services/Service';
import { notifications } from '@mantine/notifications';

interface UseSettingsPersistenceProps {
    setting: PlayerSetting | null;
    playMode: string;
    volume: number;
    currentThemeId: string;
    setSetting: (setting: PlayerSetting) => void;
    skipPersistRef: React.MutableRefObject<boolean>;
}

export const useSettingsPersistence = ({
    setting,
    playMode,
    volume,
    currentThemeId,
    setSetting,
    skipPersistRef,
}: UseSettingsPersistenceProps) => {
    // 标记设置是否已完成加载，供其他模块判断
    const settingsLoadedRef = useRef(false);
    // 使用 ref 同步最新的设置状态，立即同步而非依赖 useEffect
    const settingsRef = useRef({
        setting, playMode, volume, currentThemeId,
    });
    // 立即同步更新 ref，不等待 useEffect
    settingsRef.current = {
        setting, playMode, volume, currentThemeId,
    };

    /**
     * 持久化设置到后端
     */
    const persistSettings = useCallback(async (partial: Partial<PlayerSetting>) => {
        // 初始化阶段或未加载完成时不进行保存
        if (skipPersistRef.current || !settingsLoadedRef.current) {
            return;
        }
        const s = settingsRef.current;
        const config = { ...(s.setting?.config || {}) };
        // 移除 themes，因为 themes 由专门的 RPC 接口管理，避免旧数据覆盖新主题
        delete config.themes;

        const next: PlayerSetting = {
            id: s.setting?.id ?? 1,
            config: {
                ...config,
                playMode: s.playMode,
                defaultVolume: s.volume,
                currentThemeId: s.currentThemeId,
                ...(partial.config || {}),
            },
            updatedAt: new Date().toISOString(),
        };
        try {
            await Services.SavePlayerSetting(toPlayerSettingModel(next));
            setSetting(next);
        } catch (err) {
            console.error("保存设置失败", err);
            notifications.show({
                title: '设置保存失败',
                message: err instanceof Error ? err.message : String(err),
                color: 'red',
            });
        }
    }, [setSetting, skipPersistRef]);

    // 自动保存设置（防抖）
    useEffect(() => {
        // 跳过初始化期间或设置未加载完成时的保存
        if (skipPersistRef.current || !settingsLoadedRef.current) {
            return;
        }
        // 使用 setTimeout 防抖
        const timeoutId = setTimeout(() => {
            persistSettings({});
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [
        playMode, volume,
        skipPersistRef, persistSettings
    ]);

    return {
        persistSettings,
        settingsLoadedRef,
    };
};
