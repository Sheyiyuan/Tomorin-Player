import { APP_VERSION } from "../../utils/constants";

export const LAST_ERROR_REPORT_KEY = "half-beat.last-error-report";

export type ErrorSource = "react" | "window.error" | "unhandledrejection";

interface ErrorReportOptions {
    source: ErrorSource;
    error: unknown;
    componentStack?: string;
    occurredAt?: Date;
}

interface ErrorDetails {
    name: string;
    message: string;
    stack: string;
}

const normalizeError = (value: unknown): ErrorDetails => {
    if (value instanceof Error) {
        return {
            name: value.name || "Error",
            message: value.message || "未知错误",
            stack: value.stack || "无可用堆栈",
        };
    }

    if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>;
        const name = typeof record.name === "string" ? record.name : "Error";
        const message = typeof record.message === "string" ? record.message : stringifyUnknown(value);
        const stack = typeof record.stack === "string" ? record.stack : "无可用堆栈";
        return { name, message, stack };
    }

    return {
        name: "Error",
        message: stringifyUnknown(value),
        stack: "无可用堆栈",
    };
};

const stringifyUnknown = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value === undefined) return "undefined";
    if (value === null) return "null";

    try {
        const serialized = JSON.stringify(value);
        return serialized || String(value);
    } catch {
        return String(value);
    }
};

export const buildErrorReport = ({
    source,
    error,
    componentStack,
    occurredAt = new Date(),
}: ErrorReportOptions): string => {
    const details = normalizeError(error);
    const colorScheme = document.documentElement.dataset.mantineColorScheme || "unknown";
    const reactStack = componentStack?.trim() || "无可用组件堆栈";

    return [
        `Half Beat ${APP_VERSION}`,
        `时间: ${occurredAt.toISOString()}`,
        `来源: ${source}`,
        `页面: ${window.location.href}`,
        `颜色方案: ${colorScheme}`,
        `环境: ${window.navigator.userAgent}`,
        "",
        `${details.name}: ${details.message}`,
        "",
        "JavaScript 堆栈:",
        details.stack,
        "",
        "React 组件堆栈:",
        reactStack,
    ].join("\n");
};

export const persistErrorReport = (report: string): void => {
    try {
        window.sessionStorage.setItem(LAST_ERROR_REPORT_KEY, report);
    } catch {
        // The fallback must remain usable when browser storage is unavailable.
    }
};

export const installGlobalErrorHandlers = (target: Window = window): (() => void) => {
    const handleWindowError = (event: ErrorEvent): void => {
        if (!event.error && !event.message) return;

        const error = event.error ?? new Error(event.message);
        persistErrorReport(buildErrorReport({ source: "window.error", error }));
        console.error("[GlobalError]", error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
        persistErrorReport(buildErrorReport({ source: "unhandledrejection", error: event.reason }));
        console.error("[UnhandledRejection]", event.reason);
    };

    target.addEventListener("error", handleWindowError);
    target.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
        target.removeEventListener("error", handleWindowError);
        target.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
};
