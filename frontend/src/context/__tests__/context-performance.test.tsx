/**
 * Context 性能测试
 * 验证新的分离式 Context 是否减少了不必要的重新渲染
 */

import React, { useState } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { AppProvider } from '../AppProvider';
import { usePlayerStore, useThemeStore, useUIStore } from '../index';

// 测试组件：只订阅播放器状态
const PlayerComponent = () => {
    const currentSong = usePlayerStore(state => state.playback.currentSong);
    const actions = usePlayerStore(state => state.actions);

    return (
        <div>
            <div data-testid="current-song">{currentSong?.name || 'No song'}</div>
            <button
                data-testid="play-button"
                onClick={() => actions.play()}
            >
                Play
            </button>
        </div>
    );
};

// 测试组件：只订阅主题状态
const ThemeComponent = () => {
    const themeColor = useThemeStore(state => state.colors.themeColor);
    const actions = useThemeStore(state => state.actions);

    return (
        <div>
            <div data-testid="theme-color">{themeColor}</div>
            <button
                data-testid="change-theme-button"
                onClick={() => actions.setThemeColor('#ff0000')}
            >
                Change Theme
            </button>
        </div>
    );
};

// 测试组件：只订阅UI状态
const UIComponent = () => {
    const status = useUIStore(state => state.app.status);
    const actions = useUIStore(state => state.actions);

    return (
        <div>
            <div data-testid="status">{status}</div>
            <button
                data-testid="change-status-button"
                onClick={() => actions.setStatus('Updated')}
            >
                Change Status
            </button>
        </div>
    );
};

// 渲染计数器组件
let playerRenderCount = 0;
let themeRenderCount = 0;
let uiRenderCount = 0;

const PlayerWithCounter = () => {
    playerRenderCount++;
    return <PlayerComponent />;
};

const ThemeWithCounter = () => {
    themeRenderCount++;
    return <ThemeComponent />;
};

const UIWithCounter = () => {
    uiRenderCount++;
    return <UIComponent />;
};

const TestApp = () => (
    <AppProvider>
        <PlayerWithCounter />
        <ThemeWithCounter />
        <UIWithCounter />
    </AppProvider>
);

describe('Context Performance Tests', () => {
    beforeEach(() => {
        playerRenderCount = 0;
        themeRenderCount = 0;
        uiRenderCount = 0;
    });

    it('should isolate state changes to relevant components only', () => {
        render(<TestApp />);

        // 初始渲染
        expect(playerRenderCount).toBe(1);
        expect(themeRenderCount).toBe(1);
        expect(uiRenderCount).toBe(1);

        // 重置计数器
        playerRenderCount = 0;
        themeRenderCount = 0;
        uiRenderCount = 0;

        // 只改变主题状态
        fireEvent.click(screen.getByTestId('change-theme-button'));

        // 只有主题组件应该重新渲染
        expect(playerRenderCount).toBe(0);
        expect(themeRenderCount).toBe(1);
        expect(uiRenderCount).toBe(0);

        // 重置计数器
        playerRenderCount = 0;
        themeRenderCount = 0;
        uiRenderCount = 0;

        // 只改变UI状态
        fireEvent.click(screen.getByTestId('change-status-button'));

        // 只有UI组件应该重新渲染
        expect(playerRenderCount).toBe(0);
        expect(themeRenderCount).toBe(0);
        expect(uiRenderCount).toBe(1);
    });

    it('should provide correct initial values', () => {
        render(<TestApp />);

        expect(screen.getByTestId('current-song')).toHaveTextContent('No song');
        expect(screen.getByTestId('theme-color')).toHaveTextContent('#ffffff');
        expect(screen.getByTestId('status')).toHaveTextContent('加载中...');
    });
});

export { };