import React from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import type { DerivedStyles } from "../../types";

export type EditFavoriteModalProps = {
    opened: boolean;
    onClose: () => void;
    name: string;
    onNameChange: (value: string) => void;
    onSave: () => void;
    themeColor: string;
    panelStyles?: React.CSSProperties;
    derived?: DerivedStyles;
};

const EditFavoriteModal: React.FC<EditFavoriteModalProps> = ({
    opened,
    onClose,
    name,
    onNameChange,
    onSave,
    themeColor,
    panelStyles,
    derived,
}) => (
    <Modal
        opened={opened}
        onClose={onClose}
        title="编辑歌单"
        centered
        size="sm"
        styles={{
            content: {
                ...panelStyles,
                backgroundColor: derived?.panelBackground,
                color: derived?.textColorPrimary,
            },
            header: {
                backgroundColor: "transparent",
                color: derived?.textColorPrimary,
            },
            title: {
                fontWeight: 600,
            },
        }}
        className="normal-panel"
    >
        <Stack gap="md">
            <TextInput
                label="歌单名称"
                value={name}
                onChange={(event) => onNameChange(event.currentTarget.value)}
                placeholder="输入歌单名称"
                styles={{
                    input: {
                        backgroundColor: derived?.controlBackground,
                        color: derived?.textColorPrimary,
                        borderColor: "transparent",
                    },
                    label: {
                        color: derived?.textColorPrimary,
                    },
                }}
            />
            <Group justify="flex-end" gap="sm">
                <Button variant="subtle" color={themeColor} onClick={onClose} style={{ color: derived?.textColorPrimary }}>
                    取消
                </Button>
                <Button color={themeColor} onClick={onSave}>
                    保存
                </Button>
            </Group>
        </Stack>
    </Modal>
);

export default EditFavoriteModal;
