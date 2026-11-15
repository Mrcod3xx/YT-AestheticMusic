import { LyricLine } from './types';

export interface LrcLibRecord {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export function cleanTrackTitle(rawTitle: string, rawArtist: string): string {
  let cleaned = rawTitle
    .replace(
      /\s*[\[(](official\s*)?(music\s*)?(video|audio|lyric\s*video|lyrics|visualizer|hd|4k|hq|explicit|clean|live|feat\.?[^\])]*|ft\.?[^\])]*|remix)[\])]/gi,
      ' '
    )
    .replace(/\s*\(feat\.[^)]*\)/gi, ' ')
    .replace(/\s*\[[^\]]*video[^\]]*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Video titles on YouTube Music often take the form "Artist - Song Title"
  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0 && rawArtist) {
    const left = cleaned.slice(0, dashIdx).trim().toLowerCase();
    const artistNorm = rawArtist.trim().toLowerCase();
    if (artistNorm.includes(left) || left.includes(artistNorm.split(',')[0].trim())) {
      cleaned = cleaned.slice(dashIdx + 3).trim();
    }
  }

  return cleaned || rawTitle.trim();
}

export function cleanArtistName(rawArtist: string): string {
  return rawArtist
    .split(/\s*(?:,|&|feat\.|ft\.|x)\s*/i)[0]
    .trim();
}

export function isLikelyAlbumName(album?: string): boolean {
  if (!album) return false;
  const trimmed = album.trim();
  if (!trimmed) return false;
  if (/^\d+(\.\d+)?[KMB]?\s+views?$/i.test(trimmed)) return false;
  if (/^\d{4}$/.test(trimmed)) return false;
  if (/^\d+:\d+$/.test(trimmed)) return false;
  return true;
}

export function toPlainLyricLines(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  let prevBlank = true;
  for (const part of raw.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = part.trim();
    if (!trimmed) {
      if (!prevBlank) {
        lines.push({ text: '' });
        prevBlank = true;
      }
    } else {
      lines.push({ text: trimmed });
      prevBlank = false;
    }
  }
  while (lines.length > 0 && !lines[lines.length - 1].text) {
    lines.pop();
  }
  return lines;
}

export function parseLrcTimestampedLyrics(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeTagRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lrc.replace(/\r\n/g, '\n').split('\n')) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeTagRegex.lastIndex = 0;

    while ((match = timeTagRegex.exec(rawLine)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fracRaw = match[3] || '0';
      const millis =
        fracRaw.length === 3
          ? Number(fracRaw)
          : fracRaw.length === 2
          ? Number(fracRaw) * 10
          : Number(fracRaw) * 100;
      const totalMs = minutes * 60_000 + seconds * 1_000 + millis;
      if (Number.isFinite(totalMs)) {
        timestamps.push(totalMs);
      }
    }

    if (timestamps.length === 0) continue;

    const text = rawLine.replace(timeTagRegex, '').trim();
    for (const startTimeMs of timestamps) {
      lines.push({ text, startTimeMs });
    }
  }

  lines.sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));

  // Filter leading empty cues before the first lyric while preserving mid-song instrumental pauses
  while (lines.length > 0 && !lines[0].text) {
    lines.shift();
  }

  return lines;
}

export function pickBestLrcCandidate(
  candidates: LrcLibRecord[],
  cleanTitle: string,
  cleanArtist: string,
  durationSec: number
): LrcLibRecord | null {
  const withSynced = candidates.filter((c) => Boolean(c.syncedLyrics?.trim()));
  const pool =
    withSynced.length > 0
      ? withSynced
      : candidates.filter((c) => Boolean(c.plainLyrics?.trim()));
  if (pool.length === 0) return null;

  const titleLower = cleanTitle.toLowerCase();
  const artistLower = cleanArtist.toLowerCase();

  let best: LrcLibRecord | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const item of pool) {
    let score = item.syncedLyrics ? 50 : 0;
    const itemTitle = (item.trackName || '').toLowerCase();
    const itemArtist = (item.artistName || '').toLowerCase();

    if (itemTitle === titleLower) score += 40;
    else if (itemTitle.includes(titleLower) || titleLower.includes(itemTitle)) score += 20;

    if (artistLower && (itemArtist.includes(artistLower) || artistLower.includes(itemArtist))) {
      score += 30;
    }

    if (durationSec > 0 && typeof item.duration === 'number') {
      const diff = Math.abs(item.duration - durationSec);
      if (diff <= 3) score += 35;
      else if (diff <= 10) score += 20;
      else if (diff <= 20) score += 5;
      else if (diff > 35) score -= 45;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore > 20 ? best : null;
}

export const LYRICS_TIMING_OFFSET_MIN_MS = -10_000;
export const LYRICS_TIMING_OFFSET_MAX_MS = 10_000;

/** Clamps a per-session lyrics timing shift (ms) cleanly inside [-10s, +10s]. */
export function clampLyricsTimingOffsetMs(offsetMs: number): number {
  if (!Number.isFinite(offsetMs)) return 0;
  return Math.min(
    LYRICS_TIMING_OFFSET_MAX_MS,
    Math.max(LYRICS_TIMING_OFFSET_MIN_MS, Math.round(offsetMs))
  );
}

/** Formats signed offset seconds cleanly (e.g. "+0.5s", "-1.0s", "0.0s"). */
export function formatLyricsOffsetLabel(offsetMs: number): string {
  const clamped = clampLyricsTimingOffsetMs(offsetMs);
  if (clamped === 0) return '0.0s';
  const sign = clamped > 0 ? '+' : '-';
  return `${sign}${(Math.abs(clamped) / 1000).toFixed(1)}s`;
}

/**
 * Resolves the active synced lyric index at `playbackTimeMs` with a manual shift (`timingOffsetMs`).
 * Positive `timingOffsetMs` shifts lyrics later so lines fire at `startTimeMs + timingOffsetMs`.
 */
export function findActiveSyncedLineIndex(
  lines: LyricLine[],
  playbackTimeMs: number,
  timingOffsetMs = 0
): number {
  if (!Array.isArray(lines) || lines.length === 0 || !Number.isFinite(playbackTimeMs)) {
    return -1;
  }
  const adjustedTimeMs = playbackTimeMs - clampLyricsTimingOffsetMs(timingOffsetMs);
  let lastStarted = -1;
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].startTimeMs;
    if (typeof start === 'number' && adjustedTimeMs >= start) {
      lastStarted = i;
    }
  }
  return lastStarted;
}

/** Joins visible lyric lines into clean newline-separated text for clipboard copy. */
export function formatLyricsForCopy(lines: LyricLine[]): string {
  return lines
    .map((line) => line.text.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
