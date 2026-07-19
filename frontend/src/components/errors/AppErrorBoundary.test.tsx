import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";
import { LAST_ERROR_REPORT_KEY } from "./errorReport";

const ThrowingChild = () => {
    throw new Error("render failed");
};

describe("AppErrorBoundary", () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(window.navigator, "clipboard");

    beforeEach(() => {
        window.sessionStorage.clear();
        document.documentElement.dataset.mantineColorScheme = "dark";
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete document.documentElement.dataset.mantineColorScheme;
        if (originalClipboard) {
            Object.defineProperty(window.navigator, "clipboard", originalClipboard);
        } else {
            Reflect.deleteProperty(window.navigator, "clipboard");
        }
    });

    it("renders children while the application is healthy", () => {
        render(
            <AppErrorBoundary>
                <div>正常界面</div>
            </AppErrorBoundary>,
        );

        expect(screen.getByText("正常界面")).toBeInTheDocument();
        expect(screen.queryByText("应用遇到错误")).not.toBeInTheDocument();
    });

    it("shows a provider-independent fallback and persists the error report", () => {
        render(
            <AppErrorBoundary>
                <ThrowingChild />
            </AppErrorBoundary>,
        );

        const fallback = screen.getByRole("alert");
        expect(fallback).toHaveClass("app-error-fallback");
        expect(fallback).toHaveAttribute("data-color-scheme", "dark");
        expect(fallback).toHaveFocus();
        expect(screen.getByText("应用遇到错误")).toBeInTheDocument();
        expect(screen.getByText("错误详情").closest("details")).not.toHaveAttribute("open");

        const report = window.sessionStorage.getItem(LAST_ERROR_REPORT_KEY);
        expect(report).toContain("来源: react");
        expect(report).toContain("Error: render failed");
        expect(report).toContain("颜色方案: dark");
        expect(report).toContain("React 组件堆栈:");
    });

    it("copies the report and delegates the reload action", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        const onReload = vi.fn();
        Object.defineProperty(window.navigator, "clipboard", {
            configurable: true,
            value: { writeText },
        });

        render(
            <AppErrorBoundary onReload={onReload}>
                <ThrowingChild />
            </AppErrorBoundary>,
        );

        fireEvent.click(screen.getByRole("button", { name: "复制错误信息" }));
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        expect(writeText.mock.calls[0][0]).toContain("render failed");
        expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "重新加载应用" }));
        expect(onReload).toHaveBeenCalledTimes(1);
    });
});
