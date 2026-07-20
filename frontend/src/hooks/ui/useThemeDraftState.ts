import { useCallback, useMemo, useReducer } from "react";
import {
    createDefaultThemeDraft,
    isThemeDraftEqual,
    type ThemeColorScheme,
    type ThemeDraft,
    type ThemeDraftField,
    type ThemeEditorMode,
} from "../features/themeDraft";

interface ThemeDraftState {
    draft: ThemeDraft;
    originalDraft: ThemeDraft;
    mode: ThemeEditorMode;
    savingTheme: boolean;
}

type ThemeDraftAction =
    | { type: "replace"; draft: ThemeDraft; mode: ThemeEditorMode }
    | { type: "applyDraft"; draft: ThemeDraft }
    | { type: "reset"; colorScheme: ThemeColorScheme }
    | { type: "updateField"; field: ThemeDraftField; value: ThemeDraft[ThemeDraftField] }
    | { type: "setSaving"; saving: boolean };

const createInitialState = (): ThemeDraftState => {
    const draft = createDefaultThemeDraft("dark");
    return {
        draft,
        originalDraft: draft,
        mode: "create",
        savingTheme: false,
    };
};

const reducer = (state: ThemeDraftState, action: ThemeDraftAction): ThemeDraftState => {
    switch (action.type) {
        case "replace":
            return {
                draft: action.draft,
                originalDraft: action.draft,
                mode: action.mode,
                savingTheme: false,
            };
        case "applyDraft":
            return {
                ...state,
                draft: action.draft,
            };
        case "reset": {
            const draft = createDefaultThemeDraft(action.colorScheme);
            return {
                draft,
                originalDraft: draft,
                mode: "create",
                savingTheme: false,
            };
        }
        case "updateField":
            return {
                ...state,
                draft: {
                    ...state.draft,
                    [action.field]: action.value,
                },
            };
        case "setSaving":
            return {
                ...state,
                savingTheme: action.saving,
            };
        default:
            return state;
    }
};

export const useThemeDraftState = () => {
    const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

    const replaceDraft = useCallback((draft: ThemeDraft, mode: ThemeEditorMode) => {
        dispatch({ type: "replace", draft, mode });
    }, []);

    const applyDraft = useCallback((draft: ThemeDraft) => {
        dispatch({ type: "applyDraft", draft });
    }, []);

    const resetThemeDraft = useCallback((colorScheme: ThemeColorScheme = "dark") => {
        dispatch({ type: "reset", colorScheme });
    }, []);

    const updateField = useCallback(<K extends ThemeDraftField>(field: K, value: ThemeDraft[K]) => {
        dispatch({ type: "updateField", field, value });
    }, []);

    const setSavingTheme = useCallback((saving: boolean) => {
        dispatch({ type: "setSaving", saving });
    }, []);

    const isDirty = useMemo(
        () => !isThemeDraftEqual(state.draft, state.originalDraft),
        [state.draft, state.originalDraft],
    );

    return {
        session: {
            draft: state.draft,
            originalDraft: state.originalDraft,
            mode: state.mode,
            savingTheme: state.savingTheme,
            isDirty,
            isReadOnly: state.mode === "view",
            editingThemeId: state.draft.id,
        },
        actions: {
            replaceDraft,
            applyDraft,
            resetThemeDraft,
            updateField,
            setSavingTheme,
        },
    };
};
