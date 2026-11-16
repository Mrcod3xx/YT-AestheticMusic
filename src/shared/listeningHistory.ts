import { ListeningHistoryItem, TrackMetadata } from './types';
import {
  hasValidExtensionRuntime,
  isExtensionContextInvalidatedError,
} from './runtimeSafety';

const HISTORY_STORAGE_KEY = 'aesthetic_music_history_v1';
export const MAX_LISTENING_HISTORY_ITEMS = 50;

function normalizeHistoryKey(track: {
  videoId?: string;
  title: string;
  artist: string;
}): string {
  if (track.videoId) return `vid:${track.videoId}`;
  return `meta:${track.title.trim().toLowerCase()}::${track.artist.trim().toLowerCase()}`;
}

/** Pure ring-buffer upsert preserving up to 50 most-recent played tracks cleanly. */
export function upsertListeningHistory(
  existing: ListeningHistoryItem[],
  track: Pick<TrackMetadata, 'title' | 'artist' | 'album' | 'artworkUrl' | 'highResArtworkUrl' | 'videoId'>,
  nowMs = Date.now(),
  maxEntries = MAX_LISTENING_HISTORY_ITEMS
): ListeningHistoryItem[] {
  const cleanTitle = track.title?.trim();
  if (!cleanTitle || cleanTitle === 'Not Playing') return existing;

  const key = normalizeHistoryKey({
    videoId: track.videoId,
    title: cleanTitle,
    artist: track.artist || '',
  });

  const existingMatch = existing.find(
    (item) => normalizeHistoryKey(item) === key
  );

  // Skip spamming count if the exact same track is currently top item within 20s
  if (
    existing[0] &&
    normalizeHistoryKey(existing[0]) === key &&
    nowMs - existing[0].playedAt < 20_000
  ) {
    return existing;
  }

  const nextEntry: ListeningHistoryItem = {
    id: key,
    title: cleanTitle,
    artist: track.artist || 'YouTube Music',
    album: track.album || '',
    artworkUrl: track.highResArtworkUrl || track.artworkUrl || '',
    videoId: track.videoId,
    playedAt: nowMs,
    playCount: (existingMatch?.playCount || 0) + 1,
  };

  const filtered = existing.filter((item) => normalizeHistoryKey(item) !== key);
  return [nextEntry, ...filtered].slice(0, maxEntries);
}

export async function loadListeningHistory(): Promise<ListeningHistoryItem[]> {
  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      const res = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
      const raw = res[HISTORY_STORAGE_KEY];
      if (Array.isArray(raw)) {
        return raw.slice(0, MAX_LISTENING_HISTORY_ITEMS);
      }
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to load listening history:', err);
    }
  }
  return [];
}

export async function recordTrackInHistory(
  track: TrackMetadata
): Promise<ListeningHistoryItem[]> {
  const current = await loadListeningHistory();
  const next = upsertListeningHistory(current, track, Date.now());
  if (next === current) return current;

  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: next });
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to persist listening history:', err);
    }
  }
  return next;
}

export async function clearListeningHistory(): Promise<void> {
  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: [] });
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to clear listening history:', err);
    }
  }
}
