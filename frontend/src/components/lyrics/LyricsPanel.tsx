import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActionIcon,
    Badge,
    Box,
    Button,
    Center,
	Checkbox,
	Divider,
    FileButton,
    Group,
    Loader,
    NumberInput,
    Popover,
    ScrollArea,
	Skeleton,
    Stack,
    Text,
    Textarea,
    Tooltip,
} from '@mantine/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CircleX, Download, FileInput, LocateFixed, RefreshCw, RotateCcw, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import type { LyricDocument, LyricImportPreview, LyricView, Song } from '../../types';
import type { LyricLoadState } from '../../hooks/features/useLyrics';
import ThemedModal from '../modals/ThemedModal';
import { parseDomainError } from '../../utils/domainError';

interface LyricsPanelActions {
	search: (songId?: string, force?: boolean) => Promise<void>;
	cancelSearch: () => void;
    previewText: (text: string, filename: string) => Promise<LyricImportPreview>;
    previewFile: (file: File) => Promise<LyricImportPreview>;
    importText: (text: string, filename: string) => Promise<void>;
    importFile: (file: File) => Promise<void>;
    setOffset: (offsetMs: number) => Promise<void>;
    applyCandidate: (documentId: string) => Promise<void>;
	restoreAutomatic: () => Promise<void>;
	deleteLyric: () => Promise<void>;
	rejectCandidate: (documentId: string) => Promise<void>;
}

export interface LyricsPanelProps {
    song: Song | null;
    view: LyricView | null;
    state: LyricLoadState;
    error: string | null;
    message: string;
	progressSeconds?: number;
	getProgressSeconds?: () => number;
    seek: (seconds: number) => void;
    actions: LyricsPanelActions;
    themeColor: string;
    controlBackground?: string;
    textColorPrimary?: string;
    textColorSecondary?: string;
    componentRadius?: number;
    modalBackground?: string;
    modalBlur?: number;
    modalRadius?: number;
}

