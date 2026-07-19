import type { Theme } from "../../types";

export type ThemeEditorMode = "create" | "edit" | "view";
export type ThemeColorScheme = "light" | "dark";
export type ThemeWindowControlsPos = "left" | "right" | "hidden";

export interface ThemeDraft {
    id: string | null;
    name: string;
    themeColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    backgroundImageUrl: string;
    backgroundImageSourceUrl: string;
    backgroundBlur: number;
    panelColor: string;
    panelOpacity: number;
    panelBlur: number;
    panelRadius: number;
    controlColor: string;
    controlOpacity: number;
    controlBlur: number;
    textColorPrimary: string;
    textColorSecondary: string;
    favoriteCardColor: string;
    cardOpacity: number;
    componentRadius: number;
    modalRadius: number;
    notificationRadius: number;
    coverRadius: number;
    modalColor: string;
    modalOpacity: number;
    modalBlur: number;
    windowControlsPos: ThemeWindowControlsPos;
    colorScheme: ThemeColorScheme;
    extraData: Record<string, unknown>;
}

export type ThemeDraftField = Exclude<keyof ThemeDraft, "id" | "extraData">;

export interface ResolvedThemeBackground {
    backgroundImage: string;
    backgroundImageSourceUrl: string;
}

export interface ThemeDataPayload extends Record<string, unknown> {
    themeColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    backgroundImage: string;
    backgroundImageSourceUrl: string;
    backgroundBlur: number;
    panelColor: string;
    panelOpacity: number;
    panelBlur: number;
    panelRadius: number;
    controlColor: string;
    controlOpacity: number;
    controlBlur: number;
    textColorPrimary: string;
    textColorSecondary: string;
    favoriteCardColor: string;
    cardOpacity: number;
    componentRadius: number;
    modalRadius: number;
    notificationRadius: number;
    coverRadius: number;
    modalColor: string;
    modalOpacity: number;
    modalBlur: number;
    windowControlsPos: ThemeWindowControlsPos;
    colorScheme: ThemeColorScheme;
}

export interface ParsedThemeDraftResult {
    draft?: ThemeDraft;
    errors: string[];
}

const themeDataKeys = new Set<string>([
    "name",
    "themeColor",
    "backgroundColor",
    "backgroundOpacity",
    "backgroundImage",
    "backgroundImageSourceUrl",
    "backgroundBlur",
    "panelColor",
    "panelOpacity",
    "panelBlur",
    "panelRadius",
    "controlColor",
    "controlOpacity",
    "controlBlur",
    "textColorPrimary",
    "textColorSecondary",
    "favoriteCardColor",
    "cardOpacity",
    "componentRadius",
    "modalRadius",
    "notificationRadius",
    "coverRadius",
    "modalColor",
    "modalOpacity",
    "modalBlur",
    "windowControlsPos",
    "colorScheme",
]);

const hexColorPattern = /^#[0-9a-f]{6}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown, fallback: string): string =>
    typeof value === "string" ? value : fallback;

const numberValue = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

const colorSchemeValue = (value: unknown, fallback: ThemeColorScheme): ThemeColorScheme =>
    value === "light" || value === "dark" ? value : fallback;

const windowControlsValue = (value: unknown, fallback: ThemeWindowControlsPos): ThemeWindowControlsPos =>
    value === "left" || value === "right" || value === "hidden" ? value : fallback;

export const createDefaultThemeDraft = (colorScheme: ThemeColorScheme): ThemeDraft => {
    const isDark = colorScheme === "dark";

    return {
        id: null,
        name: "",
        themeColor: "#228be6",
        backgroundColor: isDark ? "#0b1021" : "#f8fafc",
        backgroundOpacity: 1,
        backgroundImageUrl: "",
        backgroundImageSourceUrl: "",
        backgroundBlur: 0,
        panelColor: isDark ? "#1f2937" : "#ffffff",
        panelOpacity: 0.92,
        panelBlur: 0,
        panelRadius: 8,
        controlColor: isDark ? "#1f2937" : "#ffffff",
        controlOpacity: 1,
        controlBlur: 0,
        textColorPrimary: isDark ? "#ffffff" : "#1a1b1e",
        textColorSecondary: isDark ? "#a6a7ab" : "#909296",
        favoriteCardColor: isDark ? "#1f2937" : "#ffffff",
        cardOpacity: 1,
        componentRadius: 8,
        modalRadius: 8,
        notificationRadius: 8,
        coverRadius: 8,
        modalColor: isDark ? "#1f2937" : "#ffffff",
        modalOpacity: 0.92,
        modalBlur: 0,
        windowControlsPos: "right",
        colorScheme,
        extraData: {},
    };
};

