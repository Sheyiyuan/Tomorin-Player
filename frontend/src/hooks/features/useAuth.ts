/**
 * 用户认证管理 Hook
 * 管理登录状态和用户信息
 */

import { useState, useCallback, useEffect } from 'react';
import * as Services from '../../../wailsjs/go/services/Service';
import { storage, STORAGE_KEYS } from '../../utils/storage';

export interface UserInfo {
    mid: number;
    name: string;
    face: string;
    [key: string]: any;
}

export interface UseAuthReturn {
    isLoggedIn: boolean;
    userInfo: UserInfo | null;
    loginModalOpened: boolean;

    setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
    setUserInfo: React.Dispatch<React.SetStateAction<UserInfo | null>>;
    setLoginModalOpened: React.Dispatch<React.SetStateAction<boolean>>;

    checkLoginStatus: () => Promise<boolean>;
    getUserInfo: () => Promise<void>;
    logout: () => void;
}

export const useAuth = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loginModalOpened, setLoginModalOpened] = useState(false);

    // 检查登录状态
    const checkLoginStatus = useCallback(async () => {
        try {
            const loggedIn = await Services.IsLoggedIn();
            setIsLoggedIn(loggedIn);
            return loggedIn;
        } catch (error) {
            console.error('检查登录状态失败:', error);
            setIsLoggedIn(false);
            return false;
        }
    }, []);

    // 获取用户信息
    const getUserInfo = useCallback(async () => {
        try {
            const info = await Services.GetUserInfo();
            setUserInfo(info);
            storage.set(STORAGE_KEYS.USER_INFO, info);
        } catch (error) {
            console.error('获取用户信息失败:', error);
            throw error;
        }
    }, []);

    // 退出登录
    const logout = useCallback(() => {
        setIsLoggedIn(false);
        setUserInfo(null);
        storage.remove(STORAGE_KEYS.USER_INFO);
    }, []);

    // 初始化时尝试从缓存恢复用户信息
    useEffect(() => {
        const cachedUserInfo = storage.get<UserInfo>(STORAGE_KEYS.USER_INFO);
        if (cachedUserInfo) {
            setUserInfo(cachedUserInfo);
        }
    }, []);

    return {
        isLoggedIn,
        userInfo,
        loginModalOpened,

        setIsLoggedIn,
        setUserInfo,
        setLoginModalOpened,

        checkLoginStatus,
        getUserInfo,
        logout,
    };
};
