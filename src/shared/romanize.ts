/**
 * Offline Hangul (Revised Romanization) and Japanese Kana (Hepburn) transliterator.
 * Produces crisp pronunciation subtitles without external network calls or dependencies.
 */

const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;

const HANGUL_INITIALS = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's',
  'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
] as const;

const HANGUL_MEDIALS = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa',
  'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
] as const;

const HANGUL_FINALS = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k',
  'm', 'l', 'l', 'l', 'l', 'l', 'm', 'p', 'p', 't',
  't', 'ng', 't', 't', 'k', 't', 'p', 't',
] as const;

const HANGUL_COMPAT_MAP: Record<string, string> = {
  ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm',
  ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj',
  ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h',
  ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo',
  ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u',
  ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i',
};

const KANA_DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  しぇ: 'she', じぇ: 'je', ちぇ: 'che',
  てぃ: 'ti', でぃ: 'di', ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',

  キャ: 'kya', キュ: 'kyu', キョ: 'kyo',
  シャ: 'sha', シュ: 'shu', ショ: 'sho',
  チャ: 'cha', チュ: 'chu', チョ: 'cho',
  ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo',
  ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo',
  ミャ: 'mya', ミュ: 'myu', ミョ: 'myo',
  リャ: 'rya', リュ: 'ryu', リョ: 'ryo',
  ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  ジャ: 'ja', ジュ: 'ju', ジョ: 'jo',
  ヂャ: 'ja', ヂュ: 'ju', ヂョ: 'jo',
  ビャ: 'bya', ビュ: 'byu', ビョ: 'byo',
  ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
  シェ: 'she', ジェ: 'je', チェ: 'che',
  ティ: 'ti', ディ: 'di', トゥ: 'tu', ドゥ: 'du',
  ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo',
  ウィ: 'wi', ウェ: 'we', ウォ: 'wo',
  ヴァ: 'va', ヴィ: 'vi', ヴ: 'vu', ヴェ: 've', ヴォ: 'vo',
  ツァ: 'tsa', ツィ: 'tsi', ツェ: 'tse', ツォ: 'tso',
};

const KANA_SINGLES: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',

  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヰ: 'wi', ヱ: 'we', ヲ: 'o', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  ヴ: 'vu',
  ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o',
  ャ: 'ya', ュ: 'yu', ョ: 'yo', ヮ: 'wa',
  '、': ',', '。': '.', '・': ' ', '「': '"', '」': '"', '〜': '~',
};

const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;

/** Returns true when a lyric line contains Korean Hangul or Japanese Kana worth romanizing. */
export function hasRomanizableScript(text: string): boolean {
  if (!text) return false;
  return HANGUL_RE.test(text) || KANA_RE.test(text);
}

function isHangulSyllable(code: number): boolean {
  return code >= HANGUL_SYLLABLE_START && code <= HANGUL_SYLLABLE_END;
}

function isVowel(ch: string): boolean {
  return ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u' || ch === 'y';
}

function geminatePrefix(nextRomaji: string): string {
  if (!nextRomaji) return '';
  if (nextRomaji.startsWith('ch')) return 't';
  const first = nextRomaji[0];
  if (first && !isVowel(first) && /[a-z]/i.test(first)) {
    return first;
  }
  return '';
}

/** Transliterates a single line of Hangul or Kana lyrics into readable Romanized syllables. */
export function romanizeLine(line: string): string {
  if (!hasRomanizableScript(line)) return '';

  let out = '';
  let i = 0;
  let lastVowel = '';
  let geminateNext = false;

  const pushSegment = (seg: string) => {
    if (!seg) return;
    if (geminateNext) {
      out += geminatePrefix(seg);
      geminateNext = false;
    }
    out += seg;
    for (let k = seg.length - 1; k >= 0; k--) {
      const c = seg[k];
      if (c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u') {
        lastVowel = c;
        break;
      }
    }
  };

  while (i < line.length) {
    const ch = line[i];
    const code = ch.charCodeAt(0);

    // 1. Precomposed Hangul syllable block (U+AC00..U+D7A3)
    if (isHangulSyllable(code)) {
      const offset = code - HANGUL_SYLLABLE_START;
      const lIdx = Math.floor(offset / 588);
      const vIdx = Math.floor((offset % 588) / 28);
      const tIdx = offset % 28;
      const syl =
        (HANGUL_INITIALS[lIdx] ?? '') +
        (HANGUL_MEDIALS[vIdx] ?? '') +
        (HANGUL_FINALS[tIdx] ?? '');
      pushSegment(syl);
      i++;
      continue;
    }

    if (HANGUL_COMPAT_MAP[ch]) {
      pushSegment(HANGUL_COMPAT_MAP[ch]);
      i++;
      continue;
    }

    // 2. Japanese geminate sokuon (っ / ッ)
    if (ch === 'っ' || ch === 'ッ') {
      geminateNext = true;
      i++;
      continue;
    }

    // 3. Japanese long vowel mark (ー)
    if (ch === 'ー') {
      if (lastVowel) out += lastVowel;
      i++;
      continue;
    }

    // 4. Japanese 2-character Kana digraphs
    if (i + 1 < line.length) {
      const pair = ch + line[i + 1];
      if (KANA_DIGRAPHS[pair]) {
        pushSegment(KANA_DIGRAPHS[pair]);
        i += 2;
        continue;
      }
    }

    // 5. Japanese syllabic 'ん/ン' followed by a vowel gets apostrophe separation for clarity
    if ((ch === 'ん' || ch === 'ン') && i + 1 < line.length) {
      const nextRoman = KANA_SINGLES[line[i + 1]] || '';
      pushSegment(isVowel(nextRoman[0] || '') ? "n'" : 'n');
      i++;
      continue;
    }

    // 6. Single Kana
    if (KANA_SINGLES[ch] !== undefined) {
      pushSegment(KANA_SINGLES[ch]);
      i++;
      continue;
    }

    // 7. Non-Hangul / Non-Kana character (ASCII, spaces, punctuation, Kanji/Hanzi pass-through)
    geminateNext = false;
    lastVowel = '';
    out += ch;
    i++;
  }

  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Transliterates multi-line lyrics while skipping lines without Hangul or Kana. */
export function romanizeText(multiline: string): string {
  if (!multiline) return '';
  return multiline
    .split('\n')
    .map((line) => romanizeLine(line))
    .filter(Boolean)
    .join('\n');
}
