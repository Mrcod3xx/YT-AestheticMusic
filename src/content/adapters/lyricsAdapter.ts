import { LyricsData, TrackMetadata } from '../../shared/types';
import { hasValidExtensionRuntime } from '../../shared/runtimeSafety';
import { callMainWorldBridge } from './bridgeClient';

interface BridgeLyricsResponse {
  ok?: boolean;
  videoId?: string;
  staleTransition?: boolean;
  lyrics?: {
    available: boolean;
    isSynced: boolean;
    lines: Array<{
      text: string;
      startTimeMs?: number;
      endTimeMs?: number;
    }>;
    source?: string;
    reason?: string;
  };
}

interface BackgroundLyricsResponse {
  ok?: boolean;
  available?: boolean;
  isSynced?: boolean;
  lines?: Array<{
    text: string;
    startTimeMs?: number;
    endTimeMs?: number;
  }>;
  source?: string;
}

const MAX_CACHE_ENTRIES = 40;
const MAX_TRANSITION_RETRIES = 4;

const DEFAULT_IDLE_LYRICS: LyricsData = {
  available: false,
  isSynced: false,
  lines: [],
  reason: 'Play a song on YouTube Music to view lyrics.',
};

const lyricsCache = new Map<string, LyricsData>();

let currentTrackKey = '';
let lastResolvedVideoId = '';
let inFlightKey: string | null = null;
let currentLyrics: LyricsData = { ...DEFAULT_IDLE_LYRICS };
let transitionRetryCount = 0;
let retryTimer: number | null = null;

function buildTrackKey(track: TrackMetadata): string {
  return `${track.title}::${track.artist}::${track.isVideoActive ? 'video' : 'song'}`;
}

function setBoundedCache(key: string, data: LyricsData): void {
  if (lyricsCache.has(key)) {
    lyricsCache.delete(key);
  } else if (lyricsCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = lyricsCache.keys().next().value;
    if (oldestKey) lyricsCache.delete(oldestKey);
  }
  lyricsCache.set(key, data);
}

async function fetchSyncedFallbackFromBackground(
  track: TrackMetadata
): Promise<BackgroundLyricsResponse | null> {
  if (!hasValidExtensionRuntime() || !chrome.runtime?.sendMessage) {
    return null;
  }
  try {
    return (await chrome.runtime.sendMessage({
      type: 'FETCH_SYNCED_LYRICS',
      payload: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      },
    })) as BackgroundLyricsResponse | null;
  } catch {
    return null;
  }
}

