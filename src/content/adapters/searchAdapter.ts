import { QueueTrackItem } from '../../shared/types';
import { SearchResultItem } from '../components/search/SearchBarOverlay';
import { callMainWorldBridge } from './bridgeClient';

interface RawBridgeSearchResult {
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

export async function searchYouTubeMusic(
  query: string,
  onQueueUpdate?: (queue: QueueTrackItem[]) => void
): Promise<SearchResultItem[]> {
  const res = await callMainWorldBridge<{
    ok: boolean;
    results?: RawBridgeSearchResult[];
  }>('SEARCH_YTM', { query }, 5000);

  if (!res?.ok || !Array.isArray(res.results)) {
    return [];
  }

  return res.results.map((item) => {
    const canQueue = Boolean(
      item.videoId ||
        item.playlistId ||
        item.addToQueueEndpoint ||
        item.playNextEndpoint
    );

    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      category: item.category,
      artworkUrl: item.artworkUrl,
      canQueue,
      onSelect: () => {
        callMainWorldBridge('PLAY_SEARCH_RESULT', {
          searchIndex: item.searchIndex,
          title: item.title,
          videoId: item.videoId,
          playlistId: item.playlistId,
          browseId: item.browseId,
          watchEndpoint: item.watchEndpoint,
        });
      },
      onAddToQueue: canQueue
        ? async (playNext = false) => {
            const qRes = await callMainWorldBridge<{
              ok?: boolean;
              queued?: boolean;
              queue?: QueueTrackItem[];
            }>(
              'ADD_TO_QUEUE',
              {
                playNext,
                videoId: item.videoId,
                playlistId: item.playlistId,
                addToQueueEndpoint: item.addToQueueEndpoint,
                playNextEndpoint: item.playNextEndpoint,
              },
              4500
            );
            if (Array.isArray(qRes?.queue) && qRes.queue.length > 0 && onQueueUpdate) {
              onQueueUpdate(qRes.queue);
            }
            return Boolean(qRes?.queued);
          }
        : undefined,
    };
  });
}
