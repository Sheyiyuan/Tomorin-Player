import React from 'react';
import { Button, Center, Stack, Text } from '@mantine/core';

interface Props {
    children: React.ReactNode;
    color?: string;
}

interface State {
    failed: boolean;
}

export class LyricErrorBoundary extends React.Component<Props, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[lyrics] render failed', error, info);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <Center h="100%" role="status">
                <Stack align="center" gap="xs">
                    <Text fw={600}>歌词区域暂时无法显示</Text>
                    <Text size="sm" c="dimmed">播放未受影响，可以重试此区域。</Text>
                    <Button size="xs" color={this.props.color} onClick={() => this.setState({ failed: false })}>重试</Button>
                </Stack>
            </Center>
        );
    }
}
