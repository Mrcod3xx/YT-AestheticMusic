import { describe, expect, it } from 'vitest';
import {
  hasRomanizableScript,
  romanizeLine,
  romanizeText,
} from '../src/shared/romanize';

describe('romanize utilities (Hangul & Japanese Kana)', () => {
  it('detects Hangul and Japanese Kana while skipping plain Latin lines', () => {
    expect(hasRomanizableScript('사랑해')).toBe(true);
    expect(hasRomanizableScript('ありがとう')).toBe(true);
    expect(hasRomanizableScript('カタカナ')).toBe(true);
    expect(hasRomanizableScript('Midnight City Lights')).toBe(false);
    expect(hasRomanizableScript('')).toBe(false);
  });

  it('transliterates Korean Hangul syllables cleanly', () => {
    expect(romanizeLine('사랑해')).toBe('saranghae');
    expect(romanizeLine('안녕 친구')).toBe('annyeong chingu');
    expect(romanizeLine('보고 싶다 Baby')).toBe('bogo sipda Baby');
  });

  it('transliterates Japanese Hiragana and Katakana with digraphs, sokuon, and long vowels', () => {
    expect(romanizeLine('ありがとう')).toBe('arigatou');
    expect(romanizeLine('きょうはいい天気')).toBe('kyouhaii天気');
    expect(romanizeLine('シャイニング・スター')).toBe('shainingu sutaa');
    expect(romanizeLine('待って ちょっと')).toBe('待tte chotto');
    expect(romanizeLine('きって こっち')).toBe('kitte kotchi');
    expect(romanizeLine('こんあいだ')).toBe("kon'aida");
  });

  it('returns empty string for purely Latin lines and skips them in multiline text', () => {
    expect(romanizeLine('Hello darkness my old friend')).toBe('');
    expect(romanizeText('Hello\n사랑해\nありがとう')).toBe('saranghae\narigatou');
  });
});
