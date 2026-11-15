import { RawBridgeSearchResult } from '../../shared/innertubeParsers';
import {
  BrowseDetailsData,
  BrowseTrackItem,
  LibraryHubSection,
  QueueTrackItem,
} from '../../shared/types';
import { SearchResultItem } from '../components/search/SearchBarOverlay';
import { callMainWorldBridge } from './bridgeClient';

interface QueueableMediaTarget {
  videoId?: string;
  playlistId?: string;
  addToQueueEndpoint?: Record<string, unknown>;
  playNextEndpoint?: Record<string, unknown>;
}

async function queueMediaItem(
  target: QueueableMediaTarget,
  playNext = false,
  onQueueUpdate?: (queue: QueueTrackItem[]) => void
): Promise<boolean> {
  const qRes = await callMainWorldBridge<{
    ok?: boolean;
    queued?: boolean;
    queue?: QueueTrackItem[];
  }>(
    'ADD_TO_QUEUE',
    {
      playNext,
      videoId: target.videoId,
      playlistId: target.playlistId,
      addToQueueEndpoint: target.addToQueueEndpoint,
      playNextEndpoint: target.playNextEndpoint,
    },
    4500
  );

  if (Array.isArray(qRes?.queue) && qRes.queue.length > 0 && onQueueUpdate) {
    onQueueUpdate(qRes.queue);
  }
  return Boolean(qRes?.queued);
}

function mapRawSearchResult(
  item: RawBridgeSearchResult,
  onQueueUpdate?: (queue: QueueTrackItem[]) => void
): SearchResultItem {
  const canQueue = Boolean(
    item.videoId ||
      item.playlistId ||
      item.addToQueueEndpoint ||
      item.playNextEndpoint
  );
  const hasPlayTarget = Boolean(
    item.videoId || item.playlistId || item.watchEndpoint
  );

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    category: item.category,
    artworkUrl: item.artworkUrl,
    browseId: item.browseId,
    videoId: item.videoId,
    playlistId: item.playlistId,
    isTopResult: item.isTopResult,
    shelfTitle: item.shelfTitle,
    canQueue,
    onSelect: hasPlayTarget
      ? () => {
          callMainWorldBridge('PLAY_SEARCH_RESULT', {
            searchIndex: item.searchIndex,
            title: item.title,
            videoId: item.videoId,
            playlistId: item.playlistId,
            browseId: item.browseId,
            watchEndpoint: item.watchEndpoint,
          });
        }
      : () => {},
    onAddToQueue: canQueue
      ? (playNext = false) => queueMediaItem(item, playNext, onQueueUpdate)
      : undefined,
  };
}

export async function searchYouTubeMusic(
  query: string,
  onQueueUpdate?: (queue: QueueTrackItem[]) => void
): Promise<SearchResultItem[]> {
  const res = await callMainWorldBridge<{
    ok: boolean;
    results?: RawBridgeSearchResult[];
  }>('SEARCH_YTM', { query }, 5500);

  if (!res?.ok || !Array.isArray(res.results)) {
    return [];
  }

  return res.results.map((item) => mapRawSearchResult(item, onQueueUpdate));
}

export interface LibraryHubResponse {
  ok: boolean;
  loggedIn: boolean;
  hasAuthCookies: boolean;
  items: SearchResultItem[];
  error?: string;
}

export async function fetchLibraryHub(
  section: LibraryHubSection,
  onQueueUpdate?: (queue: QueueTrackItem[]) => void
): Promise<LibraryHubResponse> {
  const res = await callMainWorldBridge<{
    ok?: boolean;
    loggedIn?: boolean;
    hasAuthCookies?: boolean;
    results?: RawBridgeSearchResult[];
    error?: string;
  }>('FETCH_LIBRARY_HUB', { section }, 8000);

  if (!res) {
    return {
      ok: false,
      loggedIn: true,
      hasAuthCookies: false,
      items: [],
      error: 'YouTube Music bridge timed out while reading library items.',
    };
  }

  const items = Array.isArray(res.results)
    ? res.results.map((item) => mapRawSearchResult(item, onQueueUpdate))
    : [];

  return {
    ok: Boolean(res.ok),
    loggedIn: res.loggedIn ?? true,
    hasAuthCookies: res.hasAuthCookies ?? false,
    items,
    error: res.error,
  };
}

export async function startSongRadio(videoId: string): Promise<boolean> {
  if (!videoId) return false;
  const playlistId = `RDAMVM${videoId}`;
  const res = await callMainWorldBridge<{ ok?: boolean }>(
    'PLAY_ENDPOINT',
    {
      playlistId,
      endpoint: {
        watchEndpoint: {
          videoId,
          playlistId,
        },
      },
    },
    3500
  );
  return Boolean(res?.ok);
}

export async function fetchBrowseDetails(
  browseId: string,
  kind?: 'Artist' | 'Album' | 'Playlist'
): Promise<BrowseDetailsData | null> {
  if (!browseId) return null;

  const res = await callMainWorldBridge<{
    ok?: boolean;
    details?: BrowseDetailsData;
  }>('FETCH_BROWSE_DETAILS', { browseId, kind }, 6000);

  return res?.ok && res.details ? res.details : null;
}

export async function playBrowseCollection(params: {
  endpoint?: Record<string, unknown>;
  playlistId?: string;
  shuffle?: boolean;
  tracks?: BrowseTrackItem[];
}): Promise<boolean> {
  const res = await callMainWorldBridge<{ ok?: boolean }>(
    'PLAY_ENDPOINT',
    params as Record<string, unknown>,
    3500
  );
  return Boolean(res?.ok);
}

export function playBrowseTrack(track: BrowseTrackItem): void {
  if (!track.videoId && !track.watchEndpoint && !track.playlistId) return;
  callMainWorldBridge('PLAY_SEARCH_RESULT', {
    title: track.title,
    videoId: track.videoId,
    playlistId: track.playlistId,
    watchEndpoint: track.watchEndpoint,
  });
}

export async function addBrowseTrackToQueue(
  track: BrowseTrackItem,
  playNext = false,
  onQueueUpdate?: (queue: QueueTrackItem[]) => void
): Promise<boolean> {
  return queueMediaItem(track, playNext, onQueueUpdate);
}
