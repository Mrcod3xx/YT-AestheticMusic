import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, THEME_PRESETS } from '../src/shared/defaultSettings';
import {
  getThemeTokens,
  hexToRgbTuple,
  resolveClockFontFamilyCss,
  resolveFontFamilyCss,
  THEME_DEFINITIONS,
} from '../src/shared/themeTokens';

describe('themeTokens & defaults', () => {
  it('parses 6-digit and 3-digit hex strings cleanly', () => {
    expect(hexToRgbTuple('#C28356')).toEqual([194, 131, 86]);
    expect(hexToRgbTuple(' #abc ')).toEqual([170, 187, 204]);
    expect(hexToRgbTuple('not-a-hex')).toBeNull();
    expect(hexToRgbTuple('#12345')).toBeNull();
  });

  it('resolves distinct typography families for UI and clock', () => {
    expect(resolveFontFamilyCss('modern')).toContain('Inter');
    expect(resolveFontFamilyCss('editorial')).toContain('Playfair Display');
    expect(resolveFontFamilyCss('mono')).toContain('JetBrains Mono');

    expect(resolveClockFontFamilyCss('modern')).toContain('Antonio');
    expect(resolveClockFontFamilyCss('editorial')).toContain('Playfair Display');
    expect(resolveClockFontFamilyCss('mono')).toContain('JetBrains Mono');
  });

  it('applies custom accent color override when valid hex is set', () => {
    const tokens = getThemeTokens({
      ...DEFAULT_SETTINGS,
      theme: 'cozy-room',
      accentColor: '#7EB09B',
    });
    expect(tokens.accent).toBe('#7EB09B');
    expect(tokens.accentRgb).toBe('126, 176, 155');
    expect(tokens.def.id).toBe('cozy-room');
  });

  it('falls back to preset accent color if accentColor is empty or invalid', () => {
    const tokens = getThemeTokens({
      ...DEFAULT_SETTINGS,
      theme: 'minimal-dark',
      accentColor: 'invalid-color',
    });
    expect(tokens.accent).toBe(THEME_DEFINITIONS['minimal-dark'].accent);
  });

  it('keeps panel alpha safely clamped within configured bounds [0.24, 0.95]', () => {
    const low = getThemeTokens({ ...DEFAULT_SETTINGS, panelTransparency: 0 });
    const high = getThemeTokens({ ...DEFAULT_SETTINGS, panelTransparency: 100 });
    expect(low.panelAlpha).toBeCloseTo(0.24, 5);
    expect(high.panelAlpha).toBeCloseTo(0.95, 5);
    expect(high.panelAlpha).toBeGreaterThan(low.panelAlpha);
  });

  it('defines matching THEME_PRESETS keys for every THEME_DEFINITIONS preset', () => {
    for (const preset of Object.keys(THEME_DEFINITIONS) as Array<
      keyof typeof THEME_DEFINITIONS
    >) {
      expect(THEME_PRESETS[preset]).toBeDefined();
      expect(THEME_PRESETS[preset].theme).toBe(preset);
    }
  });
});
