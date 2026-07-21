import React from "react";
import { Button, Group, Select, Stack, Text, TextInput, Loader, Switch } from "@mantine/core";
import { favoriteSongCount, type Favorite, type DerivedStyles, type PlaylistSyncProgress } from "../../types";
import PlaylistTaskProgress from "../playlists/PlaylistTaskProgress";
import ThemedModal from "./ThemedModal";

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
	keepSynced: boolean;
	isSubmitting: boolean;
	importProgress?: PlaylistSyncProgress;

    onClose: () => void;
    onNameChange: (value: string) => void;
    onModeChange: (mode: CreateFavMode) => void;
    onDuplicateSourceChange: (id: string | null) => void;
    onImportFidChange: (value: string) => void;

    // 新增：我的收藏夹操作
    onMyCollectionSelect: (id: number | null) => void;
    onFetchMyCollections: () => void;
	onKeepSyncedChange: (value: boolean) => void;

    onSubmit: () => void | Promise<void>;

    derived?: DerivedStyles;
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
	keepSynced,
	isSubmitting,
	importProgress,

    onClose,
    onNameChange,
    onModeChange,
    onDuplicateSourceChange,
    onImportFidChange,

    // 我的收藏夹操作
    onMyCollectionSelect,
    onFetchMyCollections,
	onKeepSyncedChange,

    onSubmit,

    derived,
}) => {
    // 当切换到导入我的收藏夹模式时,自动获取收藏夹列表
    React.useEffect(() => {
        if (opened && createFavMode === "importMine" && myCollections.length === 0 && !isLoadingCollections) {
            onFetchMyCollections();
        }
    }, [opened, createFavMode, myCollections.length, isLoadingCollections, onFetchMyCollections]);

    const inputStyles = derived ? {
        input: {
            backgroundColor: derived.controlBackground,
            color: derived.textColorPrimary,
            borderColor: "transparent",
        },
        label: {
            color: derived.textColorPrimary,
        }
    } : undefined;
	const handleClose = () => {
		if (!isSubmitting) onClose();
	};

    return (
        <ThemedModal
            derived={derived}
            opened={opened}
			onClose={handleClose}
            title="新建歌单"
            centered
            size="md"
			closeOnClickOutside={!isSubmitting}
			closeOnEscape={!isSubmitting}
			withCloseButton={!isSubmitting}
        >
            <Stack gap="sm">
                <TextInput
                    label="歌单名称"
                    value={createFavName}
                    onChange={(e) => onNameChange(e.currentTarget.value)}
                    placeholder="输入歌单名"
                    styles={inputStyles}
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
                    styles={inputStyles}
                />
                {createFavMode === "duplicate" && (
                    <Select
                        label="选择要复制的歌单"
                        placeholder={favorites.length ? "选择歌单" : "暂无歌单"}
                        data={favorites.map((f) => ({ value: f.id, label: `${f.title} (${favoriteSongCount(f)} 首)` }))}
                        value={duplicateSourceId}
                        onChange={(val) => onDuplicateSourceChange(val)}
                        searchable
                        clearable
                        styles={inputStyles}
                    />
                )}
                {createFavMode === "importFid" && (
                    <TextInput
                        label="收藏夹 fid"
                        placeholder="输入 fid"
                        value={importFid}
                        onChange={(e) => onImportFidChange(e.currentTarget.value)}
                        styles={inputStyles}
                    />
                )}
                {createFavMode === "importMine" && (
                    <>
                        {isLoadingCollections ? (
                            <Group justify="center" py="md">
                                <Loader size="sm" color={themeColor} />
                                <Text size="sm" style={{ color: derived?.textColorSecondary }}>正在获取收藏夹列表...</Text>
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
                                styles={inputStyles}
                            />
                        ) : (
                            <Stack gap="xs">
                                <Text size="sm" style={{ color: derived?.textColorSecondary }}>暂无可用收藏夹</Text>
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
				{(createFavMode === "importMine" || createFavMode === "importFid") && (
					<Stack gap={4}>
						<Switch
							label="保持同步（锁定）"
							description="自动镜像 Bilibili 中可播放的曲目；锁定期间不可手动修改"
							checked={keepSynced}
							onChange={(event) => onKeepSyncedChange(event.currentTarget.checked)}
							color={themeColor}
							styles={{ label: { color: derived?.textColorPrimary }, description: { color: derived?.textColorSecondary } }}
						/>
						{keepSynced && <Text size="xs" c={derived?.textColorSecondary}>完整同步后，Bilibili 已移除的条目也会从本歌单移除；歌曲、歌词、封面、下载和缓存不会删除。转换为本地歌单后将永久停止同步，重新关联需要再次导入。</Text>}
					</Stack>
				)}
				{isSubmitting && importProgress && (createFavMode === "importMine" || createFavMode === "importFid") && (
					<PlaylistTaskProgress progress={importProgress} themeColor={themeColor} />
				)}
                <Group justify="flex-end" mt="sm">
					<Button variant="subtle" color={themeColor} onClick={handleClose} disabled={isSubmitting} style={{ color: derived?.textColorPrimary }}>取消</Button>
					<Button color={themeColor} onClick={() => { void onSubmit(); }} loading={isSubmitting} disabled={isSubmitting}>确认</Button>
                </Group>
            </Stack>
        </ThemedModal>
    );
};

export default CreateFavoriteModal;
