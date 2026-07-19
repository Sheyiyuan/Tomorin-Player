/**
 * UI Context
 * 管理所有模态框的可见性。
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    UIContextValue,
    ModalState,
    UIActions,
} from '../types/contexts';

const UIContext = createContext<UIContextValue | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ========== 模态框状态 ==========
    const [modals, setModals] = useState<ModalState>({
        loginModal: false,
        settingsModal: false,
        playlistModal: false,
        themeManagerModal: false,
        themeEditorModal: false,
        themeDetailModal: false,
        globalSearchModal: false,
        bvAddModal: false,
        createFavModal: false,
        editFavModal: false,
        addFavoriteModal: false,
        downloadManagerModal: false,
        exitConfirmModal: false,
    });

    // ========== 模态框控制操作 ==========
    const openModal = useCallback((name: keyof ModalState) => {
        setModals(prev => ({ ...prev, [name]: true }));
    }, []);

    const closeModal = useCallback((name: keyof ModalState) => {
        setModals(prev => ({ ...prev, [name]: false }));
    }, []);

    // ========== 稳定的 Actions 对象 ==========
    const actions: UIActions = useMemo(() => ({
        openModal,
        closeModal,
    }), [openModal, closeModal]);

    // ========== 状态对象 ==========
    const modalState: ModalState = useMemo(() => modals, [modals]);

    // ========== Context Value ==========
    const contextValue: UIContextValue = useMemo(() => ({
        modals: modalState,
        actions,
    }), [modalState, actions]);

    return (
        <UIContext.Provider value={contextValue}>
            {children}
        </UIContext.Provider>
    );
};

// ========== Hook ==========
export const useUIContext = (): UIContextValue => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUIContext must be used within UIProvider');
    }
    return context;
};

export default UIContext;
