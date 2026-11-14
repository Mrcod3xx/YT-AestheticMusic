/**
 * MAIN World Bridge for YouTube Music
 * Executes in the page context of https://music.youtube.com/* to access:
 * 1. Live InnerTube Search API (/youtubei/v1/search) with recursive renderer extraction
 * 2. Polymer component .data on <ytmusic-player-queue-item> (including offscreen lazy thumbnails)
 * 3. #movie_player API & Polymer watchEndpoint playback triggers
 * 4. Capture-phase keyboard shield so typing Spacebar or hotkeys inside Shadow DOM inputs
 *    is never swallowed by YouTube Music's global shortcut manager.
 */

interface BridgeRequestDetail {
  action:
    | 'PING'
    | 'GET_FULL_STATE'
    | 'SEEK_TO'
    | 'SET_VOLUME'
    | 'PLAY_QUEUE_INDEX'
    | 'PLAY_NEXT_QUEUE_ITEM'
    | 'REMOVE_QUEUE_ITEM'
    | 'SEARCH_YTM'
    | 'PLAY_SEARCH_RESULT'
    | 'ADD_TO_QUEUE'
    | 'GET_LYRICS';
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

interface ParsedSearchResult {
  id: string;
  searchIndex: number;
  title: string;
  subtitle: string;
  category: 'Song' | 'Video' | 'Album' | 'Artist' | 'Playlist';
  artworkUrl: string;
  videoId?: string;
  playlistId?: string;
  browseId?: string;
  watchEndpoint?: Record<string, unknown>;
  addToQueueEndpoint?: Record<string, unknown>;
  playNextEndpoint?: Record<string, unknown>;
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

function upgradeGoogleImage(url: string): string {
  if (!url) return '';
  if (url.includes('lh3.googleusercontent.com') || url.includes('yt3.ggpht.com')) {
    return url.replace(/=w\d+-h\d+[^&?]*/g, '=w1000-h1000-l90-rj');
  }
  if (url.includes('i.ytimg.com')) {
    return url.replace(/(hqdefault|mqdefault|sddefault)\.jpg/, 'hq720.jpg');
  }
  return url;
}

function pickBestThumbnail(thumbnails?: PolymerThumbnail[]): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  const last = thumbnails[thumbnails.length - 1];
  return last?.url || thumbnails[0]?.url || '';
}

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

function getInnerTubeConfig(): {
  apiKey?: string;
  context?: Record<string, unknown>;
} {
  const ytcfg = (
    window as unknown as {
      ytcfg?: { get?: (key: string) => unknown };
    }
  ).ytcfg;
  return {
    apiKey: ytcfg?.get?.('INNERTUBE_API_KEY') as string | undefined,
    context: ytcfg?.get?.('INNERTUBE_CONTEXT') as Record<string, unknown> | undefined,
  };
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

function classifySubtitle(
  subtitleText: string,
  shelfTitle = '',
  hasVideoId = false
): 'Song' | 'Video' | 'Album' | 'Artist' | 'Playlist' {
  const lower = `${shelfTitle} ${subtitleText}`.toLowerCase();
  if (lower.includes('video')) return 'Video';
  if (lower.includes('album') || lower.includes('single') || lower.includes('ep')) return 'Album';
  if (lower.includes('artist') || lower.includes('subscribers')) return 'Artist';
  if (lower.includes('playlist')) return 'Playlist';
  if (hasVideoId) return 'Song';
  return 'Song';
}

function extractQueueEndpoints(menuItems: unknown): {
  addToQueueEndpoint?: Record<string, unknown>;
  playNextEndpoint?: Record<string, unknown>;
  queuePlaylistId?: string;
} {
  let addToQueueEndpoint: Record<string, unknown> | undefined;
  let playNextEndpoint: Record<string, unknown> | undefined;
  let queuePlaylistId: string | undefined;

  if (!Array.isArray(menuItems)) {
    return {};
  }

  for (const entry of menuItems) {
    const msi = (entry as Record<string, unknown>)?.menuServiceItemRenderer as
      | {
          serviceEndpoint?: {
            queueAddEndpoint?: {
              queueInsertPosition?: string;
              queueTarget?: { videoId?: string; playlistId?: string };
            };
          };
        }
      | undefined;
    const ep = msi?.serviceEndpoint;
    const qAdd = ep?.queueAddEndpoint;
    if (!qAdd) continue;

    if (!queuePlaylistId && qAdd.queueTarget?.playlistId) {
      queuePlaylistId = qAdd.queueTarget.playlistId;
    }

    if (qAdd.queueInsertPosition === 'INSERT_AT_END' && !addToQueueEndpoint) {
      addToQueueEndpoint = ep as unknown as Record<string, unknown>;
    } else if (
      qAdd.queueInsertPosition === 'INSERT_AFTER_CURRENT_VIDEO' &&
      !playNextEndpoint
    ) {
      playNextEndpoint = ep as unknown as Record<string, unknown>;
    }
  }

  return { addToQueueEndpoint, playNextEndpoint, queuePlaylistId };
}

// Recursively walk any InnerTube JSON structure and extract every musicCardShelfRenderer and musicResponsiveListItemRenderer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRenderersRecursively(root: any): ParsedSearchResult[] {
  const results: ParsedSearchResult[] = [];
  const seenKeys = new Set<string>();
  let idxCounter = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any, currentShelfTitle = '') {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const child of node) {
        walk(child, currentShelfTitle);
      }
      return;
    }

    // Track shelf title if entering a musicShelfRenderer
    let nextShelfTitle = currentShelfTitle;
    if (node.musicShelfRenderer?.title?.runs?.[0]?.text) {
      nextShelfTitle = node.musicShelfRenderer.title.runs[0].text;
    }

    // 1. musicCardShelfRenderer (Top Result Card)
    if (node.musicCardShelfRenderer) {
      const card = node.musicCardShelfRenderer;
      const title = card?.title?.runs?.[0]?.text || '';
      const subtitle = (card?.subtitle?.runs || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.text)
        .join('');
      const thumb = pickBestThumbnail(
        card?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      );
      const watchEp =
        card?.onTap?.watchEndpoint ||
        card?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint ||
        card?.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint;
      const browseEp =
        card?.onTap?.browseEndpoint ||
        card?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint;

      const videoId = watchEp?.videoId;
      const browseId = browseEp?.browseId;
      const { addToQueueEndpoint, playNextEndpoint, queuePlaylistId } =
        extractQueueEndpoints(card?.menu?.menuRenderer?.items);
      const playlistId = watchEp?.playlistId || queuePlaylistId;
      const mvType =
        watchEp?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
          ?.musicVideoType;

      if (title) {
        const dedupKey = videoId || browseId || `${title}-${subtitle}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
          const category =
            mvType === 'MUSIC_VIDEO_TYPE_OMV' || mvType === 'MUSIC_VIDEO_TYPE_UGC'
              ? 'Video'
              : mvType === 'MUSIC_VIDEO_TYPE_ATV'
              ? 'Song'
              : classifySubtitle(subtitle, 'Top result', Boolean(videoId));

          results.push({
            id: `it-card-${idxCounter}`,
            searchIndex: idxCounter++,
            title,
            subtitle: subtitle || 'Top Result',
            category,
            artworkUrl: upgradeGoogleImage(thumb) || thumb,
            videoId,
            playlistId,
            browseId,
            watchEndpoint: watchEp || undefined,
            addToQueueEndpoint,
            playNextEndpoint,
          });
        }
      }
    }

    // 2. musicResponsiveListItemRenderer (Songs, Videos, Albums, Artists, Playlists)
    if (node.musicResponsiveListItemRenderer) {
      const item = node.musicResponsiveListItemRenderer;
      const flexColumns = item?.flexColumns || [];

      const runs0 =
        flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const title = runs0[0]?.text || '';

      // Concatenate remaining flex columns for Artist • Album • Duration
      const subtitleParts: string[] = [];
      for (let i = 1; i < flexColumns.length; i++) {
        const runs =
          flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const colText = runs.map((r: any) => r.text).join('').trim();
        if (colText) subtitleParts.push(colText);
      }
      const subtitle = subtitleParts.join(' • ');

      const thumb = pickBestThumbnail(
        item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      );

      const overlayWatch =
        item?.overlay?.musicItemThumbnailOverlayRenderer?.content
          ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint ||
        item?.overlay?.musicItemThumbnailOverlayRenderer?.content
          ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchPlaylistEndpoint;

      const directWatch =
        runs0[0]?.navigationEndpoint?.watchEndpoint ||
        item?.navigationEndpoint?.watchEndpoint ||
        item?.doubleTapCommand?.watchEndpoint;

      const browseEp =
        runs0[0]?.navigationEndpoint?.browseEndpoint ||
        item?.navigationEndpoint?.browseEndpoint;

      const fullWatchEp = overlayWatch || directWatch;
      const videoId = fullWatchEp?.videoId;
      const browseId = browseEp?.browseId;
      const { addToQueueEndpoint, playNextEndpoint, queuePlaylistId } =
        extractQueueEndpoints(item?.menu?.menuRenderer?.items);
      const playlistId = fullWatchEp?.playlistId || queuePlaylistId;
      const mvType =
        fullWatchEp?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
          ?.musicVideoType;

      if (title) {
        const dedupKey = videoId || browseId || `${title}-${subtitle}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
          const category =
            mvType === 'MUSIC_VIDEO_TYPE_OMV' || mvType === 'MUSIC_VIDEO_TYPE_UGC'
              ? 'Video'
              : mvType === 'MUSIC_VIDEO_TYPE_ATV'
              ? 'Song'
              : classifySubtitle(subtitle, nextShelfTitle, Boolean(videoId));

          results.push({
            id: `it-item-${idxCounter}-${videoId || idxCounter}`,
            searchIndex: idxCounter++,
            title,
            subtitle: subtitle || nextShelfTitle || 'YouTube Music',
            category,
            artworkUrl: upgradeGoogleImage(thumb) || thumb,
            videoId,
            playlistId,
            browseId,
            watchEndpoint: fullWatchEp || undefined,
            addToQueueEndpoint,
            playNextEndpoint,
          });
        }
      }
    }

    for (const key of Object.keys(node)) {
      walk(node[key], nextShelfTitle);
    }
  }

  walk(root);
  return results;
}

