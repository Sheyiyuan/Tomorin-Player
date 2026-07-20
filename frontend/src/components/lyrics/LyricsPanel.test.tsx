import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LyricImportPreview, LyricView, Song } from '../../types';
import LyricsPanel, { type LyricsPanelProps } from './LyricsPanel';
import { LyricErrorBoundary } from './LyricErrorBoundary';

const song: Song = {
    id: 'song-1', bvid: 'BV1xx411c7mD', name: 'Song', singer: 'Singer', singerId: '', cover: '', coverLocal: '',
    sourceId: '', streamUrl: '', streamUrlExpiresAt: '', lyric: '', lyricOffset: 0, skipStartTime: 0, skipEndTime: 0,
    pageNumber: 1, pageTitle: '', videoTitle: '', totalPages: 1, createdAt: '', updatedAt: '',
};

const view: LyricView = {
    songId: song.id,
    offsetMs: 100,
    manualLocked: true,
    candidates: [],
    document: {
        id: 'manual', songId: song.id, source: 'manual', sourceLabel: '本地', format: 'lrc', rawText: '[00:01]one\n[00:02]two',
        lines: [{ startMs: 1000, text: 'one' }, { startMs: 2000, text: 'two' }], metadata: {}, contentHash: 'hash', providerRef: '',
		encoding: 'utf-8', confidence: 1, embeddedOffsetMs: 0, isManual: true, isReliable: true, createdAt: '', updatedAt: '',
    },
};

const emptyPreview: LyricImportPreview = { text: '', format: 'plain', encoding: 'utf-8', lines: [], metadata: {}, embeddedOffsetMs: 0, validLineCount: 0, firstMs: 0, lastMs: 0, warnings: [] };

const actions: LyricsPanelProps['actions'] = {
    search: vi.fn(async () => undefined),
	cancelSearch: vi.fn(),
	previewText: vi.fn(async () => emptyPreview),
	previewFile: vi.fn(async () => emptyPreview),
    importText: vi.fn(async () => undefined), importFile: vi.fn(async () => undefined), setOffset: vi.fn(async () => undefined),
    applyCandidate: vi.fn(async () => undefined), restoreAutomatic: vi.fn(async () => undefined),
	deleteLyric: vi.fn(async () => undefined),
	rejectCandidate: vi.fn(async () => undefined),
};

