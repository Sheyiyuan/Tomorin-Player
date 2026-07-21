import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Services from '../../../wailsjs/go/services/Service';
import { models } from '../../../wailsjs/go/models';
import { convertFavoriteSongPage, type Song } from '../../types';

const PAGE_SIZE = 100;
const BULK_PAGE_SIZE = 200;
const MAX_CACHED_PAGES = 20;

interface CachedPage {
	items: Song[];
	total: number;
	revision: string;
	touchedAt: number;
}

interface PageDescriptor {
	favoriteId: string;
	query: string;
	revision: string;
	baseKey: string;
}

interface UseFavoriteSongPagesOptions {
	favoriteId?: string;
	favoriteRevision?: string;
	favoriteSongCount?: number;
	query: string;
	onSongsLoaded?: (songs: Song[]) => void;
}

const pageKey = (baseKey: string, offset: number): string => `${baseKey}\u0000${offset}`;

const applyLocalSongOverrides = (song: Song): Song => {
	try {
		const raw = window.localStorage.getItem(`half-beat.song.${song.id}`);
		if (!raw) return song;
		const cached = JSON.parse(raw) as { skipStartTime?: number; skipEndTime?: number };
		return {
			...song,
			skipStartTime: cached.skipStartTime ?? song.skipStartTime,
			skipEndTime: cached.skipEndTime ?? song.skipEndTime,
		};
	} catch {
		return song;
	}
};

