/**
 * UI Context 读取 Hook。
 * selector 只简化返回值，不会阻止 Provider 更新触发组件重渲染。
 */

import { useUIContext } from '../contexts/UIContext';
import { ModalName, UIContextValue } from '../types/contexts';

// ========== 基础读取 Hook ==========
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
export const useModal = (modalName: ModalName) => useUIStore(state => state.modals[modalName]);

// 操作选择器
export const useUIActions = () => useUIStore(state => state.actions);

// 组合选择器（用于需要多个状态的组件）
export const useModalControls = () => useUIStore(state => ({
    modals: state.modals,
    openModal: state.actions.openModal,
    closeModal: state.actions.closeModal,
}));
