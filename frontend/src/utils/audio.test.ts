import { describe, expect, it } from 'vitest';
import { dbToGain, getNativeVolume, MAX_COMPENSATION_GAIN, MIN_COMPENSATION_GAIN } from './audio';

describe('dbToGain', () => {
    it('converts decibels to linear gain', () => {
        expect(dbToGain(0)).toBe(1);
        expect(dbToGain(6)).toBeCloseTo(1.995, 3);
        expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    });

    it('clamps unsafe values and treats non-finite input as zero', () => {
        expect(dbToGain(-100)).toBe(MIN_COMPENSATION_GAIN);
        expect(dbToGain(100)).toBe(MAX_COMPENSATION_GAIN);
        expect(dbToGain(Number.NaN)).toBe(1);
    });
});

describe('getNativeVolume', () => {
    it('applies compensation and clamps the audio element volume', () => {
        expect(getNativeVolume(0.5, 6)).toBeCloseTo(0.998, 3);
        expect(getNativeVolume(0.8, 12)).toBe(1);
        expect(getNativeVolume(-1, 0)).toBe(0);
    });
});
