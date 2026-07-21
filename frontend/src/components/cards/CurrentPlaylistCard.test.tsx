import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Favorite, Song } from "../../types";
import CurrentPlaylistCard from "./CurrentPlaylistCard";

vi.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: ({ count }: { count: number }) => ({
        getVirtualItems: () => Array.from({ length: Math.min(count, 24) }, (_, index) => ({ index, start: index * 47 })),
        getTotalSize: () => count * 47,
    }),
}));

const songs: Song[] = [
    {
        id: "song-1", bvid: "BV1xx411c7mD", name: "A very long song title that must not displace the actions", singer: "A very long artist name", singerId: "", cover: "", coverLocal: "", sourceId: "",
        streamUrl: "", streamUrlExpiresAt: "", lyric: "", lyricOffset: 0, skipStartTime: 0, skipEndTime: 0, pageNumber: 1,
        pageTitle: "", videoTitle: "", totalPages: 1, createdAt: "", updatedAt: "",
    },
    {
        id: "song-2", bvid: "BV1xx411c7mD", name: "Second song", singer: "Singer", singerId: "", cover: "", coverLocal: "", sourceId: "",
        streamUrl: "", streamUrlExpiresAt: "", lyric: "", lyricOffset: 0, skipStartTime: 0, skipEndTime: 0, pageNumber: 1,
        pageTitle: "", videoTitle: "", totalPages: 1, createdAt: "", updatedAt: "",
    },
];

const favorite: Favorite = {
    id: "favorite", title: "Queue", songIds: [], createdAt: "", updatedAt: "",
};

const renderQueue = (overrides: Partial<React.ComponentProps<typeof CurrentPlaylistCard>> = {}) => {
    const props: React.ComponentProps<typeof CurrentPlaylistCard> = {
        panelBackground: "#111", panelStyles: {}, currentFav: favorite, currentFavSongs: songs, currentSongId: songs[0].id,
        searchQuery: "", onSearchChange: vi.fn(), onPlaySong: vi.fn(), themeColor: "blue", downloadedSongIds: new Set(),
        onDownloadSong: vi.fn(), onAddSongToFavorite: vi.fn(), onRemoveSongFromPlaylist: vi.fn(), confirmRemoveSongId: null,
        onToggleConfirmRemove: vi.fn(), onPlayAll: vi.fn(), onDownloadAll: vi.fn(), ...overrides,
    };
    return { props, ...render(<MantineProvider><CurrentPlaylistCard {...props} /></MantineProvider>) };
};

describe("CurrentPlaylistCard", () => {
    it("renders songs as a compact semantic list with the current row marked", () => {
        renderQueue();
        const list = screen.getByRole("list", { name: "当前歌单" });
        const rows = within(list).getAllByRole("listitem");

        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveClass("queue-song-row");
        expect(rows[0]).toHaveAttribute("aria-current", "true");
        expect(rows[1]).not.toHaveAttribute("aria-current");
        expect(within(rows[0]).getByRole("button", { name: `播放 ${songs[0].name}` })).toBeInTheDocument();
    });

    it("plays from the song row without action buttons triggering playback", () => {
        const onPlaySong = vi.fn();
        const onDownloadSong = vi.fn();
        renderQueue({ onPlaySong, onDownloadSong });

        fireEvent.click(screen.getByRole("button", { name: `播放 ${songs[0].name}` }));
        expect(onPlaySong).toHaveBeenCalledWith(songs[0]);

        fireEvent.click(screen.getAllByRole("button", { name: "下载歌曲" })[0]);
        expect(onDownloadSong).toHaveBeenCalledWith(songs[0]);
        expect(onPlaySong).toHaveBeenCalledTimes(1);
    });

    it("mounts only the visible window for a 10,000-song playlist", async () => {
        const onVisibleRangeChange = vi.fn();
        renderQueue({
            currentFavSongs: [],
            songTotal: 10_000,
            getSong: (index) => index === 0 ? songs[0] : undefined,
            onVisibleRangeChange,
        });

        const list = screen.getByRole("list", { name: "当前歌单" });
        const rows = within(list).getAllByRole("listitem");
        expect(rows).toHaveLength(24);
        expect(rows[0]).toHaveAttribute("aria-current", "true");
        expect(rows[0]).toHaveAttribute("aria-setsize", "10000");
        expect(within(list).getByLabelText("正在加载第 2 首")).toBeInTheDocument();
        await waitFor(() => expect(onVisibleRangeChange).toHaveBeenCalledWith(0, 23));
    });
});
