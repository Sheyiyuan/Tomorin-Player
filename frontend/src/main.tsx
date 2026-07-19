import React from "react";
import { createRoot } from "react-dom/client";
import { ColorSchemeScript } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";
import { onWailsReady } from "./utils/wails";
import App from "./App";
import { AppProvider } from "./context/AppProvider";
import AppErrorBoundary from "./components/errors/AppErrorBoundary";
import { installGlobalErrorHandlers } from "./components/errors/errorReport";

const removeGlobalErrorHandlers = installGlobalErrorHandlers();
if (import.meta.hot) {
    import.meta.hot.dispose(removeGlobalErrorHandlers);
}

// Wails runtime 在部分环境（尤其 Linux WebKit）存在异步注入时序。
// 延迟加载可避免启动阶段出现 "window.wails.Callback" 为 undefined 的错误。
onWailsReady(() => {
    import("../wailsjs/runtime/runtime").catch((e) => {
        console.warn("[Wails] runtime 加载失败（可能不在 Wails 环境）:", e);
    });
});

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing");

createRoot(container).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <ColorSchemeScript defaultColorScheme="auto" />
            <AppProvider>
                <App />
            </AppProvider>
        </AppErrorBoundary>
    </React.StrictMode>
);
