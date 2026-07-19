import React, { lazy, Suspense } from "react";
import type { ModalName, ModalState } from "../context/types/contexts";

const ThemeManagerModal = lazy(() => import("./modals/ThemeManagerModal"));
const ThemeDetailModal = lazy(() => import("./modals/ThemeDetailModal"));
const AddToFavoriteModal = lazy(() => import("./modals/AddToFavoriteModal"));
const PlaylistModal = lazy(() => import("./modals/PlaylistModal"));
const EditFavoriteModal = lazy(() => import("./modals/EditFavoriteModal"));
const LoginModal = lazy(() => import("./modals/LoginModal"));
const SettingsModal = lazy(() => import("./modals/SettingsModal"));
const DownloadManagerModal = lazy(() => import("./modals/DownloadManagerModal"));
const CreateFavoriteModal = lazy(() => import("./modals/CreateFavoriteModal"));
const GlobalSearchModal = lazy(() => import("./modals/GlobalSearchModal"));
const BVAddModal = lazy(() => import("./modals/BVAddModal"));
const ExitConfirmModal = lazy(() => import("./modals/ExitConfirmModal"));

type ManagedModalProps<T> = Omit<T, "opened" | "onClose">;

export interface AppModalsProps {
    modals: ModalState;
    closeModal: (name: ModalName) => void;
    themeManager: ManagedModalProps<React.ComponentProps<typeof ThemeManagerModal>>;
    themeDetail: Omit<React.ComponentProps<typeof ThemeDetailModal>, "opened" | "onClose" | "isReadOnly">;
    addFavorite: ManagedModalProps<React.ComponentProps<typeof AddToFavoriteModal>>;
    playlist: ManagedModalProps<React.ComponentProps<typeof PlaylistModal>>;
    editFavorite: ManagedModalProps<React.ComponentProps<typeof EditFavoriteModal>>;
    login: ManagedModalProps<React.ComponentProps<typeof LoginModal>>;
    settings: ManagedModalProps<React.ComponentProps<typeof SettingsModal>>;
    downloadManager: Omit<React.ComponentProps<typeof DownloadManagerModal>, "opened">;
    createFavorite: ManagedModalProps<React.ComponentProps<typeof CreateFavoriteModal>>;
    globalSearch: ManagedModalProps<React.ComponentProps<typeof GlobalSearchModal>>;
    bvAdd: Omit<React.ComponentProps<typeof BVAddModal>, "opened">;
    exitConfirm: ManagedModalProps<React.ComponentProps<typeof ExitConfirmModal>>;
}

const AppModalsOptimized: React.FC<AppModalsProps> = React.memo(({
    modals,
    closeModal,
    themeManager,
    themeDetail,
    addFavorite,
    playlist,
    editFavorite,
    login,
    settings,
    downloadManager,
    createFavorite,
    globalSearch,
    bvAdd,
    exitConfirm,
}) => (
    <Suspense fallback={null}>
        {modals.themeManagerModal && (
            <ThemeManagerModal
                {...themeManager}
                opened
                onClose={() => closeModal("themeManagerModal")}
            />
        )}

        {modals.themeEditorModal && (
            <ThemeDetailModal
                {...themeDetail}
                opened
                onClose={themeDetail.onCancel}
                isReadOnly={false}
            />
        )}

        {modals.themeDetailModal && (
            <ThemeDetailModal
                {...themeDetail}
                opened
                onClose={themeDetail.onCancel}
                isReadOnly
            />
        )}

        {modals.addFavoriteModal && (
            <AddToFavoriteModal
                {...addFavorite}
                opened
                onClose={() => closeModal("addFavoriteModal")}
            />
        )}

        {modals.playlistModal && (
            <PlaylistModal
                {...playlist}
                opened
                onClose={() => closeModal("playlistModal")}
            />
        )}

        {modals.editFavModal && (
            <EditFavoriteModal
                {...editFavorite}
                opened
                onClose={() => closeModal("editFavModal")}
            />
        )}

        {modals.loginModal && (
            <LoginModal
                {...login}
                opened
                onClose={() => closeModal("loginModal")}
            />
        )}

        {modals.settingsModal && (
            <SettingsModal
                {...settings}
                opened
                onClose={() => closeModal("settingsModal")}
            />
        )}

        {modals.downloadManagerModal && (
            <DownloadManagerModal
                {...downloadManager}
                opened
            />
        )}

        {modals.createFavModal && (
            <CreateFavoriteModal
                {...createFavorite}
                opened
                onClose={() => closeModal("createFavModal")}
            />
        )}

        {modals.globalSearchModal && (
            <GlobalSearchModal
                {...globalSearch}
                opened
                onClose={() => closeModal("globalSearchModal")}
            />
        )}

        {modals.bvAddModal && <BVAddModal {...bvAdd} opened />}

        {modals.exitConfirmModal && (
            <ExitConfirmModal {...exitConfirm} opened onClose={() => closeModal("exitConfirmModal")} />
        )}
    </Suspense>
));

export default AppModalsOptimized;
