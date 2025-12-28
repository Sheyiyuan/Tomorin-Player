import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { Theme } from '../../types';
import type { ModalStates } from '../ui/useModalManager';

interface UseThemeEditorProps {
    themes: Theme[];
    setThemes: (themes: Theme[]) => void;
    defaultThemes: Theme[];
    currentThemeId: string | null;
    computedColorScheme: string;
    saveCachedCustomThemes: (themes: Theme[]) => void;
    applyThemeToUi: (theme: Theme) => void;
    getCustomThemesFromState: (themes: Theme[]) => Theme[];
    editingThemeId: string | null;
    setEditingThemeId: (id: string | null) => void;
    newThemeName: string;
    setNewThemeName: (name: string) => void;
    colorSchemeDraft: "light" | "dark";
    setColorSchemeDraft: (scheme: "light" | "dark") => void;
    themeColorDraft: string;
    setThemeColorDraft: (color: string) => void;
    backgroundColorDraft: string;
    setBackgroundColorDraft: (color: string) => void;
    backgroundOpacityDraft: number;
    setBackgroundOpacityDraft: (opacity: number) => void;
    backgroundImageUrlDraft: string;
    setBackgroundImageUrlDraftSafe: (url: string) => void;
    backgroundBlurDraft: number;
    setBackgroundBlurDraft: (blur: number) => void;
    panelColorDraft: string;
    setPanelColorDraft: (color: string) => void;
    panelOpacityDraft: number;
    setPanelOpacityDraft: (opacity: number) => void;
    panelBlurDraft: number;
    setPanelBlurDraft: (blur: number) => void;
    panelRadiusDraft: number;
    setPanelRadiusDraft: (radius: number) => void;
    componentRadiusDraft: number;
    setComponentRadiusDraft: (radius: number) => void;
    coverRadiusDraft: number;
    setCoverRadiusDraft: (radius: number) => void;
    windowControlsPosDraft: string;
    setWindowControlsPosDraft: (pos: string) => void;
    setSavingTheme: (saving: boolean) => void;
    openModal: (name: keyof ModalStates) => void;
    closeModal: (name: keyof ModalStates) => void;
}

