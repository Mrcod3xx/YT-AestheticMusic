import { describe, expect, it } from 'vitest';
import {
  isExtensionContextInvalidatedError,
  shouldShieldKeyboardTarget,
} from '../src/shared/runtimeSafety';
import { DEFAULT_SETTINGS } from '../src/shared/defaultSettings';
import {
  createSettingsExportPayload,
  parseAndSanitizeImportedSettings,
  SETTINGS_EXPORT_FORMAT,
} from '../src/shared/storage';
import { upgradeArtworkUrl } from '../src/content/adapters/playerAdapter';
import { isCacheableUnavailableOutcome } from '../src/content/adapters/lyricsAdapter';

describe('runtimeSafety & adapter helpers', () => {
  it('detects interactive form inputs for keyboard shortcut isolation', () => {
    expect(shouldShieldKeyboardTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(shouldShieldKeyboardTarget({ tagName: 'textarea' } as unknown as EventTarget)).toBe(true);
    expect(shouldShieldKeyboardTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(
      shouldShieldKeyboardTarget({
        tagName: 'DIV',
        isContentEditable: true,
      } as unknown as EventTarget)
    ).toBe(true);
    expect(
      shouldShieldKeyboardTarget({
        tagName: 'DIV',
        getAttribute: (name: string) => (name === 'role' ? 'textbox' : null),
      } as unknown as EventTarget)
    ).toBe(true);

    expect(shouldShieldKeyboardTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
    expect(shouldShieldKeyboardTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(shouldShieldKeyboardTarget(null)).toBe(false);
  });

  it('recognizes Chrome MV3 context invalidation errors cleanly', () => {
    expect(
      isExtensionContextInvalidatedError(new Error('Extension context invalidated.'))
    ).toBe(true);
    expect(
      isExtensionContextInvalidatedError('Could not establish connection. Receiving end does not exist.')
    ).toBe(true);
    expect(isExtensionContextInvalidatedError(new Error('Network timeout'))).toBe(false);
    expect(isExtensionContextInvalidatedError(null)).toBe(false);
  });

  it('upgrades Google and YouTube Music thumbnail URLs to high resolution', () => {
    expect(
      upgradeArtworkUrl('https://lh3.googleusercontent.com/abc=w60-h60-l90-rj')
    ).toBe('https://lh3.googleusercontent.com/abc=w1000-h1000-l90-rj');
    expect(
      upgradeArtworkUrl('https://yt3.ggpht.com/xyz=w120-h120-c-k-c0x00ffffff-no-rj')
    ).toBe('https://yt3.ggpht.com/xyz=w1000-h1000-l90-rj');
    expect(
      upgradeArtworkUrl('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
    ).toBe('https://i.ytimg.com/vi/abc123/hq720.jpg');
    expect(upgradeArtworkUrl('')).toBe('');
  });

  it('prevents poisoning lyricsCache with transient errors or stale YTM transitions', () => {
    expect(isCacheableUnavailableOutcome(true, true, true)).toBe(false);
    expect(isCacheableUnavailableOutcome(false, false, false)).toBe(false);
    expect(isCacheableUnavailableOutcome(undefined, true, false)).toBe(false);
    expect(isCacheableUnavailableOutcome(true, false, false)).toBe(true);
    expect(isCacheableUnavailableOutcome(false, false, true)).toBe(true);
  });

  it('creates portable settings exports and validates/clamps imported JSON payloads', () => {
    const exported = createSettingsExportPayload({
      ...DEFAULT_SETTINGS,
      theme: 'custom',
      backgroundMode: 'custom',
      customBackgroundType: 'image',
      customBackgroundName: 'secret-wall.png',
      customWallpaperVersion: 123456,
    });

    expect(exported.format).toBe(SETTINGS_EXPORT_FORMAT);
    expect(exported.settings.backgroundMode).toBe('auto');
    expect(exported.settings.customBackgroundType).toBe('none');
    expect(exported.settings.customBackgroundName).toBe('');
    expect(exported.settings.customWallpaperVersion).toBe(0);

    const sanitized = parseAndSanitizeImportedSettings({
      format: SETTINGS_EXPORT_FORMAT,
      settings: {
        enabled: false,
        clockFontSize: 999,
        panelTransparency: -20,
        animationSpeed: 10,
        theme: 'velvet-noir',
        stageStyle: 'vinyl',
        ambientParticles: 'bokeh',
        showMiniLyricLine: true,
        backgroundMode: 'custom',
        fontFamily: 'mono',
        accentColor: '#c28356',
        clockColor: 'not-a-hex',
        lyricsFontSize: 'invalid-size',
      },
    });

    expect(sanitized.enabled).toBe(false);
    expect(sanitized.clockFontSize).toBe(140);
    expect(sanitized.panelTransparency).toBe(25);
    expect(sanitized.animationSpeed).toBe(2.0);
    expect(sanitized.theme).toBe('velvet-noir');
    expect(sanitized.stageStyle).toBe('vinyl');
    expect(sanitized.ambientParticles).toBe('bokeh');
    expect(sanitized.showMiniLyricLine).toBe(true);
    expect(sanitized.backgroundMode).toBe('auto');
    expect(sanitized.fontFamily).toBe('mono');
    expect(sanitized.accentColor).toBe('#C28356');
    expect(sanitized.clockColor).toBeUndefined();
    expect(sanitized.lyricsFontSize).toBeUndefined();

    const rejectedEnums = parseAndSanitizeImportedSettings({
      format: SETTINGS_EXPORT_FORMAT,
      settings: {
        enabled: true,
        stageStyle: 'hologram',
        ambientParticles: 'fireworks',
        theme: 'unknown-theme',
      },
    });
    expect(rejectedEnums.enabled).toBe(true);
    expect(rejectedEnums.stageStyle).toBeUndefined();
    expect(rejectedEnums.ambientParticles).toBeUndefined();
    expect(rejectedEnums.theme).toBeUndefined();

    expect(() => parseAndSanitizeImportedSettings({ format: 'wrong-app', settings: {} })).toThrow();
    expect(() => parseAndSanitizeImportedSettings({})).toThrow();
    expect(() => parseAndSanitizeImportedSettings([])).toThrow();
  });
});
