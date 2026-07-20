import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import MainLayout from "./MainLayout";
import type { Favorite, LyricView, Song } from "../../types";

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

const lyricView: LyricView = {
    songId: song.id,
    offsetMs: 0,
    manualLocked: false,
    candidates: [],
    document: {
        id: "lyric-1",
        songId: song.id,
        source: "lrclib",
        sourceLabel: "LRCLIB",
        format: "lrc",
        rawText: "[00:01]Line",
        lines: [{ startMs: 1000, text: "Line" }],
        metadata: {},
        contentHash: "hash",
        providerRef: "provider-ref",
        encoding: "utf-8",
        confidence: 0.95,
        embeddedOffsetMs: 0,
        isManual: false,
		isReliable: true,
        createdAt: "",
        updatedAt: "",
    },
};

const lyricActions: ComponentProps<typeof MainLayout>["lyrics"]["actions"] = {
    search: async () => undefined,
    cancelSearch: () => undefined,
    previewText: async () => ({ text: "", format: "plain", encoding: "utf-8", lines: [], metadata: {}, embeddedOffsetMs: 0, validLineCount: 0, firstMs: 0, lastMs: 0, warnings: [] }),
    previewFile: async () => ({ text: "", format: "plain", encoding: "utf-8", lines: [], metadata: {}, embeddedOffsetMs: 0, validLineCount: 0, firstMs: 0, lastMs: 0, warnings: [] }),
    importText: async () => undefined,
    importFile: async () => undefined,
    setOffset: async () => undefined,
    applyCandidate: async () => undefined,
    restoreAutomatic: async () => undefined,
    deleteLyric: async () => undefined,
	rejectCandidate: async () => undefined,
};

const defaultProps: ComponentProps<typeof MainLayout> = {
    currentSong: song,
    panelBackground: "#000",
    panelStyles: {},
    themeColor: "blue",
    computedColorScheme: "light",
    placeholderCover: "",
    maxSkipLimit: 60,
    formatTime: String,
    formatTimeWithMs: String,
    onIntervalChange: () => undefined,
    onSkipStartChange: () => undefined,
    onSkipEndChange: () => undefined,
    lyrics: {
        song,
        view: null,
        state: "empty",
        error: null,
        message: "",
        progressSeconds: 0,
        seek: () => undefined,
        actions: lyricActions,
        themeColor: "blue",
    },
    currentFav: favorite,
    currentFavSongs: [song],
    searchQuery: "",
    onSearchChange: () => undefined,
    onPlaySong: () => undefined,
    downloadedSongIds: new Set(),
    onDownloadSong: () => undefined,
    onAddSongToFavorite: () => undefined,
    onRemoveSongFromPlaylist: () => undefined,
    confirmRemoveSongId: null,
    onToggleConfirmRemove: () => undefined,
    onPlayAll: () => undefined,
    onDownloadAll: () => undefined,
    favorites: [favorite],
    selectedFavId: favorite.id,
    onSelectFavorite: () => undefined,
    onPlayFavorite: () => undefined,
    onCreateFavorite: () => undefined,
    onEditFavorite: () => undefined,
    onDeleteFavorite: async () => undefined,
    onToggleConfirmDelete: () => undefined,
    confirmDeleteFavId: null,
    onSyncFavorite: async () => undefined,
    onLoadFavoriteSyncStatus: async () => undefined,
    onDetachFavorite: async () => undefined,
    onDuplicateFavorite: async () => undefined,
    onLoginRequired: () => undefined,
    syncingFavoriteIds: new Set(),
    syncStatusByFavorite: {},
};

