import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MainLayout from "./MainLayout";
import type { Favorite, Song } from "../../types";

const song: Song = {
    id: "song-1",
    bvid: "BV1xx411c7mD",
    name: "Song",
    singer: "Singer",
    singerId: "",
    cover: "",
    coverLocal: "",
    sourceId: "",
    streamUrl: "",
    streamUrlExpiresAt: "",
    lyric: "",
    lyricOffset: 0,
    skipStartTime: 0,
    skipEndTime: 0,
    pageNumber: 1,
    pageTitle: "",
    videoTitle: "",
    totalPages: 1,
    createdAt: "",
    updatedAt: "",
};

const favorite: Favorite = {
    id: "fav-1",
    title: "Favorite",
    songIds: [],
    createdAt: "",
    updatedAt: "",
};

describe("MainLayout", () => {
    it("keeps the three primary cards mounted with stable layout classes", () => {
        render(
            <MantineProvider>
                <MainLayout
                    currentSong={song}
                    panelBackground="#000"
                    panelStyles={{}}
                    themeColor="blue"
                    computedColorScheme="light"
                    placeholderCover=""
                    maxSkipLimit={60}
                    formatTime={(value) => String(value)}
                    formatTimeWithMs={(value) => String(value)}
                    onIntervalChange={() => undefined}
                    onSkipStartChange={() => undefined}
                    onSkipEndChange={() => undefined}
                    currentFav={favorite}
                    currentFavSongs={[song]}
                    searchQuery=""
                    onSearchChange={() => undefined}
                    onPlaySong={() => undefined}
                    downloadedSongIds={new Set()}
                    onDownloadSong={() => undefined}
                    onAddSongToFavorite={() => undefined}
                    onRemoveSongFromPlaylist={() => undefined}
                    confirmRemoveSongId={null}
                    onToggleConfirmRemove={() => undefined}
                    onPlayAll={() => undefined}
                    onDownloadAll={() => undefined}
                    favorites={[favorite]}
                    selectedFavId={favorite.id}
                    onSelectFavorite={() => undefined}
                    onPlayFavorite={() => undefined}
                    onCreateFavorite={() => undefined}
                    onEditFavorite={() => undefined}
                    onDeleteFavorite={async () => undefined}
                    onToggleConfirmDelete={() => undefined}
                    confirmDeleteFavId={null}
                />
            </MantineProvider>,
        );

        expect(document.querySelector(".main-layout")).toBeTruthy();
        expect(document.querySelector(".song-detail-card")).toBeTruthy();
        expect(document.querySelector(".current-playlist-card")).toBeTruthy();
        expect(document.querySelector(".favorite-list-card")).toBeTruthy();
        expect(document.querySelectorAll(".card-scroll-area")).toHaveLength(3);
    });
});
