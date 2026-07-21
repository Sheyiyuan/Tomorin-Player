import { act, fireEvent, render, screen } from "@testing-library/react";
import { RangeSlider, Slider, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { beforeEach, describe, expect, it } from "vitest";
import type { Theme } from "../types";
import { DEFAULT_THEMES } from "../utils/constants";
import { AppProvider } from "./AppProvider";
import { useThemeStore } from "./hooks/useThemeStore";

const ThemeControls = () => {
    const themeStore = useThemeStore();
    const lightTheme = DEFAULT_THEMES.find((theme) => theme.id === "light");
    const darkTheme = DEFAULT_THEMES.find((theme) => theme.id === "dark");
    const customTooltipTheme = (colorScheme: "light" | "dark"): Theme => ({
        id: `custom-${colorScheme}`,
        name: `Custom ${colorScheme}`,
        data: "{}",
        isDefault: false,
        isReadOnly: false,
        colorScheme,
        tooltipBackgroundColor: "#123456",
        tooltipTextColor: "#fedcba",
        tooltipBorderColor: "#abcdef",
    });

    if (!lightTheme || !darkTheme) throw new Error("Default themes are missing");

    return (
        <>
            <button type="button" onClick={() => themeStore.actions.applyTheme(lightTheme)}>light</button>
            <button type="button" onClick={() => themeStore.actions.applyTheme(darkTheme)}>dark</button>
            <button type="button" onClick={() => themeStore.actions.applyTheme(customTooltipTheme("light"))}>custom light</button>
            <button type="button" onClick={() => themeStore.actions.applyTheme(customTooltipTheme("dark"))}>custom dark</button>
            <Tooltip label="精确提示色" opened>
                <button type="button">tooltip target</button>
            </Tooltip>
            <Slider aria-label="主题滑块" value={50} label="50%" labelAlwaysOn />
            <RangeSlider aria-label="主题范围滑块" value={[25, 75]} label={(value) => `${value}%`} labelAlwaysOn />
        </>
    );
};

const renderProvider = () => render(
    <AppProvider>
        <ThemeControls />
    </AppProvider>,
);

describe("ThemedMantineProvider", () => {
    beforeEach(() => {
        notifications.clean();
        localStorage.clear();
        document.documentElement.removeAttribute("data-mantine-color-scheme");
    });

    it("initializes Mantine from the cached dark business theme", () => {
        localStorage.setItem("half-beat.currentThemeId", "dark");

        renderProvider();

        expect(document.documentElement.dataset.mantineColorScheme).toBe("dark");
        expect(document.querySelectorAll('style[data-mantine-styles="true"]')).toHaveLength(1);
    });

    it("keeps the root color scheme in sync without adding another provider", () => {
        localStorage.setItem("half-beat.currentThemeId", "light");
        renderProvider();

        expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
        fireEvent.click(screen.getByRole("button", { name: "dark" }));
        expect(document.documentElement.dataset.mantineColorScheme).toBe("dark");
        fireEvent.click(screen.getByRole("button", { name: "light" }));
        expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
        expect(document.querySelectorAll('style[data-mantine-styles="true"]')).toHaveLength(1);
    });

    it("gives notification close buttons an accessible name", async () => {
        renderProvider();
        act(() => {
            notifications.show({ title: "播放失败", message: "请稍后重试" });
        });

        expect(await screen.findByRole("button", { name: "关闭通知" })).toHaveAttribute("title", "关闭通知");
    });

    it("uses exact theme tooltip colors independently from the Mantine color scheme", () => {
        renderProvider();

        const tooltip = screen.getByRole("tooltip", { name: "精确提示色" });
        const sliderLabel = screen.getByText("50%");
        const rangeSliderLabel = screen.getByText("25%");
        const expectExactColors = (element: Element) => {
            const styles = getComputedStyle(element);
            expect(styles.backgroundColor).toBe("rgb(18, 52, 86)");
            expect(styles.color).toBe("rgb(254, 220, 186)");
            expect(styles.borderColor).toBe("#abcdef");
        };

        fireEvent.click(screen.getByRole("button", { name: "custom light" }));
        expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
        expectExactColors(tooltip);
        expectExactColors(sliderLabel);
        expectExactColors(rangeSliderLabel);

        fireEvent.click(screen.getByRole("button", { name: "custom dark" }));
        expect(document.documentElement.dataset.mantineColorScheme).toBe("dark");
        expectExactColors(tooltip);
        expectExactColors(sliderLabel);
        expectExactColors(rangeSliderLabel);
    });
});