describe("MainLayout", () => {
    it("keeps the three primary cards mounted with stable layout classes", () => {
        render(
            <MantineProvider>
                <MainLayout {...defaultProps} />
            </MantineProvider>,
        );

        expect(document.querySelector(".main-layout")).toBeTruthy();
        expect(document.querySelector(".song-detail-card")).toBeTruthy();
		expect(document.querySelector(".current-playlist-card")).toBeTruthy();
        expect(document.querySelector(".favorite-list-card")).toBeTruthy();
        expect(document.querySelectorAll(".card-scroll-area")).toHaveLength(3);
		expect(screen.getByRole("tab", { name: "歌词" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "歌单" })).toBeInTheDocument();
		expect(document.querySelectorAll(".song-detail-card img")).toHaveLength(1);
		expect(document.querySelector(".workspace-card")).toBeTruthy();
    });

    it("puts the queue first and keeps it selected when lyrics are available", () => {
        render(<MantineProvider><MainLayout {...defaultProps} lyrics={{ ...defaultProps.lyrics, view: lyricView, state: "ready" }} /></MantineProvider>);
		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((tab) => tab.textContent)).toEqual(["歌单", "歌词"]);
		expect(screen.getByRole("tab", { name: "歌单" })).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("list", { name: "当前歌单" })).toBeVisible();
		expect(screen.getByRole("listitem")).toHaveAttribute("aria-current", "true");
    });

    it("preserves the tab selected by the user when lyric state changes", () => {
        const { rerender } = render(<MantineProvider><MainLayout {...defaultProps} lyrics={{ ...defaultProps.lyrics, view: lyricView, state: "ready" }} /></MantineProvider>);
        fireEvent.click(screen.getByRole("tab", { name: "歌词" }));
        expect(screen.getByRole("tab", { name: "歌词" })).toHaveAttribute("aria-selected", "true");

        rerender(<MantineProvider><MainLayout {...defaultProps} lyrics={{ ...defaultProps.lyrics, view: lyricView, state: "searching" }} /></MantineProvider>);
        expect(screen.getByRole("tab", { name: "歌词" })).toHaveAttribute("aria-selected", "true");
    });

	it("supports arrow-key tab switching and preserves lyric scroll on resize", async () => {
		const richLyrics = {
			...defaultProps.lyrics,
			view: {
				...lyricView,
				document: lyricView.document ? {
					...lyricView.document,
					lines: Array.from({ length: 40 }, (_, index) => ({ startMs: index * 1000, text: `Line ${index}` })),
				} : undefined,
			},
			state: "ready" as const,
		};
		const { rerender } = render(<MantineProvider><MainLayout {...defaultProps} lyrics={richLyrics} /></MantineProvider>);
			const queueTab = screen.getByRole("tab", { name: "歌单" });
			queueTab.focus();
			fireEvent.keyDown(queueTab, { key: "ArrowRight" });
			const lyricTab = screen.getByRole("tab", { name: "歌词" });
			expect(lyricTab).toHaveAttribute("aria-selected", "true");

		await waitFor(() => expect(document.querySelector(".lyrics-content .mantine-ScrollArea-viewport")).toBeTruthy());
		const viewport = document.querySelector(".lyrics-content .mantine-ScrollArea-viewport") as HTMLElement | null;
		if (!viewport) return;
		viewport.scrollTop = 180;
		fireEvent.scroll(viewport);
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
		window.dispatchEvent(new Event("resize"));
		rerender(<MantineProvider><MainLayout {...defaultProps} lyrics={richLyrics} /></MantineProvider>);
		expect(screen.getByRole("tab", { name: "歌词" })).toHaveAttribute("aria-selected", "true");
		expect(viewport.scrollTop).toBe(180);
	});

	it("resets outer workspace scrolling without changing panel scroll positions", async () => {
		const richLyrics = {
			...defaultProps.lyrics,
			view: {
				...lyricView,
				document: lyricView.document ? {
					...lyricView.document,
					lines: Array.from({ length: 40 }, (_, index) => ({ startMs: index * 1000, text: `Line ${index}` })),
				} : undefined,
			},
			state: "ready" as const,
		};
		render(<MantineProvider><MainLayout {...defaultProps} lyrics={richLyrics} /></MantineProvider>);

		const workspaceTabs = document.querySelector(".workspace-tabs") as HTMLElement | null;
		const workspaceCard = document.querySelector(".workspace-card") as HTMLElement | null;
		const queueViewport = document.querySelector(".current-playlist-scroll-area .mantine-ScrollArea-viewport") as HTMLElement | null;
		expect(workspaceTabs).toBeTruthy();
		expect(workspaceCard).toBeTruthy();
		expect(queueViewport).toBeTruthy();
		if (!workspaceCard || !workspaceTabs || !queueViewport) return;

		queueViewport.scrollTop = 120;
		fireEvent.scroll(queueViewport);
		workspaceTabs.scrollTop = 90;
		workspaceTabs.scrollLeft = 16;
		fireEvent.scroll(workspaceTabs);
		expect(workspaceTabs.scrollTop).toBe(0);
		expect(workspaceTabs.scrollLeft).toBe(0);
		expect(queueViewport.scrollTop).toBe(120);
		workspaceCard.scrollTop = 44;
		workspaceCard.scrollLeft = 12;
		fireEvent.scroll(workspaceCard);
		expect(workspaceCard.scrollTop).toBe(0);
		expect(workspaceCard.scrollLeft).toBe(0);
		expect(queueViewport.scrollTop).toBe(120);

		fireEvent.click(screen.getByRole("tab", { name: "歌词" }));
		await waitFor(() => expect(document.querySelector(".lyrics-content .mantine-ScrollArea-viewport")).toBeTruthy());
		const lyricsViewport = document.querySelector(".lyrics-content .mantine-ScrollArea-viewport") as HTMLElement | null;
		expect(lyricsViewport).toBeTruthy();
		if (!lyricsViewport) return;
		lyricsViewport.scrollTop = 220;
		fireEvent.scroll(lyricsViewport);

		fireEvent.click(screen.getByRole("tab", { name: "歌单" }));
		expect(queueViewport.scrollTop).toBe(120);
		fireEvent.click(screen.getByRole("tab", { name: "歌词" }));
		expect(lyricsViewport.scrollTop).toBe(220);
		expect(screen.getByRole("tab", { name: "歌单" })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "歌词" })).toHaveAttribute("aria-selected", "true");
	});

	it("keeps playback settings in the only scrollable region of the inspector", () => {
		render(<MantineProvider><MainLayout {...defaultProps} /></MantineProvider>);
		const layout = document.querySelector(".main-layout");
		const playerSettings = screen.getByText("播放设置");
		expect(screen.getByText("播放区间（只播放此段）")).toBeInTheDocument();
		expect(playerSettings.closest(".song-detail-card")).toBeTruthy();
		expect(document.querySelector(".song-detail-card .song-detail-scroll-area")).toBeNull();
		expect(document.querySelectorAll(".song-detail-card .mantine-ScrollArea-root")).toHaveLength(1);
		expect(document.querySelector(".song-detail-card .song-settings-scroll-area")).toBeTruthy();
		expect(document.querySelector(".main-layout")).toBe(layout);
	});
});
