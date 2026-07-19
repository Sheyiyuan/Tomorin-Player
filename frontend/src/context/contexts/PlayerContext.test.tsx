import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../../types';
import { PlayerProvider, usePlayerContext } from './PlayerContext';

const serviceMocks = vi.hoisted(() => ({ savePlaylist: vi.fn() }));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    SavePlaylist: serviceMocks.savePlaylist,
}));

const song: Song = {
    id: 'song-1',
    bvid: 'BV1xx411c7mD',
    name: 'Song',
    singer: '',
    singerId: '',
    cover: '',
    coverLocal: '',
    sourceId: '',
    streamUrl: '',
    streamUrlExpiresAt: '',
    lyric: '',
    lyricOffset: 0,
    skipStartTime: 0,
    skipEndTime: 0,
    pageNumber: 1,
    pageTitle: '',
    videoTitle: '',
    totalPages: 1,
    createdAt: '',
    updatedAt: '',
};

const wrapper = ({ children }: PropsWithChildren) => <PlayerProvider>{children}</PlayerProvider>;

describe('PlayerContext queue persistence', () => {
    beforeEach(() => serviceMocks.savePlaylist.mockResolvedValue(undefined));

    it('waits for hydration and persists a cleared queue once', async () => {
        const { result } = renderHook(() => usePlayerContext(), { wrapper });

        act(() => result.current.actions.setQueue([song]));
        expect(serviceMocks.savePlaylist).not.toHaveBeenCalled();

        act(() => result.current.actions.setPlaylistHydrated(true));
        await waitFor(() => expect(serviceMocks.savePlaylist).toHaveBeenCalledWith('["song-1"]', 0));

        serviceMocks.savePlaylist.mockClear();
        act(() => result.current.actions.setQueue([]));
        await waitFor(() => expect(serviceMocks.savePlaylist).toHaveBeenCalledTimes(1));
        expect(serviceMocks.savePlaylist).toHaveBeenCalledWith('[]', 0);
    });
});
