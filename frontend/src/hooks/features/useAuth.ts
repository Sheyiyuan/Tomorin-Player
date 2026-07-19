/**
 * 用户认证管理 Hook
 * 管理登录状态和用户信息
 */

import { useState } from 'react';
import { UserInfo } from '../../types';

export interface UseAuthReturn {
    userInfo: UserInfo | null;
    setUserInfo: React.Dispatch<React.SetStateAction<UserInfo | null>>;
}

export const useAuth = () => {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    return {
        userInfo,
        setUserInfo,
    };
};
