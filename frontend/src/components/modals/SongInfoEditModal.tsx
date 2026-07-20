import React, { useState } from "react";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { Check, X } from "lucide-react";
import type { DerivedStyles, Song } from "../../types";
import { parseDomainError } from "../../utils/domainError";
import ThemedModal from "./ThemedModal";

interface SongInfoEditModalProps {
    opened: boolean;
    song: Song;
    themeColor: string;
    derived?: DerivedStyles;
    onClose: () => void;
    onSave: (songId: string, updates: { name?: string; singer?: string; cover?: string }) => void | Promise<void>;
}

const SongInfoEditModal: React.FC<SongInfoEditModalProps> = ({
    opened,
    song,
    themeColor,
    derived,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState(song.name);
    const [singer, setSinger] = useState(song.singer);
    const [cover, setCover] = useState(song.cover || "");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const handleClose = () => {
        if (!isSaving) onClose();
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        setError("");
        try {
            await onSave(song.id, {
                name: name.trim() || song.name,
                singer: singer.trim() || song.singer,
                cover: cover.trim() || song.cover,
            });
            onClose();
        } catch (cause) {
            setError(parseDomainError(cause).message);
        } finally {
            setIsSaving(false);
        }
    };

    const inputStyles = derived ? {
        input: {
            backgroundColor: derived.controlBackground,
            color: derived.textColorPrimary,
            borderColor: "transparent",
            borderRadius: derived.componentRadius,
        },
        label: { color: derived.textColorPrimary },
    } : undefined;

    return (
        <ThemedModal
            derived={derived}
            opened={opened}
            onClose={handleClose}
            title="编辑歌曲信息"
            centered
            size="md"
            closeOnClickOutside={!isSaving}
            closeOnEscape={!isSaving}
            withCloseButton={!isSaving}
        >
            <form onSubmit={(event) => { void handleSubmit(event); }}>
                <Stack gap="sm">
                    <TextInput
                        label="歌曲名称"
                        value={name}
                        onChange={(event) => setName(event.currentTarget.value)}
                        placeholder="请输入歌曲名称"
                        styles={inputStyles}
                    />
                    <TextInput
                        label="歌手"
                        value={singer}
                        onChange={(event) => setSinger(event.currentTarget.value)}
                        placeholder="请输入歌手名称"
                        styles={inputStyles}
                    />
                    <TextInput
                        label="封面 URL"
                        value={cover}
                        onChange={(event) => setCover(event.currentTarget.value)}
                        placeholder="请输入封面图片链接"
                        styles={inputStyles}
                    />
                    {error && <Text size="sm" c="red" role="status">{error}</Text>}
                    <Group justify="flex-end" mt="xs">
                        <Button
                            type="button"
                            variant="subtle"
                            color="gray"
                            leftSection={<X size={15} />}
                            onClick={handleClose}
                            disabled={isSaving}
                            radius={derived?.componentRadius}
                            style={{ color: derived?.textColorPrimary }}
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            color={themeColor}
                            leftSection={<Check size={15} />}
                            loading={isSaving}
                            disabled={isSaving}
                            radius={derived?.componentRadius}
                        >
                            保存
                        </Button>
                    </Group>
                </Stack>
            </form>
        </ThemedModal>
    );
};

export default SongInfoEditModal;
