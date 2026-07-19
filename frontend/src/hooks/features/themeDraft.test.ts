import { describe, expect, it } from "vitest";
import type { Theme } from "../../types";
import {
    createDefaultThemeDraft,
    createThemeDataFromDraft,
    parseThemeDraftJson,
    themeToDraft,
} from "./themeDraft";

const baseTheme: Theme = {
    id: "custom",
    name: "Custom",
    data: JSON.stringify({
        themeColor: "#112233",
        backgroundColor: "#000000",
        backgroundOpacity: 0,
        backgroundImage: "http://127.0.0.1:1234/theme-image",
        backgroundImageSourceUrl: "https://example.com/bg.jpg",
        backgroundBlur: 0,
        panelColor: "#ffffff",
        panelOpacity: 0.2,
        panelBlur: 0,
        panelRadius: 0,
        controlColor: "#eeeeee",
        controlOpacity: 0,
        controlBlur: 0,
        textColorPrimary: "#111111",
        textColorSecondary: "#222222",
        favoriteCardColor: "#dddddd",
        cardOpacity: 0,
        componentRadius: 0,
        modalRadius: 0,
        notificationRadius: 0,
        coverRadius: 0,
        modalColor: "#cccccc",
        modalOpacity: 0,
        modalBlur: 0,
        windowControlsPos: "hidden",
        colorScheme: "light",
        futureField: { enabled: true },
    }),
    isDefault: false,
    isReadOnly: false,
};

describe("theme draft helpers", () => {
    it("creates defaults for the requested color scheme", () => {
        expect(createDefaultThemeDraft("dark").colorScheme).toBe("dark");
        expect(createDefaultThemeDraft("light").textColorPrimary).toBe("#1a1b1e");
    });

    it("preserves explicit zero values and unknown data when converting a theme", () => {
        const draft = themeToDraft(baseTheme);

        expect(draft.backgroundOpacity).toBe(0);
        expect(draft.panelRadius).toBe(0);
        expect(draft.windowControlsPos).toBe("hidden");
        expect(draft.extraData.futureField).toEqual({ enabled: true });
    });

    it("writes cleared background fields explicitly while preserving unknown fields", () => {
        const draft = themeToDraft(baseTheme);
        const data = createThemeDataFromDraft(
            { ...draft, backgroundImageUrl: "", backgroundImageSourceUrl: "" },
            { backgroundImage: "", backgroundImageSourceUrl: "" },
        );

        expect(data.backgroundImage).toBe("");
        expect(data.backgroundImageSourceUrl).toBe("");
        expect(data.futureField).toEqual({ enabled: true });
    });

    it("treats missing JSON backgroundImage as an explicit clear", () => {
        const draft = themeToDraft(baseTheme);
        const json = JSON.stringify({
            name: "Imported",
            themeColor: "#112233",
            backgroundColor: "#000000",
            backgroundOpacity: 1,
            backgroundBlur: 0,
            panelColor: "#ffffff",
            panelOpacity: 0.5,
            panelBlur: 0,
            panelRadius: 8,
            controlColor: "#eeeeee",
            controlOpacity: 1,
            controlBlur: 0,
            textColorPrimary: "#111111",
            textColorSecondary: "#222222",
            favoriteCardColor: "#dddddd",
            cardOpacity: 1,
            componentRadius: 8,
            modalRadius: 8,
            notificationRadius: 8,
            coverRadius: 8,
            modalColor: "#cccccc",
            modalOpacity: 1,
            modalBlur: 0,
            windowControlsPos: "right",
            colorScheme: "light",
        });

        const result = parseThemeDraftJson(json, draft);

        expect(result.errors).toEqual([]);
        expect(result.draft?.backgroundImageUrl).toBe("");
    });

    it("rejects invalid colors, ranges, and enums", () => {
        const draft = createDefaultThemeDraft("dark");
        const result = parseThemeDraftJson(JSON.stringify({
            ...createThemeDataFromDraft(draft, { backgroundImage: "", backgroundImageSourceUrl: "" }),
            name: "Broken",
            themeColor: "blue",
            backgroundOpacity: 2,
            windowControlsPos: "middle",
            colorScheme: "system",
        }), draft);

        expect(result.draft).toBeUndefined();
        expect(result.errors.join("\n")).toContain("themeColor");
        expect(result.errors.join("\n")).toContain("backgroundOpacity");
        expect(result.errors.join("\n")).toContain("windowControlsPos");
        expect(result.errors.join("\n")).toContain("colorScheme");
    });
});
