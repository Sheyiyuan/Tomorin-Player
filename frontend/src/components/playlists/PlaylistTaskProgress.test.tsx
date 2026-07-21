import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlaylistTaskProgress from './PlaylistTaskProgress';

describe('PlaylistTaskProgress', () => {
	it('shows determinate video progress and skipped resources', () => {
		render(
			<MantineProvider>
				<PlaylistTaskProgress
					progress={{ stage: 'resolving', completedVideoCount: 2, totalVideoCount: 4, skippedCount: 1 }}
					themeColor="blue"
				/>
			</MantineProvider>,
		);
		expect(screen.getByText('正在解析视频 2 / 4')).toBeInTheDocument();
		expect(screen.getByText('已跳过 1 项不支持的内容')).toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
	});

	it('uses an animated bar while the snapshot size is unknown', () => {
		render(
			<MantineProvider>
				<PlaylistTaskProgress progress={{ stage: 'fetching', completedVideoCount: 0, totalVideoCount: 0, skippedCount: 0 }} themeColor="blue" />
			</MantineProvider>,
		);
		expect(screen.getByText('正在读取收藏夹...')).toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toHaveClass('mantine-Progress-section');
	});
});
