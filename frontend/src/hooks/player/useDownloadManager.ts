import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import * as Services from '../../../wailsjs/go/services/Service';
import { Song, Favorite, favoriteSongCount } from '../../types';
import type { ModalName } from '../../context/types/contexts';

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

interface UseDownloadManagerProps {
    currentSong: Song | null;
	loadFavoriteSongs: (favoriteId: string) => Promise<Song[]>;
    downloadedSongIds: Set<string>;
    managingSong: Song | null;
    setStatus: (status: string) => void;
    setDownloadedSongIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    setManagingSong: (song: Song | null) => void;
    setConfirmDeleteDownloaded: (confirm: boolean) => void;
    openModal: (name: ModalName) => void;
    closeModal: (name: ModalName) => void;
}

export const useDownloadManager = ({
    currentSong,
	loadFavoriteSongs,
    downloadedSongIds,
    managingSong,
    setStatus,
    setDownloadedSongIds,
    setManagingSong,
    setConfirmDeleteDownloaded,
    openModal,
    closeModal,
}: UseDownloadManagerProps) => {

    const handleManageDownload = useCallback(() => {
        if (!currentSong) {
            notifications.show({ title: '无法操作', message: '未选择歌曲', color: 'red' });
            return;
        }
        setManagingSong(currentSong);
        setConfirmDeleteDownloaded(false);
        openModal("downloadManagerModal");
    }, [currentSong, setManagingSong, setConfirmDeleteDownloaded, openModal]);

    const handleDownloadSong = useCallback(async (song: Song) => {
        if (!song) {
            notifications.show({ title: '无法操作', message: '未选择歌曲', color: 'red' });
            return;
        }
        const isAlreadyDownloaded = downloadedSongIds.has(song.id);
        if (isAlreadyDownloaded) {
            setManagingSong(song);
            setConfirmDeleteDownloaded(false);
            openModal("downloadManagerModal");
            return;
        }
        try {
            setStatus(`正在下载: ${song.name}`);
            const savedPath = await Services.DownloadSong(song.id);
            notifications.show({ title: '下载完成', message: `已保存到: ${savedPath}`, color: 'green' });
            setStatus('下载完成');
            setDownloadedSongIds(prev => new Set([...prev, song.id]));
        } catch (e: unknown) {
            const msg = getErrorMessage(e);
            notifications.show({ title: '下载失败', message: msg, color: 'red' });
            setStatus(`下载失败: ${msg}`);
        }
    }, [downloadedSongIds, setStatus, setDownloadedSongIds, setManagingSong, setConfirmDeleteDownloaded, openModal]);

    const handleDownload = useCallback(async () => {
        if (!currentSong) {
            notifications.show({ title: '无法操作', message: '未选择歌曲', color: 'red' });
            return;
        }
        if (downloadedSongIds.has(currentSong.id)) {
            setManagingSong(currentSong);
            setConfirmDeleteDownloaded(false);
            openModal("downloadManagerModal");
            return;
        }
        await handleDownloadSong(currentSong);
    }, [currentSong, downloadedSongIds, handleDownloadSong, openModal, setConfirmDeleteDownloaded, setManagingSong]);

    const handleDownloadCurrentSong = useCallback(async () => {
        if (!currentSong) {
            notifications.show({ title: '无法操作', message: '未选择歌曲', color: 'red' });
            return;
        }
        await handleDownloadSong(currentSong);
    }, [currentSong, handleDownloadSong]);

    const handleDownloadAllFavorite = useCallback(async (fav: Favorite) => {
		if (!fav || favoriteSongCount(fav) === 0) {
            notifications.show({ title: '无法操作', message: '歌单为空', color: 'red' });
            return;
        }
		const favoriteSongs = await loadFavoriteSongs(fav.id);
		const songsToDownload = favoriteSongs.filter(s => !downloadedSongIds.has(s.id));
        if (songsToDownload.length === 0) {
            notifications.show({ title: '提示', message: '所有歌曲都已下载', color: 'blue' });
            return;
        }
        setStatus(`开始批量下载 ${songsToDownload.length} 首歌曲...`);
        let successCount = 0;
        let failCount = 0;
        for (const song of songsToDownload) {
            try {
                setStatus(`正在下载: ${song.name} (${successCount + failCount + 1}/${songsToDownload.length})`);
                await Services.DownloadSong(song.id);
                setDownloadedSongIds(prev => new Set([...prev, song.id]));
                successCount++;
            } catch (e: unknown) {
                failCount++;
                console.error(`下载失败: ${song.name}`, e);
            }
        }
        setStatus(`下载完成: 成功 ${successCount} 首，失败 ${failCount} 首`);
        notifications.show({
            title: '批量下载完成',
            message: `成功 ${successCount} 首，失败 ${failCount} 首`,
            color: failCount === 0 ? 'green' : 'yellow',
        });
    }, [loadFavoriteSongs, downloadedSongIds, setStatus, setDownloadedSongIds]);

    const handleOpenDownloadedFile = useCallback(async () => {
        if (!managingSong) return;
        try {
            await Services.OpenDownloadedFile(managingSong.id);
        } catch (e: unknown) {
            notifications.show({ title: '打开失败', message: getErrorMessage(e), color: 'red' });
        }
    }, [managingSong]);

    const handleDeleteDownloadedFile = useCallback(async () => {
        if (!managingSong) return;
        try {
            await Services.DeleteDownloadedSong(managingSong.id);
            setDownloadedSongIds(prev => {
                const next = new Set(prev);
                next.delete(managingSong.id);
                return next;
            });
            closeModal("downloadManagerModal");
            setConfirmDeleteDownloaded(false);
            setManagingSong(null);
            notifications.show({ title: '已删除下载文件', message: '成功', color: 'green' });
        } catch (e: unknown) {
            notifications.show({ title: '删除失败', message: getErrorMessage(e), color: 'red' });
        }
    }, [managingSong, setDownloadedSongIds, closeModal, setConfirmDeleteDownloaded, setManagingSong]);

    return {
        handleDownload,
        handleDownloadCurrentSong,
        handleManageDownload,
        handleDownloadSong,
        handleDownloadAllFavorite,
        handleOpenDownloadedFile,
        handleDeleteDownloadedFile,
    };
};
