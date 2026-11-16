import {
  AestheticSettings,
  AmbientParticles,
  BackgroundMode,
  ScenePresetSnapshot,
  StageStyle,
  StudioScenePreset,
  ThemePreset,
} from './types';
import { DEFAULT_SETTINGS } from './defaultSettings';

export const MAX_CUSTOM_SCENES = 6;

const VALID_THEMES = new Set<ThemePreset>([
  'night-city',
  'minimal-dark',
  'cozy-room',
  'velvet-noir',
  'midnight-ocean',
  'sakura-haze',
  'custom',
]);
const VALID_FONTS = new Set<'modern' | 'editorial' | 'mono'>([
  'modern',
  'editorial',
  'mono',
]);
const VALID_STAGES = new Set<StageStyle>([
  'carousel',
  'vinyl',
  'cassette',
  'poster',
  'minimal',
]);
const VALID_BG_MODES = new Set<BackgroundMode>([
  'auto',
  'video',
  'ambient',
  'custom',
  'off',
]);
const VALID_PARTICLES = new Set<AmbientParticles>([
  'none',
  'dust',
  'bokeh',
  'rain',
  'petals',
  'embers',
]);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const BUILT_IN_SCENE_PRESETS: StudioScenePreset[] = [
  {
    id: 'builtin-night-rain',
    name: 'Night Rain Desk',
    tagline: 'Vinyl platter, copper glass & drifting rain',
    isBuiltIn: true,
    snapshot: {
      theme: 'night-city',
      accentColor: '#C28356',
      clockColor: '#E89B63',
      fontFamily: 'modern',
      stageStyle: 'vinyl',
      backgroundMode: 'ambient',
      ambientParticles: 'rain',
      ambientAurora: false,
      blurIntensity: 52,
      backgroundBrightness: 72,
      darknessOverlay: 48,
      glowIntensity: 68,
      panelTransparency: 74,
      playerGlassOpacity: 78,
      vignette: true,
      filmGrain: true,
    },
  },
  {
    id: 'builtin-warm-cassette',
    name: 'Warm Vinyl Lounge',
    tagline: 'Amber cassette deck & fireplace embers',
    isBuiltIn: true,
    snapshot: {
      theme: 'cozy-room',
      accentColor: '#DDA15E',
      clockColor: '#F2CC8F',
      fontFamily: 'editorial',
      stageStyle: 'cassette',
      backgroundMode: 'ambient',
      ambientParticles: 'embers',
      ambientAurora: false,
      blurIntensity: 42,
      backgroundBrightness: 84,
      darknessOverlay: 36,
      glowIntensity: 84,
      panelTransparency: 68,
      playerGlassOpacity: 74,
      vignette: true,
      filmGrain: true,
    },
  },
  {
    id: 'builtin-sakura-study',
    name: 'Sakura Study',
    tagline: 'Poster frame, drifting blossoms & aurora silk',
    isBuiltIn: true,
    snapshot: {
      theme: 'sakura-haze',
      accentColor: '#D89AA8',
      clockColor: '#F2C0CC',
      fontFamily: 'editorial',
      stageStyle: 'poster',
      backgroundMode: 'ambient',
      ambientParticles: 'petals',
      ambientAurora: true,
      blurIntensity: 46,
      backgroundBrightness: 82,
      darknessOverlay: 34,
      glowIntensity: 78,
      panelTransparency: 68,
      playerGlassOpacity: 74,
      vignette: true,
      filmGrain: true,
    },
  },
  {
    id: 'builtin-editorial-cinema',
    name: 'Editorial Cinema',
    tagline: 'Music video backdrop, monochrome glass & crisp focus',
    isBuiltIn: true,
    snapshot: {
      theme: 'minimal-dark',
      accentColor: '#E4E4E7',
      clockColor: '#F4F4F5',
      fontFamily: 'mono',
      stageStyle: 'minimal',
      backgroundMode: 'auto',
      ambientParticles: 'none',
      ambientAurora: false,
      blurIntensity: 60,
      backgroundBrightness: 64,
      darknessOverlay: 54,
      glowIntensity: 24,
      panelTransparency: 82,
      playerGlassOpacity: 84,
      vignette: true,
      filmGrain: false,
    },
  },
];

/** Extracts only visual/atmosphere settings into a portable scene snapshot. */
export function extractSceneSnapshot(settings: AestheticSettings): ScenePresetSnapshot {
  return {
    theme: settings.theme,
    accentColor: settings.accentColor,
    clockColor: settings.clockColor,
    fontFamily: settings.fontFamily,
    stageStyle: settings.stageStyle,
    backgroundMode:
      settings.backgroundMode === 'custom' && settings.customBackgroundType === 'none'
        ? 'auto'
        : settings.backgroundMode,
    ambientParticles: settings.ambientParticles,
    ambientAurora: settings.ambientAurora,
    blurIntensity: settings.blurIntensity,
    backgroundBrightness: settings.backgroundBrightness,
    darknessOverlay: settings.darknessOverlay,
    glowIntensity: settings.glowIntensity,
    panelTransparency: settings.panelTransparency,
    playerGlassOpacity: settings.playerGlassOpacity,
    vignette: settings.vignette,
    filmGrain: settings.filmGrain,
  };
}

