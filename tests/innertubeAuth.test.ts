import { describe, expect, it } from 'vitest';
import {
  buildInnerTubeRequestHeaders,
  buildSapisidAuthorizationHeader,
  computeSapisidHash,
  detectYtmSessionState,
  normalizeBrowseIdForRequest,
  parseCookieMap,
} from '../src/shared/innertubeAuth';

describe('innertubeAuth (YTM Session Detection & Authenticated Headers)', () => {
  it('parses document.cookie strings safely including values containing `=`', () => {
    const map = parseCookieMap(
      'SAPISID=abc==123/xyz; __Secure-3PAPISID=tok3p==; broken=%E0%A4%A; empty='
    );
    expect(map.SAPISID).toBe('abc==123/xyz');
    expect(map['__Secure-3PAPISID']).toBe('tok3p==');
    expect(map.broken).toBe('%E0%A4%A');
    expect(map.empty).toBe('');
  });

  it('computes RFC-compliant SAPISIDHASH / 1PHASH / 3PHASH Authorization tokens', async () => {
    const fixedTs = 1700000000;
    const singleHash = await computeSapisidHash(
      fixedTs,
      'test-sapisid-cookie',
      'https://music.youtube.com/'
    );
    expect(singleHash).toMatch(/^1700000000_[a-f0-9]{40}$/);

    const authHeader = await buildSapisidAuthorizationHeader(
      {
        SAPISID: 's1',
        '__Secure-1PAPISID': 's1p',
        '__Secure-3PAPISID': 's3p',
      },
      'https://music.youtube.com',
      fixedTs
    );
    expect(authHeader).toContain(`SAPISIDHASH ${fixedTs}_`);
    expect(authHeader).toContain(`SAPISID1PHASH ${fixedTs}_`);
    expect(authHeader).toContain(`SAPISID3PHASH ${fixedTs}_`);
  });

  it('detects logged-in Brave YouTube Music sessions across ytcfg, tokens, cookies, and nav DOM', () => {
    const viaCfg = detectYtmSessionState({
      ytcfgLoggedIn: true,
      sessionIndex: 1,
      delegatedSessionId: '10449988',
      cookieHeader: 'SAPISID=my_sapisid; __Secure-3PAPISID=my_3p',
    });
    expect(viaCfg).toEqual({
      loggedIn: true,
      hasAuthCookies: true,
      sessionIndex: '1',
      delegatedSessionId: '10449988',
    });

    const viaDomAndCookies = detectYtmSessionState({
      ytcfgLoggedIn: false,
      cookieHeader: '__Secure-3PAPISID=only_3p',
      hasNavAvatar: true,
      hasSignInLink: false,
    });
    expect(viaDomAndCookies.loggedIn).toBe(true);
    expect(viaDomAndCookies.hasAuthCookies).toBe(true);

    const signedOut = detectYtmSessionState({
      ytcfgLoggedIn: false,
      cookieHeader: 'VISITOR_INFO1_LIVE=xyz',
      hasNavAvatar: false,
      hasSignInLink: true,
    });
    expect(signedOut.loggedIn).toBe(false);
    expect(signedOut.hasAuthCookies).toBe(false);
  });

  it('constructs complete InnerTube request headers with brand account & visitor context', async () => {
    const headers = await buildInnerTubeRequestHeaders({
      origin: 'https://music.youtube.com',
      cookieHeader: 'SAPISID=cookieA; __Secure-3PAPISID=cookieB',
      sessionState: {
        loggedIn: true,
        hasAuthCookies: true,
        sessionIndex: '2',
        delegatedSessionId: 'deleg-55',
      },
      clientName: 67,
      clientVersion: '1.20261101.01.00',
      visitorData: 'Cgt5dG1fdmlzaXRvcg==',
      timestampSec: 1700000100,
    });

    expect(headers['X-Origin']).toBe('https://music.youtube.com');
    expect(headers['X-Goog-AuthUser']).toBe('2');
    expect(headers['X-Goog-PageId']).toBe('deleg-55');
    expect(headers['X-Goog-Visitor-Id']).toBe('Cgt5dG1fdmlzaXRvcg==');
    expect(headers['X-Youtube-Client-Name']).toBe('67');
    expect(headers['X-Youtube-Client-Version']).toBe('1.20261101.01.00');
    expect(headers['X-Youtube-Bootstrap-Logged-In']).toBe('true');
    expect(headers.Authorization).toContain('SAPISIDHASH 1700000100_');
    expect(headers.Authorization).toContain('SAPISID3PHASH 1700000100_');
  });

  it('normalizes bare playlist browseIds for InnerTube /browse requests without mutating other IDs', () => {
    expect(normalizeBrowseIdForRequest('LM')).toBe('FEmusic_liked_videos');
    expect(normalizeBrowseIdForRequest('VLLM')).toBe('FEmusic_liked_videos');
    expect(normalizeBrowseIdForRequest('PLabc123', 'Playlist')).toBe('VLPLabc123');
    expect(normalizeBrowseIdForRequest('VLPLabc123', 'Playlist')).toBe('VLPLabc123');
    expect(normalizeBrowseIdForRequest('UCartist99', 'Artist')).toBe('UCartist99');
    expect(normalizeBrowseIdForRequest('MPREb_album1', 'Album')).toBe('MPREb_album1');
  });
});
