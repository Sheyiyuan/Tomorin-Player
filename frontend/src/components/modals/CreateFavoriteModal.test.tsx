import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateFavoriteModal from "./CreateFavoriteModal";

describe("CreateFavoriteModal", () => {
    it("explains the exact consequences of importing a locked mirror", () => {
        render(
            <MantineProvider>
                <CreateFavoriteModal
                    opened
                    themeColor="blue"
                    favorites={[]}
                    createFavName="Mirror"
                    createFavMode="importFid"
                    duplicateSourceId={null}
                    importFid="42"
                    myCollections={[]}
                    isLoadingCollections={false}
                    selectedMyCollectionId={null}
                    keepSynced
					isSubmitting={false}
                    onClose={vi.fn()}
                    onNameChange={vi.fn()}
                    onModeChange={vi.fn()}
                    onDuplicateSourceChange={vi.fn()}
                    onImportFidChange={vi.fn()}
                    onMyCollectionSelect={vi.fn()}
                    onFetchMyCollections={vi.fn()}
                    onKeepSyncedChange={vi.fn()}
                    onSubmit={vi.fn()}
                />
            </MantineProvider>,
        );

        expect(screen.getByText(/Bilibili 已移除的条目也会从本歌单移除/)).toBeInTheDocument();
        expect(screen.getByText(/歌曲、歌词、封面、下载和缓存不会删除/)).toBeInTheDocument();
        expect(screen.getByText(/转换为本地歌单后将永久停止同步/)).toBeInTheDocument();
    });

	it("disables every close path while a submission is active", () => {
		const onClose = vi.fn();
		render(
			<MantineProvider>
				<CreateFavoriteModal
					opened
					themeColor="blue"
					favorites={[]}
					createFavName="New playlist"
					createFavMode="blank"
					duplicateSourceId={null}
					importFid=""
					myCollections={[]}
					isLoadingCollections={false}
					selectedMyCollectionId={null}
					keepSynced
					isSubmitting
					onClose={onClose}
					onNameChange={vi.fn()}
					onModeChange={vi.fn()}
					onDuplicateSourceChange={vi.fn()}
					onImportFidChange={vi.fn()}
					onMyCollectionSelect={vi.fn()}
					onFetchMyCollections={vi.fn()}
					onKeepSyncedChange={vi.fn()}
					onSubmit={vi.fn()}
				/>
			</MantineProvider>,
		);

		expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "确认" })).toBeDisabled();
		expect(screen.queryByRole("button", { name: "Close modal" })).not.toBeInTheDocument();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).not.toHaveBeenCalled();
	});

	it("shows real import progress while resolving videos", () => {
		render(
			<MantineProvider>
				<CreateFavoriteModal
					opened
					themeColor="blue"
					favorites={[]}
					createFavName="Mirror"
					createFavMode="importFid"
					duplicateSourceId={null}
					importFid="42"
					myCollections={[]}
					isLoadingCollections={false}
					selectedMyCollectionId={null}
					keepSynced
					isSubmitting
					importProgress={{ stage: "resolving", completedVideoCount: 12, totalVideoCount: 40, skippedCount: 2 }}
					onClose={vi.fn()}
					onNameChange={vi.fn()}
					onModeChange={vi.fn()}
					onDuplicateSourceChange={vi.fn()}
					onImportFidChange={vi.fn()}
					onMyCollectionSelect={vi.fn()}
					onFetchMyCollections={vi.fn()}
					onKeepSyncedChange={vi.fn()}
					onSubmit={vi.fn()}
				/>
			</MantineProvider>,
		);

		expect(screen.getByText("正在解析视频 12 / 40")).toBeInTheDocument();
		expect(screen.getByText("已跳过 2 项不支持的内容")).toBeInTheDocument();
	});
});