/** Builds a named custom scene preset from the active studio look. */
export function buildCustomScenePreset(
  rawName: string,
  settings: AestheticSettings
): StudioScenePreset {
  const cleanName = rawName.trim().slice(0, 28) || 'My Scene';
  return {
    id: `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    tagline: 'Custom saved studio vibe',
    isBuiltIn: false,
    snapshot: extractSceneSnapshot(settings),
  };
}

/** Converts a scene snapshot into a settings update safe for the current device. */
export function applySceneSnapshot(
  snapshot: ScenePresetSnapshot,
  currentSettings: AestheticSettings
): Partial<AestheticSettings> {
  const hasCustomWallpaper = currentSettings.customBackgroundType !== 'none';
  return {
    ...snapshot,
    backgroundMode:
      snapshot.backgroundMode === 'custom' && !hasCustomWallpaper
        ? 'auto'
        : snapshot.backgroundMode,
  };
}

function clampInt(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.round(Math.min(max, Math.max(min, val)));
}

/** Validates user-created scenes on storage load or JSON settings import. */
export function sanitizeCustomScenes(raw: unknown): StudioScenePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: StudioScenePreset[] = [];
  const seenIds = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const rawSnap = item.snapshot;
    if (!rawSnap || typeof rawSnap !== 'object') continue;
    const snap = rawSnap as Record<string, unknown>;

    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 64)
        : `scene-${out.length + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, 28)
        : `Scene ${out.length + 1}`;
    const tagline =
      typeof item.tagline === 'string' && item.tagline.trim()
        ? item.tagline.trim().slice(0, 60)
        : 'Custom saved studio vibe';

    const sanitizedSnapshot: ScenePresetSnapshot = {
      theme: VALID_THEMES.has(snap.theme as ThemePreset)
        ? (snap.theme as ThemePreset)
        : DEFAULT_SETTINGS.theme,
      accentColor:
        typeof snap.accentColor === 'string' && HEX_COLOR_RE.test(snap.accentColor.trim())
          ? snap.accentColor.trim().toUpperCase()
          : DEFAULT_SETTINGS.accentColor,
      clockColor:
        typeof snap.clockColor === 'string' && HEX_COLOR_RE.test(snap.clockColor.trim())
          ? snap.clockColor.trim().toUpperCase()
          : DEFAULT_SETTINGS.clockColor,
      fontFamily: VALID_FONTS.has(snap.fontFamily as 'modern' | 'editorial' | 'mono')
        ? (snap.fontFamily as 'modern' | 'editorial' | 'mono')
        : DEFAULT_SETTINGS.fontFamily,
      stageStyle: VALID_STAGES.has(snap.stageStyle as StageStyle)
        ? (snap.stageStyle as StageStyle)
        : DEFAULT_SETTINGS.stageStyle,
      backgroundMode: VALID_BG_MODES.has(snap.backgroundMode as BackgroundMode)
        ? snap.backgroundMode === 'custom'
          ? 'auto'
          : (snap.backgroundMode as BackgroundMode)
        : DEFAULT_SETTINGS.backgroundMode,
      ambientParticles: VALID_PARTICLES.has(snap.ambientParticles as AmbientParticles)
        ? (snap.ambientParticles as AmbientParticles)
        : DEFAULT_SETTINGS.ambientParticles,
      ambientAurora:
        typeof snap.ambientAurora === 'boolean'
          ? snap.ambientAurora
          : DEFAULT_SETTINGS.ambientAurora,
      blurIntensity: clampInt(snap.blurIntensity, DEFAULT_SETTINGS.blurIntensity, 0, 96),
      backgroundBrightness: clampInt(
        snap.backgroundBrightness,
        DEFAULT_SETTINGS.backgroundBrightness,
        25,
        115
      ),
      darknessOverlay: clampInt(snap.darknessOverlay, DEFAULT_SETTINGS.darknessOverlay, 0, 85),
      glowIntensity: clampInt(snap.glowIntensity, DEFAULT_SETTINGS.glowIntensity, 0, 100),
      panelTransparency: clampInt(
        snap.panelTransparency,
        DEFAULT_SETTINGS.panelTransparency,
        25,
        95
      ),
      playerGlassOpacity: clampInt(
        snap.playerGlassOpacity,
        DEFAULT_SETTINGS.playerGlassOpacity,
        35,
        95
      ),
      vignette:
        typeof snap.vignette === 'boolean' ? snap.vignette : DEFAULT_SETTINGS.vignette,
      filmGrain:
        typeof snap.filmGrain === 'boolean' ? snap.filmGrain : DEFAULT_SETTINGS.filmGrain,
    };

    out.push({
      id,
      name,
      tagline,
      isBuiltIn: false,
      snapshot: sanitizedSnapshot,
    });

    if (out.length >= MAX_CUSTOM_SCENES) break;
  }

  return out;
}
