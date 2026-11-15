export type BackgroundMode = 'auto' | 'video' | 'ambient' | 'custom' | 'off';

export type ThemePreset =
  | 'night-city'
  | 'minimal-dark'
  | 'cozy-room'
  | 'velvet-noir'
  | 'midnight-ocean'
  | 'sakura-haze'
  | 'custom';

export type StageStyle = 'carousel' | 'vinyl' | 'minimal';

export type AmbientParticles = 'none' | 'dust' | 'bokeh';

export type LibraryHubSection = 'liked' | 'playlists' | 'home';

export type LyricsMode = 'focus' | 'compact' | 'full';

export type PlayerPosition = 'bottom-center' | 'bottom-wide' | 'compact-dock';

export type SearchResultCategory = 'Song' | 'Video' | 'Album' | 'Artist' | 'Playlist';

export interface BrowseTarget {
  browseId: string;
  kind?: 'Artist' | 'Album' | 'Playlist';
  previewTitle?: string;
  previewSubtitle?: string;
  previewArtworkUrl?: string;
}

export interface BrowseTrackItem {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  album?: string;
  artist?: string;
  duration: string;
  artworkUrl: string;
  videoId?: string;
  playlistId?: string;
  watchEndpoint?: Record<string, unknown>;
  addToQueueEndpoint?: Record<string, unknown>;
  playNextEndpoint?: Record<string, unknown>;
}

export interface BrowseDetailsData {
  browseId: string;
  kind: 'Artist' | 'Album' | 'Playlist';
  title: string;
  subtitle: string;
  description?: string;
  artworkUrl: string;
  playlistId?: string;
  playEndpoint?: Record<string, unknown>;
  shuffleEndpoint?: Record<string, unknown>;
  tracks: BrowseTrackItem[];
  tracksHeading: string;
}

export interface AestheticSettings {
  // General
  enabled: boolean;
  autoActivateOnYTM: boolean;
  rememberSettings: boolean;

  // Appearance
  theme: ThemePreset;
  accentColor: string;
  showClock: boolean;
  clockFontSize: number; // Scale percentage 75 - 140
  clock24Hour: boolean;
  clockColor: string;
  showCarousel: boolean;
  stageStyle: StageStyle;
  showSidebar: boolean;
  showSearchBar: boolean;
  playerPosition: PlayerPosition;
  panelTransparency: number; // 0 to 100
  borderRadius: number; // px (12 to 32)
  fontFamily: 'modern' | 'editorial' | 'mono';

  // Background
  backgroundMode: BackgroundMode;
  blurIntensity: number; // px (0 to 100)
  backgroundBrightness: number; // % (20 to 120)
  darknessOverlay: number; // % (0 to 90)
  glowIntensity: number; // % (0 to 100)
  animationSpeed: number; // 0.2 to 2.0
  vignette: boolean;
  filmGrain: boolean;
  ambientParticles: AmbientParticles;
  customBackgroundType: 'none' | 'image' | 'video';
  customBackgroundName: string;
  customWallpaperVersion: number;

  // Music Player
  showShuffleRepeat: boolean;
  showLikeButton: boolean;
  showVolumeControl: boolean;
  thumbnailSize: 'small' | 'medium' | 'large';
  playerGlassOpacity: number; // 20 to 95

  // Lyrics
  lyricsEnabled: boolean;
  lyricsOpen: boolean;
  defaultLyricsMode: LyricsMode;
  lyricsFontSize: 'small' | 'medium' | 'large';
  lyricsHighlightActive: boolean;
  lyricsDimBackground: boolean;
  showMiniLyricLine: boolean;

  // Performance
  reducedMotion: boolean;
  pauseWhenHidden: boolean;
  lowGpuMode: boolean;
}

export interface TrackMetadata {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  highResArtworkUrl: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isLiked: boolean;
  hasVideo: boolean;
  isVideoActive: boolean;
  videoToggleLocked: boolean;
  shuffleOn: boolean;
  repeatMode: 'NONE' | 'ALL' | 'ONE';
  volume: number;
  isMuted: boolean;
}

export interface QueueTrackItem {
  index: number;
  title: string;
  artist: string;
  duration: string;
  artworkUrl: string;
  highResArtworkUrl: string;
  isSelected: boolean;
  isPlaying: boolean;
  videoId?: string;
  isAutomix?: boolean;
}

export interface LyricLine {
  text: string;
  startTimeMs?: number;
  endTimeMs?: number;
}

export interface LyricsData {
  available: boolean;
  isSynced: boolean;
  lines: LyricLine[];
  source?: string;
  loading?: boolean;
  trackKey?: string;
  reason?: string;
}

export interface YTMStatusResponse {
  isYouTubeMusic: boolean;
  aestheticEnabled: boolean;
  trackTitle: string;
  trackArtist: string;
  isPlaying: boolean;
  hasVideo: boolean;
  activeBackgroundSource: 'video' | 'ambient' | 'custom' | 'default' | 'off';
}

export type ExtensionMessage =
  | { type: 'GET_YTM_STATUS' }
  | { type: 'SET_AESTHETIC_MODE'; enabled: boolean }
  | { type: 'SETTINGS_UPDATED'; settings: Partial<AestheticSettings> }
  | { type: 'WALLPAPER_UPDATED'; version: number }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'RESET_SETTINGS' };
