import { notifications } from '@mantine/notifications';
import * as Services from '../../wailsjs/go/services/Service';
import { parseDomainError } from './domainError';

export type ExitBehavior = 'minimize' | 'quit';
export const EXIT_BEHAVIOR_KEY = 'half-beat.exitBehavior';

export function getStoredExitBehavior(): ExitBehavior | null {
    const stored = localStorage.getItem(EXIT_BEHAVIOR_KEY);
    return stored === 'minimize' || stored === 'quit' ? stored : null;
}

export async function executeExitBehavior(behavior: ExitBehavior): Promise<void> {
    try {
        if (behavior === 'minimize') {
            await Services.MinimizeToTray();
        } else {
            await Services.QuitApp();
        }
    } catch (error) {
        console.error('Error executing exit behavior:', error);
        notifications.show({
            title: '关闭失败',
            message: parseDomainError(error).message,
            color: 'red',
            autoClose: 5000,
        });
    }
}
