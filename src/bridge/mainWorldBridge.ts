/**
 * MAIN World Bridge for YouTube Music
 * Executes in the page context of https://music.youtube.com/* to access:
 * 1. Live InnerTube Search API (/youtubei/v1/search) with recursive renderer extraction
 * 2. Polymer component .data on <ytmusic-player-queue-item> (including offscreen lazy thumbnails)
 * 3. #movie_player API & Polymer watchEndpoint playback triggers
 * 4. Capture-phase keyboard shield so typing Spacebar or hotkeys inside Shadow DOM inputs
 *    is never swallowed by YouTube Music's global shortcut manager.
 */

import type { BrowseTrackItem, LibraryHubSection } from '../shared/types';
import {
  buildInnerTubeRequestHeaders,
  detectYtmSessionState,
  normalizeBrowseIdForRequest,
  YtmSessionState,
} from '../shared/innertubeAuth';
import {
  RawBridgeSearchResult,
  extractLibraryHubItems,
  extractSearchRenderers,
  extractTracksFromBrowseShelf,
  parseAddToPlaylistOptions,
  parseBrowseDetails,
  pickBestThumbnail,
  upgradeGoogleImage,
} from '../shared/innertubeParsers';

interface BridgeRequestDetail {
  action:
    | 'PING'
    | 'GET_FULL_STATE'
    | 'SEEK_TO'
    | 'SET_VOLUME'
    | 'PLAY_QUEUE_INDEX'
    | 'PLAY_NEXT_QUEUE_ITEM'
    | 'REMOVE_QUEUE_ITEM'
    | 'REORDER_QUEUE_ITEM'
    | 'CLEAR_UPCOMING_QUEUE'
    | 'TOGGLE_SHUFFLE'
    | 'SHUFFLE_UPCOMING_QUEUE'
    | 'SEARCH_YTM'
    | 'PLAY_SEARCH_RESULT'
    | 'ADD_TO_QUEUE'
    | 'GET_LYRICS'
    | 'FETCH_BROWSE_DETAILS'
    | 'FETCH_LIBRARY_HUB'
    | 'GET_ADD_TO_PLAYLIST_OPTIONS'
    | 'TOGGLE_TRACK_IN_PLAYLIST'
    | 'CREATE_PLAYLIST'
    | 'PLAY_ENDPOINT';
  requestId: string;
  payload?: Record<string, unknown>;
}

interface PolymerThumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface PolymerRuns {
  runs?: Array<{
    text?: string;
    navigationEndpoint?: {
      watchEndpoint?: { videoId?: string; playlistId?: string };
      browseEndpoint?: { browseId?: string };
    };
  }>;
}

