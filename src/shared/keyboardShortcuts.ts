import { shouldShieldKeyboardTarget } from './runtimeSafety';

export type AestheticShortcutAction =
  | 'toggle-play'
  | 'focus-search'
  | 'toggle-lyrics'
  | 'cycle-lyrics-mode'
  | 'toggle-eye'
  | 'toggle-sidebar'
  | 'toggle-mute'
  | 'toggle-pip'
  | 'save-to-playlist'
  | 'previous-track'
  | 'next-track'
  | 'toggle-shortcuts-help'
  | 'escape';

export type EscapeLayerTarget =
  | 'playlist-modal'
  | 'settings-popover'
  | 'shortcuts-help'
  | 'browse-modal'
  | 'search-dropdown'
  | 'zen-mode'
  | 'lyrics-only';

export interface ShortcutUIState {
  playlistModalOpen?: boolean;
  settingsPopoverOpen: boolean;
  shortcutsHelpOpen: boolean;
  detailsModalOpen: boolean;
  searchDropdownOpen: boolean;
  zenMode: boolean;
  lyricsOnly: boolean;
}

export interface ShortcutEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target: EventTarget | null;
  composedPath?: () => EventTarget[];
}

export interface ShortcutHelpEntry {
  keys: string[];
  label: string;
  description: string;
}

export const SHORTCUT_HELP_ITEMS: ShortcutHelpEntry[] = [
  { keys: ['Space'], label: 'Play / Pause', description: 'Toggle playback cleanly without clicking buttons' },
  { keys: ['/', 'Ctrl+K'], label: 'Focus Search', description: 'Open and focus the inline YouTube Music search bar' },
  { keys: ['←', '→'], label: 'Previous / Next', description: 'Step backward or forward across your queue' },
  { keys: ['L'], label: 'Lyrics Overlay', description: 'Show or hide synced lyrics panel' },
  { keys: ['Shift+L'], label: 'Lyrics View Mode', description: 'Cycle Focus → Compact → Full lyrics layout' },
  { keys: ['E'], label: 'Immersive Eye', description: 'Toggle Zen view or Lyrics-only canvas' },
  { keys: ['S'], label: 'Queue Sidebar', description: 'Show or hide Continue Playing panel' },
  { keys: ['M'], label: 'Mute Audio', description: 'Toggle player mute state' },
  { keys: ['P'], label: 'Mini PiP Player', description: 'Pop out or close the floating mini desk player' },
  { keys: ['B'], label: 'Save to Playlist', description: 'Add or remove the current song in your YTM playlists' },
  { keys: ['?'], label: 'Shortcut Guide', description: 'Open or close this keyboard shortcut reference' },
  { keys: ['Esc'], label: 'Dismiss Layer', description: 'Close active popover, modal, search list, or Zen view' },
];

const SINGLE_KEY_MAP: Record<string, AestheticShortcutAction> = {
  '/': 'focus-search',
  l: 'toggle-lyrics',
  e: 'toggle-eye',
  s: 'toggle-sidebar',
  m: 'toggle-mute',
  p: 'toggle-pip',
  b: 'save-to-playlist',
  '?': 'toggle-shortcuts-help',
  ArrowLeft: 'previous-track',
  ArrowRight: 'next-track',
};

export function resolveEscapeTarget(state: ShortcutUIState): EscapeLayerTarget | null {
  if (state.playlistModalOpen) return 'playlist-modal';
  if (state.settingsPopoverOpen) return 'settings-popover';
  if (state.shortcutsHelpOpen) return 'shortcuts-help';
  if (state.detailsModalOpen) return 'browse-modal';
  if (state.searchDropdownOpen) return 'search-dropdown';
  if (state.zenMode) return 'zen-mode';
  if (state.lyricsOnly) return 'lyrics-only';
  return null;
}

export function resolveAestheticShortcut(
  event: ShortcutEventLike,
  state: ShortcutUIState
): AestheticShortcutAction | null {
  const key = event.key;
  const hasModifier = Boolean(event.ctrlKey || event.metaKey || event.altKey);

  // Escape works reliably across overlays/controls, except leaving active modals/inputs clean via priority chain
  if (key === 'Escape' && !hasModifier && !event.shiftKey) {
    return resolveEscapeTarget(state) ? 'escape' : null;
  }

  const primaryTarget = event.composedPath?.()[0] ?? event.target;
  if (shouldShieldKeyboardTarget(primaryTarget)) {
    return null;
  }

  // Ctrl+K / Cmd+K opens/focuses inline Search
  if ((event.ctrlKey || event.metaKey) && !event.altKey && key.toLowerCase() === 'k') {
    return 'focus-search';
  }

  // Do not hijack browser shortcuts (Ctrl+R, Ctrl+L, Alt+Left, etc.)
  if (hasModifier) {
    return null;
  }

  if ((key === ' ' || event.code === 'Space') && !event.shiftKey) {
    return 'toggle-play';
  }

  // Shift+/ produces '?' on US keyboards, so allow shiftKey specifically for '?' and 'L'
  if (key === '?') {
    return 'toggle-shortcuts-help';
  }

  const lower = key.toLowerCase();
  if (lower === 'l' && event.shiftKey) {
    return 'cycle-lyrics-mode';
  }

  if (event.shiftKey) {
    return null;
  }

  const mapped = SINGLE_KEY_MAP[key] || SINGLE_KEY_MAP[lower] || null;
  if (
    (mapped === 'previous-track' || mapped === 'next-track') &&
    (state.detailsModalOpen ||
      state.searchDropdownOpen ||
      state.settingsPopoverOpen ||
      state.shortcutsHelpOpen)
  ) {
    return null;
  }

  return mapped;
}
