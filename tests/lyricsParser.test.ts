import { describe, expect, it } from 'vitest';
import {
  cleanArtistName,
  cleanTrackTitle,
  isLikelyAlbumName,
  parseLrcTimestampedLyrics,
  pickBestLrcCandidate,
  toPlainLyricLines,
} from '../src/shared/lyricsParser';

describe('lyricsParser helpers', () => {
  it('strips YouTube video suffixes and duplicated artist prefix from titles', () => {
    expect(cleanTrackTitle('NF - HAPPY (Official Music Video)', 'NF')).toBe('HAPPY');
    expect(cleanTrackTitle('Blinding Lights [Official Audio] (HD)', 'The Weeknd')).toBe(
      'Blinding Lights'
    );
    expect(cleanTrackTitle('Someone Like You (Live)', 'Adele')).toBe('Someone Like You');
  });

  it('normalizes primary artist from collaborations', () => {
    expect(cleanArtistName('NF feat. Hopsin')).toBe('NF');
    expect(cleanArtistName('ArrDee & Aitch')).toBe('ArrDee');
    expect(cleanArtistName('Drake, 21 Savage')).toBe('Drake');
  });

  it('filters view counts, release years, and durations out of album field', () => {
    expect(isLikelyAlbumName('4.2M views')).toBe(false);
    expect(isLikelyAlbumName('2023')).toBe(false);
    expect(isLikelyAlbumName('3:42')).toBe(false);
    expect(isLikelyAlbumName('')).toBe(false);
    expect(isLikelyAlbumName('HOPE')).toBe(true);
  });

  it('formats plain lyrics and removes excessive blank lines', () => {
    const lines = toPlainLyricLines('\n\nFirst verse\r\n\r\n\r\nSecond verse\n\n');
    expect(lines).toEqual([
      { text: 'First verse' },
      { text: '' },
      { text: 'Second verse' },
    ]);
  });

  it('parses synced LRC timestamps, multi-tag lines, and fractional precision', () => {
    const rawLrc = [
      '[00:01.00]',
      '[00:12.45]Line one',
      '[00:25.123][01:10.5] Chorus line ',
      '[00:18.00]Interlude cue before chorus',
    ].join('\n');

    const parsed = parseLrcTimestampedLyrics(rawLrc);
    expect(parsed).toEqual([
      { text: 'Line one', startTimeMs: 12_450 },
      { text: 'Interlude cue before chorus', startTimeMs: 18_000 },
      { text: 'Chorus line', startTimeMs: 25_123 },
      { text: 'Chorus line', startTimeMs: 70_500 },
    ]);
  });

  it('selects synced candidate matching artist and duration while rejecting huge duration mismatches', () => {
    const best = pickBestLrcCandidate(
      [
        {
          trackName: 'Happy (Acoustic Short)',
          artistName: 'NF',
          duration: 120,
          syncedLyrics: '[00:05.00]Wrong duration',
        },
        {
          trackName: 'HAPPY',
          artistName: 'NF',
          duration: 243,
          syncedLyrics: '[00:08.00]Right track',
        },
      ],
      'HAPPY',
      'NF',
      244
    );
    expect(best?.syncedLyrics).toContain('Right track');

    const rejected = pickBestLrcCandidate(
      [
        {
          trackName: 'Unrelated Song',
          artistName: 'Other',
          duration: 400,
          plainLyrics: 'No match',
        },
      ],
      'HAPPY',
      'NF',
      244
    );
    expect(rejected).toBeNull();
  });
});
