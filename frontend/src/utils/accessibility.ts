type Rgb = {
    red: number;
    green: number;
    blue: number;
};

const parseHexColor = (color: string): Rgb | null => {
    const normalized = color.trim().replace(/^#/, "");
    const expanded = normalized.length === 3
        ? normalized.split("").map((value) => `${value}${value}`).join("")
        : normalized.slice(0, 6);

    if (expanded.length !== 6 || !/^[0-9a-f]{6}$/i.test(expanded)) {
        return null;
    }

    return {
        red: Number.parseInt(expanded.slice(0, 2), 16),
        green: Number.parseInt(expanded.slice(2, 4), 16),
        blue: Number.parseInt(expanded.slice(4, 6), 16),
    };
};

const relativeLuminance = ({ red, green, blue }: Rgb): number => {
    const normalize = (channel: number): number => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * normalize(red) + 0.7152 * normalize(green) + 0.0722 * normalize(blue);
};

export const getContrastRatio = (foreground: string, background: string): number | null => {
    const foregroundRgb = parseHexColor(foreground);
    const backgroundRgb = parseHexColor(background);
    if (!foregroundRgb || !backgroundRgb) return null;

    const foregroundLuminance = relativeLuminance(foregroundRgb);
    const backgroundLuminance = relativeLuminance(backgroundRgb);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
};
