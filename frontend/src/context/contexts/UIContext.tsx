/**
 * UI Context
 * 管理UI相关的所有状态：模态框状态、搜索状态、应用状态
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
    UIContextValue,
    ModalState,
    SearchState,
    AppState,
    UIActions,
} from '../types/contexts';
import { Song, UserInfo } from '../../types';

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
        playlistManagerModal: false,
        createFavModal: false,
        addFavoriteModal: false,
        downloadManagerModal: false,
        downloadTasksModal: false,
        downloadModal: false,
    });

    // ========== 搜索状态 ==========
    const [query, setQuery] = useState("");
    const [globalTerm, setGlobalTerm] = useState("");
    const [results, setResults] = useState<Song[]>([]);

    // ========== 应用状态 ==========
    const [status, setStatus] = useState<string>("加载中...");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    // ========== 模态框控制操作 ==========
    const openModal = useCallback((name: string) => {
        setModals(prev => ({ ...prev, [name]: true }));
    }, []);

    const closeModal = useCallback((name: string) => {
        setModals(prev => ({ ...prev, [name]: false }));
    }, []);

    // ========== 搜索控制操作 ==========
    const setSearchQuery = useCallback((newQuery: string) => {
        setQuery(newQuery);
    }, []);

    const setGlobalSearchTerm = useCallback((term: string) => {
        setGlobalTerm(term);
    }, []);

    const setGlobalSearchResults = useCallback((newResults: Song[]) => {
        setResults(newResults);
    }, []);

    // ========== 应用状态操作 ==========
    const setStatusSafe = useCallback((newStatus: string) => {
        setStatus(newStatus);
    }, []);

    const setIsLoadingSafe = useCallback((loading: boolean) => {
        setIsLoading(loading);
    }, []);

    const setErrorMessageSafe = useCallback((message: string | null) => {
        setErrorMessage(message);
    }, []);

    const setUserInfoSafe = useCallback((info: UserInfo | null) => {
        setUserInfo(info);
    }, []);

    // ========== 稳定的 Actions 对象 ==========
    const actions: UIActions = useMemo(() => ({
        // 模态框控制
        openModal,
        closeModal,

        // 搜索控制
        setSearchQuery,
        setGlobalSearchTerm,
        setGlobalSearchResults,

        // 应用状态
        setStatus: setStatusSafe,
        setIsLoading: setIsLoadingSafe,
        setErrorMessage: setErrorMessageSafe,
        setUserInfo: setUserInfoSafe,
    }), [
        openModal, closeModal,
        setSearchQuery, setGlobalSearchTerm, setGlobalSearchResults,
        setStatusSafe, setIsLoadingSafe, setErrorMessageSafe, setUserInfoSafe,
    ]);

    // ========== 状态对象 ==========
    const modalState: ModalState = useMemo(() => modals, [modals]);

    const searchState: SearchState = useMemo(() => ({
        query,
        globalTerm,
        results,
    }), [query, globalTerm, results]);

    const appState: AppState = useMemo(() => ({
        status,
        isLoading,
        errorMessage,
        userInfo,
    }), [status, isLoading, errorMessage, userInfo]);

    // ========== Context Value ==========
    const contextValue: UIContextValue = useMemo(() => ({
        modals: modalState,
        search: searchState,
        app: appState,
        actions,
    }), [modalState, searchState, appState, actions]);

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