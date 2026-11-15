import { AestheticSettings, ThemePreset } from './types';
import { DEFAULT_SETTINGS, THEME_PRESETS } from './defaultSettings';
import {
  hasValidExtensionRuntime,
  isExtensionContextInvalidatedError,
} from './runtimeSafety';

const STORAGE_KEY = 'aesthetic_music_settings_v1';

export async function getSettings(): Promise<AestheticSettings> {
  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const saved = result[STORAGE_KEY] as Partial<AestheticSettings> | undefined;
      if (saved && typeof saved === 'object') {
        return { ...DEFAULT_SETTINGS, ...saved };
      }
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to load settings from storage:', err);
    }
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(partial: Partial<AestheticSettings>): Promise<AestheticSettings> {
  const current = await getSettings();
  const next: AestheticSettings = { ...current, ...partial };
  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to save settings to storage:', err);
    }
  }
  return next;
}

export async function applyThemePreset(preset: ThemePreset): Promise<AestheticSettings> {
  const presetValues = THEME_PRESETS[preset] || {};
  return saveSettings({ ...presetValues, theme: preset });
}

export async function resetSettings(): Promise<AestheticSettings> {
  try {
    if (hasValidExtensionRuntime() && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    }
  } catch (err) {
    if (!isExtensionContextInvalidatedError(err)) {
      console.warn('[Aesthetic Music] Failed to reset settings:', err);
    }
  }
  return { ...DEFAULT_SETTINGS };
}

export function subscribeToSettings(
  callback: (newSettings: AestheticSettings) => void
): () => void {
  if (!hasValidExtensionRuntime() || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]?.newValue) {
      const merged: AestheticSettings = {
        ...DEFAULT_SETTINGS,
        ...(changes[STORAGE_KEY].newValue as Partial<AestheticSettings>),
      };
      callback(merged);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    if (hasValidExtensionRuntime() && chrome.storage?.onChanged) {
      try {
        chrome.storage.onChanged.removeListener(listener);
      } catch {
        // Ignore invalidated context during unload/reload
      }
    }
  };
}

export const SETTINGS_EXPORT_FORMAT = 'aesthetic-music-settings';
export const SETTINGS_EXPORT_SCHEMA_VERSION = 1;

export interface SettingsBackupPayload {
  format: typeof SETTINGS_EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  settings: Partial<AestheticSettings>;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const BOOLEAN_SETTING_KEYS: Array<keyof AestheticSettings> = [
  'enabled',
  'autoActivateOnYTM',
  'rememberSettings',
  'showClock',
  'clock24Hour',
  'showCarousel',
  'showSidebar',
  'showSearchBar',
  'vignette',
  'filmGrain',
  'showShuffleRepeat',
  'showLikeButton',
  'showVolumeControl',
  'lyricsEnabled',
  'lyricsOpen',
  'lyricsHighlightActive',
  'lyricsDimBackground',
  'showMiniLyricLine',
  'reducedMotion',
  'pauseWhenHidden',
  'lowGpuMode',
];

const NUMERIC_SETTING_BOUNDS: Record<string, { min: number; max: number; round?: boolean }> = {
  clockFontSize: { min: 75, max: 140, round: true },
  panelTransparency: { min: 25, max: 95, round: true },
  borderRadius: { min: 12, max: 32, round: true },
  blurIntensity: { min: 0, max: 96, round: true },
  backgroundBrightness: { min: 25, max: 115, round: true },
  darknessOverlay: { min: 0, max: 85, round: true },
  glowIntensity: { min: 0, max: 100, round: true },
  animationSpeed: { min: 0.2, max: 2.0 },
  playerGlassOpacity: { min: 35, max: 95, round: true },
};

const ENUM_SETTING_ALLOWLIST: Record<string, readonly string[]> = {
  theme: [
    'night-city',
    'minimal-dark',
    'cozy-room',
    'velvet-noir',
    'midnight-ocean',
    'sakura-haze',
    'custom',
  ],
  stageStyle: ['carousel', 'vinyl', 'minimal'],
  playerPosition: ['bottom-center', 'bottom-wide', 'compact-dock'],
  fontFamily: ['modern', 'editorial', 'mono'],
  backgroundMode: ['auto', 'video', 'ambient', 'off'],
  ambientParticles: ['none', 'dust', 'bokeh'],
  thumbnailSize: ['small', 'medium', 'large'],
  defaultLyricsMode: ['focus', 'compact', 'full'],
  lyricsFontSize: ['small', 'medium', 'large'],
};

/** Builds a portable JSON backup payload without machine-local IndexedDB wallpaper binaries. */
export function createSettingsExportPayload(settings: AestheticSettings): SettingsBackupPayload {
  const portable: Partial<AestheticSettings> = {
    ...settings,
    backgroundMode: settings.backgroundMode === 'custom' ? 'auto' : settings.backgroundMode,
    customBackgroundType: 'none',
    customBackgroundName: '',
    customWallpaperVersion: 0,
  };
  return {
    format: SETTINGS_EXPORT_FORMAT,
    schemaVersion: SETTINGS_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: portable,
  };
}

/** Validates and clamps imported JSON settings so invalid types or out-of-range values cannot corrupt storage. */
export function parseAndSanitizeImportedSettings(raw: unknown): Partial<AestheticSettings> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Settings backup must be a JSON object.');
  }

  const record = raw as Record<string, unknown>;
  if ('format' in record && record.format !== SETTINGS_EXPORT_FORMAT) {
    throw new Error('Unrecognized settings backup format.');
  }

  const source =
    record.settings && typeof record.settings === 'object' && !Array.isArray(record.settings)
      ? (record.settings as Record<string, unknown>)
      : record;

  const sanitized: Partial<AestheticSettings> = {};
  let acceptedCount = 0;

  for (const key of BOOLEAN_SETTING_KEYS) {
    const val = source[key];
    if (typeof val === 'boolean') {
      (sanitized as Record<string, unknown>)[key] = val;
      acceptedCount++;
    }
  }

  for (const [key, bounds] of Object.entries(NUMERIC_SETTING_BOUNDS)) {
    const val = source[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      const clamped = Math.min(bounds.max, Math.max(bounds.min, val));
      (sanitized as Record<string, unknown>)[key] = bounds.round
        ? Math.round(clamped)
        : Math.round(clamped * 10) / 10;
      acceptedCount++;
    }
  }

  for (const [key, allowed] of Object.entries(ENUM_SETTING_ALLOWLIST)) {
    const val = source[key];
    if (typeof val === 'string' && allowed.includes(val)) {
      (sanitized as Record<string, unknown>)[key] = val;
      acceptedCount++;
    } else if (key === 'backgroundMode' && val === 'custom') {
      sanitized.backgroundMode = 'auto';
      acceptedCount++;
    }
  }

  for (const colorKey of ['accentColor', 'clockColor'] as const) {
    const val = source[colorKey];
    if (typeof val === 'string' && HEX_COLOR_RE.test(val.trim())) {
      sanitized[colorKey] = val.trim().toUpperCase();
      acceptedCount++;
    }
  }

  if (acceptedCount === 0) {
    throw new Error('No valid Aesthetic Music settings were found in that file.');
  }

  return sanitized;
}

export async function importSettings(rawOrJson: unknown): Promise<AestheticSettings> {
  const parsed =
    typeof rawOrJson === 'string' ? (JSON.parse(rawOrJson) as unknown) : rawOrJson;
  const sanitized = parseAndSanitizeImportedSettings(parsed);
  return saveSettings(sanitized);
}
