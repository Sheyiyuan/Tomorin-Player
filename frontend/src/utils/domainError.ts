export interface DomainErrorInfo {
    code: string;
    message: string;
    retryable: boolean;
    details: Record<string, string>;
}

const toRecord = (value: unknown): Record<string, unknown> => (
    typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
);

const parseObject = (value: unknown): DomainErrorInfo | null => {
    const record = toRecord(value);
    if (typeof record.code !== 'string' || typeof record.message !== 'string') return null;
    const detailsRecord = toRecord(record.details);
    const details = Object.fromEntries(
        Object.entries(detailsRecord).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    return {
        code: record.code,
        message: record.message,
        retryable: record.retryable === true,
        details,
    };
};

export const parseDomainError = (cause: unknown): DomainErrorInfo => {
    const candidates: unknown[] = [cause];
    if (cause instanceof Error) candidates.push(cause.message);

    for (const candidate of candidates) {
        const direct = parseObject(candidate);
        if (direct) return direct;
        if (typeof candidate !== 'string') continue;
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start < 0 || end <= start) continue;
        try {
            const parsed = parseObject(JSON.parse(candidate.slice(start, end + 1)));
            if (parsed) return parsed;
        } catch {
            // Fall through to the generic message below.
        }
    }

    return {
        code: 'UNKNOWN',
        message: cause instanceof Error ? cause.message : String(cause),
        retryable: false,
        details: {},
    };
};