// Shield Shadow DOM inputs from YouTube Music's global capture/bubble keyboard shortcuts
(function installKeyboardShield() {
  const shield = (e: KeyboardEvent) => {
    const path = e.composedPath?.() || [];
    const topTarget = path[0] as HTMLElement | undefined;
    if (
      topTarget &&
      (topTarget.tagName === 'INPUT' ||
        topTarget.tagName === 'TEXTAREA' ||
        topTarget.isContentEditable)
    ) {
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', shield, true);
  window.addEventListener('keypress', shield, true);
  window.addEventListener('keyup', shield, true);
})();

interface RawQueueEntry {
  playlistPanelVideoRenderer?: Record<string, unknown>;
  playlistPanelVideoWrapperRenderer?: {
    primaryRenderer?: {
      playlistPanelVideoRenderer?: Record<string, unknown>;
    };
  };
  [key: string]: unknown;
}

interface YtmQueueStore {
  getState?: () => {
    queue?: {
      items?: RawQueueEntry[];
      automixItems?: RawQueueEntry[];
      nextQueueItemId?: number;
      selectedItemIndex?: number;
      queueContextParams?: string;
    };
  };
  dispatch?: (action: { type: string; payload?: unknown }) => unknown;
  subscribe?: (listener: () => void) => () => void;
}

interface YtmQueueElement extends HTMLElement {
  selectedQueueItemIndex?: number;
  queue?: {
    getCurrentItemIndex?: () => number;
    getItems?: () => RawQueueEntry[];
    selectQueueItem?: (item: unknown) => void;
    removeItem?: (id: unknown) => void;
  };
  ytmusicReduxBehavior?: {
    store?: YtmQueueStore;
  };
}

interface InnerTubeRuntimeConfig {
  apiKey?: string;
  context?: Record<string, unknown>;
  clientName?: unknown;
  clientVersion?: unknown;
  visitorData?: unknown;
  loggedIn?: unknown;
  datasyncId?: unknown;
  delegatedSessionId?: unknown;
  sessionIndex?: unknown;
  idToken?: unknown;
}

function getInnerTubeConfig(): InnerTubeRuntimeConfig {
  const win = window as unknown as {
    ytcfg?: { get?: (key: string) => unknown; data_?: Record<string, unknown> };
    yt?: { config_?: Record<string, unknown> };
  };
  const readKey = (key: string): unknown =>
    win.ytcfg?.get?.(key) ?? win.ytcfg?.data_?.[key] ?? win.yt?.config_?.[key];

  const context = readKey('INNERTUBE_CONTEXT') as Record<string, unknown> | undefined;
  const ctxClient = context?.client as Record<string, unknown> | undefined;

  return {
    apiKey: readKey('INNERTUBE_API_KEY') as string | undefined,
    context,
    clientName: readKey('INNERTUBE_CLIENT_NAME') ?? ctxClient?.clientName ?? '67',
    clientVersion: readKey('INNERTUBE_CLIENT_VERSION') ?? ctxClient?.clientVersion,
    visitorData: readKey('VISITOR_DATA') ?? ctxClient?.visitorData,
    loggedIn: readKey('LOGGED_IN'),
    datasyncId: readKey('DATASYNC_ID'),
    delegatedSessionId: readKey('DELEGATED_SESSION_ID'),
    sessionIndex: readKey('SESSION_INDEX'),
    idToken: readKey('ID_TOKEN'),
  };
}

function getYtmSessionState(cfg: InnerTubeRuntimeConfig): YtmSessionState {
  const hasNavAvatar = Boolean(
    document.querySelector(
      'ytmusic-nav-bar ytmusic-settings-button, ytmusic-nav-bar #avatar-btn, ytmusic-nav-bar img#img[src*="googleusercontent"], ytmusic-nav-bar button[aria-label*="Account"]'
    )
  );
  const hasSignInLink = Boolean(
    document.querySelector(
      'ytmusic-nav-bar a.sign-in-link, ytmusic-nav-bar a[href*="ServiceLogin"]'
    )
  );
  return detectYtmSessionState({
    ytcfgLoggedIn: cfg.loggedIn,
    datasyncId: cfg.datasyncId,
    delegatedSessionId: cfg.delegatedSessionId,
    sessionIndex: cfg.sessionIndex,
    idToken: cfg.idToken,
    cookieHeader: document.cookie || '',
    hasNavAvatar,
    hasSignInLink,
  });
}

async function getInnerTubeAuthHeaders(
  cfg: InnerTubeRuntimeConfig,
  sessionState: YtmSessionState
): Promise<Record<string, string>> {
  return buildInnerTubeRequestHeaders({
    origin: window.location.origin || 'https://music.youtube.com',
    cookieHeader: document.cookie || '',
    sessionState,
    clientName: cfg.clientName,
    clientVersion: cfg.clientVersion,
    visitorData: cfg.visitorData,
  });
}

function unwrapQueueRenderer(raw: RawQueueEntry | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  if (raw.playlistPanelVideoRenderer) {
    return raw.playlistPanelVideoRenderer;
  }
  const primary = raw.playlistPanelVideoWrapperRenderer?.primaryRenderer;
  if (primary?.playlistPanelVideoRenderer) {
    return primary.playlistPanelVideoRenderer;
  }
  return raw;
}

function getQueueContext() {
  const queueEl = document.querySelector('ytmusic-player-queue#queue') as YtmQueueElement | null;
  const ytApp = document.querySelector('ytmusic-app') as
    | (HTMLElement & { ytmusicReduxBehavior?: { store?: YtmQueueStore } })
    | null;
  const store = queueEl?.ytmusicReduxBehavior?.store || ytApp?.ytmusicReduxBehavior?.store || null;
  const qState = store?.getState?.()?.queue;
  const items = Array.isArray(qState?.items) ? qState.items : [];
  const automixItems = Array.isArray(qState?.automixItems) ? qState.automixItems : [];

  let selectedIndex =
    typeof queueEl?.selectedQueueItemIndex === 'number' && queueEl.selectedQueueItemIndex >= 0
      ? queueEl.selectedQueueItemIndex
      : typeof queueEl?.queue?.getCurrentItemIndex?.() === 'number' &&
          (queueEl.queue.getCurrentItemIndex() ?? -1) >= 0
        ? queueEl.queue.getCurrentItemIndex()!
        : typeof qState?.selectedItemIndex === 'number' && qState.selectedItemIndex >= 0
          ? qState.selectedItemIndex
          : items.findIndex((entry) => Boolean(unwrapQueueRenderer(entry)?.selected));

  if (selectedIndex < 0 && items.length > 0) {
    const moviePlayer = document.getElementById('movie_player') as unknown as {
      getVideoData?: () => { video_id?: string };
    } | null;
    const playingVid = moviePlayer?.getVideoData?.()?.video_id;
    if (playingVid) {
      selectedIndex = items.findIndex((entry) => {
        const r = unwrapQueueRenderer(entry) as {
          videoId?: string;
          navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
        };
        return (r.videoId || r.navigationEndpoint?.watchEndpoint?.videoId) === playingVid;
      });
    }
  }

  return {
    queueEl,
    ytApp,
    store,
    qState,
    items,
    automixItems,
    selectedIndex,
  };
}

let subscribedQueueStore: YtmQueueStore | null = null;
let lastQueueSignature = '';

function computeQueueSignature(ctx: ReturnType<typeof getQueueContext>): string {
  const itemSig = ctx.items
    .slice(0, 120)
    .map((it) => {
      const r = unwrapQueueRenderer(it) as {
        videoId?: string;
        selected?: boolean;
        navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
      };
      const vid = r.videoId || r.navigationEndpoint?.watchEndpoint?.videoId || '';
      return `${vid}:${r.selected ? 1 : 0}`;
    })
    .join(',');

  const autoSig = ctx.automixItems
    .slice(0, 80)
    .map((it) => {
      const r = unwrapQueueRenderer(it) as {
        videoId?: string;
        navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
      };
      return r.videoId || r.navigationEndpoint?.watchEndpoint?.videoId || '';
    })
    .join(',');

  return `${ctx.selectedIndex}|${ctx.items.length}:${itemSig}|${ctx.automixItems.length}:${autoSig}`;
}

function ensureQueueStoreSubscription() {
  const ctx = getQueueContext();
  const store = ctx.store;
  if (!store || typeof store.subscribe !== 'function' || subscribedQueueStore === store) {
    return;
  }

  subscribedQueueStore = store;
  lastQueueSignature = computeQueueSignature(ctx);
  store.subscribe(() => {
    try {
      const nextCtx = getQueueContext();
      const sig = computeQueueSignature(nextCtx);
      if (sig !== lastQueueSignature) {
        lastQueueSignature = sig;
        window.dispatchEvent(new CustomEvent('aesthetic-music:queue-changed'));
      }
    } catch {
      // Ignore transient store state during SPA navigation
    }
  });
}

function mapQueueRendererItem(
  raw: RawQueueEntry,
  index: number,
  isSelected: boolean,
  isPlayingNow: boolean,
  isAutomix: boolean
) {
  const renderer = unwrapQueueRenderer(raw) as {
    title?: PolymerRuns;
    shortBylineText?: PolymerRuns;
    longBylineText?: PolymerRuns;
    lengthText?: PolymerRuns;
    thumbnail?: { thumbnails?: PolymerThumbnail[] };
    videoId?: string;
    navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
  };

  const title = renderer?.title?.runs?.map((r) => r.text || '').join('') || 'Untitled';
  const artist =
    renderer?.shortBylineText?.runs?.[0]?.text ||
    renderer?.longBylineText?.runs?.[0]?.text ||
    '';
  const duration = renderer?.lengthText?.runs?.[0]?.text || '';
  const artworkUrl = pickBestThumbnail(renderer?.thumbnail?.thumbnails);
  const videoId =
    renderer?.videoId || renderer?.navigationEndpoint?.watchEndpoint?.videoId || '';

  return {
    index,
    title,
    artist,
    duration,
    artworkUrl,
    highResArtworkUrl: upgradeGoogleImage(artworkUrl),
    isSelected,
    isPlaying: isSelected && isPlayingNow,
    videoId: videoId || undefined,
    isAutomix,
  };
}

function extractQueueItems() {
  ensureQueueStoreSubscription();
  const ctx = getQueueContext();
  const moviePlayer = document.getElementById('movie_player') as unknown as {
    getPlayerState?: () => number;
  } | null;
  const isPlayingNow = moviePlayer?.getPlayerState?.() === 1;

  // Primary source: YTM Redux queue store (exact order: queued items followed by automix suggestions)
  const combinedEntries: Array<{ raw: RawQueueEntry; isAutomix: boolean }> = [
    ...ctx.items.map((raw) => ({ raw, isAutomix: false })),
    ...ctx.automixItems.map((raw) => ({ raw, isAutomix: true })),
  ];

  if (combinedEntries.length > 0) {
    return combinedEntries.slice(0, 200).map((entry, index) => {
      const renderer = unwrapQueueRenderer(entry.raw) as { selected?: boolean };
      const isSelected =
        ctx.selectedIndex >= 0
          ? index === ctx.selectedIndex
          : Boolean(renderer?.selected);
      return mapQueueRendererItem(
        entry.raw,
        index,
        isSelected,
        isPlayingNow,
        entry.isAutomix
      );
    });
  }

  // Secondary fallback: DOM elements when store is unavailable
  const queueEls = Array.from(
    document.querySelectorAll('ytmusic-player-queue#queue ytmusic-player-queue-item')
  ) as Array<HTMLElement & { data?: RawQueueEntry; __data?: { data?: RawQueueEntry } }>;

  if (queueEls.length > 0) {
    return queueEls.slice(0, 200).map((el, index) => {
      const rawData = (el.data || el.__data?.data || {}) as RawQueueEntry;
      const renderer = unwrapQueueRenderer(rawData) as {
        title?: PolymerRuns;
        shortBylineText?: PolymerRuns;
        longBylineText?: PolymerRuns;
        lengthText?: PolymerRuns;
        thumbnail?: { thumbnails?: PolymerThumbnail[] };
        videoId?: string;
        navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
        selected?: boolean;
      };

      const title =
        renderer?.title?.runs?.map((r) => r.text || '').join('') ||
        el.querySelector('.song-title')?.textContent?.trim() ||
        'Untitled';

      const artist =
        renderer?.shortBylineText?.runs?.[0]?.text ||
        renderer?.longBylineText?.runs?.[0]?.text ||
        el.querySelector('.byline')?.textContent?.trim() ||
        '';

      const duration =
        renderer?.lengthText?.runs?.[0]?.text ||
        el.querySelector('.duration')?.textContent?.trim() ||
        '';

      const domImg = (el.querySelector('img') as HTMLImageElement | null)?.src || '';
      const artworkUrl = pickBestThumbnail(renderer?.thumbnail?.thumbnails) || domImg;

      const playState = el.getAttribute('play-button-state') || '';
      const isSelected =
        Boolean(renderer?.selected) ||
        el.hasAttribute('selected') ||
        playState === 'playing' ||
        playState === 'paused' ||
        playState === 'loading';

      return {
        index,
        title,
        artist,
        duration,
        artworkUrl,
        highResArtworkUrl: upgradeGoogleImage(artworkUrl),
        isSelected,
        isPlaying: playState === 'playing',
        videoId:
          renderer?.videoId ||
          renderer?.navigationEndpoint?.watchEndpoint?.videoId ||
          undefined,
        isAutomix: false,
      };
    });
  }

  // Fallback: if no active queue exists yet (e.g. fresh Home page load), read playable tracks from Home shelves
  const homeItems = Array.from(
    document.querySelectorAll(
      'ytmusic-browse-response ytmusic-responsive-list-item-renderer, ytmusic-browse-response ytmusic-two-row-item-renderer'
    )
  ) as Array<HTMLElement & { data?: Record<string, unknown> }>;

  return homeItems.slice(0, 14).map((el, index) => {
    const data = (el.data || {}) as {
      title?: PolymerRuns;
      subtitle?: PolymerRuns;
      flexColumns?: Array<{
        musicResponsiveListItemFlexColumnRenderer?: { text?: PolymerRuns };
      }>;
      thumbnailRenderer?: {
        musicThumbnailRenderer?: { thumbnail?: { thumbnails?: PolymerThumbnail[] } };
      };
      thumbnail?: {
        musicThumbnailRenderer?: { thumbnail?: { thumbnails?: PolymerThumbnail[] } };
      };
    };

    const title =
      data?.title?.runs?.[0]?.text ||
      data?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
        ?.text ||
      el.querySelector('.title')?.textContent?.trim() ||
      'Track';

    const artist =
      data?.subtitle?.runs?.[0]?.text ||
      data?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
        ?.text ||
      el.querySelector('.subtitle, .secondary-flex-columns')?.textContent?.trim() ||
      'YouTube Music';

    const polyThumb =
      pickBestThumbnail(
        data?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails
      ) ||
      pickBestThumbnail(
        data?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      ) ||
      (el.querySelector('img') as HTMLImageElement | null)?.src ||
      '';

    return {
      index,
      title,
      artist,
      duration: '',
      artworkUrl: polyThumb,
      highResArtworkUrl: upgradeGoogleImage(polyThumb),
      isSelected: index === 0,
      isPlaying: false,
    };
  });
}

async function performNativeSearch(query: string): Promise<RawBridgeSearchResult[]> {
  try {
    const cfg = getInnerTubeConfig();
    if (!cfg.apiKey || !cfg.context) return [];
    const session = getYtmSessionState(cfg);
    const headers = await getInnerTubeAuthHeaders(cfg, session);

    const url = `https://music.youtube.com/youtubei/v1/search?prettyPrint=false&key=${encodeURIComponent(
      cfg.apiKey
    )}`;
    const postSearch = (params?: string) =>
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(
          params
            ? { context: cfg.context, query, params }
            : { context: cfg.context, query }
        ),
      });

    // Query General (Top Results + shelves), Videos, Songs, Artists, and Albums in parallel
    const [generalRes, videosRes, songsRes, artistsRes, albumsRes] =
      await Promise.allSettled([
        postSearch(),
        postSearch('EgWKAQIQAWoKEAkQBRAKEAMQBA=='),
        postSearch('EgWKAQIIAWoKEAkQBRAKEAMQBA=='),
        postSearch('EgWKAQIgAWoKEAkQBRAKEAMQBA=='),
        postSearch('EgWKAQIYAWoKEAkQBRAKEAMQBA=='),
      ]);

    const merged: RawBridgeSearchResult[] = [];
    const seen = new Set<string>();

    const appendParsed = (items: RawBridgeSearchResult[]) => {
      for (const item of items) {
        const key = `${item.category}:${
          item.videoId || item.browseId || `${item.title}-${item.subtitle}`
        }`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
    };

    if (generalRes.status === 'fulfilled' && generalRes.value.ok) {
      const generalJson = await generalRes.value.json();
      appendParsed(extractSearchRenderers(generalJson).slice(0, 40));
    }
    if (artistsRes.status === 'fulfilled' && artistsRes.value.ok) {
      const artistsJson = await artistsRes.value.json();
      appendParsed(
        extractSearchRenderers(artistsJson)
          .slice(0, 8)
          .map((a) => ({ ...a, category: 'Artist' as const }))
      );
    }
    if (songsRes.status === 'fulfilled' && songsRes.value.ok) {
      const songsJson = await songsRes.value.json();
      appendParsed(
        extractSearchRenderers(songsJson)
          .slice(0, 8)
          .map((s) => ({ ...s, category: 'Song' as const }))
      );
    }
    if (videosRes.status === 'fulfilled' && videosRes.value.ok) {
      const videosJson = await videosRes.value.json();
      appendParsed(
        extractSearchRenderers(videosJson)
          .slice(0, 6)
          .map((v) => ({ ...v, category: 'Video' as const }))
      );
    }
    if (albumsRes.status === 'fulfilled' && albumsRes.value.ok) {
      const albumsJson = await albumsRes.value.json();
      appendParsed(
        extractSearchRenderers(albumsJson)
          .slice(0, 6)
          .map((al) => ({ ...al, category: 'Album' as const }))
      );
    }

    if (merged.length > 0) {
      return merged.slice(0, 50).map((item, idx) => ({
        ...item,
        searchIndex: idx,
      }));
    }
  } catch (err) {
    console.warn('[Aesthetic Music] InnerTube live search error:', err);
  }

  return [];
}

const LIBRARY_HUB_BROWSE_IDS: Record<LibraryHubSection, string> = {
  liked: 'FEmusic_liked_videos',
  playlists: 'FEmusic_liked_playlists',
  home: 'FEmusic_home',
  explore: 'FEmusic_moods_and_genres',
  history: 'FEmusic_history',
};

async function postInnerTubeEndpoint(
  endpointPath: string,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; json: unknown; session: YtmSessionState }
  | { ok: false; error: string; status?: number; session: YtmSessionState }
> {
  const cfg = getInnerTubeConfig();
  const session = getYtmSessionState(cfg);
  if (!cfg.apiKey || !cfg.context) {
    return { ok: false, error: 'InnerTube config unavailable', session };
  }

  const headers = await getInnerTubeAuthHeaders(cfg, session);
  const url = `https://music.youtube.com/youtubei/v1/${endpointPath}?prettyPrint=false&key=${encodeURIComponent(
    cfg.apiKey
  )}`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      context: cfg.context,
      ...payload,
    }),
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: `InnerTube ${endpointPath} HTTP ${res.status}`,
      session,
    };
  }

  return { ok: true, json: await res.json(), session };
}

