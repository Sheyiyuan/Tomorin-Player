import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    ColorInput,
    Divider,
    Fieldset,
    Group,
    Modal,
    ScrollArea,
    SegmentedControl,
    Select,
    Slider,
    Stack,
    Tabs,
    Text,
    TextInput,
    Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, Check, Copy, ImagePlus, Trash2 } from "lucide-react";
import type { DerivedStyles } from "../../types";
import type { useThemeDraftState } from "../../hooks/ui/useThemeDraftState";
import {
    createThemeJsonObject,
    parseThemeDraftJson,
    type ThemeColorScheme,
    type ThemeDraft,
    type ThemeDraftField,
    type ThemeWindowControlsPos,
} from "../../hooks/features/themeDraft";
import { useImageProxy } from "../../hooks/ui/useImageProxy";
import { getContrastRatio } from "../../utils/accessibility";

type ThemeDraftSession = ReturnType<typeof useThemeDraftState>["session"];
type ThemeDraftActions = ReturnType<typeof useThemeDraftState>["actions"];

export type ThemeDetailModalProps = {
    opened: boolean;
    onClose: () => void;
    onCancel: (discardChanges?: boolean) => boolean | void;
    session: ThemeDraftSession;
    actions: ThemeDraftActions;
    onClearBackgroundImage: () => void;
    onSubmit: () => Promise<void>;
    onBackgroundFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    panelStyles?: React.CSSProperties;
    derived?: DerivedStyles;
    isReadOnly?: boolean;
};

const setField = <K extends ThemeDraftField>(
    actions: ThemeDraftActions,
    field: K,
    value: ThemeDraft[K],
): void => {
    actions.updateField(field, value);
};

