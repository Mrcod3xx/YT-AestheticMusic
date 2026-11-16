import { AbLoopRange } from './types';

export const MIN_PLAYBACK_RATE = 0.75;
export const MAX_PLAYBACK_RATE = 1.5;
export const MIN_AB_LOOP_GAP_SEC = 1.0;

/** Clamps and rounds playback speed cleanly to 0.05x increments inside [0.75, 1.50]. */
export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1.0;
  const clamped = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
  return Math.round(clamped * 20) / 20;
}

/**
 * Normalizes an A-B section loop range so A <= B with at least 1.0 second span
 * and safe clamping within the current track duration.
 */
export function normalizeAbLoopRange(
  aSec: number | null,
  bSec: number | null,
  durationSec: number
): AbLoopRange {
  const maxDur = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const clampPoint = (pt: number | null): number | null => {
    if (pt === null || !Number.isFinite(pt)) return null;
    const lower = Math.max(0, pt);
    return maxDur > 0 ? Math.min(maxDur, lower) : lower;
  };

  let a = clampPoint(aSec);
  let b = clampPoint(bSec);

  if (a !== null && b !== null) {
    if (b < a) {
      [a, b] = [b, a];
    }
    if (b - a < MIN_AB_LOOP_GAP_SEC) {
      if (maxDur > 0 && a + MIN_AB_LOOP_GAP_SEC > maxDur) {
        a = Math.max(0, maxDur - MIN_AB_LOOP_GAP_SEC);
        b = maxDur;
      } else {
        b = a + MIN_AB_LOOP_GAP_SEC;
      }
    }
  }

  return { aSec: a, bSec: b };
}

/**
 * Returns the loop-start seek target (seconds) when playback reaches or passes B,
 * or null if playback should continue normally.
 */
export function shouldTriggerAbLoopSeek(
  currentTimeSec: number,
  range: AbLoopRange
): number | null {
  if (range.aSec === null || range.bSec === null) return null;
  if (!Number.isFinite(currentTimeSec)) return null;
  if (range.bSec - range.aSec < MIN_AB_LOOP_GAP_SEC) return null;
  if (currentTimeSec >= range.bSec - 0.08) {
    return range.aSec;
  }
  return null;
}

export function formatShortSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
