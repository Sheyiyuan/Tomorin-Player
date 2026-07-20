import { useCallback } from "react";
import { notifications } from "@mantine/notifications";
import * as Services from "../../../wailsjs/go/services/Service";
import type { Theme } from "../../types";
import type { ModalName } from "../../context/types/contexts";
import type { useThemeDraftState } from "../ui/useThemeDraftState";
import { parseDomainError } from "../../utils/domainError";
import {
    createDefaultThemeDraft,
    createThemeDataFromDraft,
    themeToDraft,
    type ResolvedThemeBackground,
    type ThemeColorScheme,
    type ThemeDraft,
} from "./themeDraft";

interface UseThemeEditorProps {
    themes: Theme[];
    setThemes: (themes: Theme[]) => void;
    defaultThemes: Theme[];
    currentThemeId: string | null;
    computedColorScheme: string;
    saveCachedCustomThemes: (themes: Theme[]) => void;
    applyThemeToUi: (theme: Theme) => void;
    getCustomThemesFromState: (themes: Theme[]) => Theme[];
    themeDraft: ReturnType<typeof useThemeDraftState>;
    openModal: (name: ModalName) => void;
    closeModal: (name: ModalName) => void;
}

const normalizeColorScheme = (value: string): ThemeColorScheme =>
    value === "dark" ? "dark" : "light";