async function postInnerTubeBrowse(
  browseId: string,
  params?: string
): Promise<
  | { ok: true; json: unknown; session: YtmSessionState }
  | { ok: false; error: string; status?: number; session: YtmSessionState }
> {
  return postInnerTubeEndpoint('browse', {
    browseId,
    ...(params ? { params } : {}),
  });
}

function finalizePlaylistResults(
  items: RawBridgeSearchResult[]
): RawBridgeSearchResult[] {
  const seen = new Set<string>();
  const out: RawBridgeSearchResult[] = [];
  for (const item of items) {
    if (item.browseId === 'FEmusic_liked_playlists') continue;
    const synthesizedBrowseId =
      item.browseId ||
      (item.playlistId === 'LM'
        ? 'FEmusic_liked_videos'
        : item.playlistId
        ? item.playlistId.startsWith('VL')
          ? item.playlistId
          : `VL${item.playlistId}`
        : undefined);
    const resolvedPlaylistId =
      item.playlistId ||
      (synthesizedBrowseId?.startsWith('VL')
        ? synthesizedBrowseId.slice(2)
        : synthesizedBrowseId?.startsWith('PL')
        ? synthesizedBrowseId
        : synthesizedBrowseId === 'FEmusic_liked_videos'
        ? 'LM'
        : undefined);
    if (!synthesizedBrowseId && !resolvedPlaylistId && !item.videoId) continue;

    const normalizedItem: RawBridgeSearchResult = {
      ...item,
      browseId: synthesizedBrowseId,
      playlistId: resolvedPlaylistId,
      category: 'Playlist',
    };
    const key = normalizedItem.browseId || normalizedItem.playlistId || normalizedItem.title;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(normalizedItem);
    }
  }
  return out;
}

async function fetchLibraryHub(section: LibraryHubSection) {
  const browseId = LIBRARY_HUB_BROWSE_IDS[section];
  const cfg = getInnerTubeConfig();
  const initialSession = getYtmSessionState(cfg);
  if (!browseId) {
    return {
      ok: false,
      loggedIn: initialSession.loggedIn,
      results: [],
      error: 'Invalid library section',
    };
  }

  try {
    const browseRes = await postInnerTubeBrowse(browseId);
    if (!browseRes.ok) {
      return {
        ok: false,
        loggedIn: browseRes.session.loggedIn,
        hasAuthCookies: browseRes.session.hasAuthCookies,
        section,
        results: [],
        error: browseRes.error,
      };
    }

    let items = extractLibraryHubItems(browseRes.json, section, 60);

    // Enrich Moods & Explore with FEmusic_explore albums, videos & mixes alongside Mood pills
    if (section === 'explore') {
      try {
        const exploreRes = await postInnerTubeBrowse('FEmusic_explore');
        if (exploreRes.ok) {
          const exploreItems = extractLibraryHubItems(exploreRes.json, 'explore', 36);
          const seenExplore = new Set(
            items.map((it) => `${it.browseId || ''}:${it.params || ''}:${it.videoId || it.title}`)
          );
          for (const ex of exploreItems) {
            const key = `${ex.browseId || ''}:${ex.params || ''}:${ex.videoId || ex.title}`;
            if (!seenExplore.has(key)) {
              seenExplore.add(key);
              items.push(ex);
            }
          }
        }
      } catch {
        // Keep mood tiles cleanly if explore endpoint fails
      }
    }

    // Fallback for Liked Songs if wrapped in a full playlist details structure
    if (section === 'liked' && items.length === 0) {
      const parsedLiked = parseBrowseDetails(
        browseRes.json,
        'FEmusic_liked_videos',
        'Playlist'
      );
      if (parsedLiked?.details.tracks.length) {
        items = parsedLiked.details.tracks.map((track, idx) => ({
          id: `lib-liked-fallback-${idx}-${track.videoId || idx}`,
          searchIndex: idx,
          title: track.title,
          subtitle: track.artist || track.subtitle || 'Liked Music',
          category: 'Song' as const,
          artworkUrl: track.artworkUrl,
          videoId: track.videoId,
          playlistId: track.playlistId || 'LM',
          shelfTitle: 'Liked Songs',
          watchEndpoint: track.watchEndpoint,
          addToQueueEndpoint: track.addToQueueEndpoint,
          playNextEndpoint: track.playNextEndpoint,
        }));
      }
    }

    // Fallback for Playlists to FEmusic_library_landing when FEmusic_liked_playlists yields empty
    if (section === 'playlists') {
      items = finalizePlaylistResults(
        items.filter(
          (it) =>
            it.category === 'Playlist' ||
            Boolean(it.browseId?.startsWith('VL')) ||
            Boolean(it.browseId?.startsWith('PL')) ||
            it.browseId === 'FEmusic_liked_videos'
        )
      );
      if (items.length === 0) {
        const landingRes = await postInnerTubeBrowse('FEmusic_library_landing');
        if (landingRes.ok) {
          const landingItems = extractLibraryHubItems(landingRes.json, 'playlists', 60);
          items = finalizePlaylistResults(
            landingItems.filter(
              (it) =>
                it.category === 'Playlist' ||
                Boolean(it.browseId?.startsWith('VL')) ||
                Boolean(it.browseId?.startsWith('PL')) ||
                it.browseId === 'FEmusic_liked_videos'
            )
          );
        }
      }
    }

    const results = items.map((item, idx) => ({
      ...item,
      searchIndex: idx,
    }));
    return {
      ok: true,
      loggedIn: browseRes.session.loggedIn,
      hasAuthCookies: browseRes.session.hasAuthCookies,
      section,
      results,
    };
  } catch (err) {
    console.warn('[Aesthetic Music] Library hub fetch error:', err);
    return {
      ok: false,
      loggedIn: initialSession.loggedIn,
      hasAuthCookies: initialSession.hasAuthCookies,
      section,
      results: [],
      error: String(err),
    };
  }
}

