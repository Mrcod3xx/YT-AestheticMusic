import { describe, expect, it } from 'vitest';
import {
  clampTrimRange,
  MAX_TRACK_TRIM_ENTRIES,
  sanitizeTrimMap,
  shouldSkipIntro,
  shouldSkipOutro,
  upsertTrackTrimPoint,
} from '../src/shared/trackTrimStore';
import { TrackTrimPoint } from '../src/shared/types';

describe('trackTrimStore', () => {
  it('clamps intro/outro bounds cleanly and enforces a minimum 2s gap', () => {
    expect(clampTrimRange(-5, 300, 240)).toEqual({
      startSec: 0,
      endSec: 240,
    });

    // Inverted bounds swap cleanly and maintain >= 2s separation
    expect(clampTrimRange(45, 20, 200)).toEqual({
      startSec: 20,
      endSec: 45,
    });

    // Narrow gap expands to MIN_TRACK_TRIM_SPAN_SEC (2.0s)
    expect(clampTrimRange(30, 30.5, 200)).toEqual({
      startSec: 30,
      endSec: 32,
    });

    // Near end of song, start backs off so gap stays inside duration
    expect(clampTrimRange(199.5, 200, 200)).toEqual({
      startSec: 198,
      endSec: 200,
    });
  });

  it('bounds persisted entries via LRU order up to maxEntries', () => {
    let map: Record<string, TrackTrimPoint> = {};
    for (let i = 0; i < MAX_TRACK_TRIM_ENTRIES + 10; i++) {
      map = upsertTrackTrimPoint(
        map,
        { videoId: `vid_${i}`, startSec: 12, updatedAt: i * 100 },
        200
      );
    }

    const keys = Object.keys(map);
    expect(keys).toHaveLength(MAX_TRACK_TRIM_ENTRIES);
    // Oldest entries (vid_0 .. vid_9) should be evicted, newest retained
    expect(map.vid_0).toBeUndefined();
    expect(map.vid_9).toBeUndefined();
    expect(map[`vid_${MAX_TRACK_TRIM_ENTRIES + 9}`]).toEqual({
      videoId: `vid_${MAX_TRACK_TRIM_ENTRIES + 9}`,
      startSec: 12,
      updatedAt: (MAX_TRACK_TRIM_ENTRIES + 9) * 100,
    });
  });

  it('removes a track when cleared to empty bounds and discards corrupt imports', () => {
    const map = upsertTrackTrimPoint(
      {
        abc: { videoId: 'abc', startSec: 15, updatedAt: 1000 },
        def: { videoId: 'def', endSec: 180, updatedAt: 2000 },
      },
      { videoId: 'abc', startSec: undefined, endSec: undefined, updatedAt: 3000 }
    );
    expect(map.abc).toBeUndefined();
    expect(map.def?.endSec).toBe(180);

    const sanitized = sanitizeTrimMap({
      bad1: null,
      bad2: { videoId: 'bad2' }, // neither start nor end
      good: { videoId: 'good', startSec: 10.24, endSec: 95.88, updatedAt: 500 },
    });
    expect(Object.keys(sanitized)).toEqual(['good']);
    expect(sanitized.good).toEqual({
      videoId: 'good',
      startSec: 10.2,
      endSec: 95.9,
      updatedAt: 500,
    });
  });

  it('triggers intro and outro skip decisions safely once per track play', () => {
    const trim: TrackTrimPoint = {
      videoId: 'song1',
      startSec: 18.5,
      endSec: 190,
      updatedAt: 100,
    };

    expect(shouldSkipIntro(0.2, trim, false)).toBe(18.5);
    expect(shouldSkipIntro(18.4, trim, false)).toBeNull();
    expect(shouldSkipIntro(25, trim, false)).toBeNull();
    // Never fights user scrubbing back before intro when already applied once
    expect(shouldSkipIntro(1.0, trim, true)).toBeNull();

    expect(shouldSkipOutro(180, 210, trim, false)).toBe(false);
    expect(shouldSkipOutro(189.9, 210, trim, false)).toBe(true);
    expect(shouldSkipOutro(195, 210, trim, true)).toBe(false);

    // If outro is practically at track end, let natural YTM transition finish cleanly
    const nearEndTrim: TrackTrimPoint = {
      videoId: 'song2',
      endSec: 209.9,
      updatedAt: 100,
    };
    expect(shouldSkipOutro(209.8, 210, nearEndTrim, false)).toBe(false);
  });
});
