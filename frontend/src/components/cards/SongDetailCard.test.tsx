import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Song } from "../../types";
import SongDetailCard from "./SongDetailCard";

const song: Song = {
    id: "song-1",
    bvid: "BV1xx411c7mD",
    name: "Original name",
    singer: "Original singer",
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

describe("SongDetailCard", () => {
    it("keeps the editor open and preserves drafts when saving fails", async () => {
        const save = vi.fn(async () => {
            throw new Error('rpc: {"code":"SONG_SAVE_FAILED","message":"歌曲信息暂时无法保存","retryable":true}');
        });
        render(
            <MantineProvider>
                <SongDetailCard
                    song={song}
                    panelBackground="#000"
                    panelStyles={{}}
                    themeColor="blue"
                    computedColorScheme="dark"
                    placeholderCover=""
                    maxSkipLimit={60}
                    formatTime={String}
                    formatTimeWithMs={String}
                    onIntervalChange={() => undefined}
                    onSkipStartChange={() => undefined}
                    onSkipEndChange={() => undefined}
                    onSongInfoUpdate={save}
                />
            </MantineProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "编辑歌曲信息" }));
        fireEvent.change(await screen.findByLabelText("歌曲名称"), { target: { value: "Draft name" } });
        fireEvent.change(screen.getByLabelText("歌手"), { target: { value: "Draft singer" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("歌曲信息暂时无法保存"));
        expect(screen.getByLabelText("歌曲名称")).toHaveValue("Draft name");
        expect(screen.getByLabelText("歌手")).toHaveValue("Draft singer");
        expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });

	it("keeps the summary fixed and confines scrolling to playback settings", () => {
		render(
			<MantineProvider>
				<SongDetailCard
					song={song}
					panelBackground="#000"
					panelStyles={{}}
					themeColor="blue"
					computedColorScheme="dark"
					placeholderCover=""
					maxSkipLimit={60}
					formatTime={String}
					formatTimeWithMs={String}
					onIntervalChange={() => undefined}
					onSkipStartChange={() => undefined}
					onSkipEndChange={() => undefined}
				/>
			</MantineProvider>,
		);

		expect(document.querySelector(".song-detail-summary")).toBeTruthy();
		expect(document.querySelector(".song-detail-scroll-area")).toBeNull();
		expect(document.querySelectorAll(".song-detail-card .mantine-ScrollArea-root")).toHaveLength(1);
		expect(document.querySelector(".song-settings-scroll-area")).toBeTruthy();
	});

	it("keeps slider labels inside the settings viewport at both endpoints", () => {
		render(
			<MantineProvider>
				<SongDetailCard
					song={song}
					panelBackground="#000"
					panelStyles={{}}
					themeColor="blue"
					computedColorScheme="dark"
					placeholderCover=""
					maxSkipLimit={60}
					formatTime={String}
					formatTimeWithMs={String}
					onIntervalChange={() => undefined}
					onSkipStartChange={() => undefined}
					onSkipEndChange={() => undefined}
				/>
			</MantineProvider>,
		);

		const sliders = document.querySelectorAll<HTMLElement>(".song-settings-panel .mantine-Slider-root");
		expect(sliders).toHaveLength(2);
		sliders.forEach((slider) => {
				expect(slider).toHaveStyle({
					width: "calc(100% - 48px)",
					marginInline: "24px",
					marginBlockStart: "28px",
					overflow: "visible",
			});
		});
	});
});
