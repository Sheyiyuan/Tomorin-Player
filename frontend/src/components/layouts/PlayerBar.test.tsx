import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
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

	it('keeps transport geometry stable across icon and title changes', () => {
		const { rerender } = render(<MantineProvider><PlayerBar {...createProps()} /></MantineProvider>);
		const transport = document.querySelector('.player-transport');
		const playButton = screen.getByRole('button', { name: '播放' });
		const initialStyle = playButton.getAttribute('style');
		rerender(<MantineProvider><PlayerBar {...createProps()} currentSong={{ ...currentSong, name: 'A very long title that must remain on one line without moving controls' }} isPlaying /></MantineProvider>);
		expect(document.querySelector('.player-transport')).toBe(transport);
		expect(screen.getByRole('button', { name: '暂停' })).toBe(playButton);
		expect(playButton.getAttribute('style')).toBe(initialStyle);
		expect(document.querySelector('.player-bar')).toHaveStyle({ height: '100%' });
		expect(document.querySelector('.compact-player-cover')).toBeNull();
	});

	it('positions the volume label below its slider', () => {
		render(<MantineProvider><PlayerBar {...createProps()} /></MantineProvider>);
		const volumeTrack = document.querySelector('.player-volume .mantine-Slider-trackContainer');
		expect(volumeTrack).not.toBeNull();
		fireEvent.mouseEnter(volumeTrack as Element);
		expect(screen.getByText('50%')).toHaveStyle({ top: 'calc(100% + 4px)' });
	});

    it('opens the anchored playback queue and plays a row', async () => {
        const onPlayQueueItem = vi.fn();
        render(
            <MantineProvider>
                <PlayerBar
                    {...createProps()}
                    queueItems={[{ queueItemId: 'queue-1', song: currentSong }]}
                    playOrder={['queue-1']}
                    currentQueueItemId="queue-1"
                    onPlayQueueItem={onPlayQueueItem}
                />
            </MantineProvider>,
        );

        const queueButton = screen.getByRole('button', { name: '打开播放队列，共 1 首' });
        expect(queueButton).not.toHaveAttribute('title');
        fireEvent.click(queueButton);
        expect(queueButton).toHaveAttribute('aria-expanded', 'true');
        expect(await screen.findByRole('list', { name: '播放队列', hidden: true })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('listitem', { name: '播放 Song', hidden: true }));
        expect(onPlayQueueItem).toHaveBeenCalledWith(0);
    });
});
