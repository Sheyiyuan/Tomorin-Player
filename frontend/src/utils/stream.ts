import type { Song } from '../types';

const isLoopbackProxyPath = (value: string, path: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === path;
    } catch {
        return false;
    }
};

export function shouldRefreshStream(song: Song, now: number = Date.now()): boolean {
    const streamUrl = song.streamUrl || '';
    if (isLoopbackProxyPath(streamUrl, '/local')) return false;
    if (!isLoopbackProxyPath(streamUrl, '/audio')) return true;

    const expiresAt = Date.parse(song.streamUrlExpiresAt || '');
    return !Number.isFinite(expiresAt) || expiresAt <= now + 60_000;
}
