import React, { useState } from 'react';
import { Button, Checkbox, Group, Radio } from '@mantine/core';
import { useThemeStore } from '../../context/hooks/useThemeStore';
import type { DerivedStyles } from '../../types';
import { executeExitBehavior, EXIT_BEHAVIOR_KEY, type ExitBehavior } from '../../utils/window';
import ThemedModal from './ThemedModal';

export interface ExitConfirmModalProps {
    opened: boolean;
    onClose: () => void;
    derived?: DerivedStyles;
}

const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({ opened, onClose, derived }) => {
    const [rememberChoice, setRememberChoice] = useState(false);
    const [exitChoice, setExitChoice] = useState<ExitBehavior>('minimize');
    const themeStore = useThemeStore();
    const { themeColor, textColorPrimary } = themeStore.colors;
    const { componentRadius } = themeStore.layout;

    const handleConfirm = () => {
        if (rememberChoice) localStorage.setItem(EXIT_BEHAVIOR_KEY, exitChoice);
        onClose();
        void executeExitBehavior(exitChoice);
    };

    return (
        <ThemedModal
            derived={derived}
            opened={opened}
            onClose={onClose}
            title="关闭应用"
            centered
            size="sm"
        >
            <Radio.Group
                value={exitChoice}
                onChange={(value) => setExitChoice(value as ExitBehavior)}
                label="选择关闭时的行为"
                size="sm"
                mb="md"
                styles={{ label: { color: textColorPrimary } }}
            >
                <Radio value="minimize" label="最小化到托盘" mb="xs" styles={{ label: { color: textColorPrimary } }} />
                <Radio value="quit" label="直接退出应用" styles={{ label: { color: textColorPrimary } }} />
            </Radio.Group>

            <Checkbox
                checked={rememberChoice}
                onChange={(event) => setRememberChoice(event.currentTarget.checked)}
                label="记住我的选择"
                size="sm"
                mb="md"
                styles={{ label: { color: textColorPrimary } }}
            />

            <Group justify="flex-end" gap="xs">
                <Button variant="subtle" size="sm" radius={componentRadius} onClick={onClose} style={{ color: textColorPrimary }}>
                    取消
                </Button>
                <Button size="sm" color={themeColor} radius={componentRadius} onClick={handleConfirm}>
                    确定
                </Button>
            </Group>
        </ThemedModal>
    );
};

export default ExitConfirmModal;