async function fetchBrowseDetails(
  rawBrowseId: string,
  hintKind?: 'Artist' | 'Album' | 'Playlist',
  params?: string
) {
  const browseId = normalizeBrowseIdForRequest(rawBrowseId, hintKind);
  if (!browseId) {
    return { ok: false, error: 'Missing browseId' };
  }

  try {
    const browseRes = await postInnerTubeBrowse(browseId, params);
    if (!browseRes.ok) {
      return browseRes;
    }

    const parsed = parseBrowseDetails(browseRes.json, browseId, hintKind);
    if (!parsed) {
      return { ok: false, error: 'Unable to parse browse details' };
    }

    // Hydrate fuller Top Songs list for Artists when YTM returns <= 8 songs inline
    if (
      parsed.details.kind === 'Artist' &&
      parsed.moreTracksBrowseEndpoint?.browseId &&
      parsed.details.tracks.length <= 8
    ) {
      try {
        const moreEp = parsed.moreTracksBrowseEndpoint;
        const moreBrowseRes = await postInnerTubeBrowse(
          moreEp.browseId,
          moreEp.params
        );
        if (moreBrowseRes.ok) {
          const moreTracks = extractTracksFromBrowseShelf(
            moreBrowseRes.json,
            parsed.details.artworkUrl,
            parsed.details.playlistId,
            parsed.details.title
          );
          if (moreTracks.length > 0) {
            const existingIds = new Set(
              parsed.details.tracks.map((t) => t.videoId).filter(Boolean)
            );
            for (const track of moreTracks) {
              if (track.videoId && !existingIds.has(track.videoId)) {
                existingIds.add(track.videoId);
                parsed.details.tracks.push({
                  ...track,
                  index: parsed.details.tracks.length,
                });
                if (parsed.details.tracks.length >= 25) break;
              }
            }
          }
        }
      } catch {
        // Keep initial Top Songs list cleanly if Show All hydration fails
      }
    }

    return { ok: true, details: parsed.details };
  } catch (err) {
    console.warn('[Aesthetic Music] Browse fetch error:', err);
    return { ok: false, error: String(err) };
  }
}

function buildWatchEndpoint(
  videoId?: string,
  playlistId?: string,
  rawWatchEndpoint?: Record<string, unknown>
): Record<string, unknown> | null {
  if (rawWatchEndpoint && Object.keys(rawWatchEndpoint).length > 0) {
    // Wrap watchEndpoint/watchPlaylistEndpoint cleanly inside NavigationEndpoint envelope if unwrapped
    if (
      !rawWatchEndpoint.watchEndpoint &&
      !rawWatchEndpoint.watchPlaylistEndpoint
    ) {
      if (rawWatchEndpoint.videoId) {
        const ep: Record<string, unknown> = { ...rawWatchEndpoint };
        if (!ep.playlistId) ep.playlistId = playlistId || `RDAMVM${ep.videoId}`;
        return { watchEndpoint: ep };
      }
      if (rawWatchEndpoint.playlistId) {
        return { watchPlaylistEndpoint: { ...rawWatchEndpoint } };
      }
    }
    return { ...rawWatchEndpoint };
  }

  if (videoId) {
    return {
      watchEndpoint: {
        videoId,
        playlistId: playlistId || `RDAMVM${videoId}`,
      },
    };
  }
  if (playlistId) {
    return {
      watchPlaylistEndpoint: {
        playlistId,
      },
    };
  }
  return null;
}

function playSearchResultItem(payload: Record<string, unknown>) {
  const videoId = payload.videoId as string | undefined;
  const playlistId = payload.playlistId as string | undefined;
  const rawWatchEndpoint = payload.watchEndpoint as Record<string, unknown> | undefined;

  const navEndpoint = buildWatchEndpoint(videoId, playlistId, rawWatchEndpoint);
  if (navEndpoint) {
    navigateWithEndpoint(navEndpoint, videoId);
  }
}

function playBrowseEndpoint(payload: Record<string, unknown>): boolean {
  const shuffle = Boolean(payload.shuffle);
  const rawEndpoint = payload.endpoint as Record<string, unknown> | undefined;
  const playlistId = payload.playlistId as string | undefined;
  const tracks = Array.isArray(payload.tracks)
    ? (payload.tracks as BrowseTrackItem[])
    : [];

  if (shuffle) {
    if (rawEndpoint) {
      return navigateWithEndpoint({ ...rawEndpoint });
    }
    if (playlistId && !playlistId.startsWith('RD')) {
      return navigateWithEndpoint({
        watchPlaylistEndpoint: {
          playlistId,
          params: 'wAEB8gECKAE%3D',
        },
      });
    }
    if (tracks.length > 0) {
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      const ep = buildWatchEndpoint(
        randomTrack.videoId,
        randomTrack.playlistId,
        randomTrack.watchEndpoint
      );
      if (ep) {
        return navigateWithEndpoint(ep, randomTrack.videoId);
      }
    }
    if (playlistId) {
      return navigateWithEndpoint({
        watchPlaylistEndpoint: {
          playlistId,
          params: 'wAEB8gECKAE%3D',
        },
      });
    }
    return false;
  }

  if (rawEndpoint) {
    const ep = buildWatchEndpoint(undefined, playlistId, rawEndpoint);
    if (ep) return navigateWithEndpoint(ep);
  }

  if (tracks.length > 0) {
    const first = tracks[0];
    const ep = buildWatchEndpoint(
      first.videoId,
      playlistId || first.playlistId,
      first.watchEndpoint
    );
    if (ep) return navigateWithEndpoint(ep, first.videoId);
  }

  if (playlistId) {
    return navigateWithEndpoint({ watchPlaylistEndpoint: { playlistId } });
  }

  return false;
}

interface ParsedLyricLine {
  text: string;
  startTimeMs?: number;
  endTimeMs?: number;
}

interface ParsedLyricsPayload {
  available: boolean;
  isSynced: boolean;
  lines: ParsedLyricLine[];
  source?: string;
  reason?: string;
}

function normalizeLyricsText(rawText: string): ParsedLyricLine[] {
  const rawLines = rawText.replace(/\r\n/g, '\n').split('\n');
  const cleaned: string[] = [];
  let prevBlank = true;

  for (const raw of rawLines) {
    const trimmed = raw.trimEnd();
    const isBlank = trimmed.trim().length === 0;
    if (isBlank) {
      if (!prevBlank) {
        cleaned.push('');
        prevBlank = true;
      }
    } else {
      cleaned.push(trimmed.trim());
      prevBlank = false;
    }
  }

  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') {
    cleaned.pop();
  }

  return cleaned.map((text) => ({ text }));
}

