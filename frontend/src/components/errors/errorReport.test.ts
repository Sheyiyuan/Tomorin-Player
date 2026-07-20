import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildErrorReport,
    installGlobalErrorHandlers,
    LAST_ERROR_REPORT_KEY,
} from "./errorReport";

describe("errorReport", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        window.sessionStorage.clear();
    });

    it("builds a readable report for non-Error rejection reasons", () => {
        const report = buildErrorReport({
            source: "unhandledrejection",
            error: { code: "E_TEST", retryable: false },
            occurredAt: new Date("2026-07-19T08:00:00.000Z"),
        });

        expect(report).toContain("时间: 2026-07-19T08:00:00.000Z");
        expect(report).toContain("来源: unhandledrejection");
        expect(report).toContain('{"code":"E_TEST","retryable":false}');
        expect(report).toContain("无可用堆栈");
    });

    it("records global errors without converting them into fatal UI state", () => {
        const removeEventListener = vi.spyOn(window, "removeEventListener");
        const removeHandlers = installGlobalErrorHandlers(window);

        try {
            const error = new Error("window failed");
            window.dispatchEvent(new ErrorEvent("error", { message: error.message, error }));
            expect(window.sessionStorage.getItem(LAST_ERROR_REPORT_KEY)).toContain("来源: window.error");
            expect(window.sessionStorage.getItem(LAST_ERROR_REPORT_KEY)).toContain("window failed");

            const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
            Object.defineProperty(rejection, "reason", { value: "async failed" });
            window.dispatchEvent(rejection);
            expect(window.sessionStorage.getItem(LAST_ERROR_REPORT_KEY)).toContain("来源: unhandledrejection");
            expect(window.sessionStorage.getItem(LAST_ERROR_REPORT_KEY)).toContain("async failed");
        } finally {
            removeHandlers();
        }
        expect(removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
        expect(removeEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
    });
});
