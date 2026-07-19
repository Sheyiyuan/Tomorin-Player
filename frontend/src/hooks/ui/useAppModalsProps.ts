import type React from "react";
import type { AppModalsProps } from "../../components/AppModalsOptimized";
import type { ModalName, ModalState } from "../../context/types/contexts";
import type { Favorite, Song, Theme, DerivedStyles } from "../../types";
import { APP_VERSION } from "../../utils/constants";
import type { useFavoriteActions } from "../features/useFavoriteActions";
import type { useBVResolver } from "../features/useBVResolver";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppSearchState } from "./useAppSearchState";
import type { useFavoritesManager } from "./useFavoritesManager";
import type { useThemeEditor } from "../features/useThemeEditor";

type GlobalSearchResult = AppModalsProps["globalSearch"]["globalSearchResults"][number];

interface UseAppModalsPropsParams {
    modals: ModalState;
    closeModal: (name: ModalName) => void;
    themes: Theme[];
    currentThemeId: string | null;
    themeColor: string;
    themeColorLight: string;
    themeEditor: ReturnType<typeof useThemeEditor>;
    favoritesState: ReturnType<typeof useFavoritesManager>;
    searchState: ReturnType<typeof useAppSearchState>;
    bvResolver: ReturnType<typeof useBVResolver>;
    handlers: ReturnType<typeof useAppHandlers>;
    myFavoriteImport: ReturnType<typeof useFavoriteActions>["myFavoriteImport"];
    favorites: Favorite[];
    queue: Song[];
    currentIndex: number;
    currentSong: Song | null;
    pendingFavoriteSong: Song | null;
    globalSearchResults: GlobalSearchResult[];
    onLoginSuccess: () => void | Promise<void>;
    volumeCompensationDb: number;
    onVolumeCompensationChange: (value: number) => void | Promise<void>;
    panelStyles: React.CSSProperties;
    derived: DerivedStyles;
    formatTime: (value: number) => string;
    formatTimeWithMs: (value: number) => string;
}

