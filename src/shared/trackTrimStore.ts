import { TrackTrimPoint } from './types';
import {
  hasValidExtensionRuntime,
  isExtensionContextInvalidatedError,
} from './runtimeSafety';

const TRACK_TRIMS_STORAGE_KEY = 'aesthetic_music_track_trims_v1';
export const MAX_TRACK_TRIM_ENTRIES = 200;
export const MIN_TRACK_TRIM_SPAN_SEC = 2.0;

function roundTenths(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Clamps optional intro/outro trim bounds to valid non-negative track times
 * while enforcing at least MIN_TRACK_TRIM_SPAN_SEC between start and end.
 */
export function clampTrimRange(
  startSec: number | undefined,
  endSec: number | undefined,
  durationSec = 0
): { startSec?: number; endSec?: number } {
  const maxDur = Number.isFinite(durationSec) && durationSec > 0 ? roundTenths(durationSec) : 0;

  let start =
    typeof startSec === 'number' && Number.isFinite(startSec)
      ? Math.max(0, roundTenths(startSec))
      : undefined;
  let end =
    typeof endSec === 'number' && Number.isFinite(endSec)
      ? Math.max(0, roundTenths(endSec))
      : undefined;

  if (maxDur > 0) {
    if (start !== undefined) start = Math.min(start, maxDur);
    if (end !== undefined) end = Math.min(end, maxDur);
  }

  if (start !== undefined && end !== undefined) {
    if (end < start) {
      [start, end] = [end, start];
    }
    if (end - start < MIN_TRACK_TRIM_SPAN_SEC) {
      if (maxDur > 0 && start + MIN_TRACK_TRIM_SPAN_SEC > maxDur) {
        start = Math.max(0, roundTenths(maxDur - MIN_TRACK_TRIM_SPAN_SEC));
        end = maxDur;
      } else {
        end = roundTenths(start + MIN_TRACK_TRIM_SPAN_SEC);
      }
    }
  } else if (start !== undefined && maxDur > MIN_TRACK_TRIM_SPAN_SEC) {
    start = Math.min(start, roundTenths(maxDur - MIN_TRACK_TRIM_SPAN_SEC));
  } else if (end !== undefined) {
    const minEnd = maxDur > 0 ? Math.min(maxDur, MIN_TRACK_TRIM_SPAN_SEC) : MIN_TRACK_TRIM_SPAN_SEC;
    end = Math.max(minEnd, end);
  }

  return {
    ...(start !== undefined ? { startSec: start } : {}),
    ...(end !== undefined ? { endSec: end } : {}),
  };
}

/**
 * Validates and bounds an imported/stored trim map to the most recently updated
 * MAX_TRACK_TRIM_ENTRIES songs, discarding empty or corrupted records.
 */
export function sanitizeTrimMap(
  raw: unknown,
  maxEntries = MAX_TRACK_TRIM_ENTRIES
): Record<string, TrackTrimPoint> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const validEntries: TrackTrimPoint[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Partial<TrackTrimPoint>;
    const videoId = String(item.videoId || key || '').trim();
    if (!videoId) continue;

    const range = clampTrimRange(item.startSec, item.endSec);
    if (range.startSec === undefined && range.endSec === undefined) continue;

    const updatedAt =
      typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) && item.updatedAt >= 0
        ? item.updatedAt
        : 0;

    validEntries.push({
      videoId,
      ...range,
      updatedAt,
    });
  }

  validEntries.sort((a, b) => b.updatedAt - a.updatedAt);
  const bounded = validEntries.slice(0, Math.max(1, maxEntries));
  const out: Record<string, TrackTrimPoint> = {};
  for (const entry of bounded) {
    out[entry.videoId] = entry;
  }
  return out;
}

/**
 * Pure LRU upsert for per-track trim points; deletes the key if neither bound remains.
 */
