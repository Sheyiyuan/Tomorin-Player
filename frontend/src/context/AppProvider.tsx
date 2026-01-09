/**
 * 统一的应用 Provider
 * 组合所有的 Context Provider，提供完整的状态管理
 */

import React, { ReactNode } from 'react';
import { PlayerProvider } from './contexts/PlayerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UIProvider } from './contexts/UIContext';
import { DataProvider } from './contexts/DataContext';

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    return (
        <DataProvider>
            <PlayerProvider>
                <ThemeProvider>
                    <UIProvider>
                        {children}
                    </UIProvider>
                </ThemeProvider>
            </PlayerProvider>
        </DataProvider>
    );
};

export default AppProvider;