import { useState, useCallback } from "react";
import { notifications } from "@mantine/notifications";
import * as Services from "../../../wailsjs/go/services/Service";

interface MyFavoriteCollection {
    id: number;
    title: string;
    count: number;
    cover: string;
}

/**
 * 导入登录用户收藏夹功能
 * 
 * 功能:
 * 1. 获取登录用户的收藏夹列表
 * 2. 选择收藏夹进行导入
 * 3. 复用 useFidImport 的导入逻辑
 */
export function useMyFavoriteImport() {
    const [myCollections, setMyCollections] = useState<MyFavoriteCollection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

    /**
     * 获取登录用户的收藏夹列表
     */
    const fetchMyCollections = useCallback(async () => {
        setIsLoading(true);
        try {
            const collections = await Services.GetMyFavoriteCollections();
            const mapped = collections.map((c) => ({
                id: Number(c.id),
                title: c.title,
                count: c.count,
                cover: c.cover,
            }));
            setMyCollections(mapped);
            return mapped;
        } catch (error) {
            console.error("获取收藏夹列表失败:", error);
            const errMsg = String(error);

            if (errMsg.includes("登录") || errMsg.includes("权限")) {
                notifications.show({
                    title: "需要登录",
                    message: "请先登录 B站 账号",
                    color: "orange",
                });
            } else {
                notifications.show({
                    title: "获取收藏夹列表失败",
                    message: errMsg,
                    color: "red",
                });
            }
            setMyCollections([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * 清空收藏夹列表（用于退出登陆或登陆状态变化）
     */
    const clearCollections = useCallback(() => {
        setMyCollections([]);
        setSelectedCollectionId(null);
    }, []);

    return {
        // 状态
        myCollections,
        isLoading,
        selectedCollectionId,

        // 方法
        setSelectedCollectionId,
        fetchMyCollections,
        clearCollections,
    };
}
