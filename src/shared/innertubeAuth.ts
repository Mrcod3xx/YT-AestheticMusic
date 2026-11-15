export interface YtmSessionSignals {
  ytcfgLoggedIn?: unknown;
  datasyncId?: unknown;
  delegatedSessionId?: unknown;
  sessionIndex?: unknown;
  idToken?: unknown;
  cookieHeader?: string;
  hasNavAvatar?: boolean;
  hasSignInLink?: boolean;
}

export interface YtmSessionState {
  loggedIn: boolean;
  hasAuthCookies: boolean;
  sessionIndex: string;
  delegatedSessionId?: string;
}

export interface InnerTubeHeaderParams {
  origin: string;
  cookieHeader: string;
  sessionState: YtmSessionState;
  clientName?: unknown;
  clientVersion?: unknown;
  visitorData?: unknown;
  timestampSec?: number;
}

/**
 * Parses `document.cookie` safely while preserving `=` characters inside base64 values
 * and never throwing on malformed percent sequences.
 */
export function parseCookieMap(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const rawName = part.slice(0, eqIdx).trim();
    const rawValue = part.slice(eqIdx + 1).trim();
    if (!rawName) continue;

    let decodedValue = rawValue;
    try {
      decodedValue = decodeURIComponent(rawValue);
    } catch {
      decodedValue = rawValue;
    }
    map[rawName] = decodedValue;
  }
  return map;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Computes Google InnerTube SHA-1 challenge proof: `<ts>_<sha1("ts cookie origin")>`.
 */
export async function computeSapisidHash(
  timestampSec: number,
  cookieValue: string,
  origin: string
): Promise<string> {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  const payload = `${timestampSec} ${cookieValue} ${normalizedOrigin}`;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return '';

  const digest = await subtle.digest('SHA-1', new TextEncoder().encode(payload));
  const hex = bytesToHex(new Uint8Array(digest));
  return `${timestampSec}_${hex}`;
}

/**
 * Builds space-separated YouTube Web `Authorization` header tokens from available
 * SAPISID cookies (`SAPISID`, `__Secure-1PAPISID`, `__Secure-3PAPISID`).
 */
export async function buildSapisidAuthorizationHeader(
  cookies: Record<string, string>,
  origin: string,
  timestampSec = Math.floor(Date.now() / 1000)
): Promise<string> {
  const pairs: Array<[scheme: string, value: string | undefined]> = [
    ['SAPISIDHASH', cookies.SAPISID],
    ['SAPISID1PHASH', cookies['__Secure-1PAPISID']],
    ['SAPISID3PHASH', cookies['__Secure-3PAPISID']],
  ];

  const tokens: string[] = [];
  for (const [scheme, value] of pairs) {
    if (!value) continue;
    const hash = await computeSapisidHash(timestampSec, value, origin);
    if (hash) {
      tokens.push(`${scheme} ${hash}`);
    }
  }

  return tokens.join(' ');
}

/**
 * Infers YouTube Music login status from multiple corroborating browser/config/DOM signals
 * so an active Brave session is recognized accurately instead of prompting to sign in.
 */
export function detectYtmSessionState(signals: YtmSessionSignals): YtmSessionState {
  const cookies = parseCookieMap(signals.cookieHeader || '');
  const hasAuthCookies = Boolean(
    cookies.SAPISID || cookies['__Secure-1PAPISID'] || cookies['__Secure-3PAPISID']
  );

  const explicitCfgTrue =
    signals.ytcfgLoggedIn === true ||
    signals.ytcfgLoggedIn === 'true' ||
    signals.ytcfgLoggedIn === 1;
  const hasTokenSignals = Boolean(
    signals.datasyncId || signals.delegatedSessionId || signals.idToken
  );
  const hasDomLoggedIn = Boolean(signals.hasNavAvatar && !signals.hasSignInLink);

  const loggedIn =
    explicitCfgTrue ||
    hasTokenSignals ||
    hasDomLoggedIn ||
    (hasAuthCookies && !signals.hasSignInLink);

  const rawIndex = signals.sessionIndex;
  const sessionIndex =
    rawIndex !== undefined && rawIndex !== null && String(rawIndex).trim() !== ''
      ? String(rawIndex).trim()
      : '0';

  const delegatedRaw =
    typeof signals.delegatedSessionId === 'string'
      ? signals.delegatedSessionId.trim()
      : '';

  return {
    loggedIn,
    hasAuthCookies,
    sessionIndex,
    delegatedSessionId: delegatedRaw || undefined,
  };
}

/**
 * Builds authenticated first-party InnerTube request headers matching YouTube Music Web Remix.
 */
export async function buildInnerTubeRequestHeaders(
  params: InnerTubeHeaderParams
): Promise<Record<string, string>> {
  const normalizedOrigin = (params.origin || 'https://music.youtube.com').replace(
    /\/+$/,
    ''
  );
  const cookies = parseCookieMap(params.cookieHeader || '');
  const authorization = await buildSapisidAuthorizationHeader(
    cookies,
    normalizedOrigin,
    params.timestampSec
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Origin': normalizedOrigin,
    'X-Goog-AuthUser': params.sessionState.sessionIndex || '0',
    'X-Youtube-Client-Name': String(params.clientName || '67'),
  };

  if (authorization) {
    headers.Authorization = authorization;
  }
  if (params.sessionState.delegatedSessionId) {
    headers['X-Goog-PageId'] = params.sessionState.delegatedSessionId;
  }
  if (typeof params.visitorData === 'string' && params.visitorData.trim()) {
    headers['X-Goog-Visitor-Id'] = params.visitorData.trim();
  }
  if (
    params.clientVersion !== undefined &&
    params.clientVersion !== null &&
    String(params.clientVersion).trim()
  ) {
    headers['X-Youtube-Client-Version'] = String(params.clientVersion).trim();
  }
  if (params.sessionState.loggedIn) {
    headers['X-Youtube-Bootstrap-Logged-In'] = 'true';
  }

  return headers;
}

/**
 * Normalizes bare YouTube playlist IDs (e.g. `PL...`, `LM`) to valid InnerTube `browseId`s.
 */
export function normalizeBrowseIdForRequest(
  browseId: string,
  hintKind?: 'Artist' | 'Album' | 'Playlist'
): string {
  const trimmed = (browseId || '').trim();
  if (!trimmed) return '';
  if (trimmed === 'LM' || trimmed === 'VLLM') return 'FEmusic_liked_videos';
  if (
    trimmed.startsWith('VL') ||
    trimmed.startsWith('UC') ||
    trimmed.startsWith('FE') ||
    trimmed.startsWith('MPREb_')
  ) {
    return trimmed;
  }

  if (
    /^(PL|UU|FL|LL)[A-Za-z0-9_-]+$/.test(trimmed) ||
    (hintKind === 'Playlist' && /^(RD|OLAK)[A-Za-z0-9_-]+$/.test(trimmed))
  ) {
    return `VL${trimmed}`;
  }

  return trimmed;
}
