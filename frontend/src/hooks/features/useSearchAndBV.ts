import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { Song, Favorite } from '../../types';

interface UseSearchAndBVProps {
    themeColor: string;
    selectedFavId: string | null;
    favorites: Favorite[];
    globalSearchTerm: string;
    setGlobalSearchTerm: (term: string) => void;
    setRemoteResults: (results: Song[]) => void;
    setRemoteLoading: (loading: boolean) => void;
    setBvPreview: (preview: any) => void;
    setBvSongName: (name: string) => void;
    setBvSinger: (singer: string) => void;
    setBvTargetFavId: (id: string | null) => void;
    setBvModalOpen: (open: boolean) => void;
    setResolvingBV: (resolving: boolean) => void;
    setIsLoggedIn: (logged: boolean) => void;
    playSingleSong: (song: Song) => void;
    playFavorite: (fav: Favorite) => void;
    setSelectedFavId: (id: string | null) => void;
    openModal: (name: string) => void;
    closeModal: (name: string) => void;
}

type GlobalSearchResult = { kind: "song"; song: Song } | { kind: "favorite"; favorite: Favorite };

export const useSearchAndBV = ({
    themeColor,
    selectedFavId,
    favorites,
    globalSearchTerm,
    setGlobalSearchTerm,
    setRemoteResults,
    setRemoteLoading,
    setBvPreview,
    setBvSongName,
    setBvSinger,
    setBvTargetFavId,
    setBvModalOpen,
    setResolvingBV,
    setIsLoggedIn,
    playSingleSong,
    playFavorite,
    setSelectedFavId,
    openModal,
    closeModal,
}: UseSearchAndBVProps) => {

    const searchResultClick = useCallback((result: GlobalSearchResult) => {
        if (result.kind === "song") {
            playSingleSong(result.song);
        } else {
            setSelectedFavId(result.favorite.id);
            playFavorite(result.favorite);
        }
        closeModal("globalSearchModal");
    }, [playSingleSong, playFavorite, setSelectedFavId, closeModal]);

    const remoteSearch = useCallback(async () => {
        const term = globalSearchTerm.trim();
        if (!term) return;

        // Skip if it's a BV or URL -> 走解析
        const bvPattern = /BV[0-9A-Za-z]{10}/;
        if (bvPattern.test(term) || term.includes('bilibili.com')) {
            // Let resolveBVAndAdd handle it
            return;
        }

        setRemoteLoading(true);
        try {
            const list = await Services.SearchBiliVideos(term, 1, 10);
            setRemoteResults(list);
        } catch (e) {
            notifications.show({
                title: '搜索失败',
                message: e instanceof Error ? e.message : '未知错误',
                color: 'red'
            });
        } finally {
            setRemoteLoading(false);
        }
    }, [globalSearchTerm, setRemoteResults, setRemoteLoading]);

    const addFromRemote = useCallback(async (item: Song) => {
        setGlobalSearchTerm(item.bvid || item.name || '');
    }, [setGlobalSearchTerm]);

    const resolveBVAndAdd = useCallback(async () => {
        const term = globalSearchTerm.trim();
        if (!term) return;

        // Check if input looks like a BV ID or URL
        const bvPattern = /BV[0-9A-Za-z]{10}/;
        if (!bvPattern.test(term) && !term.includes('bilibili.com')) {
            notifications.show({
                title: '输入格式错误',
                message: '请输入有效的 BV 号或 B站链接',
                color: 'orange',
            });
            return;
        }

        setResolvingBV(true);
        const toastId = notifications.show({
            title: '正在解析视频',
            message: '请稍候...',
            color: themeColor,
            loading: true,
            autoClose: false,
        });

        try {
            // Check if logged in
            const loggedIn = await Services.IsLoggedIn();
            setIsLoggedIn(loggedIn);
            if (!loggedIn) {
                notifications.update({
                    id: toastId,
                    title: '需要登录',
                    message: '请先通过扫码登录',
                    color: 'blue',
                    loading: false,
                    autoClose: 3000,
                });
                openModal("loginModal");
                setGlobalSearchTerm('');
                return;
            }

            const audioInfo = await Services.ResolveBiliAudio(term);
            const bvid = term.match(bvPattern)?.[0] || '';

            setBvPreview({
                bvid,
                title: audioInfo.title || '未命名视频',
                cover: audioInfo.cover || '',
                url: audioInfo.url,
                expiresAt: audioInfo.expiresAt as any,
                duration: (audioInfo as any).duration || 0,
            });
            setBvSongName(audioInfo.title || '未命名视频');
            setBvSinger(((audioInfo as any).author || '').replace(/\s+/g, ' ').trim());
            setBvTargetFavId(selectedFavId || favorites[0]?.id || null);
            setBvModalOpen(true);

            notifications.update({
                id: toastId,
                title: '已解析',
                message: '请选择歌单并编辑歌曲信息后确认',
                color: 'teal',
                loading: false,
                autoClose: 3000,
            });

            closeModal("globalSearchModal");
        } catch (err) {
            notifications.update({
                id: toastId,
                title: '解析失败',
                message: err instanceof Error ? err.message : '未知错误',
                color: 'red',
                loading: false,
                autoClose: 4000,
            });
        } finally {
            setResolvingBV(false);
        }
    }, [globalSearchTerm, themeColor, selectedFavId, favorites, setGlobalSearchTerm, setRemoteLoading, setBvPreview, setBvSongName, setBvSinger, setBvTargetFavId, setBvModalOpen, setResolvingBV, setIsLoggedIn, openModal, closeModal]);

    return {
        searchResultClick,
        remoteSearch,
        addFromRemote,
        resolveBVAndAdd,
    };
};
