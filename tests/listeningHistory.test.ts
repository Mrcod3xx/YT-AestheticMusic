import { describe, expect, it } from 'vitest';
import {
  MAX_LISTENING_HISTORY_ITEMS,
  upsertListeningHistory,
} from '../src/shared/listeningHistory';

describe('listeningHistory ring buffer', () => {
  it('ignores placeholder tracks and deduplicates same track within 20s', () => {
    const empty = upsertListeningHistory([], {
      title: 'Not Playing',
      artist: '',
      album: '',
      artworkUrl: '',
      highResArtworkUrl: '',
      videoId: 'v0',
    });
    expect(empty).toHaveLength(0);

    const t1 = 1_000_000;
    const afterFirst = upsertListeningHistory(
      [],
      {
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up',
        artworkUrl: 'https://example.com/a.jpg',
        highResArtworkUrl: 'https://example.com/a-hd.jpg',
        videoId: 'vid1',
      },
      t1
    );
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].playCount).toBe(1);

    const rapidRepeat = upsertListeningHistory(
      afterFirst,
      {
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up',
        artworkUrl: 'https://example.com/a.jpg',
        highResArtworkUrl: 'https://example.com/a-hd.jpg',
        videoId: 'vid1',
      },
      t1 + 5_000
    );
    expect(rapidRepeat).toBe(afterFirst);

    const laterReplay = upsertListeningHistory(
      afterFirst,
      {
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up',
        artworkUrl: 'https://example.com/a.jpg',
        highResArtworkUrl: 'https://example.com/a-hd.jpg',
        videoId: 'vid1',
      },
      t1 + 25_000
    );
    expect(laterReplay).toHaveLength(1);
    expect(laterReplay[0].playCount).toBe(2);
  });

  it('keeps at most 50 unique entries ordered from most recent to oldest', () => {
    let history = [] as ReturnType<typeof upsertListeningHistory>;
    for (let i = 0; i < MAX_LISTENING_HISTORY_ITEMS + 10; i++) {
      history = upsertListeningHistory(
        history,
        {
          title: `Song ${i}`,
          artist: 'Artist',
          album: '',
          artworkUrl: '',
          highResArtworkUrl: '',
          videoId: `vid-${i}`,
        },
        10_000 + i * 30_000
      );
    }

    expect(history).toHaveLength(MAX_LISTENING_HISTORY_ITEMS);
    expect(history[0].videoId).toBe(`vid-${MAX_LISTENING_HISTORY_ITEMS + 9}`);
    expect(history[history.length - 1].videoId).toBe('vid-10');
  });
});
