import type { BVPreview, Song } from '../types';

export function selectRemotePagesForPreview(remotePages: Song[], preview: BVPreview): Song[] {
    if (!preview.singlePageOnly) return remotePages;

    const targetPage = preview.pageNumber;
    if (!Number.isInteger(targetPage) || (targetPage ?? 0) < 1) {
        throw new Error('分 P 页码无效');
    }

    const selectedPage = remotePages.find((song) => song.pageNumber === targetPage);
    if (!selectedPage) {
        throw new Error(`找不到分 P P${targetPage}`);
    }
    return [selectedPage];
}

export function getPagePlaybackInterval(
    isMultiPageBatch: boolean,
    requestedStart: number,
    requestedEnd: number,
    pageDuration: number,
): { start: number; end: number } {
    if (isMultiPageBatch) {
        return { start: 0, end: Math.max(0, pageDuration) };
    }
    return { start: requestedStart, end: requestedEnd };
}