export function clearLyricsRetryTimer(): void {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export function getCachedLyricsForCurrentTrack(track: TrackMetadata | null): LyricsData {
  if (!track || !track.title) {
    return DEFAULT_IDLE_LYRICS;
  }
  const key = buildTrackKey(track);
  return (
    lyricsCache.get(key) ||
    (currentLyrics.trackKey === key
      ? currentLyrics
      : {
          available: false,
          isSynced: false,
          lines: [],
          loading: true,
          trackKey: key,
        })
  );
}

export function isCacheableUnavailableOutcome(
  ytmOk: boolean | undefined,
  ytmStale: boolean | undefined,
  lrcOk: boolean | undefined
): boolean {
  return !ytmStale && (Boolean(ytmOk) || lrcOk === true);
}

export function requestLyricsForTrack(
  track: TrackMetadata | null,
  onUpdate: () => void,
  forceRefresh = false
): void {
  if (!track || !track.title) {
    clearLyricsRetryTimer();
    currentTrackKey = '';
    inFlightKey = null;
    currentLyrics = { ...DEFAULT_IDLE_LYRICS };
    return;
  }

  const key = buildTrackKey(track);
  const trackChanged = key !== currentTrackKey;

  if (trackChanged) {
    clearLyricsRetryTimer();
    currentTrackKey = key;
    transitionRetryCount = 0;
  }

  if (!forceRefresh) {
    const cached = lyricsCache.get(key);
    if (cached) {
      currentLyrics = cached;
      return;
    }
    if (inFlightKey === key) {
      return;
    }
  } else {
    clearLyricsRetryTimer();
    lyricsCache.delete(key);
  }

  inFlightKey = key;
  currentLyrics = {
    available: false,
    isSynced: false,
    lines: [],
    loading: true,
    trackKey: key,
  };

  void (async () => {
    // 1. Check native YouTube Music lyrics first
    const ytmPromise = callMainWorldBridge<BridgeLyricsResponse>(
      'GET_LYRICS',
      {
        expectedTitle: track.title,
        lastVideoId: trackChanged ? lastResolvedVideoId : undefined,
      },
      5500
    );

    // Query LRCLIB in parallel so Spotify-style millisecond sync resolves instantly if YTM only has static text
    const lrclibPromise = fetchSyncedFallbackFromBackground(track);

    const ytmRes = await ytmPromise;

    if (key !== currentTrackKey) {
      return;
    }

    if (ytmRes?.staleTransition && transitionRetryCount < MAX_TRANSITION_RETRIES) {
      inFlightKey = null;
      transitionRetryCount += 1;
      clearLyricsRetryTimer();
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        if (currentTrackKey === key) {
          requestLyricsForTrack(track, onUpdate, true);
        }
      }, 360);
      return;
    }

    if (ytmRes?.videoId) {
      lastResolvedVideoId = ytmRes.videoId;
    }

    const usableYtmLyrics = !ytmRes?.staleTransition ? ytmRes?.lyrics : undefined;

    // If YouTube Music natively supplies timed/synced lyrics, use them with highest priority
    if (usableYtmLyrics?.available && usableYtmLyrics.isSynced && usableYtmLyrics.lines.length > 0) {
      inFlightKey = null;
      const syncedNative: LyricsData = {
        available: true,
        isSynced: true,
        lines: usableYtmLyrics.lines,
        source: usableYtmLyrics.source || 'YouTube Music • Synced',
        loading: false,
        trackKey: key,
      };
      setBoundedCache(key, syncedNative);
      currentLyrics = syncedNative;
      onUpdate();
      return;
    }

    // If YTM gave static lyrics immediately, surface them right away while LRCLIB finishes checking sync
    if (usableYtmLyrics?.available && usableYtmLyrics.lines.length > 0) {
      currentLyrics = {
        available: true,
        isSynced: false,
        lines: usableYtmLyrics.lines,
        source: usableYtmLyrics.source,
        loading: false,
        trackKey: key,
      };
      onUpdate();
    }

    const lrcRes = await lrclibPromise;
    if (key !== currentTrackKey) {
      return;
    }

    inFlightKey = null;

    if (lrcRes?.ok && lrcRes.available && lrcRes.isSynced && lrcRes.lines?.length) {
      const syncedEnhanced: LyricsData = {
        available: true,
        isSynced: true,
        lines: lrcRes.lines,
        source: lrcRes.source || 'Synced Lyrics • LRCLIB',
        loading: false,
        trackKey: key,
      };
      setBoundedCache(key, syncedEnhanced);
      currentLyrics = syncedEnhanced;
      onUpdate();
      return;
    }

    if (usableYtmLyrics?.available && usableYtmLyrics.lines.length > 0) {
      const staticNative: LyricsData = {
        available: true,
        isSynced: false,
        lines: usableYtmLyrics.lines,
        source: usableYtmLyrics.source,
        loading: false,
        trackKey: key,
      };
      setBoundedCache(key, staticNative);
      currentLyrics = staticNative;
      onUpdate();
      return;
    }

    if (lrcRes?.ok && lrcRes.available && lrcRes.lines?.length) {
      const plainFallback: LyricsData = {
        available: true,
        isSynced: false,
        lines: lrcRes.lines,
        source: lrcRes.source || 'LRCLIB',
        loading: false,
        trackKey: key,
      };
      setBoundedCache(key, plainFallback);
      currentLyrics = plainFallback;
      onUpdate();
      return;
    }

    const unavailable: LyricsData = {
      available: false,
      isSynced: false,
      lines: [],
      loading: false,
      trackKey: key,
      reason:
        usableYtmLyrics?.reason || 'No lyrics available for this song.',
    };
    if (isCacheableUnavailableOutcome(ytmRes?.ok, ytmRes?.staleTransition, lrcRes?.ok)) {
      setBoundedCache(key, unavailable);
    }
    currentLyrics = unavailable;
    onUpdate();
  })();
}