export const useThemeEditor = ({
    themes,
    setThemes,
    defaultThemes,
    currentThemeId,
    computedColorScheme,
    saveCachedCustomThemes,
    applyThemeToUi,
    getCustomThemesFromState,
    editingThemeId,
    setEditingThemeId,
    newThemeName,
    setNewThemeName,
    colorSchemeDraft,
    setColorSchemeDraft,
    themeColorDraft,
    setThemeColorDraft,
    backgroundColorDraft,
    setBackgroundColorDraft,
    backgroundOpacityDraft,
    setBackgroundOpacityDraft,
    backgroundImageUrlDraft,
    setBackgroundImageUrlDraftSafe,
    backgroundBlurDraft,
    setBackgroundBlurDraft,
    panelColorDraft,
    setPanelColorDraft,
    panelOpacityDraft,
    setPanelOpacityDraft,
    panelBlurDraft,
    setPanelBlurDraft,
    panelRadiusDraft,
    setPanelRadiusDraft,
    componentRadiusDraft,
    setComponentRadiusDraft,
    coverRadiusDraft,
    setCoverRadiusDraft,
    windowControlsPosDraft,
    setWindowControlsPosDraft,
    setSavingTheme,
    openModal,
    closeModal,
}: UseThemeEditorProps) => {

    const selectTheme = useCallback((theme: Theme) => {
        applyThemeToUi(theme);
        Services.SetCurrentTheme(theme.id).catch(err => console.error("SetCurrentTheme failed", err));
    }, [applyThemeToUi]);

    const editTheme = useCallback((theme: Theme) => {
        setEditingThemeId(theme.id);
        setNewThemeName(theme.name);
        setColorSchemeDraft((theme.colorScheme as "light" | "dark") || "light");
        setThemeColorDraft(theme.themeColor);
        setBackgroundColorDraft(theme.backgroundColor);
        setBackgroundOpacityDraft(theme.backgroundOpacity);
        setBackgroundImageUrlDraftSafe(theme.backgroundImage);
        setBackgroundBlurDraft(theme.backgroundBlur || 0);
        setPanelColorDraft(theme.panelColor);
        setPanelOpacityDraft(theme.panelOpacity);
        setPanelBlurDraft(theme.panelBlur ?? 0);
        setPanelRadiusDraft(theme.panelRadius ?? 8);
        setComponentRadiusDraft(theme.componentRadius ?? 8);
        setCoverRadiusDraft(theme.coverRadius ?? 8);
        setWindowControlsPosDraft(theme.windowControlsPos || 'right');
        openModal("themeEditorModal");
    }, [setEditingThemeId, setNewThemeName, setColorSchemeDraft, setThemeColorDraft, setBackgroundColorDraft, setBackgroundOpacityDraft, setBackgroundImageUrlDraftSafe, setBackgroundBlurDraft, setPanelColorDraft, setPanelOpacityDraft, setPanelBlurDraft, setPanelRadiusDraft, setComponentRadiusDraft, setCoverRadiusDraft, setWindowControlsPosDraft, openModal]);

    const deleteTheme = useCallback(async (id: string) => {
        await Services.DeleteTheme(id);
        const currentCustomThemes = getCustomThemesFromState(themes);
        const nextCustom = currentCustomThemes.filter((t: Theme) => t.id !== id);
        saveCachedCustomThemes(nextCustom);
        setThemes([...defaultThemes, ...nextCustom]);
    }, [themes, setThemes, saveCachedCustomThemes, getCustomThemesFromState, defaultThemes]);

    const createThemeClick = useCallback(() => {
        setEditingThemeId(null);
        setNewThemeName("");
        setColorSchemeDraft(computedColorScheme as "light" | "dark");
        setThemeColorDraft("#228be6");
        setBackgroundColorDraft(computedColorScheme === "dark" ? "#0b1021" : "#f8fafc");
        setBackgroundOpacityDraft(1);
        setBackgroundImageUrlDraftSafe("");
        setBackgroundBlurDraft(0);
        setPanelColorDraft(computedColorScheme === "dark" ? "#1f2937" : "#ffffff");
        setPanelOpacityDraft(0.92);
        setPanelBlurDraft(0);
        setPanelRadiusDraft(8);
        setComponentRadiusDraft(8);
        setCoverRadiusDraft(8);
        setWindowControlsPosDraft("right");
        openModal("themeEditorModal");
    }, [setEditingThemeId, setNewThemeName, setColorSchemeDraft, setThemeColorDraft, setBackgroundColorDraft, setBackgroundOpacityDraft, setBackgroundImageUrlDraftSafe, setBackgroundBlurDraft, setPanelColorDraft, setPanelOpacityDraft, setPanelBlurDraft, setPanelRadiusDraft, setComponentRadiusDraft, setCoverRadiusDraft, setWindowControlsPosDraft, openModal, computedColorScheme]);

    const submitTheme = useCallback(async () => {
        setSavingTheme(true);
        const toastId = notifications.show({
            title: editingThemeId ? "正在保存主题" : "正在创建主题",
            message: "请稍候...",
            color: themeColorDraft,
            loading: true,
            autoClose: false,
        });
        try {
            if (editingThemeId) {
                const editingTheme = themes.find((t: Theme) => t.id === editingThemeId);
                const updatedTheme: Theme = {
                    id: editingThemeId,
                    name: newThemeName || "未命名主题",
                    colorScheme: colorSchemeDraft,
                    themeColor: themeColorDraft,
                    backgroundColor: backgroundColorDraft,
                    backgroundOpacity: backgroundOpacityDraft,
                    backgroundImage: backgroundImageUrlDraft,
                    backgroundBlur: backgroundBlurDraft,
                    panelColor: panelColorDraft,
                    panelOpacity: panelOpacityDraft,
                    panelBlur: panelBlurDraft,
                    panelRadius: panelRadiusDraft,
                    componentRadius: componentRadiusDraft,
                    coverRadius: coverRadiusDraft,
                    windowControlsPos: windowControlsPosDraft,
                    isDefault: editingTheme?.isDefault || false,
                    isReadOnly: false,
                };
                await Services.UpdateTheme(updatedTheme);
                const currentCustomThemes = getCustomThemesFromState(themes);
                const nextCustom = currentCustomThemes.map((t: Theme) => (t.id === editingThemeId ? updatedTheme : t));
                saveCachedCustomThemes(nextCustom);
                setThemes([...defaultThemes, ...nextCustom]);
                if (currentThemeId === editingThemeId) {
                    applyThemeToUi(updatedTheme);
                }
                notifications.update({
                    id: toastId,
                    title: "主题已保存",
                    message: updatedTheme.name,
                    color: "teal",
                    loading: false,
                    autoClose: 1500,
                });
            } else {
                const newTheme: Theme = {
                    id: "",
                    name: newThemeName || "未命名主题",
                    colorScheme: colorSchemeDraft,
                    themeColor: themeColorDraft,
                    backgroundColor: backgroundColorDraft,
                    backgroundOpacity: backgroundOpacityDraft,
                    backgroundImage: backgroundImageUrlDraft,
                    backgroundBlur: backgroundBlurDraft,
                    panelColor: panelColorDraft,
                    panelOpacity: panelOpacityDraft,
                    panelBlur: panelBlurDraft,
                    panelRadius: panelRadiusDraft,
                    componentRadius: componentRadiusDraft,
                    coverRadius: coverRadiusDraft,
                    windowControlsPos: windowControlsPosDraft,
                    isDefault: false,
                    isReadOnly: false,
                };
                const createdTheme = await Services.CreateTheme(newTheme);
                const currentCustomThemes = getCustomThemesFromState(themes);
                const nextCustom = [...currentCustomThemes, createdTheme];
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
            setEditingThemeId(null);
            setNewThemeName("");
        } catch (err) {
            notifications.update({
                id: toastId,
                title: editingThemeId ? "保存失败" : "创建失败",
                message: `${err}`,
                color: "red",
                loading: false,
                autoClose: 3000,
            });
        } finally {
            setSavingTheme(false);
        }
    }, [
        themes, currentThemeId, saveCachedCustomThemes, applyThemeToUi, getCustomThemesFromState,
        setThemes, setSavingTheme, closeModal, setEditingThemeId, setNewThemeName,
        editingThemeId, newThemeName, colorSchemeDraft, themeColorDraft,
        backgroundColorDraft, backgroundOpacityDraft, backgroundImageUrlDraft, backgroundBlurDraft,
        panelColorDraft, panelOpacityDraft, panelBlurDraft, panelRadiusDraft,
        componentRadiusDraft, coverRadiusDraft, windowControlsPosDraft, defaultThemes
    ]);

    const closeThemeEditor = useCallback(() => {
        closeModal("themeEditorModal");
        setEditingThemeId(null);
        setNewThemeName("");
    }, [closeModal, setEditingThemeId, setNewThemeName]);

    return {
        selectTheme,
        editTheme,
        deleteTheme,
        createThemeClick,
        submitTheme,
        closeThemeEditor,
    };
};
