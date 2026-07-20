import React, { useCallback } from "react";
import { convertFavorites, Favorite, type Song, type BVPreview, toFavoriteModel } from "../../types";
import { notifications } from "@mantine/notifications";
import * as Services from "../../../wailsjs/go/services/Service";
import { loadBackgroundFile } from "../../utils/image";
import type { ModalName } from "../../context/types/contexts";
import type { useThemeEditor } from "../features/useThemeEditor";
import type { useFavoriteActions } from "../features/useFavoriteActions";
import type { useSkipIntervalHandler } from "../player/useSkipIntervalHandler";
import type { useDownloadManager } from "../player/useDownloadManager";
import type { usePlaylistActions } from "../player/usePlaylistActions";
import type { useSearchAndBV } from "../features/useSearchAndBV";
import type { useBVModal } from "../features/useBVModal";
import { parseDomainError } from "../../utils/domainError";

/**
 * useAppHandlers: 聚合应用级别的事件处理函数
 * 大幅减少 App.tsx 中的 handler 定义数量
 */
export const useAppHandlers = (config: {
    // 主题编辑器
    themeEditor: ReturnType<typeof useThemeEditor>;

    // 收藏夹操作
    favoriteActions: ReturnType<typeof useFavoriteActions>;
    editingFavId: string | null;
    editingFavName: string;
    setEditingFavId: (id: string | null) => void;
    setEditingFavName: (name: string) => void;
    createFavName: string;
    setCreateFavName: (name: string) => void;
    createFavMode: "blank" | "duplicate" | "importMine" | "importFid";
    setCreateFavMode: (mode: "blank" | "duplicate" | "importMine" | "importFid") => void;
    duplicateSourceId: string | null;
    setDuplicateSourceId: (id: string | null) => void;
    importFid: string;
    setImportFid: (fid: string) => void;
	keepImportedFavoriteSynced: boolean;
	setKeepImportedFavoriteSynced: (value: boolean) => void;
    openModal: (name: ModalName) => void;
    setConfirmDeleteFavId: (id: string | null) => void;

    // 跳过区间处理
    skipIntervalHandler: ReturnType<typeof useSkipIntervalHandler>;

    // 播放模式
    playMode: "loop" | "random" | "single";
    setPlayMode: (mode: "loop" | "random" | "single") => void;

    // 下载管理
    downloadManager: ReturnType<typeof useDownloadManager>;
    setConfirmDeleteDownloaded: (confirm: boolean) => void;
    setManagingSong: (song: Song | null) => void;
    closeModal: (name: ModalName) => void;

    // 播放列表动作
    playlistActions: ReturnType<typeof usePlaylistActions>;

    // 搜索与 BV
    searchAndBV: ReturnType<typeof useSearchAndBV>;
    newFavName: string;
    setNewFavName: (name: string) => void;
    setFavorites: (favorites: Favorite[]) => void;
    setBvTargetFavId: (id: string | null) => void;
    bvPreview: BVPreview | null;
    sliceStart: number;
    sliceEnd: number;
    setSliceStart: (start: number) => void;
    setSliceEnd: (end: number) => void;

    // 设置相关
    setCacheSize: (size: number) => void;

    // BV 模态
    bvModal: ReturnType<typeof useBVModal>;
}) => {
    const {
        themeEditor,
        favoriteActions,
        editingFavId,
        editingFavName,
        setEditingFavId,
        setEditingFavName,
        createFavName,
        setCreateFavName,
        createFavMode,
        setCreateFavMode,
        duplicateSourceId,
        setDuplicateSourceId,
        importFid,
        setImportFid,
		keepImportedFavoriteSynced,
		setKeepImportedFavoriteSynced,
        openModal,
        setConfirmDeleteFavId,
        skipIntervalHandler,
        playMode,
        setPlayMode,
        downloadManager,
        setConfirmDeleteDownloaded,
        setManagingSong,
        closeModal,
        playlistActions,
        searchAndBV,
        newFavName,
        setNewFavName,
        setFavorites,
        setBvTargetFavId,
        bvPreview,
        sliceStart,
        sliceEnd,
        setSliceStart,
        setSliceEnd,
        setCacheSize,
        bvModal,
    } = config;
	const {
		deleteFavorite,
		editFavorite,
		saveEditFavorite,
		createFavorite: createFavoriteAction,
		myFavoriteImport,
	} = favoriteActions;

    // ========== 主题处理 ==========
    const handleSelectTheme = themeEditor.selectTheme;
    const handleViewTheme = themeEditor.viewTheme;
    const handleEditTheme = themeEditor.editTheme;
    const handleDeleteTheme = themeEditor.deleteTheme;
    const handleCreateThemeClick = themeEditor.createThemeClick;
    const handleSubmitTheme = () => themeEditor.submitTheme();
    const handleCloseThemeEditor = themeEditor.closeThemeEditor;
    const handleClearBackgroundImageDraft = () => themeEditor.draftActions.updateField("backgroundImageUrl", "");
    const handleBackgroundFileDraft = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const dataUrl = await loadBackgroundFile(e);
        if (!dataUrl) return;
        themeEditor.draftActions.updateField("backgroundImageUrl", dataUrl);
    };

    // ========== 收藏夹处理 ==========
	const handleDeleteFavorite = useCallback((id: string) =>
		deleteFavorite(id, setConfirmDeleteFavId), [deleteFavorite, setConfirmDeleteFavId]);
	const handleEditFavorite = useCallback((fav: Favorite) =>
		editFavorite(fav, setEditingFavId, setEditingFavName), [editFavorite, setEditingFavId, setEditingFavName]);
	const handleSaveEditFavorite = useCallback(() =>
		saveEditFavorite(editingFavId, editingFavName), [saveEditFavorite, editingFavId, editingFavName]);
	const handleSubmitCreateFavorite = useCallback(() =>
		createFavoriteAction({
            name: createFavName,
            mode: createFavMode,
            duplicateSourceId,
            importFid,
			selectedMyFavId: myFavoriteImport.selectedCollectionId,
			keepSynced: keepImportedFavoriteSynced,
		}), [createFavName, createFavMode, duplicateSourceId, importFid, createFavoriteAction, myFavoriteImport.selectedCollectionId, keepImportedFavoriteSynced]);

	const createFavorite = useCallback(() => {
        setCreateFavName("新歌单");
        setCreateFavMode("blank");
        setDuplicateSourceId(null);
        setImportFid("");
		setKeepImportedFavoriteSynced(true);
        openModal("createFavModal");
    }, [setCreateFavName, setCreateFavMode, setDuplicateSourceId, setImportFid, setKeepImportedFavoriteSynced, openModal]);

    // ========== 播放区间处理 ==========
    const handleIntervalChange = skipIntervalHandler.handleIntervalChange;
    const handleSkipStartChange = skipIntervalHandler.handleSkipStartChange;
    const handleSkipEndChange = skipIntervalHandler.handleSkipEndChange;

    // ========== 播放模式 ==========
	const handlePlayModeToggle = useCallback(() => {
        const newMode =
            playMode === "loop" ? "random" : playMode === "random" ? "single" : "loop";
        setPlayMode(newMode);
    }, [playMode, setPlayMode]);

    // ========== 下载管理 ==========
    const handleDownload = downloadManager.handleDownload;
    const handleDownloadCurrentSong = downloadManager.handleDownloadCurrentSong;
    const handleManageDownload = downloadManager.handleManageDownload;
    const handleDownloadSong = downloadManager.handleDownloadSong;
    const handleDownloadAllFavorite = downloadManager.handleDownloadAllFavorite;
    const handleOpenDownloadedFile = downloadManager.handleOpenDownloadedFile;
    const handleDeleteDownloadedFile = downloadManager.handleDeleteDownloadedFile;

    const handleDownloadModalClose = () => {
        closeModal("downloadManagerModal");
        setConfirmDeleteDownloaded(false);
        setManagingSong(null);
    };

    // ========== 播放列表处理 ==========
    const handleAddSongToFavorite = playlistActions.addSongToFavoriteFromList;
    const handleAddCurrentSongToFavorite = playlistActions.addCurrentSongToFavorite;
    const handleRemoveSongFromPlaylist = playlistActions.removeSongFromPlaylist;
    const handleAddToFavoriteFromModal = playlistActions.addToFavoriteFromModal;
    const handlePlaylistSelect = playlistActions.playlistSelect;
    const handlePlaylistReorder = playlistActions.playlistReorder;
    const handlePlaylistRemove = playlistActions.playlistRemove;

    // ========== 搜索与 BV ==========
    const handleSearchResultClick = searchAndBV.searchResultClick;
    const handleRemoteSearch = searchAndBV.remoteSearch;
    const handleAddFromRemote = searchAndBV.addFromRemote;
    const handleAddSingleRemotePage = searchAndBV.addSingleRemotePage;
    const handleResolveBVAndAdd = searchAndBV.resolveBVAndAdd;
    const handleLoadRemotePages = searchAndBV.loadRemotePages;

    // ========== BV 切片处理 ==========
    const handleSliceRangeChange = (startVal: number, endVal: number) => {
        const limit =
            bvPreview?.duration && bvPreview.duration > 0
                ? bvPreview.duration
                : Math.max(endVal, startVal);
        const roundedStart = Math.round(startVal * 20) / 20;
        const roundedEnd = Math.round(endVal * 20) / 20;
        const safeStart = Math.max(0, Math.min(roundedStart, roundedEnd, limit));
        const safeEnd = Math.max(safeStart, Math.min(roundedEnd, limit));
        setSliceStart(safeStart);
        setSliceEnd(safeEnd);
    };

    const handleSliceStartChange = (value: number | string) => {
        const v = Math.round((Number(value) || 0) * 20) / 20;
        const limit =
            bvPreview?.duration && bvPreview.duration > 0
                ? bvPreview.duration
                : Math.max(sliceEnd, v);
        const safeStart = Math.max(0, Math.min(v, limit));
        const safeEnd = Math.max(safeStart, Math.min(sliceEnd, limit));
        setSliceStart(safeStart);
        setSliceEnd(safeEnd);
    };

    const handleSliceEndChange = (value: number | string) => {
        const v = Math.round((Number(value) || 0) * 20) / 20;
        const limit =
            bvPreview?.duration && bvPreview.duration > 0
                ? bvPreview.duration
                : Math.max(v, sliceStart);
        const safeEnd = Math.max(sliceStart, Math.min(v, limit));
        setSliceEnd(safeEnd);
    };

    const handleCreateFavoriteInModal = async () => {
        const name = newFavName.trim();
        if (!name) return;
        try {
            await Services.SaveFavorite(toFavoriteModel({
                id: "",
                title: name,
                songIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }));
            const refreshedFavs = await Services.ListFavorites();
            setFavorites(convertFavorites(refreshedFavs));
            const targetId =
                refreshedFavs.find((f) => f.title === name)?.id ||
                refreshedFavs[refreshedFavs.length - 1]?.id ||
                null;
            setBvTargetFavId(targetId);
            notifications.show({
                title: "已创建歌单",
                message: name,
                color: "green",
            });
            setNewFavName("");
        } catch (error) {
            notifications.show({
                title: "创建歌单失败",
                message: parseDomainError(error).message,
                color: "red",
            });
        }
    };

    // ========== 设置弹窗 ==========

    const handleOpenDownloadsFolder = async () => {
        try {
            await Services.OpenDownloadsFolder();
        } catch (e: unknown) {
            notifications.show({
                title: "打开失败",
                message: parseDomainError(e).message,
                color: "red",
            });
        }
    };

    const handleOpenDatabaseFile = async () => {
        try {
            await Services.OpenDatabaseFile();
        } catch (e: unknown) {
            notifications.show({
                title: "打开失败",
                message: parseDomainError(e).message,
                color: "red",
            });
        }
    };

    const handleClearMusicCache = async () => {
        try {
            await Services.ClearAudioCache();
            const size = await Services.GetAudioCacheSize();
            setCacheSize(size);
            notifications.show({
                title: "已清除音乐缓存",
                message: "已删除所有离线音乐文件",
                color: "green",
            });
        } catch (e) {
            notifications.show({
                title: "清除缓存失败",
                message: parseDomainError(e).message,
                color: "red",
            });
        }
    };

    // ========== BV 模态 ==========
    const handleConfirmBVAdd = bvModal.handleConfirmBVAdd;

    return {
        // 主题
        handleSelectTheme,
        handleViewTheme,
        handleEditTheme,
        handleDeleteTheme,
        handleCreateThemeClick,
        handleSubmitTheme,
        handleCloseThemeEditor,
        handleClearBackgroundImageDraft,
        handleBackgroundFileDraft,
        // 收藏夹
        handleDeleteFavorite,
        handleEditFavorite,
        handleSaveEditFavorite,
        handleSubmitCreateFavorite,
        createFavorite,
        // 播放区间
        handleIntervalChange,
        handleSkipStartChange,
        handleSkipEndChange,
        // 播放模式
        handlePlayModeToggle,
        // 下载
        handleDownload,
        handleDownloadCurrentSong,
        handleManageDownload,
        handleDownloadSong,
        handleDownloadAllFavorite,
        handleOpenDownloadedFile,
        handleDeleteDownloadedFile,
        handleDownloadModalClose,
        // 播放列表
        handleAddSongToFavorite,
        handleAddCurrentSongToFavorite,
        handleRemoveSongFromPlaylist,
        handleAddToFavoriteFromModal,
        handlePlaylistSelect,
        handlePlaylistReorder,
        handlePlaylistRemove,
        // 搜索与 BV
        handleSearchResultClick,
        handleRemoteSearch,
        handleAddFromRemote,
        handleAddSingleRemotePage,
        handleResolveBVAndAdd,
        handleLoadRemotePages,
        // BV 切片
        handleSliceRangeChange,
        handleSliceStartChange,
        handleSliceEndChange,
        handleCreateFavoriteInModal,
        // 设置
        handleOpenDownloadsFolder,
        handleOpenDatabaseFile,
        handleClearMusicCache,
        // BV 模态
        handleConfirmBVAdd,
    };
};
