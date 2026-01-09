/**
 * UI状态选择器 Hook
 * 提供细粒度的UI状态订阅，减少不必要的重新渲染
 */

import { useUIContext } from '../contexts/UIContext';
import { UIContextValue } from '../types/contexts';

// ========== 基础选择器 Hook ==========
export const useUIStore = <T = UIContextValue>(
    selector?: (state: UIContextValue) => T
): T => {
    const context = useUIContext();

    if (selector) {
        return selector(context);
    }

    return context as T;
};

// ========== 便捷选择器 Hooks ==========

// 模态框选择器
export const useModals = () => useUIStore(state => state.modals);
export const useModal = (modalName: string) => useUIStore(state => state.modals[modalName] || false);

// 搜索选择器
export const useSearch = () => useUIStore(state => state.search);
export const useSearchQuery = () => useUIStore(state => state.search.query);
export const useGlobalSearch = () => useUIStore(state => ({
    term: state.search.globalTerm,
    results: state.search.results,
}));

// 应用状态选择器
export const useAppState = () => useUIStore(state => state.app);
export const useStatus = () => useUIStore(state => state.app.status);
export const useLoading = () => useUIStore(state => state.app.isLoading);
export const useError = () => useUIStore(state => state.app.errorMessage);
export const useUserInfo = () => useUIStore(state => state.app.userInfo);

// 操作选择器
export const useUIActions = () => useUIStore(state => state.actions);

// 组合选择器（用于需要多个状态的组件）
export const useModalControls = () => useUIStore(state => ({
    modals: state.modals,
    openModal: state.actions.openModal,
    closeModal: state.actions.closeModal,
}));

export const useSearchControls = () => useUIStore(state => ({
    query: state.search.query,
    globalTerm: state.search.globalTerm,
    results: state.search.results,
    setSearchQuery: state.actions.setSearchQuery,
    setGlobalSearchTerm: state.actions.setGlobalSearchTerm,
    setGlobalSearchResults: state.actions.setGlobalSearchResults,
}));

export const useAppControls = () => useUIStore(state => ({
    status: state.app.status,
    isLoading: state.app.isLoading,
    errorMessage: state.app.errorMessage,
    userInfo: state.app.userInfo,
    setStatus: state.actions.setStatus,
    setIsLoading: state.actions.setIsLoading,
    setErrorMessage: state.actions.setErrorMessage,
    setUserInfo: state.actions.setUserInfo,
}));