function findNestedProperty<T>(node: unknown, targetKey: string, depth = 0): T | null {
  if (!node || typeof node !== 'object' || depth > 14) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNestedProperty<T>(item, targetKey, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }

  const record = node as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, targetKey) && record[targetKey] != null) {
    return record[targetKey] as T;
  }

  for (const key of Object.keys(record)) {
    const found = findNestedProperty<T>(record[key], targetKey, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

function parseInnerTubeLyrics(browseJson: unknown): ParsedLyricsPayload | null {
  // 1. Check for synced / timed lyrics first
  const timedData = findNestedProperty<
    Array<{
      lyricLine?: string;
      cueRange?: { startTimeMilliseconds?: string | number; endTimeMilliseconds?: string | number };
    }>
  >(browseJson, 'timedLyricsData');

  if (Array.isArray(timedData) && timedData.length > 0) {
    const sourceMessage = findNestedProperty<string>(browseJson, 'sourceMessage') || '';
    const lines: ParsedLyricLine[] = timedData
      .map((entry) => {
        const start = Number(entry?.cueRange?.startTimeMilliseconds);
        const end = Number(entry?.cueRange?.endTimeMilliseconds);
        return {
          text: String(entry?.lyricLine || '').trim(),
          startTimeMs: Number.isFinite(start) ? start : undefined,
          endTimeMs: Number.isFinite(end) ? end : undefined,
        };
      })
      .filter((line) => line.text.length > 0 || typeof line.startTimeMs === 'number');

    if (lines.length > 0) {
      return {
        available: true,
        isSynced: lines.some((l) => typeof l.startTimeMs === 'number'),
        lines,
        source: sourceMessage || 'YouTube Music',
      };
    }
  }

  // 2. Standard desktop YouTube Music Web static lyrics (musicDescriptionShelfRenderer)
  const shelf = findNestedProperty<{
    description?: PolymerRuns;
    footer?: PolymerRuns;
  }>(browseJson, 'musicDescriptionShelfRenderer');

  if (shelf?.description?.runs) {
    const text = shelf.description.runs.map((r) => r.text || '').join('');
    const footer = shelf.footer?.runs?.map((r) => r.text || '').join('').trim() || '';
    const lines = normalizeLyricsText(text);
    if (lines.length > 0) {
      return {
        available: true,
        isSynced: false,
        lines,
        source: footer || 'YouTube Music',
      };
    }
  }

  return null;
}

function readDomLyricsFallback(): ParsedLyricsPayload | null {
  const timedRenderer = document.querySelector(
    'ytmusic-player-page ytmusic-timed-lyrics-renderer'
  ) as (HTMLElement & { data?: unknown; __data?: unknown }) | null;
  if (timedRenderer) {
    const parsedTimed = parseInnerTubeLyrics(timedRenderer.data || timedRenderer.__data);
    if (parsedTimed) return parsedTimed;
  }

  const shelfEl = document.querySelector(
    'ytmusic-player-page ytmusic-description-shelf-renderer[is-track-lyrics-page], ytmusic-player-page ytmusic-description-shelf-renderer'
  );
  if (shelfEl) {
    const desc =
      shelfEl.querySelector('yt-formatted-string.description')?.textContent || '';
    const footer =
      shelfEl.querySelector('yt-formatted-string.footer')?.textContent?.trim() || '';
    const lines = normalizeLyricsText(desc);
    if (lines.length > 0) {
      return {
        available: true,
        isSynced: false,
        lines,
        source: footer || 'YouTube Music',
      };
    }
  }

  return null;
}

function findLyricsTabMeta(tabs: unknown): { browseId?: string; unavailable: boolean } {
  if (!Array.isArray(tabs)) return { unavailable: false };
  for (const tabItem of tabs) {
    const tr = (tabItem as Record<string, unknown>)?.tabRenderer as
      | {
          title?: string;
          unselectable?: boolean;
          endpoint?: {
            browseEndpoint?: {
              browseId?: string;
              browseEndpointContextSupportedConfigs?: {
                browseEndpointContextMusicConfig?: { pageType?: string };
              };
            };
          };
        }
      | undefined;
    if (!tr) continue;

    const browseEp = tr.endpoint?.browseEndpoint;
    const pageType =
      browseEp?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
        ?.pageType;
    const isLyricsTab =
      pageType === 'MUSIC_PAGE_TYPE_TRACK_LYRICS' ||
      Boolean(browseEp?.browseId?.startsWith('MPLYt')) ||
      tr.title?.trim().toLowerCase() === 'lyrics';

    if (isLyricsTab) {
      if (tr.unselectable || !browseEp?.browseId) {
        return { unavailable: true };
      }
      return { browseId: browseEp.browseId, unavailable: false };
    }
  }
  return { unavailable: false };
}

function normalizeTitleCompare(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/gi, ' ')
    .trim();
}

async function fetchLyricsForCurrentTrack(
  expectedTitle?: string,
  lastVideoId?: string
): Promise<{
  videoId: string;
  staleTransition?: boolean;
  lyrics?: ParsedLyricsPayload;
}> {
  const moviePlayer = document.getElementById('movie_player') as unknown as {
    getVideoData?: () => { video_id?: string; title?: string; author?: string };
  } | null;

  const videoData = moviePlayer?.getVideoData?.();
  const videoId =
    videoData?.video_id || new URLSearchParams(window.location.search).get('v') || '';

  if (!videoId) {
    return {
      videoId: '',
      lyrics: {
        available: false,
        isSynced: false,
        lines: [],
        reason: 'Play a song on YouTube Music to view lyrics.',
      },
    };
  }

  // Detect mid-transition delay where playerBar title updated before #movie_player video_id
  if (lastVideoId && videoId === lastVideoId && expectedTitle) {
    const normActual = normalizeTitleCompare(videoData?.title || '');
    const normExpected = normalizeTitleCompare(expectedTitle);
    if (
      normActual &&
      normExpected &&
      !normActual.includes(normExpected) &&
      !normExpected.includes(normActual)
    ) {
      return { videoId, staleTransition: true };
    }
  }

  try {
    const ytcfg = (window as unknown as {
      ytcfg?: { get?: (key: string) => unknown };
    }).ytcfg;
    const apiKey = ytcfg?.get?.('INNERTUBE_API_KEY') as string | undefined;
    const context = ytcfg?.get?.('INNERTUBE_CONTEXT') as Record<string, unknown> | undefined;

    if (apiKey && context) {
      const nextUrl = `https://music.youtube.com/youtubei/v1/next?prettyPrint=false&key=${encodeURIComponent(
        apiKey
      )}`;
      const nextRes = await fetch(nextUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, videoId }),
      });

      if (nextRes.ok) {
        const nextJson = await nextRes.json();
        const tabs =
          nextJson?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
            ?.watchNextTabbedResultsRenderer?.tabs;
        const tabMeta = findLyricsTabMeta(tabs);

        if (tabMeta.unavailable) {
          return {
            videoId,
            lyrics: {
              available: false,
              isSynced: false,
              lines: [],
              reason: 'No lyrics available for this track on YouTube Music.',
            },
          };
        }

        if (tabMeta.browseId) {
          const browseUrl = `https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&key=${encodeURIComponent(
            apiKey
          )}`;
          const browseRes = await fetch(browseUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, browseId: tabMeta.browseId }),
          });

          if (browseRes.ok) {
            const browseJson = await browseRes.json();
            const parsed = parseInnerTubeLyrics(browseJson);
            if (parsed) {
              return { videoId, lyrics: parsed };
            }
          }
        }
      }
    }
  } catch {
    // Fall through to DOM inspection fallback
  }

  const domFallback = readDomLyricsFallback();
  if (domFallback) {
    return { videoId, lyrics: domFallback };
  }

  return {
    videoId,
    lyrics: {
      available: false,
      isSynced: false,
      lines: [],
      reason: 'No lyrics available for this track on YouTube Music.',
    },
  };
}

let isolatedPlayBtn:
  | (HTMLElement & {
      data?: Record<string, unknown>;
      playNavigationEndpoint?: Record<string, unknown>;
      matchedPlayCommand?: unknown;
      state?: string;
    })
  | null = null;

let isolatedMenuServiceItem:
  | (HTMLElement & {
      data?: Record<string, unknown>;
      ytmusicServiceMenuItemBehavior?: {
        handleCommand?: (endpoint: Record<string, unknown>) => Promise<unknown> | unknown;
      };
    })
  | null = null;

function getIsolatedPlayButton() {
  const host = document.querySelector('ytmusic-app') || document.body;
  if (isolatedPlayBtn && host && host.contains(isolatedPlayBtn)) {
    return isolatedPlayBtn;
  }
  const btn = document.createElement('ytmusic-play-button-renderer') as HTMLElement & {
    data?: Record<string, unknown>;
    playNavigationEndpoint?: Record<string, unknown>;
    matchedPlayCommand?: unknown;
    state?: string;
  };
  btn.setAttribute('aria-hidden', 'true');
  btn.style.cssText =
    'position:fixed;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;';
  host?.appendChild(btn);
  isolatedPlayBtn = btn;
  return btn;
}

function getIsolatedMenuServiceItem() {
  const host = document.querySelector('ytmusic-app') || document.body;
  if (isolatedMenuServiceItem && host && host.contains(isolatedMenuServiceItem)) {
    return isolatedMenuServiceItem;
  }
  const item = document.createElement('ytmusic-menu-service-item-renderer') as HTMLElement & {
    data?: Record<string, unknown>;
    ytmusicServiceMenuItemBehavior?: {
      handleCommand?: (endpoint: Record<string, unknown>) => Promise<unknown> | unknown;
    };
  };
  item.setAttribute('aria-hidden', 'true');
  item.style.cssText =
    'position:fixed;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;';
  host?.appendChild(item);
  isolatedMenuServiceItem = item;
  return item;
}

function navigateWithEndpoint(
  navEndpoint: Record<string, unknown>,
  fallbackVideoId?: string
): boolean {
  const ytApp = document.querySelector('ytmusic-app');
  const btn = getIsolatedPlayButton();

  if (btn && customElements.get('ytmusic-play-button-renderer')) {
    try {
      btn.state = 'default';
      btn.matchedPlayCommand = undefined;
      btn.playNavigationEndpoint = navEndpoint;
      btn.data = { playNavigationEndpoint: navEndpoint };
      btn.click();
      return true;
    } catch {
      // Fall through to event dispatch
    }
  }

  if (ytApp) {
    ytApp.dispatchEvent(
      new CustomEvent('yt-navigate', {
        bubbles: true,
        composed: true,
        detail: { endpoint: navEndpoint },
      })
    );
    ytApp.dispatchEvent(
      new CustomEvent('yt-action', {
        bubbles: true,
        composed: true,
        detail: {
          actionName: 'yt-navigate',
          args: [navEndpoint],
        },
      })
    );
    return true;
  }

  if (fallbackVideoId) {
    const moviePlayer = document.getElementById('movie_player') as unknown as {
      loadVideoById?: (id: string) => void;
    } | null;
    moviePlayer?.loadVideoById?.(fallbackVideoId);
    return true;
  }

  return false;
}

