import {
  BrowseDetailsData,
  BrowseTrackItem,
  SearchResultCategory,
} from './types';

export interface PolymerThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface PolymerRun {
  text?: string;
  navigationEndpoint?: {
    watchEndpoint?: { videoId?: string; playlistId?: string; params?: string };
    watchPlaylistEndpoint?: { playlistId?: string; params?: string };
    browseEndpoint?: {
      browseId?: string;
      params?: string;
      browseEndpointContextSupportedConfigs?: {
        browseEndpointContextMusicConfig?: {
          pageType?: string;
        };
      };
    };
  };
}

export interface PolymerRuns {
  runs?: PolymerRun[];
}

export interface RawBridgeSearchResult {
  id: string;
  searchIndex: number;
  title: string;
  subtitle: string;
  category: SearchResultCategory;
  artworkUrl: string;
  videoId?: string;
  playlistId?: string;
  browseId?: string;
  isTopResult?: boolean;
  shelfTitle?: string;
  watchEndpoint?: Record<string, unknown>;
  addToQueueEndpoint?: Record<string, unknown>;
  playNextEndpoint?: Record<string, unknown>;
}

const DURATION_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;

export function upgradeGoogleImage(url: string): string {
  if (!url) return '';
  if (url.includes('lh3.googleusercontent.com') || url.includes('yt3.ggpht.com')) {
    return url.replace(/=w\d+-h\d+[^&?]*/g, '=w1000-h1000-l90-rj');
  }
  if (url.includes('i.ytimg.com')) {
    return url.replace(/(hqdefault|mqdefault|sddefault)\.jpg/, 'hq720.jpg');
  }
  return url;
}

export function pickBestThumbnail(thumbnails?: PolymerThumbnail[]): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  const last = thumbnails[thumbnails.length - 1];
  return last?.url || thumbnails[0]?.url || '';
}

export function runsToText(runs?: Array<{ text?: string }>): string {
  if (!Array.isArray(runs)) return '';
  return runs
    .map((r) => r?.text || '')
    .join('')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPageType(browseEp: any): string {
  return (
    browseEp?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
      ?.pageType || ''
  );
}

export function inferBrowseKind(
  browseId: string,
  pageType?: string,
  subtitleHint?: string
): 'Artist' | 'Album' | 'Playlist' {
  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL') {
    return 'Artist';
  }
  if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') return 'Album';
  if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') return 'Playlist';

  if (browseId.startsWith('UC') || browseId.startsWith('FE')) return 'Artist';
  if (browseId.startsWith('MPREb_')) return 'Album';
  if (browseId.startsWith('VL') || browseId.startsWith('PL') || browseId.startsWith('RD')) {
    return 'Playlist';
  }

  const lower = (subtitleHint || '').toLowerCase();
  if (lower.includes('artist') || lower.includes('monthly audience')) return 'Artist';
  if (lower.includes('playlist')) return 'Playlist';
  return 'Album';
}

export function classifySearchCategory(params: {
  pageType?: string;
  mvType?: string;
  browseId?: string;
  subtitleText: string;
  shelfTitle?: string;
  hasVideoId: boolean;
}): SearchResultCategory {
  const { pageType, mvType, browseId, subtitleText, shelfTitle = '', hasVideoId } = params;

  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL') {
    return 'Artist';
  }
  if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') {
    return 'Album';
  }
  if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') {
    return 'Playlist';
  }

  if (!hasVideoId && browseId) {
    if (browseId.startsWith('UC')) return 'Artist';
    if (browseId.startsWith('MPREb_')) return 'Album';
    if (browseId.startsWith('VL')) return 'Playlist';
  }

  if (mvType === 'MUSIC_VIDEO_TYPE_OMV' || mvType === 'MUSIC_VIDEO_TYPE_UGC') {
    return 'Video';
  }
  if (mvType === 'MUSIC_VIDEO_TYPE_ATV') {
    return 'Song';
  }

  const shelfLower = shelfTitle.toLowerCase();
  const subLower = subtitleText.toLowerCase();
  const combined = `${shelfLower} ${subLower}`;

  if (subLower.startsWith('artist') || shelfLower === 'artists' || subLower.includes('monthly audience') || subLower.includes('subscribers')) {
    return 'Artist';
  }
  if (combined.includes('video')) return 'Video';
  if (!hasVideoId || subLower.startsWith('album') || subLower.startsWith('single') || subLower.startsWith('ep') || shelfLower === 'albums' || shelfLower === 'singles') {
    if (combined.includes('album') || combined.includes('single') || combined.includes('ep')) {
      return 'Album';
    }
    if (combined.includes('playlist')) return 'Playlist';
  }

  return 'Song';
}

