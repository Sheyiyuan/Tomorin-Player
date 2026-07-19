import React, { useState, useEffect } from "react";
import { ActionIcon, Group } from "@mantine/core";
import { Minus, Square, X, Copy } from "lucide-react";
import * as Services from "../../../wailsjs/go/services/Service";
import { useThemeStore } from "../../context/hooks/useThemeStore";
import { useUIStore } from "../../context/hooks/useUIStore";
import { executeExitBehavior, getStoredExitBehavior } from "../../utils/window";

interface WindowControlsProps {
    themeColor?: string;
    controlBackground?: string;
    componentRadius?: number;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
    themeColor: propThemeColor,
    controlBackground: propControlBackground,
    componentRadius: propComponentRadius,
}) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const themeStore = useThemeStore();
    const { openModal } = useUIStore().actions;

    // 优先使用 props，否则回退到 store theme state
    const themeColor = propThemeColor || themeStore.colors.themeColor;
    const controlBackground = propControlBackground;
    const componentRadius = propComponentRadius ?? themeStore.layout.componentRadius;

    // 窗口尺寸变化时同步最大化状态，避免持续轮询 Wails。
    useEffect(() => {
        const checkMaximized = async () => {
            try {
                const maximised = await Services.IsWindowMaximized();
                setIsMaximized(maximised);
            } catch (error) {
                console.error("Failed to check window maximized state:", error);
            }
        };

        let resizeTimer: number | null = null;
        const handleResize = () => {
            if (resizeTimer !== null) window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(checkMaximized, 150);
        };

        void checkMaximized();
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            if (resizeTimer !== null) window.clearTimeout(resizeTimer);
        };
    }, []);

    const handleMinimize = () => {
        Services.MinimiseWindow();
    };

    const handleMaximize = async () => {
        try {
            if (isMaximized) {
                await Services.UnmaximizeWindow();
            } else {
                await Services.MaximizeWindow();
            }
            setIsMaximized((value) => !value);
        } catch (error) {
            console.error("Error in handleMaximize:", error);
        }
    };

    const handleCloseClick = () => {
        const stored = getStoredExitBehavior();
        if (stored) {
            void executeExitBehavior(stored);
        } else {
            openModal("exitConfirmModal");
        }
    };

    return (
        <>
            <Group gap={0} wrap="nowrap">
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius={componentRadius}
                    onClick={handleMinimize}
                    title="最小化"
                    aria-label="最小化"
                    className="window-control"
                    color={themeColor}
                    style={{ backgroundColor: controlBackground }}
                >
                    <Minus size={16} />
                </ActionIcon>
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius={componentRadius}
                    onClick={handleMaximize}
                    title={isMaximized ? "还原" : "最大化"}
                    aria-label={isMaximized ? "还原" : "最大化"}
                    className="window-control"
                    color={themeColor}
                    style={{ backgroundColor: controlBackground }}
                >
                    {isMaximized ? <Copy size={16} /> : <Square size={16} />}
                </ActionIcon>
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius={componentRadius}
                    onClick={handleCloseClick}
                    title="关闭"
                    aria-label="关闭"
                    className="window-control"
                    color="red"
                    style={{ backgroundColor: controlBackground }}
                >
                    <X size={16} />
                </ActionIcon>
            </Group>

        </>
    );
};