const activeLineIndex = (lines: readonly { startMs: number }[], positionMs: number): number => {
    let low = 0;
    let high = lines.length - 1;
    let result = -1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (lines[middle].startMs <= positionMs) {
            result = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return result;
};

const formatMilliseconds = (value: number): string => {
	const totalSeconds = Math.max(0, Math.round(value / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const prefersReducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const preferredScrollBehavior = (): ScrollBehavior => prefersReducedMotion() ? 'auto' : 'smooth';

const selectionTouches = (element: HTMLElement): boolean => {
	const selection = window.getSelection?.();
	return Boolean(selection && !selection.isCollapsed && selection.toString() && selection.containsNode(element, true));
};

const LyricsPanel: React.FC<LyricsPanelProps> = ({
    song,
    view,
    state,
    error,
    message,
	progressSeconds = 0,
	getProgressSeconds,
    seek,
    actions,
    themeColor,
    controlBackground,
    textColorPrimary,
    textColorSecondary,
    componentRadius = 6,
    modalBackground,
    modalBlur,
    modalRadius,
}) => {
    const [browserMode, setBrowserMode] = useState(false);
    const [importOpened, setImportOpened] = useState(false);
    const [candidateOpened, setCandidateOpened] = useState(false);
	const [candidateError, setCandidateError] = useState('');
    const [editorText, setEditorText] = useState('');
    const [preview, setPreview] = useState<LyricImportPreview | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [saving, setSaving] = useState(false);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [plainConfirmed, setPlainConfirmed] = useState(false);
	const [deleteOpened, setDeleteOpened] = useState(false);
	const [rejectTarget, setRejectTarget] = useState<LyricDocument | null>(null);
	const [deleteError, setDeleteError] = useState('');
	const [rejectError, setRejectError] = useState('');
	const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
	const [positionMs, setPositionMs] = useState(() => Math.round(progressSeconds * 1000));
    const [offsetDraft, setOffsetDraft] = useState(view?.offsetMs ?? 0);
    const browserTimerRef = useRef<number | null>(null);
    const offsetTimerRef = useRef<number | null>(null);
    const lineRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
	const lyricsViewportRef = useRef<HTMLDivElement | null>(null);
    const isProgrammaticScrollRef = useRef(false);

	const lines = useMemo(() => view?.document?.lines ?? [], [view?.document?.lines]);
	const document = view?.document;
	const virtualized = lines.length > 500;
	const virtualizer = useVirtualizer({
		count: virtualized ? lines.length : 0,
		getScrollElement: () => lyricsViewportRef.current,
		estimateSize: () => 38,
		overscan: 10,
	});
	const displayPositionMs = positionMs + (view?.offsetMs ?? 0);
    const currentIndex = useMemo(() => activeLineIndex(lines, displayPositionMs), [lines, displayPositionMs]);
	const requiresPlainConfirmation = preview?.format === 'plain'
		&& (pendingFile?.name.toLowerCase().endsWith('.lrc') === true || /\[\d{1,3}:/.test(editorText));

    useEffect(() => {
        setOffsetDraft(view?.offsetMs ?? 0);
        setEditorText(view?.document?.rawText ?? '');
	}, [song?.id, view?.document?.id, view?.document?.rawText, view?.offsetMs]);

	useEffect(() => {
		const updatePosition = () => {
			const seconds = getProgressSeconds ? getProgressSeconds() : progressSeconds;
			setPositionMs(Math.round(Math.max(0, seconds) * 1000));
		};
		updatePosition();
		const timer = window.setInterval(updatePosition, 100);
		return () => window.clearInterval(timer);
	}, [getProgressSeconds, progressSeconds, song?.id]);

	useEffect(() => {
		setShowLoadingSkeleton(false);
		if (state !== 'loading') return;
		const timer = window.setTimeout(() => setShowLoadingSkeleton(true), 300);
		return () => window.clearTimeout(timer);
	}, [state, song?.id]);

    useEffect(() => {
        if (browserMode || currentIndex < 0) return;
		if (virtualized) {
			const viewport = lyricsViewportRef.current;
			const currentStart = currentIndex * 38;
			if (viewport && viewport.clientHeight > 0) {
				const safeTop = viewport.scrollTop + viewport.clientHeight * 0.35;
				const safeBottom = viewport.scrollTop + viewport.clientHeight * 0.65;
				if (currentStart >= safeTop && currentStart+38 <= safeBottom) return;
			}
			isProgrammaticScrollRef.current = true;
			virtualizer.scrollToIndex(currentIndex, { align: 'center', behavior: preferredScrollBehavior() });
			window.setTimeout(() => { isProgrammaticScrollRef.current = false; }, prefersReducedMotion() ? 0 : 220);
			return;
		}
        const target = lineRefs.current.get(currentIndex);
        if (!target || typeof target.scrollIntoView !== 'function') return;
		const viewport = lyricsViewportRef.current;
		if (viewport && viewport.clientHeight > 0) {
			const viewportRect = viewport.getBoundingClientRect();
			const targetRect = target.getBoundingClientRect();
			const safeTop = viewportRect.top + viewportRect.height * 0.35;
			const safeBottom = viewportRect.top + viewportRect.height * 0.65;
			if (targetRect.top >= safeTop && targetRect.bottom <= safeBottom) return;
		}
        isProgrammaticScrollRef.current = true;
		target.scrollIntoView({ block: 'center', behavior: preferredScrollBehavior() });
		window.setTimeout(() => { isProgrammaticScrollRef.current = false; }, prefersReducedMotion() ? 0 : 220);
	}, [browserMode, currentIndex, virtualized, virtualizer]);

    useEffect(() => () => {
        if (browserTimerRef.current !== null) window.clearTimeout(browserTimerRef.current);
        if (offsetTimerRef.current !== null) window.clearTimeout(offsetTimerRef.current);
    }, []);

    const beginBrowsing = () => {
        if (isProgrammaticScrollRef.current) return;
        setBrowserMode(true);
        if (browserTimerRef.current !== null) window.clearTimeout(browserTimerRef.current);
        browserTimerRef.current = window.setTimeout(() => setBrowserMode(false), 4000);
    };

    const returnToCurrent = () => {
        setBrowserMode(false);
		if (virtualized) {
			virtualizer.scrollToIndex(currentIndex, { align: 'center', behavior: preferredScrollBehavior() });
			return;
		}
		lineRefs.current.get(currentIndex)?.scrollIntoView?.({ block: 'center', behavior: preferredScrollBehavior() });
    };

    const updateOffset = (value: number) => {
        const next = Math.max(-30_000, Math.min(30_000, Math.round(value / 50) * 50));
        setOffsetDraft(next);
        if (offsetTimerRef.current !== null) window.clearTimeout(offsetTimerRef.current);
		offsetTimerRef.current = window.setTimeout(() => { void actions.setOffset(next).catch(() => undefined); }, 300);
    };

    const previewEditor = async () => {
        setPreviewError('');
        try {
			const result = await actions.previewText(editorText, editorText.includes('[') ? 'lyrics.lrc' : 'lyrics.txt');
			setPreview(result);
			setPlainConfirmed(false);
        } catch (cause) {
            setPreview(null);
			setPreviewError(parseDomainError(cause).message);
        }
    };

    const saveEditor = async () => {
		if (!preview || preview.text !== editorText) {
			setPreviewError('请先预览当前歌词内容');
			return;
		}
		if (requiresPlainConfirmation && !plainConfirmed) {
			setPreviewError('请确认按纯文本导入');
			return;
		}
        setSaving(true);
        try {
			if (pendingFile && preview.text === editorText) {
				await actions.importFile(pendingFile);
			} else {
				await actions.importText(editorText, preview.format === 'lrc' ? 'lyrics.lrc' : 'lyrics.txt');
			}
            setImportOpened(false);
            setPreview(null);
			setPendingFile(null);
        } catch (cause) {
			setPreviewError(parseDomainError(cause).message);
        } finally {
            setSaving(false);
        }
    };

	const previewSelectedFile = async (file: File | null) => {
		if (!file) return;
		setPreviewError('');
		setPendingFile(file);
		setPlainConfirmed(false);
		setImportOpened(true);
		try {
			const result = await actions.previewFile(file);
			setPreview(result);
			setEditorText(result.text);
		} catch (cause) {
			setPreview(null);
			setPreviewError(parseDomainError(cause).message);
		}
	};

	const openEditor = () => {
		setEditorText(document?.rawText ?? '');
		setPreview(null);
		setPreviewError('');
		setPendingFile(null);
		setPlainConfirmed(false);
		setImportOpened(true);
	};

	const exportLyric = () => {
		if (!document) return;
		const extension = document.format === 'lrc' ? 'lrc' : 'txt';
		const sourceNote = document.isManual ? '' : `# 来源: ${document.sourceLabel || document.source}\n`;
		const blob = new Blob([sourceNote, document.rawText], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = window.document.createElement('a');
		link.href = url;
		link.download = `${song?.name || 'lyrics'}.${extension}`;
		link.click();
		URL.revokeObjectURL(url);
	};

    const derived = { modalBackground, modalBlur, modalRadius, controlBackground, textColorPrimary, textColorSecondary, componentRadius };

    return (
        <Stack className="lyrics-panel" gap={0} h="100%" miw={0}>
            <Group className="lyrics-toolbar" justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" miw={0}>
                    {document && <Badge size="sm" variant="light" color={themeColor}>{view?.manualLocked ? '本地' : document.sourceLabel || document.source}</Badge>}
                    {state === 'searching' && <Loader size={14} color={themeColor} />}
					<Text size="xs" c="dimmed" truncate role="status" aria-live="polite">{message}</Text>
                </Group>
                <Group gap={4} wrap="nowrap">
					{document || view?.candidates.length ? (
                        <Tooltip label="检查匹配">
							<ActionIcon variant="subtle" color={themeColor} aria-label="查看歌词来源和匹配" onClick={() => setCandidateOpened(true)}><Sparkles size={16} /></ActionIcon>
                        </Tooltip>
                    ) : null}
					{state === 'searching' ? (
						<Tooltip label="停止等待"><ActionIcon variant="subtle" color={themeColor} aria-label="停止等待自动歌词" onClick={actions.cancelSearch}><X size={16} /></ActionIcon></Tooltip>
					) : (
						<Tooltip label="自动获取"><ActionIcon variant="subtle" color={themeColor} aria-label="自动获取歌词" onClick={() => void actions.search()}><RefreshCw size={16} /></ActionIcon></Tooltip>
					)}
					<FileButton onChange={(file) => { void previewSelectedFile(file); }} accept=".lrc,.txt,text/plain">
                        {(props) => <Tooltip label="导入 LRC/TXT"><ActionIcon {...props} variant="subtle" color={themeColor} aria-label="导入歌词文件"><FileInput size={16} /></ActionIcon></Tooltip>}
                    </FileButton>
                    <Tooltip label="编辑歌词">
						<ActionIcon variant="subtle" color={themeColor} aria-label="编辑歌词" disabled={!song} onClick={openEditor}><FileInput size={16} /></ActionIcon>
                    </Tooltip>
					{document && <Tooltip label="导出歌词"><ActionIcon variant="subtle" color={themeColor} aria-label="导出歌词" onClick={exportLyric}><Download size={16} /></ActionIcon></Tooltip>}
					{document && !document.isManual && <Tooltip label="标记歌词错误"><ActionIcon variant="subtle" color="red" aria-label="标记歌词错误并禁用" onClick={() => { setRejectError(''); setRejectTarget(document); }}><CircleX size={16} /></ActionIcon></Tooltip>}
					{document && <Tooltip label="删除歌词"><ActionIcon variant="subtle" color="red" aria-label="删除歌词" onClick={() => setDeleteOpened(true)}><Trash2 size={16} /></ActionIcon></Tooltip>}
                    <Popover position="bottom-end" shadow="md">
                        <Popover.Target>
                            <Tooltip label="歌词偏移"><ActionIcon variant="subtle" color={themeColor} aria-label="调整歌词偏移" disabled={!song}><SlidersHorizontal size={16} /></ActionIcon></Tooltip>
                        </Popover.Target>
                        <Popover.Dropdown style={{ backgroundColor: modalBackground, color: textColorPrimary }}>
                            <Stack gap="xs">
                                <Text size="xs">歌词偏移</Text>
                                <Group gap={4} wrap="nowrap">
                                    <Button size="compact-xs" variant="light" color={themeColor} onClick={() => updateOffset(offsetDraft - 500)}>-500</Button>
                                    <NumberInput value={offsetDraft} onChange={(value) => updateOffset(Number(value) || 0)} min={-30000} max={30000} step={50} suffix=" ms" w={120} size="xs" />
                                    <Button size="compact-xs" variant="light" color={themeColor} onClick={() => updateOffset(offsetDraft + 500)}>+500</Button>
									<Tooltip label="重置偏移"><ActionIcon variant="subtle" aria-label="重置歌词偏移" onClick={() => updateOffset(0)}><RotateCcw size={14} /></ActionIcon></Tooltip>
                                </Group>
                            </Stack>
                        </Popover.Dropdown>
                    </Popover>
                </Group>
            </Group>
			{song && error && document && (
				<Group className="lyrics-inline-error" role="status" justify="space-between" wrap="nowrap">
					<Text size="xs" c="red" truncate>{error}</Text>
					<Button size="compact-xs" variant="subtle" color="red" onClick={() => void actions.search()}>重试</Button>
				</Group>
			)}

            <Box className="lyrics-content" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {!song && <Center h="100%"><Text c="dimmed">选择一首歌曲</Text></Center>}
				{song && state === 'loading' && showLoadingSkeleton && <Center h="100%"><Stack w="70%" gap="md"><Skeleton h={18} w="68%" mx="auto" /><Skeleton h={18} w="88%" mx="auto" /><Skeleton h={18} w="58%" mx="auto" /></Stack></Center>}
                {song && error && !document && (
                    <Center h="100%"><Stack align="center" gap="xs" role="status"><Text fw={600}>歌词加载失败</Text><Text size="sm" c="dimmed" maw={360} ta="center">{error}</Text><Button size="xs" color={themeColor} onClick={() => void actions.search()}>重试</Button></Stack></Center>
                )}
				{song && !document && state === 'searching' && <Center h="100%"><Stack align="center" gap="xs"><Loader size="sm" color={themeColor} /><Text size="sm" c="dimmed">正在查找歌词</Text><Button size="compact-xs" variant="subtle" onClick={actions.cancelSearch}>停止等待</Button></Stack></Center>}
				{song && !document && state !== 'loading' && state !== 'searching' && !error && (
					<Center h="100%">
						<Stack align="center" gap="xs">
							<Text fw={600}>暂未找到可靠歌词</Text>
							<Text size="sm" c="dimmed">请手动导入正确歌词</Text>
							<Group>
								<FileButton onChange={(file) => { void previewSelectedFile(file); }} accept=".lrc,.txt,text/plain">
									{(props) => <Button {...props} size="xs" color={themeColor}>导入 LRC/TXT</Button>}
								</FileButton>
								<Button size="xs" variant="light" color={themeColor} onClick={() => setImportOpened(true)}>粘贴歌词</Button>
							</Group>
						</Stack>
					</Center>
				)}
                {song && document?.format === 'plain' && (
                    <ScrollArea h="100%" type="auto"><Text className="plain-lyrics" style={{ color: textColorPrimary, whiteSpace: 'pre-wrap' }}>{document.rawText}</Text></ScrollArea>
                )}
                {song && document?.format === 'lrc' && (
					<ScrollArea viewportRef={lyricsViewportRef} h="100%" type="auto" onScrollPositionChange={beginBrowsing}>
						{virtualized ? (
							<Box className="timed-lyrics" h={virtualizer.getTotalSize()} pos="relative">
								{virtualizer.getVirtualItems().map((virtualRow) => {
									const line = lines[virtualRow.index];
									return (
										<button
											type="button"
											key={`${line.startMs}:${virtualRow.index}`}
											className="lyric-line virtual-lyric-line"
											data-current={virtualRow.index === currentIndex || undefined}
											aria-current={virtualRow.index === currentIndex ? 'true' : undefined}
											onClick={(event) => {
								const target = Math.max(0, (line.startMs - (view?.offsetMs ?? 0)) / 1000);
												const songDuration = song.duration ?? 0;
												if (!selectionTouches(event.currentTarget)) seek(songDuration > 0 ? Math.min(songDuration, target) : target);
											}}
											style={{ color: virtualRow.index === currentIndex ? themeColor : textColorSecondary, height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
										>
											{line.text || '\u00a0'}
										</button>
									);
								})}
							</Box>
						) : (
						<Stack className="timed-lyrics" gap={0} py="xl">
							{lines.map((line, index) => (
                                <button
                                    type="button"
                                    key={`${line.startMs}:${index}`}
                                    ref={(element) => { if (element) lineRefs.current.set(index, element); else lineRefs.current.delete(index); }}
                                    className="lyric-line"
                                    data-current={index === currentIndex || undefined}
                                    aria-current={index === currentIndex ? 'true' : undefined}
                                    onClick={(event) => {
										const target = Math.max(0, (line.startMs - (view?.offsetMs ?? 0)) / 1000);
										const songDuration = song.duration ?? 0;
										if (!selectionTouches(event.currentTarget)) seek(songDuration > 0 ? Math.min(songDuration, target) : target);
                                    }}
                                    style={{ color: index === currentIndex ? themeColor : textColorSecondary }}
                                >
                                    {line.text || '\u00a0'}
                                </button>
                            ))}
                        </Stack>
						)}
                    </ScrollArea>
                )}
                {browserMode && currentIndex >= 0 && (
                    <Tooltip label="回到当前歌词"><ActionIcon className="return-current-lyric" variant="filled" color={themeColor} aria-label="回到当前歌词" onClick={returnToCurrent}><LocateFixed size={16} /></ActionIcon></Tooltip>
                )}
            </Box>

			<ThemedModal derived={derived} opened={importOpened} onClose={() => setImportOpened(false)} title={document ? '编辑歌词' : '导入歌词'} centered size="lg">
                <Stack gap="sm">
					<Textarea aria-label="歌词原始文本" value={editorText} onChange={(event) => { setEditorText(event.currentTarget.value); setPreview(null); setPlainConfirmed(false); }} minRows={12} maxRows={18} autosize placeholder="粘贴 LRC 或纯文本歌词" styles={{ input: { backgroundColor: controlBackground, color: textColorPrimary } }} />
					{preview && (
						<Stack gap={5} p="sm" style={{ backgroundColor: controlBackground, borderRadius: componentRadius }}>
							<Text size="xs" fw={600}>导入预览</Text>
							<Text size="xs" c="dimmed">
								{preview.encoding} · {preview.format.toUpperCase()} · {preview.validLineCount} 个有效时间行
								{preview.format === 'lrc' ? ` · ${formatMilliseconds(preview.firstMs)}–${formatMilliseconds(preview.lastMs)}` : ''}
								{preview.embeddedOffsetMs ? ` · 内置偏移 ${preview.embeddedOffsetMs} ms` : ''}
							</Text>
							<Divider />
							{(preview.lines.length ? preview.lines.slice(0, 3).map((line) => line.text) : preview.text.split(/\r?\n/).filter(Boolean).slice(0, 3)).map((line, index) => (
								<Text key={`${index}:${line}`} size="xs" lineClamp={1}>{line}</Text>
							))}
							{preview.warnings.map((warning) => <Text key={warning} size="xs" c="yellow">{warning}</Text>)}
						</Stack>
					)}
					{requiresPlainConfirmation && preview && (
						<Checkbox checked={plainConfirmed} onChange={(event) => setPlainConfirmed(event.currentTarget.checked)} label="有效时间标签少于 2 行，确认按纯文本导入" color={themeColor} />
					)}
                    {previewError && <Text size="sm" c="red" role="status">{previewError}</Text>}
                    <Group justify="space-between">
						{view?.manualLocked ? <Button size="xs" variant="subtle" color="gray" onClick={() => { void actions.restoreAutomatic().then(() => setImportOpened(false)).catch((cause) => setPreviewError(parseDomainError(cause).message)); }}>恢复自动歌词</Button> : <span />}
						<Group><Button variant="subtle" onClick={() => setImportOpened(false)}>取消</Button><Button variant="light" color={themeColor} onClick={() => void previewEditor()}>预览</Button><Button color={themeColor} loading={saving} disabled={!preview || preview.text !== editorText || (requiresPlainConfirmation && !plainConfirmed)} onClick={() => void saveEditor()}>保存为本地歌词</Button></Group>
                    </Group>
                </Stack>
            </ThemedModal>

			<ThemedModal derived={derived} opened={candidateOpened} onClose={() => setCandidateOpened(false)} title="歌词来源" centered size="md">
                <Stack gap="xs">
					{document && (
						<Box p="sm" style={{ backgroundColor: controlBackground, borderRadius: componentRadius }}>
							<Group justify="space-between" wrap="nowrap">
								<Stack gap={2} miw={0}>
									<Text size="xs" c="dimmed">当前使用</Text>
									<Text size="sm" fw={600}>{document.sourceLabel || document.source}</Text>
									<Text size="xs" c="dimmed">{document.format.toUpperCase()} · 匹配度 {Math.round(document.confidence * 100)}%</Text>
								</Stack>
								{!document.isManual && <Tooltip label="此歌词不正确，将其禁用"><ActionIcon variant="subtle" color="red" aria-label="禁用当前错误歌词" onClick={() => { setRejectError(''); setRejectTarget(document); }}><CircleX size={16} /></ActionIcon></Tooltip>}
							</Group>
						</Box>
					)}
                    {view?.candidates.map((candidate) => (
                        <Box key={candidate.id} p="sm" style={{ backgroundColor: controlBackground, borderRadius: componentRadius }}>
                            <Group justify="space-between" wrap="nowrap">
								<Stack gap={2} miw={0}>
									<Text size="sm" fw={600}>{candidate.sourceLabel || candidate.source}</Text>
									<Text size="xs" c="dimmed">匹配度 {Math.round(candidate.confidence * 100)}% · {candidate.format.toUpperCase()}</Text>
									{candidate.evidence?.trackName && <Text size="xs" c="dimmed" truncate>{candidate.evidence.trackName} · {candidate.evidence.artistName || '未知歌手'}</Text>}
									{candidate.evidence?.candidateDuration && <Text size="xs" c="dimmed">候选 {candidate.evidence.candidateDuration}s · 当前 {candidate.evidence.targetDuration || '?'}s</Text>}
								</Stack>
								<Group gap={4} wrap="nowrap">
									<Tooltip label="禁用错误结果"><ActionIcon variant="subtle" color="red" aria-label={`禁用 ${candidate.sourceLabel || candidate.source} 歌词`} onClick={() => { setRejectError(''); setRejectTarget(candidate); }}><CircleX size={16} /></ActionIcon></Tooltip>
									<Button size="xs" color={themeColor} onClick={() => { setCandidateError(''); void actions.applyCandidate(candidate.id).then(() => setCandidateOpened(false)).catch((cause) => setCandidateError(parseDomainError(cause).message)); }}>采用</Button>
								</Group>
                            </Group>
                        </Box>
                    ))}
					{candidateError && <Text size="sm" c="red" role="status">{candidateError}</Text>}
                </Stack>
			</ThemedModal>

			<ThemedModal derived={derived} opened={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="标记歌词错误" centered size="sm">
				<Stack gap="md">
					<Text size="sm">该歌词将被禁用，以后自动获取也不会再次采用这个来源结果。禁用后请手动导入正确歌词。</Text>
					{rejectTarget && <Text size="xs" c="dimmed">{rejectTarget.sourceLabel || rejectTarget.source}</Text>}
					{rejectError && <Text size="sm" c="red" role="status">{rejectError}</Text>}
					<Group justify="flex-end">
						<Button variant="subtle" onClick={() => setRejectTarget(null)}>取消</Button>
						<Button color="red" onClick={() => {
							if (!rejectTarget) return;
							setRejectError('');
							void actions.rejectCandidate(rejectTarget.id).then(() => {
								setRejectTarget(null);
								setCandidateOpened(false);
							}).catch((cause) => setRejectError(parseDomainError(cause).message));
						}}>确认禁用</Button>
					</Group>
				</Stack>
			</ThemedModal>

			<ThemedModal derived={derived} opened={deleteOpened} onClose={() => setDeleteOpened(false)} title="删除歌词" centered size="sm">
				<Stack gap="md">
					<Text size="sm">删除后不会立即自动获取；手工版本仍保留在历史中，可通过重新获取或恢复自动歌词继续使用。</Text>
					{deleteError && <Text size="sm" c="red" role="status">{deleteError}</Text>}
					<Group justify="flex-end"><Button variant="subtle" onClick={() => setDeleteOpened(false)}>取消</Button><Button color="red" onClick={() => { setDeleteError(''); void actions.deleteLyric().then(() => setDeleteOpened(false)).catch((cause) => setDeleteError(parseDomainError(cause).message)); }}>确认删除</Button></Group>
				</Stack>
			</ThemedModal>
        </Stack>
    );
};

export default LyricsPanel;
