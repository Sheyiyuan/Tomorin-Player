import { describe, expect, it } from "vitest";
import type { Theme } from "../../types";
import { createDefaultThemeDraft, createThemeJsonObject, parseThemeDraftJson, themeToDraft } from "./themeDraft";

const theme: Theme = {
    id: "theme-1",
    name: "Theme",
    data: JSON.stringify({
        themeColor: "#112233",
        backgroundColor: "#445566",
        backgroundOpacity: 0.5,
        backgroundImage: "",
        backgroundImageSourceUrl: "",
        backgroundBlur: 1,
        panelColor: "#778899",
        panelOpacity: 0.6,
        panelBlur: 2,
        panelRadius: 8,
        controlColor: "#aabbcc",
        controlOpacity: 1,
        controlBlur: 0,
        textColorPrimary: "#111111",
        textColorSecondary: "#222222",
        favoriteCardColor: "#ddeeff",
        cardOpacity: 1,
        componentRadius: 8,
        modalRadius: 8,
        notificationRadius: 8,
        coverRadius: 8,
        modalColor: "#ffffff",
        modalOpacity: 1,
        modalBlur: 0,
        windowControlsPos: "right",
        colorScheme: "light",
        future: "keep",
    }),
    isDefault: false,
    isReadOnly: false,
};

describe("theme editor data flow", () => {
    it("keeps unknown theme data when round-tripping through the draft", () => {
        const draft = themeToDraft(theme);
        const roundTripped = createThemeJsonObject(draft);

        expect(roundTripped.future).toBe("keep");
        expect(roundTripped.backgroundImage).toBe("");
    });

    it("allows empty JSON names and still returns a valid draft", () => {
        const draft = createDefaultThemeDraft("dark");
        const json = JSON.stringify({
            ...createThemeJsonObject(draft),
            name: "",
        });

        const result = parseThemeDraftJson(json, draft);

        expect(result.errors).toEqual([]);
        expect(result.draft?.name).toBe("");
    });
});
