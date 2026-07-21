import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
	createLocalFavorite: vi.fn(),
	listFavoriteSummaries: vi.fn(),
	listSongs: vi.fn(),
	startBiliFavoriteImport: vi.fn(),
	getBiliFavoriteImportTask: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("../../../wailsjs/go/services/Service", () => ({
	CreateLocalFavorite: serviceMocks.createLocalFavorite,
	ListFavoriteSummaries: serviceMocks.listFavoriteSummaries,
	ListSongs: serviceMocks.listSongs,
	StartBiliFavoriteImport: serviceMocks.startBiliFavoriteImport,
	GetBiliFavoriteImportTask: serviceMocks.getBiliFavoriteImportTask,
}));
vi.mock("@mantine/notifications", () => ({ notifications: notificationMocks }));

import { useFavoriteActions } from "./useFavoriteActions";

const createHook = () => renderHook(() => useFavoriteActions({
    favorites: [],
    setFavorites: vi.fn(),
    songs: [],
    setSongs: vi.fn(),
    selectedFavId: null,
    setSelectedFavId: vi.fn(),
    setStatus: vi.fn(),
    themeColor: "blue",
    openModal: vi.fn(),
    closeModal: vi.fn(),
}));

describe("useFavoriteActions creation guard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		serviceMocks.listFavoriteSummaries.mockResolvedValue([]);
		serviceMocks.listSongs.mockResolvedValue([]);
	});

    it("allows only one service call for concurrent submissions", async () => {
        let resolveSave: (() => void) | undefined;
		serviceMocks.createLocalFavorite.mockImplementation(() => new Promise((resolve) => {
			resolveSave = () => resolve({ id: "favorite", title: "Only once", songCount: 0, createdAt: "", updatedAt: "" });
		}));
        const { result } = createHook();
        let firstSubmission: Promise<void> | undefined;

        await act(async () => {
            firstSubmission = result.current.createFavorite({ name: "Only once", mode: "blank" });
            await result.current.createFavorite({ name: "Only once", mode: "blank" });
        });

		expect(serviceMocks.createLocalFavorite).toHaveBeenCalledTimes(1);
        expect(result.current.isCreatingFavorite).toBe(true);

        resolveSave?.();
        await act(async () => { await firstSubmission; });
        await waitFor(() => expect(result.current.isCreatingFavorite).toBe(false));
    });

    it("releases the guard after failure so the user can retry", async () => {
		serviceMocks.createLocalFavorite
			.mockRejectedValueOnce(new Error("database busy"))
			.mockResolvedValueOnce({ id: "favorite", title: "Retry", songCount: 0, createdAt: "", updatedAt: "" });
        const { result } = createHook();

        await act(async () => {
            await result.current.createFavorite({ name: "Retry", mode: "blank" });
        });
        await act(async () => {
            await result.current.createFavorite({ name: "Retry", mode: "blank" });
        });

		expect(serviceMocks.createLocalFavorite).toHaveBeenCalledTimes(2);
        expect(result.current.isCreatingFavorite).toBe(false);
    });

	it("polls an import task and exposes its real progress", async () => {
		let resolveTask: ((value: unknown) => void) | undefined;
		serviceMocks.startBiliFavoriteImport.mockResolvedValue({
			id: "import-task",
			status: "queued",
			progress: { stage: "queued", completedVideoCount: 0, totalVideoCount: 0, skippedCount: 0 },
		});
		serviceMocks.getBiliFavoriteImportTask.mockImplementation(() => new Promise((resolve) => {
			resolveTask = resolve;
		}));
		const { result } = createHook();
		let submission: Promise<void> | undefined;

		act(() => {
			submission = result.current.createFavorite({ name: "Imported", mode: "importFid", importFid: "42" });
		});
		await waitFor(() => expect(serviceMocks.startBiliFavoriteImport).toHaveBeenCalledTimes(1));
		expect(result.current.favoriteImportProgress?.stage).toBe("queued");
		await waitFor(() => expect(serviceMocks.getBiliFavoriteImportTask).toHaveBeenCalledWith("import-task"));

		resolveTask?.({
			id: "import-task",
			status: "succeeded",
			progress: { stage: "completed", completedVideoCount: 2, totalVideoCount: 2, skippedCount: 1 },
			result: {
				favorite: { id: "favorite", title: "Imported", songIds: [], createdAt: "", updatedAt: "" },
				syncStatus: { run: { addedCount: 2, skippedCount: 1, pendingCount: 0 } },
			},
		});
		await act(async () => { await submission; });

		expect(serviceMocks.listFavoriteSummaries).toHaveBeenCalled();
		expect(serviceMocks.listSongs).not.toHaveBeenCalled();
		expect(notificationMocks.show).toHaveBeenCalledWith(expect.objectContaining({
			message: expect.stringContaining("跳过 1 项 · 待解析 0 项"),
		}));
		expect(result.current.isCreatingFavorite).toBe(false);
		expect(result.current.favoriteImportProgress).toBeUndefined();
	});
});