const hexToRgba = (hex: string, opacity: number): string => {
    const match = hex.match(/^#([0-9a-f]{6})$/i);
    if (!match) return hex;
    const value = Number.parseInt(match[1], 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
};

const ThemeDetailModal: React.FC<ThemeDetailModalProps> = React.memo(({
    opened,
    onCancel,
    session,
    actions,
    onClearBackgroundImage,
    onSubmit,
    onBackgroundFileChange,
    panelStyles,
    derived,
    isReadOnly = false,
}) => {
    const { draft, savingTheme, isDirty } = session;
    const readOnly = isReadOnly || session.isReadOnly;
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>("gui");
    const [jsonText, setJsonText] = useState("");
    const [jsonError, setJsonError] = useState("");
    const [copied, setCopied] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const { getProxiedImageUrlSync } = useImageProxy();

    const backgroundPreviewUrl = getProxiedImageUrlSync(draft.backgroundImageUrl);

    const jsonObject = useMemo(() => createThemeJsonObject(draft), [draft]);

    useEffect(() => {
        if (opened && activeTab === "json") {
            setJsonText(JSON.stringify(jsonObject, null, 2));
            setJsonError("");
        }
    }, [activeTab, jsonObject, opened]);

    useEffect(() => {
        if (!opened) {
            setActiveTab("gui");
            setJsonError("");
            setDiscardOpen(false);
        }
    }, [opened]);

    const requestClose = useCallback(() => {
        if (savingTheme) return;
        if (readOnly) {
            onCancel(true);
            return;
        }
        const closed = onCancel(false);
        if (closed === false && isDirty) {
            setDiscardOpen(true);
        }
    }, [isDirty, onCancel, readOnly, savingTheme]);

    const discardChanges = useCallback(() => {
        setDiscardOpen(false);
        onCancel(true);
    }, [onCancel]);

    const handleTabChange = useCallback((tab: string | null) => {
        if (tab === "json") {
            setJsonText(JSON.stringify(createThemeJsonObject(draft), null, 2));
            setJsonError("");
        }
        setActiveTab(tab);
    }, [draft]);

    const handleCopyJson = useCallback(() => {
        navigator.clipboard.writeText(jsonText).then(() => {
            setCopied(true);
            notifications.show({ message: "已复制到剪贴板", color: "green", autoClose: 1500 });
            window.setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            notifications.show({ message: "复制失败", color: "red", autoClose: 1500 });
        });
    }, [jsonText]);

    const handleApplyJson = useCallback(() => {
        const result = parseThemeDraftJson(jsonText, draft);
        if (result.errors.length > 0 || !result.draft) {
            setJsonError(result.errors.join("\n"));
            return;
        }
        actions.applyDraft(result.draft);
        setJsonError("");
    }, [actions, draft, jsonText]);

    const primaryContrast = useMemo(
        () => getContrastRatio(draft.textColorPrimary, draft.panelColor),
        [draft.panelColor, draft.textColorPrimary],
    );
    const secondaryContrast = useMemo(
        () => getContrastRatio(draft.textColorSecondary, draft.panelColor),
        [draft.panelColor, draft.textColorSecondary],
    );
    const lowContrastLabels = [
        primaryContrast !== null && primaryContrast < 4.5 ? `主要文字 ${primaryContrast.toFixed(1)}:1` : null,
        secondaryContrast !== null && secondaryContrast < 4.5 ? `次要文字 ${secondaryContrast.toFixed(1)}:1` : null,
    ].filter((label): label is string => label !== null);

    const modalStyles = {
        content: {
            backgroundColor: derived?.modalBackground,
            backdropFilter: panelStyles?.backdropFilter,
            color: derived?.textColorPrimary,
            maxHeight: "calc(100dvh - 32px)",
            display: "flex" as const,
            flexDirection: "column" as const,
            overflow: "hidden" as const,
        },
        header: {
            backgroundColor: "transparent",
            color: derived?.textColorPrimary,
            flexShrink: 0,
        },
        title: {
            color: derived?.textColorPrimary,
            fontWeight: 600,
        },
        body: {
            minHeight: 0,
            overflow: "hidden",
            display: "flex" as const,
            flexDirection: "column" as const,
        },
    };

    const inputStyles = derived ? {
        input: {
            backgroundColor: derived.controlBackground,
            color: derived.textColorPrimary,
            borderColor: "transparent",
            borderRadius: derived.componentRadius,
        },
        label: {
            color: derived.textColorPrimary,
        },
    } : undefined;

    const sliderColor = draft.themeColor;
    const title = readOnly ? "主题详情" : draft.id ? "编辑主题" : "新建主题";

    return (
        <>
            <Modal
                opened={opened}
                onClose={requestClose}
                title={title}
                centered
                size="min(900px, calc(100vw - 32px))"
                radius={derived?.componentRadius}
                styles={modalStyles}
                className="normal-panel"
                closeOnClickOutside={!savingTheme}
                closeOnEscape={!savingTheme}
                withCloseButton={!savingTheme}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={onBackgroundFileChange}
                />

                <Tabs value={activeTab} onChange={handleTabChange} defaultValue="gui" style={{ minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
                    <Tabs.List>
                        <Tabs.Tab value="gui">可视化</Tabs.Tab>
                        <Tabs.Tab value="json">JSON</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="gui" pt="md" style={{ minHeight: 0, flex: 1 }}>
                        <ScrollArea type="auto" offsetScrollbars style={{ height: "min(520px, calc(100dvh - 230px))", paddingRight: 8, overscrollBehavior: "contain" }}>
                            <Box className="theme-editor-grid">
                                <Stack gap="md">
                                    <Fieldset legend="基础" variant="unstyled" styles={{ legend: { color: derived?.textColorPrimary, fontWeight: 600 } }}>
                                        <Stack gap="sm">
                                            <TextInput
                                                label="主题名称"
                                                value={draft.name}
                                                onChange={(event) => setField(actions, "name", event.currentTarget.value)}
                                                placeholder="输入主题名称"
                                                size="sm"
                                                styles={inputStyles}
                                                readOnly={readOnly}
                                            />
                                            <SegmentedControl
                                                value={draft.colorScheme}
                                                onChange={(value) => {
                                                    if (value === "light" || value === "dark") {
                                                        setField(actions, "colorScheme", value as ThemeColorScheme);
                                                    }
                                                }}
                                                data={[
                                                    { label: "亮色", value: "light" },
                                                    { label: "暗色", value: "dark" },
                                                ]}
                                                fullWidth
                                                disabled={readOnly}
                                            />
                                            <ColorInput label="主题色" value={draft.themeColor} onChange={(value) => setField(actions, "themeColor", value)} size="sm" disallowInput={false} format="hex" styles={inputStyles} readOnly={readOnly} />
                                        </Stack>
                                    </Fieldset>

                                    <Fieldset legend="颜色" variant="unstyled" styles={{ legend: { color: derived?.textColorPrimary, fontWeight: 600 } }}>
                                        <Stack gap="sm">
                                            <Group grow gap="xs">
                                                <ColorInput label="背景色" value={draft.backgroundColor} onChange={(value) => setField(actions, "backgroundColor", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                                <ColorInput label="面板色" value={draft.panelColor} onChange={(value) => setField(actions, "panelColor", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                            </Group>
                                            <Group grow gap="xs">
                                                <ColorInput label="控件色" value={draft.controlColor} onChange={(value) => setField(actions, "controlColor", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                                <ColorInput label="卡片色" value={draft.favoriteCardColor} onChange={(value) => setField(actions, "favoriteCardColor", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                            </Group>
                                            <Group grow gap="xs">
                                                <ColorInput label="主要文字" value={draft.textColorPrimary} onChange={(value) => setField(actions, "textColorPrimary", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                                <ColorInput label="次要文字" value={draft.textColorSecondary} onChange={(value) => setField(actions, "textColorSecondary", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                            </Group>
                                            <ColorInput label="弹窗色" value={draft.modalColor} onChange={(value) => setField(actions, "modalColor", value)} size="sm" format="hex" disallowInput={false} styles={inputStyles} readOnly={readOnly} />
                                            {lowContrastLabels.length > 0 && (
                                                <Alert color="yellow" icon={<AlertCircle size={16} />} title="文字对比度偏低">
                                                    {lowContrastLabels.join("，")}。普通文字建议至少达到 4.5:1。
                                                </Alert>
                                            )}
                                        </Stack>
                                    </Fieldset>

                                    <Fieldset legend="效果" variant="unstyled" styles={{ legend: { color: derived?.textColorPrimary, fontWeight: 600 } }}>
                                        <Stack gap="sm">
                                            <SliderField label="背景不透明度" value={draft.backgroundOpacity * 100} min={0} max={100} color={sliderColor} disabled={readOnly} suffix="%" onChange={(value) => setField(actions, "backgroundOpacity", value / 100)} />
                                            <SliderField label="背景模糊" value={draft.backgroundBlur} min={0} max={50} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "backgroundBlur", value)} />
                                            <Group grow gap="xs">
                                                <SliderField label="面板不透明度" value={draft.panelOpacity * 100} min={20} max={100} color={sliderColor} disabled={readOnly} suffix="%" onChange={(value) => setField(actions, "panelOpacity", value / 100)} />
                                                <SliderField label="控件不透明度" value={draft.controlOpacity * 100} min={0} max={100} color={sliderColor} disabled={readOnly} suffix="%" onChange={(value) => setField(actions, "controlOpacity", value / 100)} />
                                            </Group>
                                            <Group grow gap="xs">
                                                <SliderField label="卡片不透明度" value={draft.cardOpacity * 100} min={0} max={100} color={sliderColor} disabled={readOnly} suffix="%" onChange={(value) => setField(actions, "cardOpacity", value / 100)} />
                                                <SliderField label="弹窗不透明度" value={draft.modalOpacity * 100} min={0} max={100} color={sliderColor} disabled={readOnly} suffix="%" onChange={(value) => setField(actions, "modalOpacity", value / 100)} />
                                            </Group>
                                            <Group grow gap="xs">
                                                <SliderField label="面板模糊" value={draft.panelBlur} min={0} max={30} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "panelBlur", value)} />
                                                <SliderField label="控件模糊" value={draft.controlBlur} min={0} max={20} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "controlBlur", value)} />
                                            </Group>
                                            <SliderField label="弹窗模糊" value={draft.modalBlur} min={0} max={30} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "modalBlur", value)} />
                                            <Divider label="背景图" labelPosition="center" size="xs" styles={{ label: { color: derived?.textColorSecondary } }} />
                                            <TextInput
                                                label="背景图 URL"
                                                value={draft.backgroundImageUrl}
                                                onChange={(event) => setField(actions, "backgroundImageUrl", event.currentTarget.value)}
                                                placeholder="https://example.com/bg.jpg"
                                                size="sm"
                                                styles={inputStyles}
                                                readOnly={readOnly}
                                            />
                                            {!readOnly && (
                                                <Group grow gap="xs">
                                                    <Button size="xs" variant="light" color={draft.themeColor} leftSection={<ImagePlus size={14} />} onClick={() => fileInputRef.current?.click()}>
                                                        上传本地图片
                                                    </Button>
                                                    <Button size="xs" variant="light" color="red" leftSection={<Trash2 size={14} />} onClick={onClearBackgroundImage} disabled={!draft.backgroundImageUrl}>
                                                        清除背景图
                                                    </Button>
                                                </Group>
                                            )}
                                        </Stack>
                                    </Fieldset>

                                    <Fieldset legend="布局" variant="unstyled" styles={{ legend: { color: derived?.textColorPrimary, fontWeight: 600 } }}>
                                        <Stack gap="sm">
                                            <Group grow gap="xs">
                                                <SliderField label="面板圆角" value={draft.panelRadius} min={0} max={32} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "panelRadius", value)} />
                                                <SliderField label="组件圆角" value={draft.componentRadius} min={0} max={32} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "componentRadius", value)} />
                                            </Group>
                                            <Group grow gap="xs">
                                                <SliderField label="弹窗圆角" value={draft.modalRadius} min={0} max={32} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "modalRadius", value)} />
                                                <SliderField label="通知圆角" value={draft.notificationRadius} min={0} max={32} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "notificationRadius", value)} />
                                            </Group>
                                            <SliderField label="封面圆角" value={draft.coverRadius} min={0} max={50} color={sliderColor} disabled={readOnly} suffix="px" onChange={(value) => setField(actions, "coverRadius", value)} />
                                            <Select
                                                label="窗口管理按钮位置"
                                                data={[
                                                    { value: "left", label: "左侧" },
                                                    { value: "right", label: "右侧" },
                                                    { value: "hidden", label: "隐藏" },
                                                ]}
                                                value={draft.windowControlsPos}
                                                onChange={(value) => {
                                                    if (value === "left" || value === "right" || value === "hidden") {
                                                        setField(actions, "windowControlsPos", value as ThemeWindowControlsPos);
                                                    }
                                                }}
                                                size="sm"
                                                radius={derived?.componentRadius}
                                                styles={inputStyles}
                                                disabled={readOnly}
                                            />
                                        </Stack>
                                    </Fieldset>
                                </Stack>

                                <ThemePreview draft={draft} backgroundPreviewUrl={backgroundPreviewUrl} />
                            </Box>
                        </ScrollArea>
                    </Tabs.Panel>

                    <Tabs.Panel value="json" pt="md" style={{ minHeight: 0, flex: 1 }}>
                        <Stack gap="md" style={{ height: "min(520px, calc(100dvh - 230px))", minHeight: 0 }}>
                            {readOnly && (
                                <Alert icon={<AlertCircle size={16} />} color="blue" title="只读模式">
                                    这是一个内置主题，无法编辑。
                                </Alert>
                            )}
                            <Box style={{ flex: 1, minHeight: 0, overflow: "hidden", backgroundColor: derived?.controlBackground, borderRadius: derived?.componentRadius }}>
                                <ScrollArea type="auto" offsetScrollbars style={{ height: "100%", overscrollBehavior: "contain" }}>
                                    <Box p="sm">
                                        <Textarea
                                            value={jsonText}
                                            placeholder="粘贴或编辑 JSON 配置..."
                                            onChange={(event) => {
                                                setJsonText(event.currentTarget.value);
                                                setJsonError("");
                                            }}
                                            autosize
                                            minRows={14}
                                            maxRows={28}
                                            spellCheck={false}
                                            wrap="off"
                                            readOnly={readOnly}
                                            styles={{
                                                input: {
                                                    width: "100%",
                                                    minHeight: 260,
                                                    fontFamily: "monospace",
                                                    fontSize: "14px",
                                                    lineHeight: "1.5",
                                                    color: derived?.textColorPrimary,
                                                    backgroundColor: derived?.controlBackground,
                                                    borderColor: "transparent",
                                                    borderRadius: derived?.componentRadius,
                                                    whiteSpace: "pre",
                                                },
                                                label: {
                                                    color: derived?.textColorPrimary,
                                                },
                                            }}
                                        />
                                    </Box>
                                </ScrollArea>
                            </Box>
                            {jsonError && (
                                <Alert icon={<AlertCircle size={16} />} color="red" title="JSON 验证错误">
                                    <Box style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>{jsonError}</Box>
                                </Alert>
                            )}
                            <Group justify="flex-end">
                                <Button leftSection={copied ? <Check size={16} /> : <Copy size={16} />} variant="light" color={draft.themeColor} onClick={handleCopyJson} radius={derived?.componentRadius}>
                                    {copied ? "已复制" : "复制 JSON"}
                                </Button>
                                {!readOnly && (
                                    <Button color={draft.themeColor} variant="light" onClick={handleApplyJson} radius={derived?.componentRadius}>
                                        应用 JSON 配置
                                    </Button>
                                )}
                            </Group>
                        </Stack>
                    </Tabs.Panel>
                </Tabs>

                <Group justify="space-between" gap="sm" mt="md" className="theme-editor-actions">
                    <Text size="xs" c={derived?.textColorSecondary}>{!readOnly && isDirty ? "有未保存修改" : ""}</Text>
                    <Group gap="sm">
                        <Button variant="subtle" color={draft.themeColor} onClick={requestClose} radius={derived?.componentRadius} style={{ color: derived?.textColorPrimary }} disabled={savingTheme}>
                            {readOnly ? "关闭" : "取消"}
                        </Button>
                        {!readOnly && (
                            <Button color={draft.themeColor} loading={savingTheme} disabled={savingTheme} radius={derived?.componentRadius} onClick={onSubmit}>
                                {draft.id ? "保存" : "创建"}
                            </Button>
                        )}
                    </Group>
                </Group>
            </Modal>

            <Modal opened={discardOpen} onClose={() => setDiscardOpen(false)} title="放弃修改？" centered size="sm" radius={derived?.componentRadius} styles={modalStyles}>
                <Stack gap="md">
                    <Text size="sm" c={derived?.textColorPrimary}>当前主题草稿尚未保存。</Text>
                    <Group justify="flex-end">
                        <Button variant="subtle" color={draft.themeColor} onClick={() => setDiscardOpen(false)} radius={derived?.componentRadius}>
                            继续编辑
                        </Button>
                        <Button color="red" onClick={discardChanges} radius={derived?.componentRadius}>
                            放弃修改
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
});

interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    color: string;
    disabled: boolean;
    suffix: string;
    onChange: (value: number) => void;
}

