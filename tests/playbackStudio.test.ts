import { describe, expect, it } from 'vitest';
import {
  clampPlaybackRate,
  formatShortSeconds,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  normalizeAbLoopRange,
  shouldTriggerAbLoopSeek,
} from '../src/shared/playbackStudio';

describe('playbackStudio helpers', () => {
  it('clamps playback rates into [0.75, 1.50] at 0.05x increments', () => {
    expect(clampPlaybackRate(0.2)).toBe(MIN_PLAYBACK_RATE);
    expect(clampPlaybackRate(3.0)).toBe(MAX_PLAYBACK_RATE);
    expect(clampPlaybackRate(1.13)).toBe(1.15);
    expect(clampPlaybackRate(Number.NaN)).toBe(1.0);
  });

  it('normalizes A-B loop ranges safely and preserves at least a 1s gap', () => {
    expect(normalizeAbLoopRange(50, 20, 200)).toEqual({ aSec: 20, bSec: 50 });
    expect(normalizeAbLoopRange(40, 40.2, 200)).toEqual({ aSec: 40, bSec: 41 });
    expect(normalizeAbLoopRange(199.8, 200, 200)).toEqual({ aSec: 199, bSec: 200 });
    expect(normalizeAbLoopRange(null, 30, 120)).toEqual({ aSec: null, bSec: 30 });
  });

  it('triggers A-B loop seek only when valid range is crossed', () => {
    expect(shouldTriggerAbLoopSeek(15, { aSec: 10, bSec: 20 })).toBeNull();
    expect(shouldTriggerAbLoopSeek(19.95, { aSec: 10, bSec: 20 })).toBe(10);
    expect(shouldTriggerAbLoopSeek(21, { aSec: 10, bSec: 20 })).toBe(10);
    expect(shouldTriggerAbLoopSeek(21, { aSec: 10, bSec: null })).toBeNull();
    expect(shouldTriggerAbLoopSeek(21, { aSec: 10, bSec: 10.5 })).toBeNull();
  });

  it('formats timestamps cleanly as M:SS', () => {
    expect(formatShortSeconds(0)).toBe('0:00');
    expect(formatShortSeconds(65)).toBe('1:05');
    expect(formatShortSeconds(-5)).toBe('0:00');
  });
});