export const useFavoriteSongPages = ({ favoriteId = '', favoriteRevision = '', favoriteSongCount = 0, query, onSongsLoaded }: UseFavoriteSongPagesOptions) => {
	const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
	const [total, setTotal] = useState(0);
	const [isInitialLoading, setIsInitialLoading] = useState(false);
	const [error, setError] = useState<string>();
	const [version, setVersion] = useState(0);
	const cacheRef = useRef(new Map<string, CachedPage>());
	const inflightRef = useRef(new Map<string, Promise<void>>());
	const generationRef = useRef(0);
	const touchCounterRef = useRef(0);
	const failedOffsetRef = useRef(0);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
		return () => window.clearTimeout(timer);
	}, [query]);

	const descriptor = useMemo<PageDescriptor>(() => ({
		favoriteId,
		query: debouncedQuery,
		revision: favoriteRevision,
		baseKey: `${favoriteId}\u0000${debouncedQuery}\u0000${favoriteRevision}`,
	}), [debouncedQuery, favoriteId, favoriteRevision]);
	const descriptorRef = useRef(descriptor);
	descriptorRef.current = descriptor;

	const trimCache = useCallback(() => {
		const cache = cacheRef.current;
		while (cache.size > MAX_CACHED_PAGES) {
			let oldestKey = '';
			let oldestTouch = Number.POSITIVE_INFINITY;
			for (const [key, page] of cache) {
				if (page.touchedAt < oldestTouch) {
					oldestKey = key;
					oldestTouch = page.touchedAt;
				}
			}
			if (!oldestKey) break;
			cache.delete(oldestKey);
		}
	}, []);

	const fetchPage = useCallback((target: PageDescriptor, offset: number, force = false): Promise<void> => {
		if (!target.favoriteId) return Promise.resolve();
		const normalizedOffset = Math.max(0, Math.floor(offset / PAGE_SIZE) * PAGE_SIZE);
		const key = pageKey(target.baseKey, normalizedOffset);
		const cached = cacheRef.current.get(key);
		if (cached && !force) {
			cached.touchedAt = ++touchCounterRef.current;
			if (descriptorRef.current.baseKey === target.baseKey) {
				setTotal(cached.total);
				setError(undefined);
				failedOffsetRef.current = 0;
			}
			return Promise.resolve();
		}
		const running = inflightRef.current.get(key);
		if (running) return running;
		const generation = generationRef.current;
		if (normalizedOffset === 0 && descriptorRef.current.baseKey === target.baseKey) setIsInitialLoading(true);
		const request = Services.ListFavoriteSongs(new models.FavoriteSongPageRequest({
			favoriteId: target.favoriteId,
			query: target.query,
			offset: normalizedOffset,
			limit: PAGE_SIZE,
		})).then((rawPage) => {
			const page = convertFavoriteSongPage(rawPage);
			const items = page.items.map(applyLocalSongOverrides);
			cacheRef.current.set(key, { items, total: page.total, revision: page.revision, touchedAt: ++touchCounterRef.current });
			trimCache();
			onSongsLoaded?.(items);
			if (generationRef.current !== generation || descriptorRef.current.baseKey !== target.baseKey) return;
			setTotal(page.total);
			setError(undefined);
			failedOffsetRef.current = 0;
			setVersion((current) => current + 1);
		}).catch((cause: unknown) => {
			if (generationRef.current !== generation || descriptorRef.current.baseKey !== target.baseKey) return;
			failedOffsetRef.current = normalizedOffset;
			setError(cause instanceof Error ? cause.message : String(cause));
		}).finally(() => {
			inflightRef.current.delete(key);
			if (generationRef.current === generation && descriptorRef.current.baseKey === target.baseKey && normalizedOffset === 0) {
				setIsInitialLoading(false);
			}
		});
		inflightRef.current.set(key, request);
		return request;
	}, [onSongsLoaded, trimCache]);

	useEffect(() => {
		generationRef.current += 1;
		failedOffsetRef.current = 0;
		setError(undefined);
		if (!descriptor.favoriteId) {
			setTotal(0);
			setIsInitialLoading(false);
			return;
		}
		const cached = cacheRef.current.get(pageKey(descriptor.baseKey, 0));
		setTotal(cached?.total ?? (descriptor.query === '' ? favoriteSongCount : 0));
		setIsInitialLoading(!cached);
		setVersion((current) => current + 1);
		void fetchPage(descriptor, 0);
	}, [descriptor, favoriteSongCount, fetchPage]);

	const loadRange = useCallback((startIndex: number, endIndex: number) => {
		if (!descriptor.favoriteId || endIndex < startIndex) return;
		const firstOffset = Math.floor(Math.max(0, startIndex) / PAGE_SIZE) * PAGE_SIZE;
		const lastOffset = Math.floor(Math.max(0, endIndex + 20) / PAGE_SIZE) * PAGE_SIZE;
		for (let offset = firstOffset; offset <= lastOffset && (total === 0 || offset < total); offset += PAGE_SIZE) {
			void fetchPage(descriptor, offset);
		}
	}, [descriptor, fetchPage, total]);

	const getSong = useCallback((index: number): Song | undefined => {
		// Changing this callback invalidates the memoized virtual list when a page arrives.
		void version;
		const offset = Math.floor(index / PAGE_SIZE) * PAGE_SIZE;
		const page = cacheRef.current.get(pageKey(descriptor.baseKey, offset));
		if (page) page.touchedAt = ++touchCounterRef.current;
		return page?.items[index - offset];
	}, [descriptor.baseKey, version]);

	const retry = useCallback(() => {
		setError(undefined);
		void fetchPage(descriptor, failedOffsetRef.current, true);
	}, [descriptor, fetchPage]);

	const patchSong = useCallback((updated: Song) => {
		let changed = false;
		for (const [key, page] of cacheRef.current) {
			let pageChanged = false;
			const items = page.items.map((song) => {
				if (song.id !== updated.id) return song;
				pageChanged = true;
				return updated;
			});
			if (pageChanged) {
				cacheRef.current.set(key, { ...page, items });
				changed = true;
			}
		}
		if (changed) setVersion((current) => current + 1);
	}, []);

	const loadAll = useCallback(async (targetFavoriteId = favoriteId): Promise<Song[]> => {
		if (!targetFavoriteId) return [];
		const all: Song[] = [];
		let offset = 0;
		let expectedTotal = Number.POSITIVE_INFINITY;
		while (offset < expectedTotal) {
			const rawPage = await Services.ListFavoriteSongs(new models.FavoriteSongPageRequest({ favoriteId: targetFavoriteId, query: '', offset, limit: BULK_PAGE_SIZE }));
			const page = convertFavoriteSongPage(rawPage);
			const items = page.items.map(applyLocalSongOverrides);
			onSongsLoaded?.(items);
			all.push(...items);
			expectedTotal = page.total;
			if (items.length === 0) break;
			offset += items.length;
			await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
		}
		return all;
	}, [favoriteId, onSongsLoaded]);

	return { total, getSong, loadRange, loadAll, patchSong, isInitialLoading, error, retry, debouncedQuery };
};
