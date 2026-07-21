export const MIN_COMPENSATION_GAIN = 0.25;
export const MAX_COMPENSATION_GAIN = 4;

export function dbToGain(db: number): number {
    const normalizedDb = Number.isFinite(db) ? db : 0;
    const gain = Math.pow(10, normalizedDb / 20);
    return Math.min(MAX_COMPENSATION_GAIN, Math.max(MIN_COMPENSATION_GAIN, gain));
}

export function getNativeVolume(volume: number, compensationDb: number): number {
    const normalizedVolume = Number.isFinite(volume) ? volume : 0;
    return Math.min(1, Math.max(0, normalizedVolume * dbToGain(compensationDb)));
}
