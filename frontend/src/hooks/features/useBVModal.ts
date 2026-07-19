import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { Song, Favorite, convertSong, convertSongs, convertFavorites, toFavoriteModel, toSongModels, type BVPreview } from '../../types';
import { SongClass } from '../../types';
import { getPagePlaybackInterval, selectRemotePagesForPreview } from '../../utils/bv';

interface UseBVModalProps {
    bvPreview: BVPreview | null;
    sliceStart: number;
    sliceEnd: number;
    bvSongName: string;
    bvSinger: string;
    bvTargetFavId: string | null;
    favorites: Favorite[];
    closeBvModal: () => void;
    setBvPreview: (preview: BVPreview | null) => void;
    setBvSongName: (name: string) => void;
    setBvSinger: (singer: string) => void;
    setSliceStart: (start: number) => void;
    setSliceEnd: (end: number) => void;
    setSongs: (songs: Song[]) => void;
    setFavorites: (favorites: Favorite[]) => void;
    setSelectedFavId: (id: string | null) => void;
}

export const useBVModal = ({
    bvPreview,
    sliceStart,
    sliceEnd,
    bvSongName,
    bvSinger,
    bvTargetFavId,
    favorites,
    closeBvModal,
    setBvPreview,
    setBvSongName,
    setBvSinger,
    setSliceStart,
    setSliceEnd,
    setSongs,
    setFavorites,
    setSelectedFavId,
}: UseBVModalProps) => {

    const handleConfirmBVAdd = useCallback(async () => {
        if (!bvPreview) return;
        const targetFavId = bvTargetFavId || favorites[0]?.id || null;
        const start = Math.max(0, sliceStart);
        const songDuration = bvPreview.duration || 0;
        const end = sliceEnd > 0 ? Math.max(start, sliceEnd) : songDuration;

        try {
            // 1. 获取分P信息（多P将拆分为多首）
            let pagesToAdd: Song[] = [];
            let remoteLookupCompleted = false;
            try {
                const rawPages = await Services.SearchBVID(bvPreview.bvid || '');
                const converted = convertSongs(rawPages || []);
                const remotePages = converted.filter((s) => !s.id || s.id.trim() === '');
                remoteLookupCompleted = true;
                pagesToAdd = selectRemotePagesForPreview(remotePages, bvPreview);
            } catch (err) {
                if (remoteLookupCompleted) throw err;
                console.warn('获取分P信息失败，回退为单首添加:', err);
            }

            if (pagesToAdd.length === 0) {
                if (bvPreview.singlePageOnly && (!Number.isInteger(bvPreview.pageNumber) || (bvPreview.pageNumber ?? 0) < 1)) {
                    throw new Error('分 P 页码无效');
                }
                pagesToAdd = [{
                    id: '',
                    bvid: bvPreview.bvid || '',
                    name: bvSongName || bvPreview.title || '',
                    singer: bvSinger || '',
                    singerId: '',
                    cover: bvPreview.cover || '',
                    coverLocal: '',
                    sourceId: '',
                    streamUrl: '',
                    streamUrlExpiresAt: '',
                    lyric: '',
                    lyricOffset: 0,
                    skipStartTime: start,
                    skipEndTime: end,
                    pageNumber: bvPreview.pageNumber || 1,
                    pageTitle: bvPreview.pageTitle || '',
                    videoTitle: bvPreview.title || '',
                    totalPages: bvPreview.singlePageOnly ? 1 : 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                } as Song];
            }

            // 2. 为每个分P创建独立流源与歌曲实例
            const newSongs: Song[] = [];
            const createdSourceIds: string[] = [];
            const isMultiPageBatch = pagesToAdd.length > 1 && !bvPreview.singlePageOnly;

            for (const page of pagesToAdd) {
                const pageNumber = page.pageNumber > 0 ? page.pageNumber : 1;
                const playInfo = await Services.GetPlayURL(page.bvid || bvPreview.bvid || '', pageNumber);
                const sourceId = await Services.CreateStreamSource(
                    page.bvid || bvPreview.bvid || '',
                    playInfo.RawURL,
                    playInfo.ExpiresAt
                );
                createdSourceIds.push(sourceId);
                const pageInterval = getPagePlaybackInterval(
                    isMultiPageBatch,
                    start,
                    end,
                    Number(playInfo.Duration) || 0,
                );

                const displayName = pagesToAdd.length > 1 && !bvPreview.singlePageOnly
                    ? (page.name || bvPreview.title || '')
                    : (bvSongName || page.name || bvPreview.title || '');

                newSongs.push(convertSong(new SongClass({
                    id: '',
                    bvid: page.bvid || bvPreview.bvid || '',
                    name: displayName,
                    singer: bvSinger || page.singer || '',
                    singerId: '',
                    cover: page.cover || bvPreview.cover || '',
                    sourceId: sourceId,
                    lyric: '',
                    lyricOffset: 0,
                    skipStartTime: pageInterval.start,
                    skipEndTime: pageInterval.end,
                    pageNumber: page.pageNumber || 1,
                    pageTitle: page.pageTitle || '',
                    videoTitle: page.videoTitle || bvPreview.title || '',
                    totalPages: page.totalPages || pagesToAdd.length || 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })));
            }

            try {
                await Services.UpsertSongs(toSongModels(newSongs));
            } catch (err) {
                throw new Error(`保存歌曲失败: ${err instanceof Error ? err.message : String(err)}`);
            }

            let refreshed: Song[] = [];
            try {
                const data = await Services.ListSongs();
                refreshed = convertSongs(data);
            } catch (err) {
                throw new Error(`获取歌曲列表失败: ${err instanceof Error ? err.message : String(err)}`);
            }

            setSongs(refreshed);

            // 每个流源只对应本次创建的一首歌曲。
            const sourceIdSet = new Set(createdSourceIds);
            const addedSongs = refreshed.filter((s) => sourceIdSet.has(s.sourceId));

            if (addedSongs.length > 0 && targetFavId) {
                const fav = favorites.find((f) => f.id === targetFavId);
                if (fav) {
                    const updatedFav = {
                        ...fav,
                        songIds: [...fav.songIds, ...addedSongs.map((s) => ({ id: 0, songId: s.id, favoriteId: fav.id }))],
                    };
                    try {
                        await Services.SaveFavorite(toFavoriteModel(updatedFav));
                    } catch (err) {
                        throw new Error(`保存歌单失败: ${err instanceof Error ? err.message : String(err)}`);
                    }

                    let refreshedFavs: typeof favorites = [];
                    try {
                        const raw = await Services.ListFavorites();
                        refreshedFavs = convertFavorites(raw);
                    } catch (err) {
                        throw new Error(`获取歌单列表失败: ${err instanceof Error ? err.message : String(err)}`);
                    }

                    setFavorites(refreshedFavs);
                    setSelectedFavId(fav.id);
                }
            }

            const addedCount = newSongs.length;
            notifications.show({
                title: '添加成功',
                message: `${addedCount} 首歌曲已加入${targetFavId ? '' : '库'}${targetFavId ? '。' : ''}`,
                color: 'teal',
            });

            closeBvModal();
            setBvPreview(null);
            setBvSongName('');
            setBvSinger('');
            setSliceStart(0);
            setSliceEnd(0);
        } catch (err) {
            console.error('BV 添加失败:', err);
            notifications.show({
                title: '保存失败',
                message: err instanceof Error ? err.message : '未知错误',
                color: 'red',
            });
        }
    }, [bvPreview, bvTargetFavId, sliceStart, sliceEnd, bvSongName, bvSinger, favorites, setSongs, setFavorites, setSelectedFavId, closeBvModal, setBvPreview, setBvSongName, setBvSinger, setSliceStart, setSliceEnd]);

    return {
        handleConfirmBVAdd,
    };
};
