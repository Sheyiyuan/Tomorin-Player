import React from "react";
import { createRoot } from "react-dom/client";
import {
    ColorSchemeScript,
    MantineProvider,
    createTheme,
    localStorageColorSchemeManager,
} from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import "./index.css";
import { onWailsReady } from "./utils/wails";
import App from "./App";
import { AppProvider } from "./context/AppContext";

// Wails runtime 在部分环境（尤其 Linux WebKit）存在异步注入时序。
// 延迟加载可避免启动阶段出现 "window.wails.Callback" 为 undefined 的错误。
onWailsReady(() => {
    import("../wailsjs/runtime/runtime").catch((e) => {
        console.warn("[Wails] runtime 加载失败（可能不在 Wails 环境）:", e);
    });
});

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing");

const theme = createTheme({
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
});

const colorSchemeManager = localStorageColorSchemeManager({ key: "azusa-color-scheme" });

createRoot(container).render(
    <React.StrictMode>
        <ColorSchemeScript defaultColorScheme="auto" />
        <MantineProvider
            theme={theme}
            defaultColorScheme="auto"
            colorSchemeManager={colorSchemeManager}
        >
            <Notifications position="top-right" zIndex={2000} />
            <AppProvider>
                <App />
            </AppProvider>
        </MantineProvider>
    </React.StrictMode>
);