export const parseThemeData = (theme: Theme): Record<string, unknown> => {
    if (!theme.data) return {};

    try {
        const parsed = JSON.parse(theme.data);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const getExtraData = (data: Record<string, unknown>): Record<string, unknown> => {
    const extra: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
        if (!themeDataKeys.has(key)) {
            extra[key] = value;
        }
    });
    return extra;
};

export const themeToDraft = (theme: Theme): ThemeDraft => {
    const data = parseThemeData(theme);
    const scheme = colorSchemeValue(data.colorScheme ?? theme.colorScheme, "dark");

    return {
        id: theme.id,
        name: theme.name,
        themeColor: stringValue(data.themeColor ?? theme.themeColor, "#1f77f0"),
        backgroundColor: stringValue(data.backgroundColor ?? theme.backgroundColor, "#0a0e27"),
        backgroundOpacity: numberValue(data.backgroundOpacity ?? theme.backgroundOpacity, 1),
        backgroundImageUrl: stringValue(
            data.backgroundImageSourceUrl ?? theme.backgroundImageSourceUrl ?? data.backgroundImage ?? theme.backgroundImage,
            "",
        ),
        backgroundImageSourceUrl: stringValue(data.backgroundImageSourceUrl ?? theme.backgroundImageSourceUrl, ""),
        backgroundBlur: numberValue(data.backgroundBlur ?? theme.backgroundBlur, 0),
        panelColor: stringValue(data.panelColor ?? theme.panelColor, "#1a1f3a"),
        panelOpacity: numberValue(data.panelOpacity ?? theme.panelOpacity, 0.6),
        panelBlur: numberValue(data.panelBlur ?? theme.panelBlur, 0),
        panelRadius: numberValue(data.panelRadius ?? theme.panelRadius, 8),
        controlColor: stringValue(data.controlColor ?? theme.controlColor ?? theme.panelColor, "#2a2f4a"),
        controlOpacity: numberValue(data.controlOpacity ?? theme.controlOpacity, 1),
        controlBlur: numberValue(data.controlBlur ?? theme.controlBlur, 0),
        textColorPrimary: stringValue(data.textColorPrimary ?? theme.textColorPrimary, "#ffffff"),
        textColorSecondary: stringValue(data.textColorSecondary ?? theme.textColorSecondary, "#909296"),
        favoriteCardColor: stringValue(data.favoriteCardColor ?? theme.favoriteCardColor ?? theme.panelColor, "#2a2f4a"),
        cardOpacity: numberValue(data.cardOpacity ?? theme.cardOpacity, 0.5),
        componentRadius: numberValue(data.componentRadius ?? theme.componentRadius, 6),
        modalRadius: numberValue(data.modalRadius ?? theme.modalRadius, 8),
        notificationRadius: numberValue(data.notificationRadius ?? theme.notificationRadius, 8),
        coverRadius: numberValue(data.coverRadius ?? theme.coverRadius, 4),
        modalColor: stringValue(data.modalColor ?? theme.modalColor ?? theme.panelColor, "#1a1f3a"),
        modalOpacity: numberValue(data.modalOpacity ?? theme.modalOpacity, 0.95),
        modalBlur: numberValue(data.modalBlur ?? theme.modalBlur, 10),
        windowControlsPos: windowControlsValue(data.windowControlsPos ?? theme.windowControlsPos, "right"),
        colorScheme: scheme,
        extraData: getExtraData(data),
    };
};

