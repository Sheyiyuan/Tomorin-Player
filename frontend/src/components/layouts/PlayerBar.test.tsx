import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Song } from '../../types';
import PlayerBar, { type PlayerBarProps } from './PlayerBar';

const currentSong: Song = {
    id: 'song-1',
    bvid: 'BV1xx411c7mD',
    name: 'Song',
    singer: 'Singer',
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

const createProps = (): PlayerBarProps => ({
    themeColor: 'blue',
    computedColorScheme: 'light',
    currentSong,
    progressInInterval: 0,
    intervalStart: 0,
    intervalLength: 60,
    duration: 60,
    formatTime: (seconds) => String(seconds),
    formatTimeWithMs: (seconds) => String(seconds),
    seek: vi.fn(),
    playPrev: vi.fn(),
    togglePlay: vi.fn(),
    playNext: vi.fn(),
    isPlaying: false,
    playMode: 'loop',
    onTogglePlayMode: vi.fn(),
    onAddToFavorite: vi.fn(),
    onShowPlaylist: vi.fn(),
    onDownloadSong: vi.fn(),
    onManageDownload: vi.fn(),
    downloadedSongIds: new Set<string>(),
    volume: 0.5,
    changeVolume: vi.fn(),
    songsCount: 1,
});

describe('PlayerBar', () => {
    it('keeps play enabled while the current song stream needs resolution', () => {
        render(
            <MantineProvider>
                <PlayerBar {...createProps()} />
            </MantineProvider>,
        );

        expect(screen.getByRole('button', { name: '播放' })).toBeEnabled();
    });
});
