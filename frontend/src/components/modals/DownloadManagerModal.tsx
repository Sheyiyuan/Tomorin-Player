import React from "react";
import { Button, Group, Stack, Text } from "@mantine/core";
import type { Song, DerivedStyles } from "../../types";
import ThemedModal from "./ThemedModal";

interface DownloadManagerModalProps {
    opened: boolean;
    managingSong: Song | null;
    confirmDeleteDownloaded: boolean;
    onClose: () => void;
    onOpenFile: () => void;
    onDeleteFile: () => void;
    onToggleConfirmDelete: (value: boolean) => void;
    derived?: DerivedStyles;
}

const DownloadManagerModal: React.FC<DownloadManagerModalProps> = ({
    opened,
    managingSong,
    confirmDeleteDownloaded,
    onClose,
    onOpenFile,
    onDeleteFile,
    onToggleConfirmDelete,
    derived,
}) => {
    return (
        <ThemedModal
            derived={derived}
            opened={opened}
            onClose={onClose}
            size="sm"
            centered
            title="下载文件管理"
        >
            <Stack gap="md">
                <Text fw={600} style={{ color: derived?.textColorPrimary }}>{managingSong?.name || '未选择歌曲'}</Text>
                <Group justify="space-between">
                    <Button variant="subtle" onClick={onOpenFile} style={{ color: derived?.textColorPrimary }}>在文件管理器中打开</Button>
                    <Group gap="xs">
                        {!confirmDeleteDownloaded ? (
                            <Button variant="light" color="red" onClick={() => onToggleConfirmDelete(true)}>删除下载文件</Button>
                        ) : (
                            <Button color="red" onClick={onDeleteFile}>确认删除</Button>
                        )}
                    </Group>
                </Group>
            </Stack>
        </ThemedModal>
    );
};

export default DownloadManagerModal;