export const createThemeDataFromDraft = (
    draft: ThemeDraft,
    background: ResolvedThemeBackground,
): ThemeDataPayload => ({
    ...draft.extraData,
    themeColor: draft.themeColor,
    backgroundColor: draft.backgroundColor,
    backgroundOpacity: draft.backgroundOpacity,
    backgroundImage: background.backgroundImage,
    backgroundImageSourceUrl: background.backgroundImageSourceUrl,
    backgroundBlur: draft.backgroundBlur,
    panelColor: draft.panelColor,
    panelOpacity: draft.panelOpacity,
    panelBlur: draft.panelBlur,
    panelRadius: draft.panelRadius,
    controlColor: draft.controlColor,
    controlOpacity: draft.controlOpacity,
    controlBlur: draft.controlBlur,
    textColorPrimary: draft.textColorPrimary,
    textColorSecondary: draft.textColorSecondary,
    favoriteCardColor: draft.favoriteCardColor,
    cardOpacity: draft.cardOpacity,
    componentRadius: draft.componentRadius,
    modalRadius: draft.modalRadius,
    notificationRadius: draft.notificationRadius,
    coverRadius: draft.coverRadius,
    modalColor: draft.modalColor,
    modalOpacity: draft.modalOpacity,
    modalBlur: draft.modalBlur,
    windowControlsPos: draft.windowControlsPos,
    colorScheme: draft.colorScheme,
});

export const createThemeJsonObject = (draft: ThemeDraft): Record<string, unknown> => ({
    ...draft.extraData,
    name: draft.name,
    themeColor: draft.themeColor,
    backgroundColor: draft.backgroundColor,
    backgroundOpacity: draft.backgroundOpacity,
    backgroundImage: draft.backgroundImageUrl,
    backgroundImageSourceUrl: draft.backgroundImageSourceUrl,
    backgroundBlur: draft.backgroundBlur,
    panelColor: draft.panelColor,
    panelOpacity: draft.panelOpacity,
    panelBlur: draft.panelBlur,
    panelRadius: draft.panelRadius,
    controlColor: draft.controlColor,
    controlOpacity: draft.controlOpacity,
    controlBlur: draft.controlBlur,
    textColorPrimary: draft.textColorPrimary,
    textColorSecondary: draft.textColorSecondary,
    favoriteCardColor: draft.favoriteCardColor,
    cardOpacity: draft.cardOpacity,
    componentRadius: draft.componentRadius,
    modalRadius: draft.modalRadius,
    notificationRadius: draft.notificationRadius,
    coverRadius: draft.coverRadius,
    modalColor: draft.modalColor,
    modalOpacity: draft.modalOpacity,
    modalBlur: draft.modalBlur,
    windowControlsPos: draft.windowControlsPos,
    colorScheme: draft.colorScheme,
});

const validateString = (values: Record<string, unknown>, key: string, errors: string[]): string => {
    const value = values[key];
    if (typeof value !== "string") {
        errors.push(`字段 "${key}" 必须是字符串类型，当前值：${String(value)}`);
        return "";
    }
    return value;
};

const validateColor = (values: Record<string, unknown>, key: string, errors: string[]): string => {
    const value = validateString(values, key, errors);
    if (value && !hexColorPattern.test(value)) {
        errors.push(`字段 "${key}" 必须是有效的十六进制颜色 (#RRGGBB)，当前值：${value}`);
    }
    return value;
};

const validateNumber = (
    values: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    errors: string[],
): number => {
    const value = values[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`字段 "${key}" 必须是数字类型，当前值：${String(value)}`);
        return min;
    }
    if (value < min) errors.push(`字段 "${key}" 必须大于等于 ${min}，当前值：${value}`);
    if (value > max) errors.push(`字段 "${key}" 必须小于等于 ${max}，当前值：${value}`);
    return value;
};

const validateRequired = (values: Record<string, unknown>, key: string, errors: string[]): void => {
    if (values[key] === undefined || values[key] === null || values[key] === "") {
        errors.push(`字段 "${key}" 是必需的`);
    }
};

