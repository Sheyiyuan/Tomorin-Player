import { act, render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginModal from './LoginModal';

const serviceMocks = vi.hoisted(() => ({
    generateLoginQR: vi.fn(),
    pollLogin: vi.fn(),
}));

vi.mock('../../../wailsjs/go/services/Service', () => ({
    GenerateLoginQR: serviceMocks.generateLoginQR,
    PollLogin: serviceMocks.pollLogin,
}));

vi.mock('qrcode', () => ({
    default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

describe('LoginModal polling lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        serviceMocks.generateLoginQR.mockResolvedValue({ url: 'https://example.com/qr', qrcode_key: 'key-1' });
        serviceMocks.pollLogin.mockResolvedValue({ loggedIn: false });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('stops polling after the modal closes', async () => {
        const view = render(
            <MantineProvider>
                <LoginModal opened onClose={vi.fn()} onLoginSuccess={vi.fn()} />
            </MantineProvider>,
        );

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(serviceMocks.pollLogin).toHaveBeenCalledTimes(1);

        view.rerender(
            <MantineProvider>
                <LoginModal opened={false} onClose={vi.fn()} onLoginSuccess={vi.fn()} />
            </MantineProvider>,
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(serviceMocks.pollLogin).toHaveBeenCalledTimes(1);
    });
});