export function upsertTrackTrimPoint(
  existing: Record<string, TrackTrimPoint>,
  nextPoint: TrackTrimPoint,
  durationSec = 0,
  maxEntries = MAX_TRACK_TRIM_ENTRIES
): Record<string, TrackTrimPoint> {
  const videoId = String(nextPoint.videoId || '').trim();
  if (!videoId) return existing;

  const copy: Record<string, TrackTrimPoint> = { ...existing };
  const range = clampTrimRange(nextPoint.startSec, nextPoint.endSec, durationSec);
  if (range.startSec === undefined && range.endSec === undefined) {
    delete copy[videoId];
    return sanitizeTrimMap(copy, maxEntries);
  }

  copy[videoId] = {
    videoId,
    ...range,
    updatedAt: Number.isFinite(nextPoint.updatedAt) ? nextPoint.updatedAt : Date.now(),
  };

  return sanitizeTrimMap(copy, maxEntries);
}

/**
 * Returns the saved intro start time (seconds) to jump to when a track starts
 * inside its trimmed intro, or null if no jump is needed.
 */
export function shouldSkipIntro(
  currentTimeSec: number,
  trim: TrackTrimPoint | null | undefined,
  alreadyAppliedForPlay: boolean
): number | null {
  if (alreadyAppliedForPlay) return null;
  if (!trim || typeof trim.startSec !== 'number' || !Number.isFinite(trim.startSec)) {
    return null;
  }
  if (!Number.isFinite(currentTimeSec) || trim.startSec < 0.5) return null;
  if (currentTimeSec < trim.startSec - 0.35) {
    return trim.startSec;
  }
  return null;
}

/**
 * Returns true when playback has reached the track's saved outro cutoff and
 * should advance to the next song cleanly (guarded once per play).
 */
export function shouldSkipOutro(
  currentTimeSec: number,
  durationSec: number,
  trim: TrackTrimPoint | null | undefined,
  alreadyTriggeredForPlay: boolean
): boolean {
  if (alreadyTriggeredForPlay) return false;
  if (!trim || typeof trim.endSec !== 'number' || !Number.isFinite(trim.endSec)) {
    return false;
  }
  if (!Number.isFinite(currentTimeSec) || trim.endSec < MIN_TRACK_TRIM_SPAN_SEC) {
    return false;
  }
  if (Number.isFinite(durationSec) && durationSec > 0 && trim.endSec >= durationSec - 0.2) {
    // Outro trim is essentially at the natural end of the track anyway
    return false;
  }
  return currentTimeSec >= trim.endSec - 0.15;
}

export async function loadAllTrackTrims(): Promise<Record<string, TrackTrimPoint>> {
  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      const res = await chrome.storage.local.get(TRACK_TRIMS_STORAGE_KEY);
      return sanitizeTrimMap(res[TRACK_TRIMS_STORAGE_KEY]);
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to load track trims:', err);
    }
  }
  return {};
}

export async function loadTrackTrim(videoId: string): Promise<TrackTrimPoint | null> {
  const id = String(videoId || '').trim();
  if (!id) return null;
  const all = await loadAllTrackTrims();
  return all[id] || null;
}

export async function saveTrackTrim(
  trim: Omit<TrackTrimPoint, 'updatedAt'> & { updatedAt?: number },
  durationSec = 0
): Promise<TrackTrimPoint | null> {
  const id = String(trim.videoId || '').trim();
  if (!id) return null;

  const current = await loadAllTrackTrims();
  const nextMap = upsertTrackTrimPoint(
    current,
    {
      videoId: id,
      startSec: trim.startSec,
      endSec: trim.endSec,
      updatedAt: trim.updatedAt ?? Date.now(),
    },
    durationSec
  );

  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      await chrome.storage.local.set({ [TRACK_TRIMS_STORAGE_KEY]: nextMap });
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to save track trim:', err);
    }
  }

  return nextMap[id] || null;
}

export async function clearTrackTrim(videoId: string): Promise<void> {
  const id = String(videoId || '').trim();
  if (!id) return;

  const current = await loadAllTrackTrims();
  if (!current[id]) return;

  const nextMap = { ...current };
  delete nextMap[id];

  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      await chrome.storage.local.set({ [TRACK_TRIMS_STORAGE_KEY]: nextMap });
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to clear track trim:', err);
    }
  }
}