describe('LyricsPanel', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

    it('highlights the current timed line and seeks with the user offset removed', () => {
        const seek = vi.fn();
        render(<MantineProvider><LyricsPanel song={song} view={view} state="ready" error={null} message="" progressSeconds={1.2} seek={seek} actions={actions} themeColor="blue" /></MantineProvider>);
        expect(screen.getByRole('button', { name: 'one' })).toHaveAttribute('aria-current', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'two' }));
        expect(seek).toHaveBeenCalledWith(1.9);
        expect(screen.getByText('本地')).toBeInTheDocument();
    });

    it('contains lyric render failures without removing sibling playback UI', () => {
        const Broken = () => { throw new Error('broken lyric'); };
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<MantineProvider><div data-testid="player">player</div><LyricErrorBoundary color="blue"><Broken /></LyricErrorBoundary></MantineProvider>);
        expect(screen.getByTestId('player')).toBeInTheDocument();
        expect(screen.getByText('歌词区域暂时无法显示')).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

	it('updates the active line from the local 100 ms playback clock', () => {
		vi.useFakeTimers();
		let progress = 1.2;
		render(<MantineProvider><LyricsPanel song={song} view={view} state="ready" error={null} message="" getProgressSeconds={() => progress} seek={vi.fn()} actions={actions} themeColor="blue" /></MantineProvider>);
		expect(screen.getByRole('button', { name: 'one' })).toHaveAttribute('aria-current', 'true');
		progress = 2.2;
		act(() => vi.advanceTimersByTime(100));
		expect(screen.getByRole('button', { name: 'two' })).toHaveAttribute('aria-current', 'true');
	});

	it('pauses automatic positioning while browsing and resumes on request', () => {
		vi.useFakeTimers();
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: () => ({ matches: false, media: '', onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
		});
		const scrollIntoView = vi.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
		let progress = 1.2;
		const { container } = render(<MantineProvider><LyricsPanel song={song} view={view} state="ready" error={null} message="" getProgressSeconds={() => progress} seek={vi.fn()} actions={actions} themeColor="blue" /></MantineProvider>);
		act(() => vi.advanceTimersByTime(250));
		const viewport = container.querySelector('.mantine-ScrollArea-viewport');
		expect(viewport).toBeTruthy();
		fireEvent.scroll(viewport as Element);
		expect(screen.getByRole('button', { name: '回到当前歌词' })).toBeInTheDocument();
		const callsBeforeProgress = scrollIntoView.mock.calls.length;
		progress = 2.2;
		act(() => vi.advanceTimersByTime(100));
		expect(screen.getByRole('button', { name: 'two' })).toHaveAttribute('aria-current', 'true');
		expect(scrollIntoView).toHaveBeenCalledTimes(callsBeforeProgress);
		fireEvent.click(screen.getByRole('button', { name: '回到当前歌词' }));
		expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsBeforeProgress);
	});

	it('keeps existing lyrics visible when a provider request fails', () => {
		const retry = vi.fn(async () => undefined);
		render(<MantineProvider><LyricsPanel song={song} view={view} state="error" error="歌词服务暂时不可用" message="自动获取失败，可重试" progressSeconds={1.2} seek={vi.fn()} actions={{ ...actions, search: retry }} themeColor="blue" /></MantineProvider>);
		expect(screen.getByRole('button', { name: 'one' })).toBeInTheDocument();
		expect(screen.getByText('歌词服务暂时不可用')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '重试' }));
		expect(retry).toHaveBeenCalledTimes(1);
	});

	it('renders plain lyrics without timestamp controls', () => {
		const plainView: LyricView = {
			...view,
			document: view.document ? { ...view.document, format: 'plain', rawText: 'first paragraph\nsecond paragraph', lines: [] } : undefined,
		};
		render(<MantineProvider><LyricsPanel song={song} view={plainView} state="ready" error={null} message="" seek={vi.fn()} actions={actions} themeColor="blue" /></MantineProvider>);
		expect(screen.getByText(/first paragraph/)).toHaveClass('plain-lyrics');
		expect(screen.queryByRole('button', { name: 'first paragraph' })).not.toBeInTheDocument();
	});

	it('lets the user disable an incorrect automatic lyric result', async () => {
		const rejectCandidate = vi.fn(async () => undefined);
		const candidateView: LyricView = {
			...view,
			manualLocked: false,
			candidates: [{ ...view.document!, id: 'candidate', isManual: false, source: 'lrclib', sourceLabel: 'LRCLIB', confidence: 0.95 }],
		};
		render(<MantineProvider><LyricsPanel song={song} view={candidateView} state="ready" error={null} message="" seek={vi.fn()} actions={{ ...actions, rejectCandidate }} themeColor="blue" /></MantineProvider>);
		fireEvent.click(screen.getByRole('button', { name: '查看歌词来源和匹配' }));
		fireEvent.click(await screen.findByRole('button', { name: '禁用 LRCLIB 歌词' }));
		fireEvent.click(await screen.findByRole('button', { name: '确认禁用' }));
		await waitFor(() => expect(rejectCandidate).toHaveBeenCalledWith('candidate'));
	});

	it('previews a file and requires explicit confirmation before importing plain text', async () => {
		const preview: LyricImportPreview = {
			text: '[00:01]only',
			format: 'plain',
			encoding: 'gb18030',
			lines: [],
			metadata: {},
			embeddedOffsetMs: 0,
			validLineCount: 0,
			firstMs: 0,
			lastMs: 0,
			warnings: ['仅找到 1 行有效时间标签，已按纯文本处理'],
		};
		const previewFile = vi.fn(async () => preview);
		const importFile = vi.fn(async () => undefined);
		const { container } = render(<MantineProvider><LyricsPanel song={song} view={null} state="empty" error={null} message="" seek={vi.fn()} actions={{ ...actions, previewFile, importFile }} themeColor="blue" /></MantineProvider>);
		const input = container.querySelector('input[type="file"]');
		expect(input).toBeTruthy();
		const file = new File(['lyrics'], 'lyrics.lrc', { type: 'text/plain' });
		fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
		expect(await screen.findByText('导入预览')).toBeInTheDocument();
		expect(screen.getByText(/gb18030 · PLAIN · 0 个有效时间行/)).toBeInTheDocument();
		const save = screen.getByRole('button', { name: '保存为本地歌词' });
		expect(save).toBeDisabled();
		fireEvent.click(screen.getByRole('checkbox', { name: /确认按纯文本导入/ }));
		expect(save).toBeEnabled();
		fireEvent.click(save);
		await waitFor(() => expect(importFile).toHaveBeenCalledWith(file));
	});

	it('virtualizes lyrics longer than 500 lines', () => {
		const longView: LyricView = {
			...view,
			document: view.document ? {
				...view.document,
				id: 'long',
				lines: Array.from({ length: 1000 }, (_, index) => ({ startMs: index * 1000, text: `line ${index}` })),
			} : undefined,
		};
		const { container } = render(<MantineProvider><LyricsPanel song={song} view={longView} state="ready" error={null} message="" progressSeconds={1} seek={vi.fn()} actions={actions} themeColor="blue" /></MantineProvider>);
		expect(container.querySelector('.timed-lyrics')).toBeInTheDocument();
		expect(container.querySelectorAll('.lyric-line').length).toBeLessThan(1000);
	});

	it('uses instant lyric positioning when reduced motion is requested', () => {
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: (query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }),
		});
		const scrollIntoView = vi.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
		render(<MantineProvider><LyricsPanel song={song} view={view} state="ready" error={null} message="" progressSeconds={1.2} seek={vi.fn()} actions={actions} themeColor="blue" /></MantineProvider>);
		expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
	});

	it('exports and deletes the active lyric through explicit actions', async () => {
		const createObjectURL = vi.fn(() => 'blob:lyrics');
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
		Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		const deleteLyric = vi.fn(async () => undefined);
		render(<MantineProvider><LyricsPanel song={song} view={view} state="ready" error={null} message="" seek={vi.fn()} actions={{ ...actions, deleteLyric }} themeColor="blue" /></MantineProvider>);
		fireEvent.click(screen.getByRole('button', { name: '导出歌词' }));
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:lyrics');
		fireEvent.click(screen.getByRole('button', { name: '删除歌词' }));
		fireEvent.click(await screen.findByRole('button', { name: '确认删除' }));
		await waitFor(() => expect(deleteLyric).toHaveBeenCalledTimes(1));
	});
});
