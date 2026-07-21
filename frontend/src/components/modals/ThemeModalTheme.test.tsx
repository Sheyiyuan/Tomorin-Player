import { fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";
import { useThemeDraftState } from "../../hooks/ui/useThemeDraftState";
import type { DerivedStyles, Theme } from "../../types";
import SettingsModal from "./SettingsModal";
import ThemeDetailModal from "./ThemeDetailModal";
import ThemeManagerModal from "./ThemeManagerModal";

const modalBackground = "rgba(20, 24, 40, 0.96)";
const derived: DerivedStyles = {
    modalBackground,
    modalBlur: 12,
    modalRadius: 10,
    controlBackground: "rgb(35, 42, 65)",
    componentRadius: 8,
    textColorPrimary: "#ffffff",
    textColorSecondary: "#a6a7ab",
};

const theme: Theme = {
    id: "dark",
    name: "暗色主题",
    data: "{}",
    isDefault: true,
    isReadOnly: true,
    themeColor: "#228be6",
    colorScheme: "dark",
};

const renderWithTheme = (children: React.ReactNode) => render(
    <MantineProvider forceColorScheme="dark">
        {children}
    </MantineProvider>,
);

const expectThemedPortalShell = () => {
    const dialog = screen.getByRole("dialog");
    const content = dialog.closest(".mantine-Modal-content");
    const portal = dialog.closest('[data-portal="true"]');
    const root = content?.closest(".mantine-Modal-root");
    const inner = content?.closest(".mantine-Modal-inner");
    const header = content?.querySelector(".mantine-Modal-header");
    const body = content?.querySelector(".mantine-Modal-body");
    const close = content?.querySelector(".mantine-Modal-close");

    expect(content).toBeTruthy();
    expect(portal?.parentElement).toBe(document.body);
    expect(content).not.toHaveClass("normal-panel", "glass-panel");
    expect(root).toHaveStyle({ color: "#ffffff" });
    expect(inner?.getAttribute("style")).toContain("background-color: transparent");
    expect(content).toHaveStyle({
        backgroundColor: modalBackground,
        color: "#ffffff",
    });
    expect(header).toHaveStyle({ backgroundColor: modalBackground, color: "#ffffff" });
    expect(body).toHaveStyle({ backgroundColor: modalBackground, color: "#ffffff" });
    expect(close).toHaveStyle({ backgroundColor: "rgb(35, 42, 65)", color: "#ffffff" });
    expect(getComputedStyle(content as Element).backgroundColor).toBe(modalBackground);
};

const ThemeDetailHarness = () => {
    const themeDraft = useThemeDraftState();

    return (
        <ThemeDetailModal
            opened
            onClose={vi.fn()}
            onCancel={vi.fn()}
            session={themeDraft.session}
            actions={themeDraft.actions}
            onClearBackgroundImage={vi.fn()}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
            onBackgroundFileChange={vi.fn()}
            derived={derived}
        />
    );
};

describe("themed modal shell", () => {
    it("themes the settings content, header and body inside the default Portal", () => {
        const onClose = vi.fn();
        renderWithTheme(
            <SettingsModal
                opened
                themeColor="#228be6"
                appVersion="1.2.0"
                cacheSize={0}
                volumeCompensationDb={0}
                onVolumeCompensationChange={vi.fn()}
                onClose={onClose}
                onOpenDownloadsFolder={vi.fn()}
                onOpenDatabaseFile={vi.fn()}
                onClearMusicCache={vi.fn()}
                derived={derived}
            />,
        );

        expectThemedPortalShell();
        expect(screen.getByText("关闭按钮行为")).toBeInTheDocument();

        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);

        const overlay = document.querySelector(".mantine-Modal-overlay");
        expect(overlay).toBeTruthy();
        fireEvent.click(overlay as Element);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("applies the same shell to the theme manager", () => {
        renderWithTheme(
            <ThemeManagerModal
                opened
                onClose={vi.fn()}
                themes={[theme]}
                currentThemeId={theme.id}
                onSelectTheme={vi.fn()}
                onViewTheme={vi.fn()}
                onEditTheme={vi.fn()}
                onDeleteTheme={vi.fn()}
                onCreateTheme={vi.fn()}
                accentColor="#228be6"
                derived={derived}
            />,
        );

        expectThemedPortalShell();
        expect(screen.getByText("暗色主题")).toBeInTheDocument();
    });

    it("keeps theme editor scrolling inside its themed Portal content", () => {
        renderWithTheme(<ThemeDetailHarness />);

        expectThemedPortalShell();
        const content = screen.getByRole("dialog").closest(".mantine-Modal-content");
        const body = content?.querySelector(".mantine-Modal-body");
        expect(content).toHaveStyle({ maxHeight: "calc(100dvh - 32px)", overflow: "hidden" });
        expect(body).toHaveStyle({ minHeight: "0", overflow: "hidden" });
        expect(screen.getByText("新建主题")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("粘贴或编辑 JSON 配置...")).not.toHaveStyle({ minHeight: "260px" });
    });
});
