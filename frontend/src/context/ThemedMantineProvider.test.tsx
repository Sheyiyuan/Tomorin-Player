import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEMES } from "../utils/constants";
import { AppProvider } from "./AppProvider";
import { useThemeStore } from "./hooks/useThemeStore";

const ThemeControls = () => {
    const themeStore = useThemeStore();
    const lightTheme = DEFAULT_THEMES.find((theme) => theme.id === "light");
    const darkTheme = DEFAULT_THEMES.find((theme) => theme.id === "dark");

    if (!lightTheme || !darkTheme) throw new Error("Default themes are missing");

    return (
        <>
            <button type="button" onClick={() => themeStore.actions.applyTheme(lightTheme)}>light</button>
            <button type="button" onClick={() => themeStore.actions.applyTheme(darkTheme)}>dark</button>
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
});
