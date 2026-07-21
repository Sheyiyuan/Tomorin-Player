import { useCallback, useEffect, useState } from 'react';
import { GetImageProxyURL, RefreshProxyURL } from '../../../wailsjs/go/services/Service';

const proxiedImageUrls = new Map<string, string>();
const pendingImageUrls = new Map<string, Promise<string>>();
const cacheSubscribers = new Set<() => void>();
let cacheGeneration = 0;

export const clearImageProxyCache = (): void => {
    cacheGeneration += 1;
    proxiedImageUrls.clear();
    pendingImageUrls.clear();
    cacheSubscribers.forEach((notify) => notify());
};

const isLoopbackImageProxyUrl = (value: string): boolean => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/image';
    } catch {
        return false;
    }
};

const requiresImageGateway = (value: string): boolean => {
    if (isLoopbackImageProxyUrl(value)) return true;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

const requestProxyUrl = (originalUrl: string): Promise<string> => {
    const cached = proxiedImageUrls.get(originalUrl);
    if (cached) return Promise.resolve(cached);

    const pending = pendingImageUrls.get(originalUrl);
    if (pending) return pending;

    const generation = cacheGeneration;
    const request = (isLoopbackImageProxyUrl(originalUrl)
        ? RefreshProxyURL(originalUrl)
        : GetImageProxyURL(originalUrl))
        .then((proxyUrl) => {
            if (proxyUrl && generation === cacheGeneration) {
                proxiedImageUrls.set(originalUrl, proxyUrl);
            }
            return proxyUrl || '';
        })
        .finally(() => {
            if (pendingImageUrls.get(originalUrl) === request) {
                pendingImageUrls.delete(originalUrl);
            }
        });

    pendingImageUrls.set(originalUrl, request);
    return request;
};

/** Uses complete backend-generated URLs because proxy ports and tokens are process scoped. */
export const useImageProxy = () => {
    const [isProxyEnabled, setIsProxyEnabled] = useState(true);
    const [, rerender] = useState(0);

    useEffect(() => {
        const notify = () => rerender((value) => value + 1);
        cacheSubscribers.add(notify);
        return () => {
            cacheSubscribers.delete(notify);
        };
    }, []);

    const getProxiedImageUrl = useCallback(async (originalUrl: string): Promise<string> => {
        if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('blob:') || !requiresImageGateway(originalUrl)) {
            return originalUrl;
        }
        if (!isProxyEnabled) return '';
        try {
            return await requestProxyUrl(originalUrl);
        } catch (error) {
            console.warn('Failed to get proxied image URL:', error);
            return '';
        }
    }, [isProxyEnabled]);

    const getProxiedImageUrlSync = useCallback((originalUrl: string): string => {
        if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('blob:') || !requiresImageGateway(originalUrl)) {
            return originalUrl;
        }
        if (!isProxyEnabled) return '';

        const cached = proxiedImageUrls.get(originalUrl);
        if (cached) return cached;

        void requestProxyUrl(originalUrl)
            .then(() => rerender((value) => value + 1))
            .catch((error) => console.warn('Failed to get proxied image URL:', error));
        return '';
    }, [isProxyEnabled]);

    return {
        getProxiedImageUrl,
        getProxiedImageUrlSync,
        isProxyEnabled,
        setIsProxyEnabled,
    };
};