function playQueueAtIndex(idx: number): boolean {
  if (!Number.isInteger(idx) || idx < 0) return false;

  const ctx = getQueueContext();
  const combined = [...ctx.items, ...ctx.automixItems];
  const rawEntry = combined[idx];

  if (rawEntry) {
    const renderer = unwrapQueueRenderer(rawEntry) as {
      videoId?: string;
      navigationEndpoint?: Record<string, unknown> & {
        watchEndpoint?: { videoId?: string; playlistId?: string; index?: number };
      };
    };
    const videoId =
      renderer?.videoId || renderer?.navigationEndpoint?.watchEndpoint?.videoId;
    let navEndpoint: Record<string, unknown> | null = renderer?.navigationEndpoint
      ? { ...renderer.navigationEndpoint }
      : videoId
        ? { watchEndpoint: { videoId } }
        : null;

    // Keep in-queue navigation intact if a queued item's watchEndpoint lacks playlistId
    if (
      navEndpoint &&
      idx < ctx.items.length &&
      !(navEndpoint.watchEndpoint as { playlistId?: string } | undefined)?.playlistId
    ) {
      const refEntry =
        ctx.items[ctx.selectedIndex >= 0 ? ctx.selectedIndex : 0] || ctx.items[0];
      const refPlaylistId = (
        unwrapQueueRenderer(refEntry) as {
          navigationEndpoint?: { watchEndpoint?: { playlistId?: string } };
        }
      )?.navigationEndpoint?.watchEndpoint?.playlistId;
      if (refPlaylistId) {
        navEndpoint = {
          ...navEndpoint,
          watchEndpoint: {
            ...((navEndpoint.watchEndpoint as Record<string, unknown>) || { videoId }),
            playlistId: refPlaylistId,
            index: idx,
          },
        };
      }
    }

    if (navEndpoint && navigateWithEndpoint(navEndpoint, videoId)) {
      return true;
    }
    if (idx < ctx.items.length && ctx.queueEl?.queue?.selectQueueItem) {
      ctx.queueEl.queue.selectQueueItem(rawEntry);
      return true;
    }
  }

  // Secondary DOM fallback
  const queueEls = document.querySelectorAll(
    'ytmusic-player-queue#queue ytmusic-player-queue-item'
  );
  if (queueEls.length > 0 && queueEls[idx]) {
    const item = queueEls[idx] as HTMLElement & {
      data?: RawQueueEntry;
      __data?: { data?: RawQueueEntry };
    };
    const rawData = item.data || item.__data?.data;
    const renderer = unwrapQueueRenderer(rawData) as {
      videoId?: string;
      navigationEndpoint?: Record<string, unknown> & {
        watchEndpoint?: { videoId?: string };
      };
    };
    const videoId =
      renderer?.videoId || renderer?.navigationEndpoint?.watchEndpoint?.videoId;
    const navEndpoint =
      renderer?.navigationEndpoint ||
      (videoId ? { watchEndpoint: { videoId } } : null);
    if (navEndpoint && navigateWithEndpoint(navEndpoint, videoId)) {
      return true;
    }
    const playBtn = item.querySelector('ytmusic-play-button-renderer') as HTMLElement | null;
    if (playBtn) {
      playBtn.click();
    } else {
      item.click();
    }
    return true;
  }

  // Fallback for Home shelf preview list when no queue exists yet
  const homeEls = document.querySelectorAll(
    'ytmusic-browse-response ytmusic-responsive-list-item-renderer, ytmusic-browse-response ytmusic-two-row-item-renderer'
  );
  const homeItem = homeEls[idx] as HTMLElement | undefined;
  if (homeItem) {
    const playBtn = homeItem.querySelector('ytmusic-play-button-renderer') as HTMLElement | null;
    if (playBtn) playBtn.click();
    else homeItem.click();
    return true;
  }

  return false;
}

async function fetchCleanQueueItems(
  videoId?: string,
  playlistId?: string
): Promise<RawQueueEntry[]> {
  if (!videoId && !playlistId) return [];
  const { apiKey, context } = getInnerTubeConfig();
  if (!apiKey || !context) return [];

  try {
    const url = `https://music.youtube.com/youtubei/v1/music/get_queue?prettyPrint=false&key=${encodeURIComponent(
      apiKey
    )}`;
    const body = videoId ? { context, videoIds: [videoId] } : { context, playlistId };
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      queueDatas?: Array<{ content?: RawQueueEntry }>;
    };
    return Array.isArray(json?.queueDatas)
      ? json.queueDatas
          .map((d) => d?.content)
          .filter((c): c is RawQueueEntry => Boolean(c))
      : [];
  } catch {
    return [];
  }
}

async function executeAddToQueue(payload: Record<string, unknown>) {
  ensureQueueStoreSubscription();
  const playNext = Boolean(payload.playNext);
  const rawEndpoint = (
    playNext ? payload.playNextEndpoint : payload.addToQueueEndpoint
  ) as
    | (Record<string, unknown> & {
        queueAddEndpoint?: {
          queueTarget?: {
            videoId?: string;
            playlistId?: string;
            onEmptyQueue?: Record<string, unknown>;
          };
          queueInsertPosition?: string;
        };
      })
    | undefined;

  const targetFromEp = rawEndpoint?.queueAddEndpoint?.queueTarget;
  const videoId = (payload.videoId as string | undefined) || targetFromEp?.videoId;
  const playlistId =
    (payload.playlistId as string | undefined) || targetFromEp?.playlistId;

  const serviceEndpoint =
    rawEndpoint ||
    (videoId || playlistId
      ? {
          queueAddEndpoint: {
            queueTarget: videoId
              ? {
                  videoId,
                  onEmptyQueue: { watchEndpoint: { videoId } },
                }
              : {
                  playlistId,
                  onEmptyQueue: { watchPlaylistEndpoint: { playlistId } },
                },
            queueInsertPosition: playNext
              ? 'INSERT_AFTER_CURRENT_VIDEO'
              : 'INSERT_AT_END',
          },
        }
      : null);

  if (!serviceEndpoint) {
    return { ok: false, queued: false, queue: extractQueueItems() };
  }

  const ctxBefore = getQueueContext();
  const beforeCount = ctxBefore.items.length;

  // 1. Run YTM's native menu service command handler (awaits /music/get_queue + Redux ADD_ITEMS)
  const menuItem = getIsolatedMenuServiceItem();
  menuItem.data = { serviceEndpoint };
  if (typeof menuItem.ytmusicServiceMenuItemBehavior?.handleCommand === 'function') {
    try {
      await menuItem.ytmusicServiceMenuItemBehavior.handleCommand(serviceEndpoint);
    } catch {
      // Fallback below will verify Redux queue growth
    }
  } else if (ctxBefore.ytApp) {
    ctxBefore.ytApp.dispatchEvent(
      new CustomEvent('yt-action', {
        bubbles: true,
        composed: true,
        detail: {
          actionName: 'yt-service-request',
          args: [menuItem, serviceEndpoint],
          returnValue: [],
        },
      })
    );
    await new Promise((r) => setTimeout(r, 350));
  }

  // 2. When Autoplay Radio (queueContextParams) returns empty queueDatas on INSERT_AT_END,
  //    fetch clean queueDatas without queueContextParams and dispatch Redux ADD_ITEMS natively.
  const ctxAfter = getQueueContext();
  if (ctxAfter.items.length <= beforeCount && ctxAfter.store?.dispatch) {
    if (beforeCount === 0 && (videoId || targetFromEp?.onEmptyQueue)) {
      const emptyEp =
        targetFromEp?.onEmptyQueue ||
        (videoId ? { watchEndpoint: { videoId } } : undefined);
      if (emptyEp) {
        navigateWithEndpoint(emptyEp, videoId);
        await new Promise((r) => setTimeout(r, 250));
      }
    } else if (beforeCount > 0 && (videoId || playlistId)) {
      const fetchedItems = await fetchCleanQueueItems(videoId, playlistId);
      if (fetchedItems.length > 0) {
        const latestCtx = getQueueContext();
        const latestItems = latestCtx.items;
        const currIdx =
          latestCtx.selectedIndex >= 0 && latestCtx.selectedIndex < latestItems.length
            ? latestCtx.selectedIndex
            : 0;
        const insertIndex = playNext
          ? Math.min(currIdx + 1, latestItems.length)
          : latestItems.length;

        latestCtx.store?.dispatch?.({
          type: 'ADD_ITEMS',
          payload: {
            nextQueueItemId: latestCtx.qState?.nextQueueItemId || 1,
            index: insertIndex,
            items: fetchedItems,
            shouldAssignIds: true,
          },
        });
      }
    }
  }

  const finalQueue = extractQueueItems();
  const afterCount = getQueueContext().items.length;
  const queued = afterCount > beforeCount || (beforeCount === 0 && finalQueue.length > 0);
  return { ok: true, queued, queue: finalQueue };
}

