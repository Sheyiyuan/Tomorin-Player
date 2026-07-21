import { describe, expect, it } from 'vitest';
import type { BVPreview, Song } from '../types';
import { getPagePlaybackInterval, selectRemotePagesForPreview } from './bv';

const page = (pageNumber: number): Song => ({
    id: '',
    bvid: 'BV1xx411c7mD',
    name: `Page ${pageNumber}`,
    singer: '',
    singerId: '',
    cover: '',
    coverLocal: '',
    sourceId: '',
    streamUrl: '',
    streamUrlExpiresAt: '',
    lyric: '',
    lyricOffset: 0,
    skipStartTime: 0,
    skipEndTime: 0,
    pageNumber,
    pageTitle: '',
    videoTitle: '',
    totalPages: 2,
    createdAt: '',
    updatedAt: '',
});

describe('getPagePlaybackInterval', () => {
    it('uses each page duration for a multi-page batch', () => {
        expect(getPagePlaybackInterval(true, 10, 60, 185)).toEqual({ start: 0, end: 185 });
    });

    it('keeps the requested slice for a single page', () => {
        expect(getPagePlaybackInterval(false, 10, 60, 185)).toEqual({ start: 10, end: 60 });
    });
});

const preview = (pageNumber?: number): BVPreview => ({
    bvid: 'BV1xx411c7mD',
    title: 'Video',
    cover: '',
    duration: 0,
    pageNumber,
    singlePageOnly: true,
});

describe('selectRemotePagesForPreview', () => {
    it('selects only the explicitly requested page', () => {
        const pages = [page(1), page(2)];
        expect(selectRemotePagesForPreview(pages, preview(2))).toEqual([pages[1]]);
    });

    it('rejects invalid and missing pages instead of falling back to P1', () => {
        expect(() => selectRemotePagesForPreview([page(1)], preview(0))).toThrow('分 P 页码无效');
        expect(() => selectRemotePagesForPreview([page(1)], preview(2))).toThrow('找不到分 P P2');
    });
});
