import React, { useMemo, type ReactNode } from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useThemeStore } from "./hooks/useThemeStore";

interface ThemedMantineProviderProps {
    children: ReactNode;
}

export const ThemedMantineProvider: React.FC<ThemedMantineProviderProps> = ({ children }) => {
    const themeStore = useThemeStore();
    const { colorScheme } = themeStore.theme;
    const {
        textColorPrimary,
        tooltipBackgroundColor,
        tooltipTextColor,
        tooltipBorderColor,
    } = themeStore.colors;
    const { componentRadius, modalRadius, notificationRadius } = themeStore.layout;

    const mantineTheme = useMemo(() => createTheme({
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        defaultRadius: componentRadius,
        black: textColorPrimary,
        white: "#ffffff",
        components: {
            Text: { defaultProps: { c: textColorPrimary } },
            Title: { defaultProps: { c: textColorPrimary } },
            Modal: { defaultProps: { radius: modalRadius } },
            Menu: { defaultProps: { radius: modalRadius } },
            Tooltip: {
                defaultProps: {
                    withinPortal: true,
                    floatingStrategy: "fixed",
                    zIndex: 4000,
                },
                styles: {
                    tooltip: {
                        backgroundColor: tooltipBackgroundColor,
                        color: tooltipTextColor,
                        border: `1px solid ${tooltipBorderColor}`,
                    },
                },
            },
            TooltipFloating: {
                defaultProps: {
                    withinPortal: true,
                    zIndex: 4000,
                },
                styles: {
                    tooltip: {
                        backgroundColor: tooltipBackgroundColor,
                        color: tooltipTextColor,
                        border: `1px solid ${tooltipBorderColor}`,
                    },
                },
            },
            Slider: {
                styles: {
                    label: {
                        backgroundColor: tooltipBackgroundColor,
                        color: tooltipTextColor,
                        border: `1px solid ${tooltipBorderColor}`,
                        zIndex: 4000,
                    },
                },
            },
            RangeSlider: {
                styles: {
                    label: {
                        backgroundColor: tooltipBackgroundColor,
                        color: tooltipTextColor,
                        border: `1px solid ${tooltipBorderColor}`,
                        zIndex: 4000,
                    },
                },
            },
            Notification: {
                defaultProps: {
                    radius: notificationRadius,
                    closeButtonProps: { "aria-label": "关闭通知", title: "关闭通知" },
                },
            },
        },
    }), [componentRadius, modalRadius, notificationRadius, textColorPrimary, tooltipBackgroundColor, tooltipTextColor, tooltipBorderColor]);

    return (
        <MantineProvider theme={mantineTheme} forceColorScheme={colorScheme}>
            <Notifications position="top-right" zIndex={2000} />
            {children}
        </MantineProvider>
    );
};

export default ThemedMantineProvider;
