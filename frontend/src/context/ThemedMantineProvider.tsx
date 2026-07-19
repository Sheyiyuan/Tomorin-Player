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
    const { textColorPrimary } = themeStore.colors;
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
            Notification: { defaultProps: { radius: notificationRadius } },
        },
    }), [componentRadius, modalRadius, notificationRadius, textColorPrimary]);

    return (
        <MantineProvider theme={mantineTheme} forceColorScheme={colorScheme}>
            <Notifications position="top-right" zIndex={2000} />
            {children}
        </MantineProvider>
    );
};

export default ThemedMantineProvider;
