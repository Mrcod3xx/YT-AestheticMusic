import { AestheticSettings, ThemePreset } from './types';

export const DEFAULT_SETTINGS: AestheticSettings = {
  // General
  enabled: true,
  autoActivateOnYTM: true,
  rememberSettings: true,

  // Appearance
  theme: 'night-city',
  accentColor: '#C28356',
  showClock: true,
  clockFontSize: 100,
  clock24Hour: false,
  clockColor: '#C28356',
  showCarousel: true,
  showSidebar: true,
  showSearchBar: true,
  playerPosition: 'bottom-center',
  panelTransparency: 72,
  borderRadius: 22,
  fontFamily: 'modern',

  // Background
  backgroundMode: 'auto',
  blurIntensity: 48,
  backgroundBrightness: 78,
  darknessOverlay: 42,
  glowIntensity: 65,
  animationSpeed: 1.0,
  vignette: true,
  filmGrain: true,
  customBackgroundType: 'none',
  customBackgroundName: '',
  customWallpaperVersion: 0,

  // Music Player
  showShuffleRepeat: true,
  showLikeButton: true,
  showVolumeControl: true,
  thumbnailSize: 'medium',
  playerGlassOpacity: 76,

  // Lyrics
  lyricsEnabled: true,
  lyricsOpen: false,
  defaultLyricsMode: 'focus',
  lyricsFontSize: 'large',
  lyricsHighlightActive: true,
  lyricsDimBackground: true,

  // Performance
  reducedMotion: false,
  pauseWhenHidden: true,
  lowGpuMode: false,
};

export const THEME_PRESETS: Record<ThemePreset, Partial<AestheticSettings>> = {
  'night-city': {
    theme: 'night-city',
    accentColor: '#C28356',
    clockColor: '#C28356',
    fontFamily: 'modern',
    panelTransparency: 72,
    playerGlassOpacity: 76,
    blurIntensity: 48,
    backgroundBrightness: 78,
    darknessOverlay: 42,
    glowIntensity: 65,
    vignette: true,
    filmGrain: true,
    borderRadius: 22,
  },
  'minimal-dark': {
    theme: 'minimal-dark',
    accentColor: '#E4E4E7',
    clockColor: '#E4E4E7',
    fontFamily: 'modern',
    panelTransparency: 84,
    playerGlassOpacity: 86,
    blurIntensity: 64,
    backgroundBrightness: 46,
    darknessOverlay: 66,
    glowIntensity: 20,
    vignette: true,
    filmGrain: false,
    borderRadius: 14,
  },
  'cozy-room': {
    theme: 'cozy-room',
    accentColor: '#DDA15E',
    clockColor: '#DDA15E',
    fontFamily: 'editorial',
    panelTransparency: 66,
    playerGlassOpacity: 74,
    blurIntensity: 40,
    backgroundBrightness: 86,
    darknessOverlay: 34,
    glowIntensity: 82,
    vignette: true,
    filmGrain: true,
    borderRadius: 26,
  },
  custom: {
    theme: 'custom',
    backgroundMode: 'custom',
  },
};
