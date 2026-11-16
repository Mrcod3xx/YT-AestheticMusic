import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/defaultSettings';
import {
  applySceneSnapshot,
  BUILT_IN_SCENE_PRESETS,
  buildCustomScenePreset,
  extractSceneSnapshot,
  MAX_CUSTOM_SCENES,
  sanitizeCustomScenes,
} from '../src/shared/scenePresets';

describe('scenePresets helpers', () => {
  it('provides valid built-in curated presets', () => {
    expect(BUILT_IN_SCENE_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of BUILT_IN_SCENE_PRESETS) {
      expect(preset.isBuiltIn).toBe(true);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.snapshot.theme).toBeTruthy();
    }
  });

  it('extracts and applies visual snapshots safely when no custom wallpaper exists', () => {
    const base = {
      ...DEFAULT_SETTINGS,
      theme: 'custom' as const,
      backgroundMode: 'custom' as const,
      customBackgroundType: 'none' as const,
    };

    const snapshot = extractSceneSnapshot(base);
    expect(snapshot.backgroundMode).toBe('auto');

    const applied = applySceneSnapshot(
      { ...snapshot, backgroundMode: 'custom' },
      { ...DEFAULT_SETTINGS, customBackgroundType: 'none' }
    );
    expect(applied.backgroundMode).toBe('auto');

    const created = buildCustomScenePreset('  Late Night Coding Session Very Long Name  ', base);
    expect(created.name.length).toBeLessThanOrEqual(28);
    expect(created.isBuiltIn).toBe(false);
  });

  it('sanitizes and caps imported custom scenes to MAX_CUSTOM_SCENES', () => {
    const rawScenes = Array.from({ length: 10 }, (_, idx) => ({
      id: `custom-${idx}`,
      name: `Scene ${idx}`,
      tagline: 'Saved',
      snapshot: {
        theme: idx === 0 ? 'invalid-theme' : 'night-city',
        accentColor: idx === 0 ? 'bad-hex' : '#C28356',
        blurIntensity: 500,
        backgroundBrightness: -10,
        vignette: true,
      },
    }));

    const sanitized = sanitizeCustomScenes(rawScenes);
    expect(sanitized).toHaveLength(MAX_CUSTOM_SCENES);
    expect(sanitized[0].snapshot.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(sanitized[0].snapshot.accentColor).toBe(DEFAULT_SETTINGS.accentColor);
    expect(sanitized[0].snapshot.blurIntensity).toBe(96);
    expect(sanitized[0].snapshot.backgroundBrightness).toBe(25);
  });
});
