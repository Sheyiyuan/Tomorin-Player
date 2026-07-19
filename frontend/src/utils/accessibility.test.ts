import { describe, expect, it } from "vitest";
import { getContrastRatio } from "./accessibility";

describe("getContrastRatio", () => {
    it("calculates the WCAG ratio for black and white", () => {
        expect(getContrastRatio("#000000", "#ffffff")).toBe(21);
    });

    it("accepts shorthand hex and rejects invalid colors", () => {
        expect(getContrastRatio("#fff", "#000")).toBe(21);
        expect(getContrastRatio("currentColor", "#000000")).toBeNull();
    });
});
