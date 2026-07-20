import React, { type ErrorInfo, type ReactNode } from "react";
import { Check, Copy, RefreshCw, TriangleAlert } from "lucide-react";
import { buildErrorReport, persistErrorReport } from "./errorReport";
import "./AppErrorBoundary.css";

interface AppErrorBoundaryProps {
    children: ReactNode;
    onReload?: () => void;
}

interface AppErrorBoundaryState {
    error: Error | null;
    report: string;
    copyStatus: "idle" | "copied" | "failed";
    colorScheme: "light" | "dark" | null;
}

const copyText = async (value: string): Promise<void> => {
    if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
        if (!document.execCommand("copy")) {
            throw new Error("Clipboard copy command failed");
        }
    } finally {
        textarea.remove();
    }
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = {
        error: null,
        report: "",
        copyStatus: "idle",
        colorScheme: null,
    };

    private fallbackRef = React.createRef<HTMLDivElement>();

    static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
        const rootColorScheme = document.documentElement.dataset.mantineColorScheme;
        return {
            error,
            report: buildErrorReport({ source: "react", error }),
            copyStatus: "idle",
            colorScheme: rootColorScheme === "light" || rootColorScheme === "dark" ? rootColorScheme : null,
        };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        const report = buildErrorReport({
            source: "react",
            error,
            componentStack: info.componentStack || undefined,
        });
        persistErrorReport(report);
        this.setState({ report }, () => this.fallbackRef.current?.focus());
        console.error("[AppErrorBoundary]", error, info);
    }

    private handleReload = (): void => {
        try {
            if (this.props.onReload) {
                this.props.onReload();
                return;
            }
            window.location.reload();
        } catch (error) {
            console.error("[AppErrorBoundary] reload failed", error);
        }
    };

    private handleCopy = async (): Promise<void> => {
        try {
            await copyText(this.state.report);
            this.setState({ copyStatus: "copied" });
        } catch (error) {
            this.setState({ copyStatus: "failed" });
            console.error("[AppErrorBoundary] copy failed", error);
        }
    };

    render(): ReactNode {
        if (!this.state.error) return this.props.children;

        const copied = this.state.copyStatus === "copied";

        return (
            <main
                ref={this.fallbackRef}
                className="app-error-fallback"
                data-color-scheme={this.state.colorScheme ?? undefined}
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
            >
                <section className="app-error-panel" aria-labelledby="app-error-title">
                    <div className="app-error-heading">
                        <span className="app-error-icon" aria-hidden="true">
                            <TriangleAlert size={24} strokeWidth={1.8} />
                        </span>
                        <div>
                            <h1 id="app-error-title">应用遇到错误</h1>
                            <p>界面无法继续运行。已保存的数据不会受影响，未保存的表单或主题草稿可能丢失。</p>
                        </div>
                    </div>

                    <div className="app-error-actions">
                        <button type="button" className="app-error-button app-error-button-primary" onClick={this.handleReload}>
                            <RefreshCw size={17} aria-hidden="true" />
                            重新加载应用
                        </button>
                        <button type="button" className="app-error-button" onClick={this.handleCopy}>
                            {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                            {copied ? "已复制" : "复制错误信息"}
                        </button>
                    </div>

                    {this.state.copyStatus === "failed" && (
                        <p className="app-error-copy-failure" role="status">
                            无法访问剪贴板，请展开错误详情后手动复制。
                        </p>
                    )}

                    <details className="app-error-details">
                        <summary>错误详情</summary>
                        <pre>{this.state.report}</pre>
                    </details>
                </section>
            </main>
        );
    }
}

export default AppErrorBoundary;
