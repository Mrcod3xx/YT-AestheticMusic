import { QueueTrackItem } from '../../shared/types';
import { callMainWorldBridge } from './bridgeClient';
import { upgradeArtworkUrl } from './playerAdapter';

export function readDomQueueFallback(): QueueTrackItem[] {
  const queueEls = Array.from(
    document.querySelectorAll('ytmusic-player-queue#queue ytmusic-player-queue-item')
  );
  if (queueEls.length === 0) return [];

  return queueEls.slice(0, 200).map((el, index) => {
    const title = el.querySelector('.song-title')?.textContent?.trim() || 'Untitled';
    const artist = el.querySelector('.byline')?.textContent?.trim() || '';
    const duration = el.querySelector('.duration')?.textContent?.trim() || '';
    const imgEl = el.querySelector('img') as HTMLImageElement | null;
    const rawArt =
      imgEl?.src && !imgEl.src.startsWith('data:image/gif') ? imgEl.src : '';
    const playState = el.getAttribute('play-button-state') || '';
    const isSelected =
      el.hasAttribute('selected') ||
      playState === 'playing' ||
      playState === 'paused' ||
      playState === 'loading';

    return {
      index,
      title,
      artist,
      duration,
      artworkUrl: rawArt,
      highResArtworkUrl: upgradeArtworkUrl(rawArt) || rawArt,
      isSelected,
      isPlaying: playState === 'playing',
    };
  });
}

export async function fetchLiveQueue(): Promise<QueueTrackItem[]> {
  const res = await callMainWorldBridge<{
    ok: boolean;
    queue?: QueueTrackItem[];
  }>('GET_FULL_STATE');

  if (res?.ok && Array.isArray(res.queue) && res.queue.length > 0) {
    return res.queue;
  }

  return readDomQueueFallback();
}

export function selectQueueItemAtIndex(index: number): void {
  callMainWorldBridge('PLAY_QUEUE_INDEX', { index });
}

export async function playNextQueueItemAtIndex(
  index: number
): Promise<QueueTrackItem[] | null> {
  const res = await callMainWorldBridge<{
    ok?: boolean;
    queue?: QueueTrackItem[];
  }>('PLAY_NEXT_QUEUE_ITEM', { index }, 3000);
  if (res?.ok && Array.isArray(res.queue)) {
    return res.queue;
  }
  return null;
}

export async function removeQueueItemAtIndex(
  index: number
): Promise<QueueTrackItem[] | null> {
  const res = await callMainWorldBridge<{
    ok?: boolean;
    queue?: QueueTrackItem[];
  }>('REMOVE_QUEUE_ITEM', { index }, 3000);
  if (res?.ok && Array.isArray(res.queue)) {
    return res.queue;
  }
  return null;
}

export async function reorderQueueItem(
  fromIndex: number,
  toIndex: number
): Promise<QueueTrackItem[] | null> {
  const res = await callMainWorldBridge<{
    ok?: boolean;
    queue?: QueueTrackItem[];
  }>('REORDER_QUEUE_ITEM', { fromIndex, toIndex }, 3000);
  if (res?.ok && Array.isArray(res.queue)) {
    return res.queue;
  }
  return null;
}

export async function clearUpcomingQueue(): Promise<QueueTrackItem[] | null> {
  const res = await callMainWorldBridge<{
    ok?: boolean;
    queue?: QueueTrackItem[];
  }>('CLEAR_UPCOMING_QUEUE', {}, 3000);
  if (res?.ok && Array.isArray(res.queue)) {
    return res.queue;
  }
  return null;
}