async function performNativeSearch(query: string): Promise<ParsedSearchResult[]> {
  try {
    const ytcfg = (window as unknown as {
      ytcfg?: { get?: (key: string) => unknown };
    }).ytcfg;
    const apiKey = ytcfg?.get?.('INNERTUBE_API_KEY') as string | undefined;
    const context = ytcfg?.get?.('INNERTUBE_CONTEXT') as Record<string, unknown> | undefined;

    if (apiKey && context) {
      const url = `https://music.youtube.com/youtubei/v1/search?prettyPrint=false&key=${encodeURIComponent(
        apiKey
      )}`;

      // Fetch General Search (Top Result + Songs + Videos), Videos filter, and Songs filter in parallel
      const [generalRes, videosRes, songsRes] = await Promise.allSettled([
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            query,
          }),
        }),
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            query,
            params: 'EgWKAQIQAWoKEAkQBRAKEAMQBA==', // Official YTM "Videos" filter
          }),
        }),
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            query,
            params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==', // Official YTM "Songs" filter
          }),
        }),
      ]);

      const merged: ParsedSearchResult[] = [];
      const seen = new Set<string>();

      const appendParsed = (items: ParsedSearchResult[]) => {
        for (const item of items) {
          const key = item.videoId || item.browseId || `${item.title}-${item.subtitle}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }
      };

      if (generalRes.status === 'fulfilled' && generalRes.value.ok) {
        const generalJson = await generalRes.value.json();
        appendParsed(extractRenderersRecursively(generalJson).slice(0, 12));
      }

      if (videosRes.status === 'fulfilled' && videosRes.value.ok) {
        const videosJson = await videosRes.value.json();
        appendParsed(
          extractRenderersRecursively(videosJson)
            .slice(0, 8)
            .map((v) => ({ ...v, category: 'Video' as const }))
        );
      }

      if (songsRes.status === 'fulfilled' && songsRes.value.ok) {
        const songsJson = await songsRes.value.json();
        appendParsed(
          extractRenderersRecursively(songsJson)
            .slice(0, 8)
            .map((s) => ({ ...s, category: 'Song' as const }))
        );
      }

      if (merged.length > 0) {
        return merged.slice(0, 28).map((item, idx) => ({
          ...item,
          searchIndex: idx,
        }));
      }
    }
  } catch (err) {
    console.warn('[Aesthetic Music] InnerTube live search error:', err);
  }

  return [];
}

function playSearchResultItem(payload: Record<string, unknown>) {
  const videoId = payload.videoId as string | undefined;
  const playlistId = payload.playlistId as string | undefined;
  const browseId = payload.browseId as string | undefined;
  const rawWatchEndpoint = payload.watchEndpoint as Record<string, unknown> | undefined;

  if (videoId || playlistId || rawWatchEndpoint) {
    const watchEndpoint: Record<string, unknown> = rawWatchEndpoint
      ? { ...rawWatchEndpoint }
      : {};
    if (videoId && !watchEndpoint.videoId) watchEndpoint.videoId = videoId;
    if (!watchEndpoint.playlistId && (playlistId || videoId)) {
      watchEndpoint.playlistId = playlistId || `RDAMVM${videoId}`;
    }

    // 1. Trigger via an existing ytmusic-play-button-renderer's Polymer handler
    const anyPlayBtn = document.querySelector('ytmusic-play-button-renderer') as
      | (HTMLElement & {
          data?: Record<string, unknown>;
          playNavigationEndpoint?: Record<string, unknown>;
        })
      | null;

    if (anyPlayBtn) {
      const originalData = anyPlayBtn.data;
      const originalEndpoint = anyPlayBtn.playNavigationEndpoint;
      try {
        const navEp = { watchEndpoint };
        anyPlayBtn.data = { playNavigationEndpoint: navEp };
        anyPlayBtn.playNavigationEndpoint = navEp;
        anyPlayBtn.click();
        setTimeout(() => {
          if (originalData) anyPlayBtn.data = originalData;
          if (originalEndpoint) anyPlayBtn.playNavigationEndpoint = originalEndpoint;
        }, 400);
        return;
      } catch {
        if (originalData) anyPlayBtn.data = originalData;
        if (originalEndpoint) anyPlayBtn.playNavigationEndpoint = originalEndpoint;
      }
    }

    // 2. Fallback: Dispatch yt-navigate on ytmusic-app
    const ytApp = document.querySelector('ytmusic-app');
    if (ytApp) {
      ytApp.dispatchEvent(
        new CustomEvent('yt-action', {
          bubbles: true,
          composed: true,
          detail: {
            actionName: 'yt-navigate',
            args: [{ watchEndpoint }],
          },
        })
      );
    }

    // 3. Direct #movie_player fallback
    const moviePlayer = document.getElementById('movie_player') as unknown as {
      loadVideoById?: (id: string) => void;
    } | null;
    if (videoId && moviePlayer?.loadVideoById) {
      moviePlayer.loadVideoById(videoId);
      return;
    }
  } else if (browseId) {
    const ytApp = document.querySelector('ytmusic-app');
    ytApp?.dispatchEvent(
      new CustomEvent('yt-action', {
        bubbles: true,
        composed: true,
        detail: {
          actionName: 'yt-navigate',
          args: [{ browseEndpoint: { browseId } }],
        },
      })
    );
  }
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
