import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Favorite, PlaylistSyncStatus } from '../../types';
import PlaylistSyncModal from './PlaylistSyncModal';

const source = {
	id: 'source', favoriteId: 'favorite', provider: 'bilibili', remoteId: '42', locked: true, syncState: 'synced',
	lastErrorCode: '', lastErrorMessage: '', lastSnapshotHash: '', remoteCount: 2, createdAt: '', updatedAt: '',
};

const favorite: Favorite = {
	id: 'favorite', title: 'mirror', songIds: [], source, createdAt: '', updatedAt: '',
};

const status: PlaylistSyncStatus = {
	source,
	run: {
		id: 'run', sourceId: 'source', status: 'synced', snapshotComplete: true,
		remoteCount: 2, resolvedCount: 1, addedCount: 1, removedCount: 0,
		skippedCount: 1, pendingCount: 0, errorCode: '', errorMessage: '', startedAt: '',
	},
};

describe('PlaylistSyncModal', () => {
	it('shows skipped resources separately from pending videos', () => {
		render(
			<MantineProvider>
				<PlaylistSyncModal
					favorite={favorite}
					status={status}
					task={{
						id: 'task', favoriteIds: ['favorite'], status: 'running', completedFavorites: 0, totalFavorites: 1,
						progress: { stage: 'resolving', favoriteId: 'favorite', completedVideoCount: 1, totalVideoCount: 2, skippedCount: 1 },
						errorCode: '', errorMessage: '', retryable: false, errorDetails: {}, startedAt: '',
					}}
					opened
					syncing
					themeColor="blue"
					onClose={vi.fn()}
					onSync={vi.fn(async () => undefined)}
					onDetach={vi.fn(async () => undefined)}
					onDuplicate={vi.fn(async () => undefined)}
					onDelete={vi.fn()}
					onLoginRequired={vi.fn()}
				/>
			</MantineProvider>,
		);

		expect(screen.getByText('远端 2 项 · 已解析 1 首 · 本地 0 首')).toBeInTheDocument();
		expect(screen.getByText('最近变化：新增 1 首，移除 0 首，跳过 1 项，待解析 0 项')).toBeInTheDocument();
		expect(screen.getByText('正在解析视频 1 / 2')).toBeInTheDocument();
		expect(screen.getByRole('progressbar', { name: '收藏夹处理进度' })).toHaveAttribute('aria-valuenow', '50');
	});
});