export const parseThemeDraftJson = (text: string, baseDraft: ThemeDraft): ParsedThemeDraftResult => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        return { errors: [`JSON 解析失败: ${String(error)}`] };
    }

    if (!isRecord(parsed)) {
        return { errors: ["JSON 必须是一个对象"] };
    }

    const errors: string[] = [];
    const requiredKeys = [
        "name",
        "themeColor",
        "backgroundColor",
        "backgroundOpacity",
        "backgroundBlur",
        "panelColor",
        "panelOpacity",
        "panelBlur",
        "panelRadius",
        "controlColor",
        "controlOpacity",
        "controlBlur",
        "textColorPrimary",
        "textColorSecondary",
        "favoriteCardColor",
        "cardOpacity",
        "componentRadius",
        "modalRadius",
        "notificationRadius",
        "coverRadius",
        "modalColor",
        "modalOpacity",
        "modalBlur",
        "windowControlsPos",
        "colorScheme",
    ];

    requiredKeys.forEach((key) => validateRequired(parsed, key, errors));

    const name = validateString(parsed, "name", errors);
    const themeColor = validateColor(parsed, "themeColor", errors);
    const backgroundColor = validateColor(parsed, "backgroundColor", errors);
    const panelColor = validateColor(parsed, "panelColor", errors);
    const controlColor = validateColor(parsed, "controlColor", errors);
    const textColorPrimary = validateColor(parsed, "textColorPrimary", errors);
    const textColorSecondary = validateColor(parsed, "textColorSecondary", errors);
    const favoriteCardColor = validateColor(parsed, "favoriteCardColor", errors);
    const modalColor = validateColor(parsed, "modalColor", errors);

    const windowControlsPos = windowControlsValue(parsed.windowControlsPos, "right");
    if (parsed.windowControlsPos !== windowControlsPos) {
        errors.push(`字段 "windowControlsPos" 必须是 left/right/hidden 之一，当前值：${String(parsed.windowControlsPos)}`);
    }

    const colorScheme = colorSchemeValue(parsed.colorScheme, "dark");
    if (parsed.colorScheme !== colorScheme) {
        errors.push(`字段 "colorScheme" 必须是 light/dark 之一，当前值：${String(parsed.colorScheme)}`);
    }

    const backgroundImage = parsed.backgroundImage === undefined ? "" : validateString(parsed, "backgroundImage", errors);
    const backgroundImageSourceUrl = parsed.backgroundImageSourceUrl === undefined
        ? ""
        : validateString(parsed, "backgroundImageSourceUrl", errors);

    const backgroundOpacity = validateNumber(parsed, "backgroundOpacity", 0, 1, errors);
    const backgroundBlur = validateNumber(parsed, "backgroundBlur", 0, 50, errors);
    const panelOpacity = validateNumber(parsed, "panelOpacity", 0.2, 1, errors);
    const panelBlur = validateNumber(parsed, "panelBlur", 0, 30, errors);
    const panelRadius = validateNumber(parsed, "panelRadius", 0, 32, errors);
    const controlOpacity = validateNumber(parsed, "controlOpacity", 0, 1, errors);
    const controlBlur = validateNumber(parsed, "controlBlur", 0, 20, errors);
    const cardOpacity = validateNumber(parsed, "cardOpacity", 0, 1, errors);
    const componentRadius = validateNumber(parsed, "componentRadius", 0, 32, errors);
    const modalRadius = validateNumber(parsed, "modalRadius", 0, 32, errors);
    const notificationRadius = validateNumber(parsed, "notificationRadius", 0, 32, errors);
    const coverRadius = validateNumber(parsed, "coverRadius", 0, 50, errors);
    const modalOpacity = validateNumber(parsed, "modalOpacity", 0, 1, errors);
    const modalBlur = validateNumber(parsed, "modalBlur", 0, 30, errors);

    if (errors.length > 0) return { errors };

    return {
        draft: {
            ...baseDraft,
            name,
            themeColor,
            backgroundColor,
            backgroundOpacity,
            backgroundImageUrl: backgroundImage,
            backgroundImageSourceUrl,
            backgroundBlur,
            panelColor,
            panelOpacity,
            panelBlur,
            panelRadius,
            controlColor,
            controlOpacity,
            controlBlur,
            textColorPrimary,
            textColorSecondary,
            favoriteCardColor,
            cardOpacity,
            componentRadius,
            modalRadius,
            notificationRadius,
            coverRadius,
            modalColor,
            modalOpacity,
            modalBlur,
            windowControlsPos,
            colorScheme,
            extraData: getExtraData(parsed),
        },
        errors,
    };
};

export const isThemeDraftEqual = (left: ThemeDraft, right: ThemeDraft): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
