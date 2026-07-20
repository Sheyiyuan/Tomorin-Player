import { describe, expect, it } from 'vitest';
import { parseDomainError } from './domainError';

describe('parseDomainError', () => {
    it('reads structured Wails error payloads without string matching error codes', () => {
        const parsed = parseDomainError(new Error('backend: {"code":"PLAYLIST_LOCKED","message":"只读","retryable":false,"details":{"favoriteId":"fav"}}'));
        expect(parsed).toEqual({ code: 'PLAYLIST_LOCKED', message: '只读', retryable: false, details: { favoriteId: 'fav' } });
    });

    it('falls back to an unknown user-facing error', () => {
        expect(parseDomainError('offline')).toMatchObject({ code: 'UNKNOWN', message: 'offline' });
    });
});
