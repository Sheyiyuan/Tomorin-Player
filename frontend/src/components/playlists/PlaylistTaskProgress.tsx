import { Progress, Stack, Text } from '@mantine/core';
import type { PlaylistSyncProgress } from '../../types';

interface PlaylistTaskProgressProps {
	progress: PlaylistSyncProgress;
	themeColor: string;
	completedFavorites?: number;
	totalFavorites?: number;
}

const progressLabel = (progress: PlaylistSyncProgress): string => {
	switch (progress.stage) {
		case 'fetching':
			return '正在读取收藏夹...';
		case 'resolving':
			return progress.totalVideoCount > 0
				? `正在解析视频 ${Math.min(progress.completedVideoCount, progress.totalVideoCount)} / ${progress.totalVideoCount}`
				: '没有需要解析的视频';
		case 'committing':
			return '正在保存歌单...';
		case 'completed':
			return '处理完成';
		default:
			return '等待开始...';
	}
};

const PlaylistTaskProgress = ({ progress, themeColor, completedFavorites = 0, totalFavorites = 1 }: PlaylistTaskProgressProps) => {
	const determinate = progress.stage === 'resolving' || progress.stage === 'completed';
	const value = progress.stage === 'completed'
		? 100
		: progress.totalVideoCount > 0
			? Math.min(100, (progress.completedVideoCount / progress.totalVideoCount) * 100)
			: 0;

	return (
		<Stack gap={6} role="status" aria-live="polite">
			<Text size="sm" fw={500}>{progressLabel(progress)}</Text>
			<Progress
				aria-label="收藏夹处理进度"
				value={determinate ? value : 100}
				color={themeColor}
				striped={!determinate}
				animated={!determinate}
				size="sm"
			/>
			{progress.skippedCount > 0 && <Text size="xs" c="dimmed">已跳过 {progress.skippedCount} 项不支持的内容</Text>}
			{totalFavorites > 1 && <Text size="xs" c="dimmed">已完成 {completedFavorites} / {totalFavorites} 个歌单</Text>}
		</Stack>
	);
};

export default PlaylistTaskProgress;
