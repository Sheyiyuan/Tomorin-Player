/**
 * Context 统一导出
 * 提供新旧两套API，支持渐进式迁移
 */

// ========== 新的分离式 Context API（推荐使用）==========
// Providers
export { PlayerProvider } from './contexts/PlayerContext';
export { ThemeProvider } from './contexts/ThemeContext';
export { UIProvider } from './contexts/UIContext';
export { DataProvider } from './contexts/DataContext';
export { AppProvider } from './AppProvider';

// Context Hooks
export { usePlayerContext } from './contexts/PlayerContext';
export { useThemeContext } from './contexts/ThemeContext';
export { useUIContext } from './contexts/UIContext';
export { useDataContext } from './contexts/DataContext';

// Store Hooks (推荐使用)
export * from './hooks/usePlayerStore';
export * from './hooks/useThemeStore';
export * from './hooks/useUIStore';
export * from './hooks/useDataStore';

// Types
export * from './types/contexts';

// ========== 向后兼容的 API（保持现有代码工作）==========
export {
    useAppStore,
    usePlayerState,
    usePlaylistState,
    useThemeState,
    useModalState,
    useUIState,
    useDataState,
} from './AppContext';

export type {
    AppStore,
    PlayerState,
    PlaylistState,
    ThemeState,
    ModalState,
    UIState,
    DataState,
    AppActions,
} from './AppContext';