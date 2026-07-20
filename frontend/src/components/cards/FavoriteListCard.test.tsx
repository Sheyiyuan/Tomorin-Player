import React, { useState } from "react";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Favorite } from "../../types";
import FavoriteListCard from "./FavoriteListCard";

const favorite: Favorite = {
    id: "favorite-1",
    title: "Local playlist",
    songIds: [],
    createdAt: "",
    updatedAt: "",
};

const FavoriteListHarness = ({ onDelete }: { onDelete: (id: string) => Promise<void> }) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    return (
        <FavoriteListCard
            panelBackground="#000"
            panelStyles={{}}
            favorites={[favorite]}
            selectedFavId={favorite.id}
            onSelectFavorite={vi.fn()}
            onPlayFavorite={vi.fn()}
            onCreateFavorite={vi.fn()}
            onEditFavorite={vi.fn()}
            onDeleteFavorite={onDelete}
            onToggleConfirmDelete={setConfirmDeleteId}
            confirmDeleteFavId={confirmDeleteId}
            onSyncFavorite={vi.fn(async () => undefined)}
            onLoadSyncStatus={vi.fn(async () => undefined)}
            onDetachFavorite={vi.fn(async () => undefined)}
            onDuplicateFavorite={vi.fn(async () => undefined)}
            onLoginRequired={vi.fn()}
            syncingIds={new Set()}
            syncStatusByFavorite={{}}
            themeColor="blue"
        />
    );
};

describe("FavoriteListCard delete confirmation", () => {
    it("keeps the menu open for the first click and deletes on the second", async () => {
        const onDelete = vi.fn(async () => undefined);
        render(<MantineProvider><FavoriteListHarness onDelete={onDelete} /></MantineProvider>);

        fireEvent.click(screen.getByRole("button", { name: "Local playlist 更多操作" }));
        fireEvent.click(await screen.findByText("删除歌单"));

        const confirmation = await screen.findByText("再次点击确认删除");
		expect(screen.getByRole("button", { name: "Local playlist 更多操作" })).toHaveAttribute("aria-expanded", "true");
		expect(confirmation).toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();

        fireEvent.click(confirmation);
        await waitFor(() => expect(onDelete).toHaveBeenCalledWith(favorite.id));
    });

    it("clears an unfinished confirmation when the menu closes", async () => {
        render(<MantineProvider><FavoriteListHarness onDelete={vi.fn(async () => undefined)} /></MantineProvider>);
        const menuButton = screen.getByRole("button", { name: "Local playlist 更多操作" });

        fireEvent.click(menuButton);
        fireEvent.click(await screen.findByText("删除歌单"));
		expect(await screen.findByText("再次点击确认删除")).toBeInTheDocument();
		expect(menuButton).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(menuButton);
		await waitFor(() => expect(menuButton).toHaveAttribute("aria-expanded", "false"));

        fireEvent.click(menuButton);
		await waitFor(() => expect(menuButton).toHaveAttribute("aria-expanded", "true"));
		expect(screen.getByRole("menuitem", { name: "删除歌单", hidden: true })).toBeInTheDocument();
    });
});
