import { getSettings, saveSettings, subscribeToSettings } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/defaultSettings';
import { EXTENSION_VERSION } from '../shared/version';
import {
  cleanArtistName,
  cleanTrackTitle,
  isLikelyAlbumName,
  LrcLibRecord,
  parseLrcTimestampedLyrics,
  pickBestLrcCandidate,
  toPlainLyricLines,
} from '../shared/lyricsParser';
import {
  arrayBufferToBase64,
  clearCustomWallpaper,
  loadCustomWallpaper,
} from '../shared/wallpaperStore';

async function syncBadge(enabled: boolean) {
  try {
    await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
    if (enabled) {
      await chrome.action.setBadgeBackgroundColor({ color: '#C28356' });
    }
  } catch {
    // Ignore badge errors in unsupported contexts
  }
}

const LRCLIB_HEADERS = {
  'Lrclib-Client': `AestheticMusicExtension/${EXTENSION_VERSION} (https://music.youtube.com)`,
};

async function fetchSyncedFromLrcLib(payload: {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
}) {
  const titleClean = cleanTrackTitle(payload.title, payload.artist);
  const artistClean = cleanArtistName(payload.artist);
  const durationSec = Math.round(payload.duration || 0);

  if (!titleClean) {
    return { ok: false };
  }

  let anyNetworkSuccess = false;

  // 1. Try exact match endpoint first
  try {
    const params = new URLSearchParams({
      track_name: titleClean,
      artist_name: artistClean || payload.artist,
    });
    if (isLikelyAlbumName(payload.album)) {
      params.set('album_name', payload.album!.trim());
    }
    if (durationSec > 0) {
      params.set('duration', String(durationSec));
    }

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: LRCLIB_HEADERS,
    });
    if (res.ok || res.status === 404) {
      anyNetworkSuccess = true;
    }
    if (res.ok) {
      const record = (await res.json()) as LrcLibRecord;
      if (record.syncedLyrics) {
        const lines = parseLrcTimestampedLyrics(record.syncedLyrics);
        if (lines.length > 0) {
          return {
            ok: true,
            available: true,
            isSynced: true,
            lines,
            source: 'Synced Lyrics • LRCLIB',
          };
        }
      }
      if (record.plainLyrics) {
        return {
          ok: true,
          available: true,
          isSynced: false,
          lines: toPlainLyricLines(record.plainLyrics),
          source: 'LRCLIB',
        };
      }
    }
  } catch {
    // Fall through to search endpoint
  }

  // 2. Fallback to fuzzy search (great for Music Videos whose runtime differs slightly or feat. credits differ)
  try {
    const searchParams = new URLSearchParams({
      q: `${titleClean} ${artistClean}`.trim(),
    });
    const searchRes = await fetch(
      `https://lrclib.net/api/search?${searchParams.toString()}`,
      { headers: LRCLIB_HEADERS }
    );
    if (searchRes.ok || searchRes.status === 404) {
      anyNetworkSuccess = true;
    }
    if (searchRes.ok) {
      const list = (await searchRes.json()) as LrcLibRecord[];
      if (Array.isArray(list) && list.length > 0) {
        const best = pickBestLrcCandidate(list, titleClean, artistClean, durationSec);
        if (best?.syncedLyrics) {
          const lines = parseLrcTimestampedLyrics(best.syncedLyrics);
          if (lines.length > 0) {
            return {
              ok: true,
              available: true,
              isSynced: true,
              lines,
              source: 'Synced Lyrics • LRCLIB',
            };
          }
        }
        if (best?.plainLyrics) {
          return {
            ok: true,
            available: true,
            isSynced: false,
            lines: toPlainLyricLines(best.plainLyrics),
            source: 'LRCLIB',
          };
        }
      }
    }
  } catch {
    // Ignore network error
  }

  return anyNetworkSuccess ? { ok: true, available: false } : { ok: false };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await getSettings();
  if (details.reason === 'install') {
    await saveSettings(DEFAULT_SETTINGS);
    await syncBadge(DEFAULT_SETTINGS.enabled);
  } else {
    await syncBadge(current.enabled);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const current = await getSettings();
  if (!current.rememberSettings) {
    const reset = await saveSettings({
      ...DEFAULT_SETTINGS,
      rememberSettings: false,
      enabled: current.enabled,
    });
    await syncBadge(reset.enabled);
    return;
  }
  await syncBadge(current.enabled);
});

subscribeToSettings((settings) => {
  syncBadge(settings.enabled);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FETCH_SYNCED_LYRICS' && message.payload) {
    fetchSyncedFromLrcLib(message.payload)
      .then((res) => sendResponse(res))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'GET_WALLPAPER_META') {
    loadCustomWallpaper()
      .then((record) => {
        if (!record) {
          sendResponse({ ok: false });
          return;
        }
        sendResponse({
          ok: true,
          rev: record.updatedAt,
          mimeType: record.mimeType,
          fileName: record.fileName,
          mediaType: record.mediaType,
          totalSize: record.blob.size,
        });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'GET_WALLPAPER_CHUNK') {
    const offset = Number(message.offset || 0);
    const length = Number(message.length || 512 * 1024);
    loadCustomWallpaper()
      .then(async (record) => {
        if (!record) {
          sendResponse({ ok: false });
          return;
        }
        const buf = await record.blob.slice(offset, offset + length).arrayBuffer();
        sendResponse({
          ok: true,
          chunkBase64: arrayBufferToBase64(buf),
        });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'CLEAR_EXTENSION_WALLPAPER') {
    clearCustomWallpaper()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime?.openOptionsPage?.();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