export function extractQueueEndpoints(menuItems: unknown): {
  addToQueueEndpoint?: Record<string, unknown>;
  playNextEndpoint?: Record<string, unknown>;
  queuePlaylistId?: string;
  shuffleEndpoint?: Record<string, unknown>;
} {
  let addToQueueEndpoint: Record<string, unknown> | undefined;
  let playNextEndpoint: Record<string, unknown> | undefined;
  let queuePlaylistId: string | undefined;
  let shuffleEndpoint: Record<string, unknown> | undefined;

  if (!Array.isArray(menuItems)) {
    return {};
  }

  for (const entry of menuItems) {
    const rec = entry as Record<string, unknown>;
    const msi = rec?.menuServiceItemRenderer as
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
    if (qAdd) {
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

    const mni = rec?.menuNavigationItemRenderer as
      | {
          text?: PolymerRuns;
          icon?: { iconType?: string };
          navigationEndpoint?: Record<string, unknown>;
        }
      | undefined;
    if (mni?.navigationEndpoint) {
      const label = runsToText(mni.text?.runs).toLowerCase();
      if (mni.icon?.iconType === 'SHUFFLE' || label.includes('shuffle')) {
        shuffleEndpoint = mni.navigationEndpoint;
      }
    }
  }

  return { addToQueueEndpoint, playNextEndpoint, queuePlaylistId, shuffleEndpoint };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractDurationText(item: any, flexColumns: any[]): string {
  const fixedRuns =
    item?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs;
  const fixedText = runsToText(fixedRuns);
  if (fixedText && DURATION_RE.test(fixedText)) {
    return fixedText;
  }

  for (let i = flexColumns.length - 1; i >= 1; i--) {
    const runs =
      flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    for (const run of runs) {
      const t = (run?.text || '').trim();
      if (DURATION_RE.test(t)) return t;
    }
  }

  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractSearchRenderers(root: any): RawBridgeSearchResult[] {
  const results: RawBridgeSearchResult[] = [];
  const seenKeys = new Set<string>();
  let idxCounter = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any, currentShelfTitle = '', inTopResult = false) {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const child of node) {
        walk(child, currentShelfTitle, inTopResult);
      }
      return;
    }

    let nextShelfTitle = currentShelfTitle;
    let nextInTopResult = inTopResult;
    if (node.musicShelfRenderer?.title?.runs) {
      nextShelfTitle = runsToText(node.musicShelfRenderer.title.runs) || currentShelfTitle;
      nextInTopResult = nextShelfTitle.toLowerCase().includes('top result');
    }

    // 1. musicCardShelfRenderer (Top Result Card + optional nested contents)
    if (node.musicCardShelfRenderer) {
      const card = node.musicCardShelfRenderer;
      const shelfHeading =
        runsToText(card?.header?.musicCardShelfHeaderBasicRenderer?.title?.runs) ||
        nextShelfTitle ||
        'Top result';
      const title = runsToText(card?.title?.runs);
      const subtitle = runsToText(card?.subtitle?.runs);
      const thumb = pickBestThumbnail(
        card?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      );
      const browseEp =
        card?.onTap?.browseEndpoint ||
        card?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint;
      const directWatchEp =
        card?.onTap?.watchEndpoint ||
        card?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint;
      const buttonWatchEp =
        card?.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint ||
        card?.buttons?.[0]?.buttonRenderer?.command?.watchPlaylistEndpoint;

      const browseId = browseEp?.browseId as string | undefined;
      const pageType = extractPageType(browseEp);
      const effectiveWatchEp = directWatchEp || buttonWatchEp;
      const mvType =
        effectiveWatchEp?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
          ?.musicVideoType;

      const category = classifySearchCategory({
        pageType,
        mvType,
        browseId,
        subtitleText: subtitle,
        shelfTitle: shelfHeading,
        hasVideoId: Boolean(directWatchEp?.videoId),
      });

      const isContainerCategory =
        category === 'Artist' || category === 'Album' || category === 'Playlist';
      const videoId = isContainerCategory
        ? (directWatchEp?.videoId as string | undefined)
        : ((effectiveWatchEp?.videoId as string | undefined) || undefined);

      const { addToQueueEndpoint, playNextEndpoint, queuePlaylistId } =
        extractQueueEndpoints(card?.menu?.menuRenderer?.items);
      const playlistId =
        (effectiveWatchEp?.playlistId as string | undefined) || queuePlaylistId;

      if (title) {
        const dedupKey = `${category}:${videoId || browseId || `${title}-${subtitle}`}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
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
            isTopResult: true,
            shelfTitle: shelfHeading,
            watchEndpoint: effectiveWatchEp || undefined,
            addToQueueEndpoint,
            playNextEndpoint,
          });
        }
      }

      // Recurse into card.contents as Top Results
      if (Array.isArray(card.contents)) {
        walk(card.contents, shelfHeading, true);
      }
      return;
    }

    // 2. musicResponsiveListItemRenderer (Songs, Videos, Albums, Artists, Playlists)
    if (node.musicResponsiveListItemRenderer) {
      const item = node.musicResponsiveListItemRenderer;
      const flexColumns = item?.flexColumns || [];
      const runs0 =
        flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const title = runsToText(runs0);

      const subtitleParts: string[] = [];
      for (let i = 1; i < flexColumns.length; i++) {
        const runs =
          flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const colText = runsToText(runs);
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
      const videoId = fullWatchEp?.videoId as string | undefined;
      const browseId = browseEp?.browseId as string | undefined;
      const pageType = extractPageType(browseEp);
      const { addToQueueEndpoint, playNextEndpoint, queuePlaylistId } =
        extractQueueEndpoints(item?.menu?.menuRenderer?.items);
      const playlistId =
        (fullWatchEp?.playlistId as string | undefined) || queuePlaylistId;
      const mvType =
        fullWatchEp?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
          ?.musicVideoType;

      if (title) {
        const category = classifySearchCategory({
          pageType,
          mvType,
          browseId,
          subtitleText: subtitle,
          shelfTitle: nextShelfTitle,
          hasVideoId: Boolean(videoId),
        });
        const dedupKey = `${category}:${videoId || browseId || `${title}-${subtitle}`}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
          results.push({
            id: `it-item-${idxCounter}-${videoId || browseId || idxCounter}`,
            searchIndex: idxCounter++,
            title,
            subtitle: subtitle || nextShelfTitle || 'YouTube Music',
            category,
            artworkUrl: upgradeGoogleImage(thumb) || thumb,
            videoId,
            playlistId,
            browseId,
            isTopResult: nextInTopResult,
            shelfTitle: nextShelfTitle || undefined,
            watchEndpoint: fullWatchEp || undefined,
            addToQueueEndpoint,
            playNextEndpoint,
          });
        }
      }
    }

    for (const key of Object.keys(node)) {
      walk(node[key], nextShelfTitle, nextInTopResult);
    }
  }

  walk(root);
  return results;
}

