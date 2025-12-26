import React from "react";
import { Button, Group, Modal, Select, Stack, Text, TextInput, Loader } from "@mantine/core";
import type { Favorite } from "../types";

type CreateFavMode = "blank" | "duplicate" | "importMine" | "importFid";

interface MyCollectionOption {
    id: number;
    title: string;
    count: number;
}

interface CreateFavoriteModalProps {
    opened: boolean;
    themeColor: string;
    favorites: Favorite[];
    createFavName: string;
    createFavMode: CreateFavMode;
    duplicateSourceId: string | null;
    importFid: string;
    
    // 新增：我的收藏夹相关
    myCollections: MyCollectionOption[];
    isLoadingCollections: boolean;
    selectedMyCollectionId: number | null;
    
    onClose: () => void;
    onNameChange: (value: string) => void;
    onModeChange: (mode: CreateFavMode) => void;
    onDuplicateSourceChange: (id: string | null) => void;
    onImportFidChange: (value: string) => void;
    
    // 新增：我的收藏夹操作
    onMyCollectionSelect: (id: number | null) => void;
    onFetchMyCollections: () => void;
    
    onSubmit: () => void;
}

const CreateFavoriteModal: React.FC<CreateFavoriteModalProps> = ({
    opened,
    themeColor,
    favorites,
    createFavName,
    createFavMode,
    duplicateSourceId,
    importFid,
    
    // 我的收藏夹
    myCollections,
    isLoadingCollections,
    selectedMyCollectionId,
    
    onClose,
    onNameChange,
    onModeChange,
    onDuplicateSourceChange,
    onImportFidChange,
    
    // 我的收藏夹操作
    onMyCollectionSelect,
    onFetchMyCollections,
    
    onSubmit,
}) => {
    // 当切换到导入我的收藏夹模式时,自动获取收藏夹列表
    React.useEffect(() => {
        if (opened && createFavMode === "importMine" && myCollections.length === 0 && !isLoadingCollections) {
            onFetchMyCollections();
        }
    }, [opened, createFavMode, myCollections.length, isLoadingCollections, onFetchMyCollections]);
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="新建歌单"
            centered
            size="md"
            overlayProps={{ blur: 10, opacity: 0.35 }}
        >
            <Stack gap="sm">
                <TextInput
                    label="歌单名称"
                    value={createFavName}
                    onChange={(e) => onNameChange(e.currentTarget.value)}
                    placeholder="输入歌单名"
                />
                <Select
                    label="创建方式"
                    data={[
                        { value: "blank", label: "新建空白歌单" },
                        { value: "duplicate", label: "复制已有歌单" },
                        { value: "importMine", label: "导入登录收藏夹 (需登录)" },
                        { value: "importFid", label: "通过 fid 导入公开收藏夹" },
                    ]}
                    value={createFavMode}
                    onChange={(val) => onModeChange((val as CreateFavMode) || "blank")}
                />
                {createFavMode === "duplicate" && (
                    <Select
                        label="选择要复制的歌单"
                        placeholder={favorites.length ? "选择歌单" : "暂无歌单"}
                        data={favorites.map((f) => ({ value: f.id, label: `${f.title} (${f.songIds.length} 首)` }))}
                        value={duplicateSourceId}
                        onChange={(val) => onDuplicateSourceChange(val)}
                        searchable
                        clearable
                    />
                )}
                {createFavMode === "importFid" && (
                    <TextInput
                        label="收藏夹 fid"
                        placeholder="输入 fid"
                        value={importFid}
                        onChange={(e) => onImportFidChange(e.currentTarget.value)}
                    />
                )}
                {createFavMode === "importMine" && (
                    <>
                        {isLoadingCollections ? (
                            <Group justify="center" py="md">
                                <Loader size="sm" color={themeColor} />
                                <Text size="sm" c="dimmed">正在获取收藏夹列表...</Text>
                            </Group>
                        ) : myCollections.length > 0 ? (
                            <Select
                                label="选择收藏夹"
                                placeholder="选择要导入的收藏夹"
                                data={myCollections.map((c) => ({
                                    value: String(c.id),
                                    label: `${c.title} (${c.count} 个视频)`,
                                }))}
                                value={selectedMyCollectionId ? String(selectedMyCollectionId) : null}
                                onChange={(val) => onMyCollectionSelect(val ? Number(val) : null)}
                                searchable
                                clearable
                            />
                        ) : (
                            <Stack gap="xs">
                                <Text size="sm" c="dimmed">暂无可用收藏夹</Text>
                                <Button 
                                    size="xs" 
                                    variant="light" 
                                    color={themeColor}
                                    onClick={onFetchMyCollections}
                                >
                                    重新获取
                                </Button>
                            </Stack>
                        )}
                    </>
                )}
                <Group justify="flex-end" mt="sm">
                    <Button variant="default" onClick={onClose}>取消</Button>
                    <Button color={themeColor} onClick={onSubmit}>确认</Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default CreateFavoriteModal;
