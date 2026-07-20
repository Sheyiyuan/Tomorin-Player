import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { models } from '../../../wailsjs/go/models';
import {
    convertLyricImportPreview,
	convertLyricSearchTask,
    convertLyricView,
    type LyricImportPreview,
    type LyricView,
    type Song,
} from '../../types';
import { parseDomainError } from '../../utils/domainError';

export type LyricLoadState = 'idle' | 'loading' | 'searching' | 'ready' | 'empty' | 'error';

let lyricRequestSequence = 0;

const nextRequestId = (songId: string): string => {
    lyricRequestSequence += 1;
    return `${songId}:${Date.now()}:${lyricRequestSequence}`;
};

const waitForTaskPoll = (): Promise<void> => new Promise((resolve) => {
	window.setTimeout(resolve, 100);
});

export const useLyrics = (currentSong: Song | null) => {
    const [view, setView] = useState<LyricView | null>(null);
    const [state, setState] = useState<LyricLoadState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const activeRequestRef = useRef('');
    const currentSongIdRef = useRef<string | null>(null);
	const currentSongDurationRef = useRef(0);
	const lastSuccessfulOffsetRef = useRef(0);
    currentSongIdRef.current = currentSong?.id ?? null;
	currentSongDurationRef.current = currentSong?.duration ?? 0;

	useEffect(() => () => {
		currentSongIdRef.current = null;
		activeRequestRef.current = '';
	}, []);

    const search = useCallback(async (songId?: string, force = true) => {
        const targetSongId = songId ?? currentSongIdRef.current;
        if (!targetSongId) return;
        const requestId = nextRequestId(targetSongId);
		let subscribedRequestId = requestId;
        activeRequestRef.current = requestId;
        setState('searching');
        setError(null);
        try {
            const request = new models.LyricSearchRequest({ songId: targetSongId, requestId, force });
			let task = convertLyricSearchTask(await Services.SearchLyrics(request));
			subscribedRequestId = task.requestId;
			activeRequestRef.current = task.requestId;
			while (task.status === 'queued' || task.status === 'running') {
				await waitForTaskPoll();
				if (activeRequestRef.current !== task.requestId || currentSongIdRef.current !== targetSongId) return;
				task = convertLyricSearchTask(await Services.GetLyricSearch(task.requestId));
			}
			if (task.status === 'failed' || !task.result) {
				if (activeRequestRef.current !== task.requestId || currentSongIdRef.current !== targetSongId) return;
				setError(task.errorMessage || '歌词自动获取失败');
				setMessage(task.retryable ? '自动获取失败，可重试' : '自动获取失败');
				setState('error');
				return;
			}
			const result = task.result;
            if (activeRequestRef.current !== result.requestId || currentSongIdRef.current !== result.songId) return;
            setView(result.view);
			lastSuccessfulOffsetRef.current = result.view.offsetMs;
            setMessage(result.message);
            setState(result.view.document ? 'ready' : 'empty');
        } catch (cause) {
            if (activeRequestRef.current !== subscribedRequestId || currentSongIdRef.current !== targetSongId) return;
			const parsed = parseDomainError(cause);
            setError(parsed.message);
			setMessage(parsed.retryable ? '自动获取失败，可重试' : '自动获取失败');
            setState('error');
        }
    }, []);

    useEffect(() => {
        activeRequestRef.current = '';
        setError(null);
        setMessage('');
        if (!currentSong) {
            setView(null);
            setState('idle');
            return;
        }
        const songId = currentSong.id;
        let active = true;
        setState('loading');
        Services.GetActiveLyric(songId)
            .then((rawView) => {
                if (!active || currentSongIdRef.current !== songId) return;
                const loaded = convertLyricView(rawView);
                setView(loaded);
				lastSuccessfulOffsetRef.current = loaded.offsetMs;
                if (loaded.document) {
                    setState('ready');
					const refreshedAt = Date.parse(loaded.document.retrievedAt || loaded.document.updatedAt);
					if (!loaded.manualLocked && (!Number.isFinite(refreshedAt) || Date.now() - refreshedAt >= 24 * 60 * 60 * 1000)) {
						void search(songId, false);
					}
                } else {
                    setState('empty');
					void search(songId, false);
                }
            })
            .catch((cause) => {
                if (!active || currentSongIdRef.current !== songId) return;
				const parsed = parseDomainError(cause);
				setError(parsed.message);
                setState('error');
            });
        return () => { active = false; };
	}, [currentSong, search]);

    const previewText = useCallback(async (text: string, filename: string): Promise<LyricImportPreview> => (
        convertLyricImportPreview(await Services.PreviewLyricText(text, filename, currentSongDurationRef.current))
    ), []);

    const previewFile = useCallback(async (file: File): Promise<LyricImportPreview> => {
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
        return convertLyricImportPreview(await Services.PreviewLyricFile(bytes, file.name, currentSongDurationRef.current));
    }, []);

    const importText = useCallback(async (text: string, filename: string) => {
        const songId = currentSongIdRef.current;
        if (!songId) return;
        const imported = convertLyricView(await Services.ImportLyricText(songId, text, filename));
        if (currentSongIdRef.current === songId) {
            setView(imported);
			lastSuccessfulOffsetRef.current = imported.offsetMs;
            setState('ready');
            setError(null);
        }
    }, []);

    const importFile = useCallback(async (file: File) => {
        const songId = currentSongIdRef.current;
        if (!songId) return;
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
        const imported = convertLyricView(await Services.ImportLyricFile(songId, bytes, file.name));
        if (currentSongIdRef.current === songId) {
            setView(imported);
			lastSuccessfulOffsetRef.current = imported.offsetMs;
            setState('ready');
            setError(null);
        }
    }, []);

    const setOffset = useCallback(async (offsetMs: number) => {
        const songId = currentSongIdRef.current;
        if (!songId) return;
        setView((current) => current ? { ...current, offsetMs } : current);
        try {
            const updated = convertLyricView(await Services.SetLyricOffset(songId, offsetMs));
			if (currentSongIdRef.current === songId) {
				lastSuccessfulOffsetRef.current = updated.offsetMs;
				setView(updated);
			}
        } catch (cause) {
			if (currentSongIdRef.current === songId) {
				setView((current) => current ? { ...current, offsetMs: lastSuccessfulOffsetRef.current } : current);
			}
			const parsed = parseDomainError(cause);
			notifications.show({ title: '偏移保存失败', message: parsed.message, color: 'red' });
            throw cause;
        }
    }, []);

    const applyCandidate = useCallback(async (documentId: string) => {
        const songId = currentSongIdRef.current;
        if (!songId) return;
        const updated = convertLyricView(await Services.ApplyLyricCandidate(songId, documentId));
        if (currentSongIdRef.current === songId) {
            setView(updated);
			lastSuccessfulOffsetRef.current = updated.offsetMs;
            setState('ready');
        }
    }, []);

    const restoreAutomatic = useCallback(async () => {
        const songId = currentSongIdRef.current;
        if (!songId) return;
        const updated = convertLyricView(await Services.RestoreAutomaticLyric(songId));
        if (currentSongIdRef.current === songId) {
            setView(updated);
			lastSuccessfulOffsetRef.current = updated.offsetMs;
            setState(updated.document ? 'ready' : 'empty');
        }
    }, []);

	const cancelSearch = useCallback(() => {
		activeRequestRef.current = '';
		setError(null);
		setMessage('已停止等待自动获取结果');
		setState((current) => current === 'searching' ? (view?.document ? 'ready' : 'empty') : current);
	}, [view?.document]);

	const deleteLyric = useCallback(async () => {
		const songId = currentSongIdRef.current;
		if (!songId) return;
		const updated = convertLyricView(await Services.DeleteActiveLyric(songId));
		if (currentSongIdRef.current === songId) {
			setView(updated);
			lastSuccessfulOffsetRef.current = updated.offsetMs;
			setState('empty');
			setError(null);
			setMessage('歌词已移除，可手动重新获取');
		}
	}, []);

	const rejectCandidate = useCallback(async (documentId: string) => {
		const songId = currentSongIdRef.current;
		if (!songId) return;
		const updated = convertLyricView(await Services.RejectLyricCandidate(songId, documentId));
		if (currentSongIdRef.current === songId) {
			setView(updated);
			lastSuccessfulOffsetRef.current = updated.offsetMs;
			setState(updated.document ? 'ready' : 'empty');
			setError(null);
			setMessage(updated.document ? '已禁用错误的歌词结果' : '已禁用错误歌词，请手动导入正确歌词');
		}
	}, []);

	const actions = useMemo(() => ({
		search,
		cancelSearch,
		previewText,
		previewFile,
		importText,
		importFile,
		setOffset,
		applyCandidate,
			restoreAutomatic,
			deleteLyric,
			rejectCandidate,
		}), [search, cancelSearch, previewText, previewFile, importText, importFile, setOffset, applyCandidate, restoreAutomatic, deleteLyric, rejectCandidate]);

    return {
        view,
        state,
        error,
        message,
		actions,
    };
};