function moveQueueItemToNext(idx: number) {
  const ctx = getQueueContext();
  if (!ctx.store?.dispatch || !Number.isInteger(idx) || idx < 0) {
    return { ok: false, queue: extractQueueItems() };
  }

  const currIdx =
    ctx.selectedIndex >= 0 && ctx.selectedIndex < ctx.items.length ? ctx.selectedIndex : 0;

  if (idx < ctx.items.length) {
    if (idx !== currIdx && idx !== currIdx + 1) {
      // MOVE_ITEM splices fromIndex first, then inserts at toIndex
      const toIndex = idx < currIdx ? currIdx : currIdx + 1;
      ctx.store.dispatch({
        type: 'MOVE_ITEM',
        payload: { fromIndex: idx, toIndex },
      });
    }
    return { ok: true, queue: extractQueueItems() };
  }

  const automixIdx = idx - ctx.items.length;
  if (automixIdx >= 0 && automixIdx < ctx.automixItems.length) {
    const rawAutomix = ctx.automixItems[automixIdx];
    ctx.store.dispatch({ type: 'REMOVE_AUTOMIX_ITEM', payload: automixIdx });
    const fresh = getQueueContext();
    const freshCurr =
      fresh.selectedIndex >= 0 && fresh.selectedIndex < fresh.items.length
        ? fresh.selectedIndex
        : 0;
    const insertIndex = Math.min(freshCurr + 1, fresh.items.length);
    fresh.store?.dispatch?.({
      type: 'ADD_ITEMS',
      payload: {
        nextQueueItemId: fresh.qState?.nextQueueItemId || 1,
        index: insertIndex,
        items: [rawAutomix],
        shouldAssignIds: true,
      },
    });
    return { ok: true, queue: extractQueueItems() };
  }

  return { ok: false, queue: extractQueueItems() };
}

function removeQueueItemAt(idx: number) {
  const ctx = getQueueContext();
  if (!ctx.store?.dispatch || !Number.isInteger(idx) || idx < 0) {
    return { ok: false, queue: extractQueueItems() };
  }

  if (idx < ctx.items.length) {
    if (idx !== ctx.selectedIndex) {
      ctx.store.dispatch({ type: 'REMOVE_ITEM', payload: idx });
    }
    return { ok: true, queue: extractQueueItems() };
  }

  const automixIdx = idx - ctx.items.length;
  if (automixIdx >= 0 && automixIdx < ctx.automixItems.length) {
    ctx.store.dispatch({ type: 'REMOVE_AUTOMIX_ITEM', payload: automixIdx });
    return { ok: true, queue: extractQueueItems() };
  }

  return { ok: false, queue: extractQueueItems() };
}

function reorderQueueItem(fromIdx: number, toIdx: number) {
  const ctx = getQueueContext();
  if (
    !ctx.store?.dispatch ||
    !Number.isInteger(fromIdx) ||
    !Number.isInteger(toIdx) ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx === toIdx
  ) {
    return { ok: false, queue: extractQueueItems() };
  }

  const currIdx =
    ctx.selectedIndex >= 0 && ctx.selectedIndex < ctx.items.length ? ctx.selectedIndex : 0;

  if (fromIdx === currIdx || toIdx <= currIdx) {
    return { ok: false, queue: extractQueueItems() };
  }

  if (fromIdx < ctx.items.length && toIdx < ctx.items.length) {
    ctx.store.dispatch({
      type: 'MOVE_ITEM',
      payload: { fromIndex: fromIdx, toIndex: toIdx },
    });
    return { ok: true, queue: extractQueueItems() };
  }

  // Promote an automix item into manual queue items when moved up past boundary
  const automixIdx = fromIdx - ctx.items.length;
  if (automixIdx >= 0 && automixIdx < ctx.automixItems.length) {
    const rawAutomix = ctx.automixItems[automixIdx];
    ctx.store.dispatch({ type: 'REMOVE_AUTOMIX_ITEM', payload: automixIdx });
    const fresh = getQueueContext();
    const insertIndex = Math.max(
      currIdx + 1,
      Math.min(toIdx, fresh.items.length)
    );
    fresh.store?.dispatch?.({
      type: 'ADD_ITEMS',
      payload: {
        nextQueueItemId: fresh.qState?.nextQueueItemId || 1,
        index: insertIndex,
        items: [rawAutomix],
        shouldAssignIds: true,
      },
    });
    return { ok: true, queue: extractQueueItems() };
  }

  return { ok: false, queue: extractQueueItems() };
}

function clearUpcomingQueueItems() {
  const ctx = getQueueContext();
  if (!ctx.store?.dispatch) {
    return { ok: false, queue: extractQueueItems() };
  }

  const currIdx =
    ctx.selectedIndex >= 0 && ctx.selectedIndex < ctx.items.length ? ctx.selectedIndex : 0;

  for (let i = ctx.items.length - 1; i > currIdx; i--) {
    ctx.store.dispatch({ type: 'REMOVE_ITEM', payload: i });
  }
  for (let j = ctx.automixItems.length - 1; j >= 0; j--) {
    ctx.store.dispatch({ type: 'REMOVE_AUTOMIX_ITEM', payload: j });
  }

  return { ok: true, queue: extractQueueItems() };
}

async function fetchAddToPlaylistOptions(videoId: string) {
  if (!videoId) {
    return { ok: false, loggedIn: true, options: [], error: 'Missing videoId' };
  }
  const res = await postInnerTubeEndpoint('playlist/get_add_to_playlist', {
    videoIds: [videoId],
  });
  if (!res.ok) {
    return {
      ok: false,
      loggedIn: res.session.loggedIn || res.session.hasAuthCookies,
      options: [],
      error: res.error,
    };
  }
  return {
    ok: true,
    loggedIn: res.session.loggedIn || res.session.hasAuthCookies,
    options: parseAddToPlaylistOptions(res.json),
  };
}

