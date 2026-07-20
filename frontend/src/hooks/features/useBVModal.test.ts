import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BVPreview, Favorite } from '../../types';

const serviceMocks = vi.hoisted(() => ({ searchBVID: vi.fn() }));
const notificationMocks = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({ SearchBVID: serviceMocks.searchBVID }));
vi.mock('@mantine/notifications', () => ({ notifications: notificationMocks }));

import { useBVModal } from './useBVModal';

const favorite: Favorite = {
    id: 'locked',
    title: 'Locked',
    songIds: [],
    createdAt: '',
    updatedAt: '',
    source: {
        id: 'source', favoriteId: 'locked', provider: 'bilibili', remoteId: '42', locked: true,
        syncState: 'idle', lastErrorCode: '', lastErrorMessage: '', lastSnapshotHash: '', remoteCount: 0,
        createdAt: '', updatedAt: '',
    },
};

const preview: BVPreview = {
    bvid: 'BV1xx411c7mD',
    title: 'Video',
    cover: '',
    url: '',
    expiresAt: '',
    duration: 60,
};

describe('useBVModal', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects a stale locked target before creating songs or stream sources', async () => {
        const { result } = renderHook(() => useBVModal({
            bvPreview: preview,
            sliceStart: 0,
            sliceEnd: 60,
            bvSongName: 'Video',
            bvSinger: 'Singer',
            bvTargetFavId: favorite.id,
            favorites: [favorite],
            closeBvModal: vi.fn(),
            setBvPreview: vi.fn(),
            setBvSongName: vi.fn(),
            setBvSinger: vi.fn(),
            setSliceStart: vi.fn(),
            setSliceEnd: vi.fn(),
            setSongs: vi.fn(),
            setFavorites: vi.fn(),
            setSelectedFavId: vi.fn(),
        }));

        await act(async () => { await result.current.handleConfirmBVAdd(); });

        expect(serviceMocks.searchBVID).not.toHaveBeenCalled();
        expect(notificationMocks.show).toHaveBeenCalledWith({
            title: '同步歌单为只读',
            message: '请选择本地歌单，或先创建本地副本',
            color: 'orange',
        });
    });
});
