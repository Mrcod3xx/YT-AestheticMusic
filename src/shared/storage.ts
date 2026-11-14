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