async function toggleTrackInPlaylist(
  playlistId: string,
  videoId: string,
  add: boolean
) {
  if (!playlistId || !videoId) {
    return { ok: false, error: 'Missing playlistId or videoId' };
  }
  const actionObj = add
    ? { action: 'ACTION_ADD_VIDEO', addedVideoId: videoId }
    : { action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: videoId };
  const res = await postInnerTubeEndpoint('browse/edit_playlist', {
    playlistId,
    actions: [actionObj],
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  const body = res.json as { status?: string } | null;
  const succeeded = !body?.status || body.status === 'STATUS_SUCCEEDED';
  return { ok: succeeded, added: add };
}

function getQueueItemVideoId(entry: RawQueueEntry | null | undefined): string {
  const r = unwrapQueueRenderer(entry) as {
    videoId?: string;
    navigationEndpoint?: { watchEndpoint?: { videoId?: string } };
  };
  return String(r?.videoId || r?.navigationEndpoint?.watchEndpoint?.videoId || '').trim();
}

function shuffleUpcomingQueueItems() {
  const ctx = getQueueContext();
  const dispatch = ctx.store?.dispatch;
  if (!dispatch || ctx.items.length < 2) {
    return { shuffled: false, moved: 0, itemCount: ctx.items.length };
  }

  const startIdx = ctx.selectedIndex >= 0 ? ctx.selectedIndex + 1 : 0;
  const n = ctx.items.length;
  if (n - startIdx < 2) {
    return { shuffled: false, moved: 0, itemCount: n };
  }

  let moved = 0;
  for (let target = startIdx; target < n - 1; target++) {
    const pick = target + Math.floor(Math.random() * (n - target));
    if (pick > target) {
      dispatch({
        type: 'MOVE_ITEM',
        payload: { fromIndex: pick, toIndex: target },
      });
      moved++;
    }
  }

  if (moved === 0) {
    dispatch({
      type: 'MOVE_ITEM',
      payload: { fromIndex: n - 1, toIndex: startIdx },
    });
    moved = 1;
  }

  return { shuffled: true, moved, itemCount: n };
}

async function toggleShuffleInMainWorld() {
  const playerBar = document.querySelector('ytmusic-player-bar') as
    | (HTMLElement & {
        onShuffleButtonClick_?: () => void;
        onShuffleButtonClick?: () => void;
      })
    | null;

  const beforeCtx = getQueueContext();
  const beforeStart = beforeCtx.selectedIndex >= 0 ? beforeCtx.selectedIndex + 1 : 0;
  const beforeUpcoming = beforeCtx.items.slice(beforeStart).map(getQueueItemVideoId);
  const wasShuffleOn = Boolean(playerBar?.hasAttribute('shuffle-on'));

  const candidates = Array.from(
    document.querySelectorAll(
      'ytmusic-player-bar .shuffle button#button, ytmusic-player-bar #expand-shuffle button#button, ytmusic-player-bar .shuffle, ytmusic-player-bar #expand-shuffle'
    )
  ) as HTMLElement[];
  const visibleBtn = candidates.find((el) => el.offsetParent !== null) || candidates[0] || null;

  if (visibleBtn) {
    visibleBtn.click();
  } else if (typeof playerBar?.onShuffleButtonClick_ === 'function') {
    playerBar.onShuffleButtonClick_();
  } else if (typeof playerBar?.onShuffleButtonClick === 'function') {
    playerBar.onShuffleButtonClick();
  }

  await new Promise((resolve) => setTimeout(resolve, 140));

  let isShuffleOn = Boolean(playerBar?.hasAttribute('shuffle-on'));
  if (isShuffleOn === wasShuffleOn) {
    if (typeof playerBar?.onShuffleButtonClick_ === 'function') {
      playerBar.onShuffleButtonClick_();
      await new Promise((resolve) => setTimeout(resolve, 100));
      isShuffleOn = Boolean(playerBar?.hasAttribute('shuffle-on'));
    } else if (typeof playerBar?.onShuffleButtonClick === 'function') {
      playerBar.onShuffleButtonClick();
      await new Promise((resolve) => setTimeout(resolve, 100));
      isShuffleOn = Boolean(playerBar?.hasAttribute('shuffle-on'));
    }
  }

  const afterCtx = getQueueContext();
  const afterStart = afterCtx.selectedIndex >= 0 ? afterCtx.selectedIndex + 1 : 0;
  const afterUpcoming = afterCtx.items.slice(afterStart).map(getQueueItemVideoId);
  const orderUnchanged =
    beforeUpcoming.length >= 2 &&
    afterUpcoming.length === beforeUpcoming.length &&
    beforeUpcoming.every((id, idx) => id === afterUpcoming[idx]);

  let manualShuffleResult: { shuffled: boolean; moved: number; itemCount: number } | null = null;
  if ((isShuffleOn || isShuffleOn === wasShuffleOn) && orderUnchanged) {
    manualShuffleResult = shuffleUpcomingQueueItems();
  }

  return {
    shuffleOn: isShuffleOn,
    manualShuffled: Boolean(manualShuffleResult?.shuffled),
    moved: manualShuffleResult?.moved ?? 0,
  };
}

async function createPlaylistWithTrack(
  title: string,
  privacyStatus: 'PRIVATE' | 'UNLISTED' | 'PUBLIC',
  videoIdOrIds?: string | string[]
) {
  const cleanTitle = title.trim().slice(0, 120);
  if (!cleanTitle) {
    return { ok: false, error: 'Playlist title is required.' };
  }
  const uniqueVideoIds = Array.from(
    new Set(
      (Array.isArray(videoIdOrIds) ? videoIdOrIds : videoIdOrIds ? [videoIdOrIds] : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 200);

  const res = await postInnerTubeEndpoint('playlist/create', {
    title: cleanTitle,
    privacyStatus,
    ...(uniqueVideoIds.length > 0 ? { videoIds: uniqueVideoIds } : {}),
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }
  const body = res.json as { playlistId?: string } | null;
  return {
    ok: Boolean(body?.playlistId),
    playlistId: body?.playlistId,
  };
}

(function initAestheticMainWorldBridge() {
  if ((window as unknown as Record<string, boolean>).__AESTHETIC_MUSIC_BRIDGE_V5__) {
    return;
  }
  (window as unknown as Record<string, boolean>).__AESTHETIC_MUSIC_BRIDGE_V5__ = true;
  ensureQueueStoreSubscription();
  if (document.querySelector('ytmusic-app')) {
    getIsolatedPlayButton();
    getIsolatedMenuServiceItem();
  }

  window.addEventListener('aesthetic-music:request', (event: Event) => {
    void (async () => {
      const customEvent = event as CustomEvent<BridgeRequestDetail>;
      const detail = customEvent.detail;
      if (!detail || !detail.requestId) return;

      const moviePlayer = document.getElementById('movie_player') as unknown as {
        getPlayerState?: () => number;
        getCurrentTime?: () => number;
        getDuration?: () => number;
        getVideoData?: () => { video_id?: string; title?: string; author?: string };
        seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
        setVolume?: (volume: number) => void;
        getVolume?: () => number;
        isMuted?: () => boolean;
      } | null;

      let responseData: Record<string, unknown> = { ok: true };

      try {
        switch (detail.action) {
          case 'PING':
            responseData = { ok: true, bridgeActive: true };
            break;

          case 'GET_FULL_STATE': {
            const queue = extractQueueItems();
            responseData = {
              ok: true,
              playerState: moviePlayer?.getPlayerState?.() ?? -1,
              currentTime: moviePlayer?.getCurrentTime?.() ?? 0,
              duration: moviePlayer?.getDuration?.() ?? 0,
              videoData: moviePlayer?.getVideoData?.() ?? null,
              volume: moviePlayer?.getVolume?.() ?? 100,
              isMuted: moviePlayer?.isMuted?.() ?? false,
              queue,
            };
            break;
          }

          case 'SEEK_TO':
            if (typeof detail.payload?.seconds === 'number') {
              moviePlayer?.seekTo?.(detail.payload.seconds, true);
            }
            break;

          case 'SET_VOLUME':
            if (typeof detail.payload?.volume === 'number') {
              moviePlayer?.setVolume?.(detail.payload.volume);
            }
            break;

          case 'PLAY_QUEUE_INDEX': {
            const idx = Number(detail.payload?.index ?? -1);
            const ok = playQueueAtIndex(idx);
            responseData = { ok };
            break;
          }

          case 'PLAY_NEXT_QUEUE_ITEM': {
            const idx = Number(detail.payload?.index ?? -1);
            responseData = moveQueueItemToNext(idx);
            break;
          }

          case 'REMOVE_QUEUE_ITEM': {
            const idx = Number(detail.payload?.index ?? -1);
            responseData = removeQueueItemAt(idx);
            break;
          }

          case 'REORDER_QUEUE_ITEM': {
            const fromIndex = Number(detail.payload?.fromIndex ?? -1);
            const toIndex = Number(detail.payload?.toIndex ?? -1);
            responseData = reorderQueueItem(fromIndex, toIndex);
            break;
          }

          case 'CLEAR_UPCOMING_QUEUE': {
            responseData = clearUpcomingQueueItems();
            break;
          }

          case 'GET_ADD_TO_PLAYLIST_OPTIONS': {
            const videoId = String(detail.payload?.videoId || '').trim();
            responseData = await fetchAddToPlaylistOptions(videoId);
            break;
          }

          case 'TOGGLE_TRACK_IN_PLAYLIST': {
            const playlistId = String(detail.payload?.playlistId || '').trim();
            const videoId = String(detail.payload?.videoId || '').trim();
            const add = Boolean(detail.payload?.add);
            responseData = await toggleTrackInPlaylist(playlistId, videoId, add);
            break;
          }

          case 'TOGGLE_SHUFFLE': {
            responseData = await toggleShuffleInMainWorld();
            break;
          }

          case 'SHUFFLE_UPCOMING_QUEUE': {
            responseData = shuffleUpcomingQueueItems();
            break;
          }

          case 'CREATE_PLAYLIST': {
            const title = String(detail.payload?.title || '').trim();
            const rawPrivacy = String(detail.payload?.privacyStatus || 'PRIVATE').toUpperCase();
            const privacyStatus =
              rawPrivacy === 'PUBLIC'
                ? 'PUBLIC'
                : rawPrivacy === 'UNLISTED'
                ? 'UNLISTED'
                : 'PRIVATE';
            const rawVideoIds = Array.isArray(detail.payload?.videoIds)
              ? detail.payload.videoIds.map((id) => String(id || '').trim()).filter(Boolean)
              : undefined;
            const singleVideoId = detail.payload?.videoId
              ? String(detail.payload.videoId).trim()
              : undefined;
            responseData = await createPlaylistWithTrack(
              title,
              privacyStatus,
              rawVideoIds && rawVideoIds.length > 0 ? rawVideoIds : singleVideoId
            );
            break;
          }

          case 'SEARCH_YTM': {
            const query = String(detail.payload?.query || '').trim();
            const results = query ? await performNativeSearch(query) : [];
            responseData = { ok: true, results };
            break;
          }

          case 'PLAY_SEARCH_RESULT': {
            if (detail.payload) {
              playSearchResultItem(detail.payload);
            }
            break;
          }

          case 'FETCH_BROWSE_DETAILS': {
            const browseId = String(detail.payload?.browseId || '').trim();
            const rawKind = detail.payload?.kind;
            const hintKind =
              rawKind === 'Artist' || rawKind === 'Album' || rawKind === 'Playlist'
                ? rawKind
                : undefined;
            const params = detail.payload?.params
              ? String(detail.payload.params)
              : undefined;
            responseData = await fetchBrowseDetails(browseId, hintKind, params);
            break;
          }

          case 'FETCH_LIBRARY_HUB': {
            const rawSection = detail.payload?.section;
            const section: LibraryHubSection =
              rawSection === 'liked' ||
              rawSection === 'playlists' ||
              rawSection === 'home' ||
              rawSection === 'explore' ||
              rawSection === 'history'
                ? rawSection
                : 'home';
            responseData = await fetchLibraryHub(section);
            break;
          }

          case 'PLAY_ENDPOINT': {
            const ok = detail.payload ? playBrowseEndpoint(detail.payload) : false;
            responseData = { ok };
            break;
          }

          case 'ADD_TO_QUEUE': {
            responseData = await executeAddToQueue(detail.payload || {});
            break;
          }

          case 'GET_LYRICS': {
            const expectedTitle =
              typeof detail.payload?.expectedTitle === 'string'
                ? detail.payload.expectedTitle
                : undefined;
            const lastVideoId =
              typeof detail.payload?.lastVideoId === 'string'
                ? detail.payload.lastVideoId
                : undefined;
            const result = await fetchLyricsForCurrentTrack(expectedTitle, lastVideoId);
            responseData = { ok: true, ...result };
            break;
          }
        }
      } catch (err) {
        responseData = { ok: false, error: String(err) };
      }

      window.dispatchEvent(
        new CustomEvent('aesthetic-music:response', {
          detail: {
            requestId: detail.requestId,
            data: responseData,
          },
        })
      );
    })();
  });
})();
