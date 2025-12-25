/**
 * 一言功能 Hook
 * 从本地 JSON 获取随机一言
 */

import { useState, useEffect } from 'react';

export const useHitokoto = () => {
    const [hitokoto, setHitokoto] = useState<string>('');

    useEffect(() => {
        const fetchHitokoto = async () => {
            try {
                const response = await fetch('/hitokoto.json');
                const data: string[] = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const randomIndex = Math.floor(Math.random() * data.length);
                    setHitokoto(data[randomIndex]);
                } else {
                    setHitokoto('生活就像海洋，只有意志坚强的人才能到达彼岸。');
                }
            } catch (e) {
                console.warn('获取一言失败', e);
                setHitokoto('生活就像海洋，只有意志坚强的人才能到达彼岸。');
            }
        };
        fetchHitokoto();
    }, []);

    return hitokoto;
};
