import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
    saveFavorite: vi.fn(),
    listFavorites: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("../../../wailsjs/go/services/Service", () => ({
    SaveFavorite: serviceMocks.saveFavorite,
    ListFavorites: serviceMocks.listFavorites,
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
        serviceMocks.listFavorites.mockResolvedValue([]);
    });

    it("allows only one service call for concurrent submissions", async () => {
        let resolveSave: (() => void) | undefined;
        serviceMocks.saveFavorite.mockImplementation(() => new Promise<void>((resolve) => {
            resolveSave = resolve;
        }));
        const { result } = createHook();
        let firstSubmission: Promise<void> | undefined;

        await act(async () => {
            firstSubmission = result.current.createFavorite({ name: "Only once", mode: "blank" });
            await result.current.createFavorite({ name: "Only once", mode: "blank" });
        });

        expect(serviceMocks.saveFavorite).toHaveBeenCalledTimes(1);
        expect(result.current.isCreatingFavorite).toBe(true);

        resolveSave?.();
        await act(async () => { await firstSubmission; });
        await waitFor(() => expect(result.current.isCreatingFavorite).toBe(false));
    });

    it("releases the guard after failure so the user can retry", async () => {
        serviceMocks.saveFavorite
            .mockRejectedValueOnce(new Error("database busy"))
            .mockResolvedValueOnce(undefined);
        const { result } = createHook();

        await act(async () => {
            await result.current.createFavorite({ name: "Retry", mode: "blank" });
        });
        await act(async () => {
            await result.current.createFavorite({ name: "Retry", mode: "blank" });
        });

        expect(serviceMocks.saveFavorite).toHaveBeenCalledTimes(2);
        expect(result.current.isCreatingFavorite).toBe(false);
    });
});