export const useThemeEditor = ({
    themes,
    setThemes,
    defaultThemes,
    currentThemeId,
    computedColorScheme,
    saveCachedCustomThemes,
    applyThemeToUi,
    getCustomThemesFromState,
    themeDraft,
    openModal,
    closeModal,
}: UseThemeEditorProps) => {
    const { session, actions: draftActions } = themeDraft;
    const { draft, savingTheme } = session;

    const resolveBackgroundImage = useCallback(async (
        draftToResolve: ThemeDraft,
        editingTheme: Theme | undefined,
    ): Promise<ResolvedThemeBackground> => {
        const trimmed = draftToResolve.backgroundImageUrl.trim();
        if (!trimmed) {
            return { backgroundImage: "", backgroundImageSourceUrl: "" };
        }

        if (trimmed.startsWith("data:")) {
            const proxyUrl = await Services.SaveThemeImageFromDataURL(trimmed);
            return { backgroundImage: proxyUrl, backgroundImageSourceUrl: "" };
        }

        if (isLocalProxyUrl(trimmed, "/theme-image") || isLocalProxyUrl(trimmed, "/image")) {
            return {
                backgroundImage: trimmed,
                backgroundImageSourceUrl: draftToResolve.backgroundImageSourceUrl || editingTheme?.backgroundImageSourceUrl || "",
            };
        }

        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            try {
                const proxyUrl = await Services.SaveThemeImageFromURL(trimmed);
                return { backgroundImage: proxyUrl, backgroundImageSourceUrl: trimmed };
            } catch (err) {
                if (editingTheme?.backgroundImage) {
                    notifications.show({
                        title: "背景图刷新失败",
                        message: "URL 无法访问，已保留旧的本地缓存。",
                        color: "yellow",
                    });
                    return {
                        backgroundImage: editingTheme.backgroundImage || "",
                        backgroundImageSourceUrl: editingTheme.backgroundImageSourceUrl || "",
                    };
                }
                throw err;
            }
        }

        return {
            backgroundImage: trimmed,
            backgroundImageSourceUrl: draftToResolve.backgroundImageSourceUrl || editingTheme?.backgroundImageSourceUrl || "",
        };
    }, []);

    const selectTheme = useCallback(async (theme: Theme) => {
        try {
            await persistThemeSelection(theme, applyThemeToUi);
        } catch (err) {
            notifications.show({
                title: "主题切换失败",
                message: parseDomainError(err).message,
                color: "red",
            });
        }
    }, [applyThemeToUi]);

    const editTheme = useCallback((theme: Theme) => {
        draftActions.replaceDraft(themeToDraft(theme), "edit");
        openModal("themeEditorModal");
    }, [draftActions, openModal]);

    const viewTheme = useCallback((theme: Theme) => {
        draftActions.replaceDraft(themeToDraft(theme), "view");
        openModal("themeDetailModal");
    }, [draftActions, openModal]);

    const deleteTheme = useCallback(async (id: string) => {
        try {
            await Services.DeleteTheme(id);
            const currentCustomThemes = getCustomThemesFromState(themes);
            const nextCustom = currentCustomThemes.filter((theme) => theme.id !== id);
            saveCachedCustomThemes(nextCustom);
            setThemes([...defaultThemes, ...nextCustom]);
            if (currentThemeId === id) {
                const fallback = defaultThemes.find((theme) => theme.id === "light") ?? defaultThemes[0];
                if (fallback) {
                    await persistThemeSelection(fallback, applyThemeToUi);
                }
            }
        } catch (err) {
            notifications.show({
                title: "主题删除失败",
                message: parseDomainError(err).message,
                color: "red",
            });
        }
    }, [themes, setThemes, saveCachedCustomThemes, getCustomThemesFromState, defaultThemes, currentThemeId, applyThemeToUi]);

    const createThemeClick = useCallback(() => {
        draftActions.replaceDraft(createDefaultThemeDraft(normalizeColorScheme(computedColorScheme)), "create");
        openModal("themeEditorModal");
    }, [draftActions, openModal, computedColorScheme]);

    const submitTheme = useCallback(async () => {
        if (savingTheme || session.isReadOnly) return;

        draftActions.setSavingTheme(true);
        const toastId = notifications.show({
            title: draft.id ? "正在保存主题" : "正在创建主题",
            message: "请稍候...",
            color: draft.themeColor,
            loading: true,
            autoClose: false,
        });

        try {
            const editingTheme = draft.id ? themes.find((theme) => theme.id === draft.id) : undefined;
            const background = await resolveBackgroundImage(draft, editingTheme);
            const themeData = createThemeDataFromDraft(draft, background);
            const name = draft.name || "未命名主题";

            if (draft.id) {
                const updatedTheme: Theme = {
                    id: draft.id,
                    name,
                    data: JSON.stringify(themeData),
                    isDefault: editingTheme?.isDefault || false,
                    isReadOnly: false,
                };
                await Services.UpdateTheme(updatedTheme);

                const displayTheme: Theme = {
                    ...updatedTheme,
                    ...themeData,
                };
                const currentCustomThemes = getCustomThemesFromState(themes);
                const nextCustom = currentCustomThemes.map((theme) => (theme.id === draft.id ? displayTheme : theme));
                saveCachedCustomThemes(nextCustom);
                setThemes([...defaultThemes, ...nextCustom]);
                if (currentThemeId === draft.id) {
                    applyThemeToUi(displayTheme);
                }
                notifications.update({
                    id: toastId,
                    title: "主题已保存",
                    message: name,
                    color: "teal",
                    loading: false,
                    autoClose: 1500,
                });
            } else {
                const newTheme: Theme = {
                    id: "",
                    name,
                    data: JSON.stringify(themeData),
                    isDefault: false,
                    isReadOnly: false,
                };
                const createdTheme = await Services.CreateTheme(newTheme);
                const displayTheme: Theme = {
                    ...createdTheme,
                    ...themeData,
                };
                const currentCustomThemes = getCustomThemesFromState(themes);
                const nextCustom = [...currentCustomThemes, displayTheme];
                saveCachedCustomThemes(nextCustom);
                setThemes([...defaultThemes, ...nextCustom]);
                notifications.update({
                    id: toastId,
                    title: "主题已创建",
                    message: createdTheme.name,
                    color: "teal",
                    loading: false,
                    autoClose: 1500,
                });
            }

            closeModal("themeEditorModal");
            draftActions.resetThemeDraft(normalizeColorScheme(computedColorScheme));
        } catch (err) {
            notifications.update({
                id: toastId,
                title: draft.id ? "保存失败" : "创建失败",
                message: parseDomainError(err).message,
                color: "red",
                loading: false,
                autoClose: 3000,
            });
        } finally {
            draftActions.setSavingTheme(false);
        }
    }, [
        savingTheme,
        session.isReadOnly,
        draftActions,
        draft,
        themes,
        resolveBackgroundImage,
        getCustomThemesFromState,
        saveCachedCustomThemes,
        setThemes,
        defaultThemes,
        currentThemeId,
        applyThemeToUi,
        closeModal,
        computedColorScheme,
    ]);

    const closeThemeEditor = useCallback((discardChanges = false): boolean => {
        if (session.savingTheme) return false;
        if (!discardChanges && session.isDirty && !session.isReadOnly) return false;
        closeModal("themeEditorModal");
        draftActions.resetThemeDraft(normalizeColorScheme(computedColorScheme));
        return true;
    }, [closeModal, computedColorScheme, draftActions, session.isDirty, session.isReadOnly, session.savingTheme]);

    const closeThemeDetail = useCallback(() => {
        closeModal("themeDetailModal");
        draftActions.resetThemeDraft(normalizeColorScheme(computedColorScheme));
    }, [closeModal, computedColorScheme, draftActions]);

    return {
        management: {
            selectTheme,
            editTheme,
            viewTheme,
            deleteTheme,
            createThemeClick,
        },
        session,
        draftActions,
        save: {
            submitTheme,
            savingTheme: session.savingTheme,
        },
        closeThemeEditor,
        closeThemeDetail,
        selectTheme,
        editTheme,
        viewTheme,
        deleteTheme,
        createThemeClick,
        submitTheme,
    };
};

export const persistThemeSelection = async (
    theme: Theme,
    applyThemeToUi: (themeToApply: Theme) => void,
): Promise<void> => {
    await Services.SetCurrentTheme(theme.id);
    applyThemeToUi(theme);
};

const isLocalProxyUrl = (value: string, path: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.pathname === path;
    } catch {
        return false;
    }
};