export interface ParsedBrowseResult {
  details: BrowseDetailsData;
  moreTracksBrowseEndpoint?: { browseId: string; params?: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findHeaderRenderer(json: any): any {
  const header = json?.header;
  if (header?.musicImmersiveHeaderRenderer) return header.musicImmersiveHeaderRenderer;
  if (header?.musicVisualHeaderRenderer) return header.musicVisualHeaderRenderer;
  if (header?.musicResponsiveHeaderRenderer) return header.musicResponsiveHeaderRenderer;
  if (header?.musicDetailHeaderRenderer) return header.musicDetailHeaderRenderer;
  const editable = header?.musicEditablePlaylistDetailHeaderRenderer?.header;
  if (editable?.musicResponsiveHeaderRenderer) return editable.musicResponsiveHeaderRenderer;
  if (editable?.musicDetailHeaderRenderer) return editable.musicDetailHeaderRenderer;

  const twoColTabs =
    json?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents;
  if (Array.isArray(twoColTabs)) {
    for (const entry of twoColTabs) {
      if (entry?.musicResponsiveHeaderRenderer) return entry.musicResponsiveHeaderRenderer;
      if (entry?.musicDetailHeaderRenderer) return entry.musicDetailHeaderRenderer;
      const ed = entry?.musicEditablePlaylistDetailHeaderRenderer?.header;
      if (ed?.musicResponsiveHeaderRenderer) return ed.musicResponsiveHeaderRenderer;
      if (ed?.musicDetailHeaderRenderer) return ed.musicDetailHeaderRenderer;
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findHeaderTypeKey(json: any): string {
  const header = json?.header;
  if (header?.musicImmersiveHeaderRenderer) return 'musicImmersiveHeaderRenderer';
  if (header?.musicVisualHeaderRenderer) return 'musicVisualHeaderRenderer';
  if (header?.musicResponsiveHeaderRenderer) return 'musicResponsiveHeaderRenderer';
  if (header?.musicDetailHeaderRenderer) return 'musicDetailHeaderRenderer';
  if (header?.musicEditablePlaylistDetailHeaderRenderer) {
    return 'musicEditablePlaylistDetailHeaderRenderer';
  }
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractResponsiveTrackRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
  index: number,
  fallbackArtworkUrl: string,
  fallbackPlaylistId?: string,
  fallbackArtist?: string
): BrowseTrackItem | null {
  const flexColumns = Array.isArray(item?.flexColumns) ? item.flexColumns : [];
  const runs0 =
    flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const title = runsToText(runs0);
  if (!title) return null;

  const duration = extractDurationText(item, flexColumns);

  let album = '';
  let artist = '';
  const metaParts: string[] = [];

  for (let i = 1; i < flexColumns.length; i++) {
    const runs: PolymerRun[] =
      flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    const colText = runsToText(runs);
    if (!colText || DURATION_RE.test(colText)) continue;

    for (const run of runs) {
      const pt = extractPageType(run?.navigationEndpoint?.browseEndpoint);
      if (pt === 'MUSIC_PAGE_TYPE_ALBUM' && !album && run.text) {
        album = run.text.trim();
      } else if (pt === 'MUSIC_PAGE_TYPE_ARTIST' && !artist && run.text) {
        artist = run.text.trim();
      }
    }
    metaParts.push(colText);
  }

  const thumb = pickBestThumbnail(
    item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
  );
  const resolvedArtwork = upgradeGoogleImage(thumb) || fallbackArtworkUrl || thumb;

  const overlayPlayEp =
    item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
      ?.playNavigationEndpoint;
  const watchEp =
    overlayPlayEp?.watchEndpoint ||
    runs0[0]?.navigationEndpoint?.watchEndpoint ||
    item?.navigationEndpoint?.watchEndpoint ||
    item?.doubleTapCommand?.watchEndpoint;

  const videoId =
    (watchEp?.videoId as string | undefined) ||
    (item?.playlistItemData?.videoId as string | undefined);

  const { addToQueueEndpoint, playNextEndpoint, queuePlaylistId } =
    extractQueueEndpoints(item?.menu?.menuRenderer?.items);

  const playlistId =
    (watchEp?.playlistId as string | undefined) ||
    queuePlaylistId ||
    fallbackPlaylistId;

  const resolvedWatchEndpoint = watchEp
    ? { ...watchEp, ...(playlistId && !watchEp.playlistId ? { playlistId } : {}) }
    : videoId
      ? { videoId, ...(playlistId ? { playlistId } : {}) }
      : undefined;

  const subtitle =
    album ||
    metaParts.filter((part) => !part.toLowerCase().includes('plays')).join(' • ') ||
    metaParts.join(' • ') ||
    artist ||
    fallbackArtist ||
    '';

  return {
    id: `bt-${index}-${videoId || title}`,
    index,
    title,
    subtitle,
    album: album || undefined,
    artist: artist || fallbackArtist || undefined,
    duration,
    artworkUrl: resolvedArtwork,
    videoId,
    playlistId,
    watchEndpoint: resolvedWatchEndpoint,
    addToQueueEndpoint,
    playNextEndpoint,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseBrowseDetails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  browseId: string,
  hintKind?: 'Artist' | 'Album' | 'Playlist'
): ParsedBrowseResult | null {
  if (!json || typeof json !== 'object') return null;

  const header = findHeaderRenderer(json);
  const headerTypeKey = findHeaderTypeKey(json);

  const headerSubRuns = runsToText(header?.subtitle?.runs);
  const inferredKind =
    hintKind ||
    (headerTypeKey === 'musicImmersiveHeaderRenderer' ||
    headerTypeKey === 'musicVisualHeaderRenderer'
      ? 'Artist'
      : inferBrowseKind(browseId, undefined, headerSubRuns));

  const title = runsToText(header?.title?.runs) || 'Details';
  const rawArt =
    pickBestThumbnail(
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
    ) ||
    pickBestThumbnail(
      header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails
    ) ||
    pickBestThumbnail(
      header?.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
    );
  const artworkUrl = upgradeGoogleImage(rawArt) || rawArt;

  const strapline = runsToText(header?.straplineTextOne?.runs);
  const secondSub = runsToText(header?.secondSubtitle?.runs);
  const subscriberCount = runsToText(
    header?.subscriptionButton?.subscribeButtonRenderer?.longSubscriberCountText?.runs ||
      header?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText?.runs
  );
  const description =
    runsToText(header?.description?.runs) ||
    runsToText(header?.description?.musicDescriptionShelfRenderer?.description?.runs);

  const subtitleParts = [headerSubRuns, strapline, secondSub, subscriberCount]
    .map((s) => s.trim())
    .filter((s, idx, arr) => Boolean(s) && arr.indexOf(s) === idx);
  const subtitle = subtitleParts.join(' • ');

  // Extract header Play & Shuffle endpoints
  let playEndpoint: Record<string, unknown> | undefined =
    header?.playButton?.buttonRenderer?.navigationEndpoint ||
    header?.playButton?.buttonRenderer?.command;
  let shuffleEndpoint: Record<string, unknown> | undefined;

  const buttons = Array.isArray(header?.buttons) ? header.buttons : [];
  for (const btnWrap of buttons) {
    const playBtn = btnWrap?.musicPlayButtonRenderer;
    if (playBtn?.playNavigationEndpoint && !playEndpoint) {
      playEndpoint = playBtn.playNavigationEndpoint;
    }

    const btn = btnWrap?.buttonRenderer;
    if (btn) {
      const ep = btn?.navigationEndpoint || btn?.command;
      const iconType = btn?.icon?.iconType || '';
      const label = `${runsToText(btn?.text?.runs)} ${
        btn?.accessibilityData?.accessibilityData?.label || ''
      }`.toLowerCase();
      if (ep) {
        if (iconType === 'SHUFFLE' || label.includes('shuffle')) {
          if (!shuffleEndpoint) shuffleEndpoint = ep;
        } else if (iconType === 'PLAY_ARROW' || label.includes('play')) {
          if (!playEndpoint) playEndpoint = ep;
        }
      }
    }

    if (btnWrap?.menuRenderer?.items) {
      const menuMeta = extractQueueEndpoints(btnWrap.menuRenderer.items);
      if (menuMeta.shuffleEndpoint && !shuffleEndpoint) {
        shuffleEndpoint = menuMeta.shuffleEndpoint;
      }
    }
  }

  if (header?.menu?.menuRenderer?.items && !shuffleEndpoint) {
    shuffleEndpoint = extractQueueEndpoints(header.menu.menuRenderer.items).shuffleEndpoint;
  }
  if (!playEndpoint && header?.startRadioButton?.buttonRenderer?.navigationEndpoint) {
    playEndpoint = header.startRadioButton.buttonRenderer.navigationEndpoint;
  }

  const headerPlaylistId =
    (playEndpoint?.watchPlaylistEndpoint as { playlistId?: string } | undefined)
      ?.playlistId ||
    (playEndpoint?.watchEndpoint as { playlistId?: string } | undefined)?.playlistId ||
    (shuffleEndpoint?.watchPlaylistEndpoint as { playlistId?: string } | undefined)
      ?.playlistId ||
    (browseId.startsWith('VL') ? browseId.slice(2) : undefined);

  // Locate primary/secondary section containers
  const sections: unknown[] = [];
  const singleColSections =
    json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents;
  if (Array.isArray(singleColSections)) sections.push(...singleColSections);

  const twoColSecondary =
    json?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
      ?.sectionListRenderer?.contents;
  if (Array.isArray(twoColSecondary)) sections.push(...twoColSecondary);

  const twoColPrimary =
    json?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents;
  if (Array.isArray(twoColPrimary)) sections.push(...twoColPrimary);

  const tracks: BrowseTrackItem[] = [];
  let moreTracksBrowseEndpoint: { browseId: string; params?: string } | undefined;

  for (const sec of sections) {
    const rec = sec as Record<string, unknown>;
    const shelf =
      (rec?.musicShelfRenderer as Record<string, unknown> | undefined) ||
      (rec?.musicPlaylistShelfRenderer as Record<string, unknown> | undefined);
    if (!shelf) continue;

    const shelfHeading = runsToText(
      (shelf?.title as PolymerRuns | undefined)?.runs
    ).toLowerCase();
    // Skip non-track shelves on artist pages (albums/videos/related artists)
    if (
      inferredKind === 'Artist' &&
      shelfHeading &&
      !shelfHeading.includes('song') &&
      !shelfHeading.includes('track')
    ) {
      continue;
    }

    const shelfContents = Array.isArray(shelf?.contents) ? shelf.contents : [];
    for (const entry of shelfContents) {
      const rli = (entry as Record<string, unknown>)?.musicResponsiveListItemRenderer;
      if (!rli) continue;
      const parsed = extractResponsiveTrackRow(
        rli,
        tracks.length,
        artworkUrl,
        headerPlaylistId,
        inferredKind === 'Artist' ? title : strapline || undefined
      );
      if (parsed && parsed.videoId) {
        tracks.push(parsed);
      }
    }

    if (inferredKind === 'Artist' && tracks.length > 0) {
      const bottomEp = (
        shelf?.bottomEndpoint as {
          browseEndpoint?: { browseId?: string; params?: string };
        } | undefined
      )?.browseEndpoint;
      if (bottomEp?.browseId && !moreTracksBrowseEndpoint) {
        moreTracksBrowseEndpoint = {
          browseId: bottomEp.browseId,
          params: bottomEp.params,
        };
      }
      break;
    }
  }

  const resolvedPlaylistId =
    headerPlaylistId || tracks.find((t) => t.playlistId)?.playlistId;

  return {
    details: {
      browseId,
      kind: inferredKind,
      title,
      subtitle,
      description: description || undefined,
      artworkUrl,
      playlistId: resolvedPlaylistId,
      playEndpoint,
      shuffleEndpoint,
      tracks,
      tracksHeading:
        inferredKind === 'Artist'
          ? 'Top Songs'
          : inferredKind === 'Playlist'
          ? 'Playlist Tracks'
          : 'Tracks',
    },
    moreTracksBrowseEndpoint,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTracksFromBrowseShelf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  fallbackArtworkUrl: string,
  fallbackPlaylistId?: string,
  fallbackArtist?: string
): BrowseTrackItem[] {
  const tracks: BrowseTrackItem[] = [];
  const seenVids = new Set<string>();

  const singleCol =
    json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];
  const twoColSec =
    json?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
      ?.sectionListRenderer?.contents || [];

  for (const sec of [...singleCol, ...twoColSec]) {
    const shelf = sec?.musicPlaylistShelfRenderer || sec?.musicShelfRenderer;
    if (!shelf || !Array.isArray(shelf.contents)) continue;
    for (const entry of shelf.contents) {
      const rli = entry?.musicResponsiveListItemRenderer;
      if (!rli) continue;
      const parsed = extractResponsiveTrackRow(
        rli,
        tracks.length,
        fallbackArtworkUrl,
        fallbackPlaylistId,
        fallbackArtist
      );
      if (parsed?.videoId && !seenVids.has(parsed.videoId)) {
        seenVids.add(parsed.videoId);
        tracks.push(parsed);
      }
    }
  }
  return tracks;
}
