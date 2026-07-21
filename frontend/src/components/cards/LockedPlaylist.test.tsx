import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Favorite, Song } from '../../types';
import CurrentPlaylistCard from './CurrentPlaylistCard';
import FavoriteListCard from './FavoriteListCard';
import AddToFavoriteModal from '../modals/AddToFavoriteModal';

const serviceMocks = vi.hoisted(() => ({ getFavoriteMemberships: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({
	GetFavoriteMemberships: serviceMocks.getFavoriteMemberships,
}));

const song: Song = {
    id: 'song', bvid: 'BV1xx411c7mD', name: 'Song', singer: 'Singer', singerId: '', cover: '', coverLocal: '', sourceId: '',
    streamUrl: '', streamUrlExpiresAt: '', lyric: '', lyricOffset: 0, skipStartTime: 0, skipEndTime: 0, pageNumber: 1,
    pageTitle: '', videoTitle: '', totalPages: 1, createdAt: '', updatedAt: '',
};

const favorite: Favorite = {
    id: 'fav', title: 'Locked', songIds: [{ id: 1, favoriteId: 'fav', songId: song.id, position: 0 }], createdAt: '', updatedAt: '',
    source: { id: 'source', favoriteId: 'fav', provider: 'bilibili', remoteId: '42', locked: true, syncState: 'idle', lastErrorCode: '', lastErrorMessage: '', lastSnapshotHash: '', remoteCount: 1, createdAt: '', updatedAt: '' },
};

describe('locked playlists', () => {
	beforeEach(() => {
		serviceMocks.getFavoriteMemberships.mockResolvedValue([]);
	});
    it('disables membership removal in the queue', () => {
        render(<MantineProvider><CurrentPlaylistCard panelBackground="#000" panelStyles={{}} currentFav={favorite} currentFavSongs={[song]} searchQuery="" onSearchChange={vi.fn()} onPlaySong={vi.fn()} themeColor="blue" downloadedSongIds={new Set()} onDownloadSong={vi.fn()} onAddSongToFavorite={vi.fn()} onRemoveSongFromPlaylist={vi.fn()} confirmRemoveSongId={null} onToggleConfirmRemove={vi.fn()} onPlayAll={vi.fn()} onDownloadAll={vi.fn()} /></MantineProvider>);
        expect(screen.getByText('只读同步')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '移出歌单' })).toBeDisabled();
    });

	it('hides rename and exposes sync details with irreversible detach acknowledgement', async () => {
		const onDeleteFavorite = vi.fn();
		render(<MantineProvider><FavoriteListCard panelBackground="#000" panelStyles={{}} favorites={[favorite]} selectedFavId={favorite.id} onSelectFavorite={vi.fn()} onPlayFavorite={vi.fn()} onCreateFavorite={vi.fn()} onEditFavorite={vi.fn()} onDeleteFavorite={onDeleteFavorite} onToggleConfirmDelete={vi.fn()} confirmDeleteFavId={null} onSyncFavorite={vi.fn(async () => undefined)} onLoadSyncStatus={vi.fn(async () => undefined)} onDetachFavorite={vi.fn(async () => undefined)} onDuplicateFavorite={vi.fn(async () => undefined)} onLoginRequired={vi.fn()} syncingIds={new Set()} syncStatusByFavorite={{}} themeColor="blue" /></MantineProvider>);
        fireEvent.click(screen.getByRole('button', { name: 'Locked 更多操作' }));
        await waitFor(() => expect(screen.getByText('同步详情')).toBeInTheDocument());
        expect(screen.queryByText('重命名')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('同步详情'));
        expect(await screen.findByText('我已了解转换不可撤销')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '确认转换为本地歌单' })).toBeDisabled();
		expect(screen.getByText('不会修改 Bilibili 收藏夹。', { exact: false })).toBeInTheDocument();
		const deleteButton = screen.getByRole('button', { name: '删除本地镜像' });
		expect(deleteButton).toBeDisabled();
		fireEvent.click(screen.getByRole('checkbox', { name: '我确认只删除本地镜像' }));
		fireEvent.click(deleteButton);
		expect(onDeleteFavorite).toHaveBeenCalledWith(favorite.id);
    });

	it('disables locked destinations in the add-to-playlist modal', async () => {
        const onAdd = vi.fn();
        const lockedTarget = { ...favorite, songIds: [] };
        render(<MantineProvider><AddToFavoriteModal opened onClose={vi.fn()} favorites={[lockedTarget]} currentSong={song} themeColor="blue" onAdd={onAdd} /></MantineProvider>);
		const target = screen.getByRole('button', { name: 'Locked （同步歌单）' });
		expect(target).toBeDisabled();
		await waitFor(() => expect(serviceMocks.getFavoriteMemberships).toHaveBeenCalledWith(song.id));
        fireEvent.click(target);
        expect(onAdd).not.toHaveBeenCalled();
    });
});