export const useAppModalsProps = ({
    modals,
    closeModal,
    themes,
    currentThemeId,
    themeColor,
    themeColorLight,
    themeEditor,
    favoritesState,
    searchState,
    bvResolver,
    handlers,
    myFavoriteImport,
    favorites,
    queue,
    currentIndex,
    currentSong,
    pendingFavoriteSong,
    globalSearchResults,
    onLoginSuccess,
    volumeCompensationDb,
    onVolumeCompensationChange,
    panelStyles,
    derived,
    formatTime,
    formatTimeWithMs,
}: UseAppModalsPropsParams): AppModalsProps => ({
    modals,
    closeModal,
    themeManager: {
        themes,
        currentThemeId,
        onSelectTheme: handlers.handleSelectTheme,
        onViewTheme: handlers.handleViewTheme,
        onEditTheme: handlers.handleEditTheme,
        onDeleteTheme: handlers.handleDeleteTheme,
        onCreateTheme: handlers.handleCreateThemeClick,
        accentColor: themeColor,
        panelStyles,
        derived,
    },
    themeDetail: {
        session: themeEditor.session,
        actions: themeEditor.draftActions,
        onClearBackgroundImage: handlers.handleClearBackgroundImageDraft,
        onSubmit: handlers.handleSubmitTheme,
        onCancel: (discardChanges?: boolean) => (
            themeEditor.session.isReadOnly
                ? themeEditor.closeThemeDetail()
                : handlers.handleCloseThemeEditor(discardChanges)
        ),
        onBackgroundFileChange: handlers.handleBackgroundFileDraft,
        panelStyles,
        derived,
    },
    addFavorite: {
        favorites,
        currentSong,
        pendingFavoriteSong,
        themeColor,
        onAdd: handlers.handleAddToFavoriteFromModal,
        panelStyles,
        derived,
    },
    playlist: {
        queue,
        currentIndex,
        themeColorHighlight: themeColorLight,
        onSelect: handlers.handlePlaylistSelect,
        onReorder: handlers.handlePlaylistReorder,
        onRemove: handlers.handlePlaylistRemove,
        derived,
    },
    editFavorite: {
        name: favoritesState.editingFavName,
        onNameChange: favoritesState.setEditingFavName,
        onSave: handlers.handleSaveEditFavorite,
        themeColor,
        panelStyles,
        derived,
    },
    login: {
        onLoginSuccess,
        panelStyles,
        derived,
    },
    settings: {
        themeColor,
        appVersion: APP_VERSION,
        cacheSize: searchState.cacheSize,
        volumeCompensationDb,
        onVolumeCompensationChange,
        onOpenDownloadsFolder: handlers.handleOpenDownloadsFolder,
        onOpenDatabaseFile: handlers.handleOpenDatabaseFile,
        onClearMusicCache: handlers.handleClearMusicCache,
        panelStyles,
        derived,
    },
    downloadManager: {
        managingSong: favoritesState.managingSong,
        confirmDeleteDownloaded: favoritesState.confirmDeleteDownloaded,
        onClose: handlers.handleDownloadModalClose,
        onOpenFile: handlers.handleOpenDownloadedFile,
        onDeleteFile: handlers.handleDeleteDownloadedFile,
        onToggleConfirmDelete: favoritesState.setConfirmDeleteDownloaded,
        panelStyles,
        derived,
    },
    createFavorite: {
        themeColor,
        favorites,
        createFavName: favoritesState.createFavName,
        createFavMode: favoritesState.createFavMode,
        duplicateSourceId: favoritesState.duplicateSourceId,
        importFid: favoritesState.importFid,
        myCollections: myFavoriteImport.myCollections,
        isLoadingCollections: myFavoriteImport.isLoading,
        selectedMyCollectionId: myFavoriteImport.selectedCollectionId,
        onNameChange: favoritesState.setCreateFavName,
        onModeChange: favoritesState.setCreateFavMode,
        onDuplicateSourceChange: favoritesState.setDuplicateSourceId,
        onImportFidChange: favoritesState.setImportFid,
        onMyCollectionSelect: myFavoriteImport.setSelectedCollectionId,
        onFetchMyCollections: myFavoriteImport.fetchMyCollections,
        onSubmit: handlers.handleSubmitCreateFavorite,
        panelStyles,
        derived,
    },
    globalSearch: {
        themeColor,
        globalSearchTerm: searchState.globalSearchTerm,
        globalSearchResults,
        remoteResults: searchState.remoteResults,
        remoteLoading: searchState.remoteLoading,
        resolvingBV: bvResolver.resolvingBV,
        onTermChange: searchState.setGlobalSearchTerm,
        onResolveBVAndAdd: handlers.handleResolveBVAndAdd,
        onRemoteSearch: handlers.handleRemoteSearch,
        onResultClick: handlers.handleSearchResultClick,
        onAddFromRemote: handlers.handleAddFromRemote,
        onAddSingleRemotePage: handlers.handleAddSingleRemotePage,
        onLoadRemotePages: handlers.handleLoadRemotePages,
        panelStyles,
        derived,
    },
    bvAdd: {
        themeColor,
        bvPreview: bvResolver.bvPreview,
        favorites,
        bvTargetFavId: bvResolver.bvTargetFavId,
        newFavName: searchState.newFavName,
        bvSongName: bvResolver.bvSongName,
        bvSinger: bvResolver.bvSinger,
        sliceStart: bvResolver.sliceStart,
        sliceEnd: bvResolver.sliceEnd,
        onClose: bvResolver.closeBvModal,
        onSliceRangeChange: handlers.handleSliceRangeChange,
        onSliceStartChange: handlers.handleSliceStartChange,
        onSliceEndChange: handlers.handleSliceEndChange,
        onSelectFavorite: bvResolver.setBvTargetFavId,
        onCreateFavorite: handlers.handleCreateFavoriteInModal,
        onFavNameChange: searchState.setNewFavName,
        onSongNameChange: bvResolver.setBvSongName,
        onSingerChange: bvResolver.setBvSinger,
        onConfirmAdd: handlers.handleConfirmBVAdd,
        formatTime,
        formatTimeWithMs,
        panelStyles,
        derived,
    },
});