const SliderField = ({ label, value, min, max, color, disabled, suffix, onChange }: SliderFieldProps) => (
    <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="xs" fw={500}>{label}</Text>
        <Slider
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={1}
            label={(current) => `${Math.round(current)}${suffix}`}
            color={color}
            disabled={disabled}
        />
    </Stack>
);

interface ThemePreviewProps {
    draft: ThemeDraft;
    backgroundPreviewUrl: string;
}

const ThemePreview = ({ draft, backgroundPreviewUrl }: ThemePreviewProps) => {
    const panelBackground = hexToRgba(draft.panelColor, draft.panelOpacity);
    const controlBackground = hexToRgba(draft.controlColor, draft.controlOpacity);
    const cardBackground = hexToRgba(draft.favoriteCardColor, draft.cardOpacity);

    return (
        <Box
            style={{
                position: "sticky",
                top: 0,
                minHeight: 360,
                borderRadius: draft.modalRadius,
                overflow: "hidden",
                backgroundColor: hexToRgba(draft.backgroundColor, draft.backgroundOpacity),
                backgroundImage: backgroundPreviewUrl ? `url("${backgroundPreviewUrl}")` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: draft.textColorPrimary,
                boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.2)",
            }}
        >
            <Box
                style={{
                    position: "absolute",
                    inset: 0,
                    backdropFilter: draft.backgroundBlur ? `blur(${draft.backgroundBlur}px)` : undefined,
                    backgroundColor: hexToRgba(draft.backgroundColor, draft.backgroundOpacity),
                }}
            />
            <Stack gap="sm" p="md" style={{ position: "relative" }}>
                <Group justify="space-between">
                    <Text fw={700} size="sm">{draft.name || "未命名主题"}</Text>
                    <Box w={46} h={18} style={{ borderRadius: draft.componentRadius, backgroundColor: draft.themeColor }} />
                </Group>
                <Box
                    p="sm"
                    style={{
                        borderRadius: draft.panelRadius,
                        backgroundColor: panelBackground,
                        backdropFilter: draft.panelBlur ? `blur(${draft.panelBlur}px)` : undefined,
                    }}
                >
                    <Stack gap="xs">
                        <Text size="sm" fw={600}>播放列表</Text>
                        <Text size="xs" style={{ color: draft.textColorSecondary }}>实时预览不会影响全局主题</Text>
                        <Box p="xs" style={{ borderRadius: draft.componentRadius, backgroundColor: cardBackground }}>
                            <Group gap="sm">
                                <Box w={42} h={42} style={{ borderRadius: draft.coverRadius, backgroundColor: draft.themeColor }} />
                                <Box style={{ minWidth: 0 }}>
                                    <Text size="sm" fw={600}>Half Beat</Text>
                                    <Text size="xs" style={{ color: draft.textColorSecondary }}>Theme preview</Text>
                                </Box>
                            </Group>
                        </Box>
                        <Group gap="xs">
                            <Box h={30} style={{ flex: 1, borderRadius: draft.componentRadius, backgroundColor: controlBackground, backdropFilter: draft.controlBlur ? `blur(${draft.controlBlur}px)` : undefined }} />
                            <Box w={60} h={30} style={{ borderRadius: draft.componentRadius, backgroundColor: draft.themeColor }} />
                        </Group>
                    </Stack>
                </Box>
            </Stack>
        </Box>
    );
};

export default ThemeDetailModal;
