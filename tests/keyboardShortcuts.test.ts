import { describe, expect, it } from 'vitest';
import {
  resolveAestheticShortcut,
  resolveEscapeTarget,
  SHORTCUT_HELP_ITEMS,
  ShortcutEventLike,
  ShortcutUIState,
} from '../src/shared/keyboardShortcuts';

const BASE_STATE: ShortcutUIState = {
  settingsPopoverOpen: false,
  shortcutsHelpOpen: false,
  detailsModalOpen: false,
  searchDropdownOpen: false,
  zenMode: false,
  lyricsOnly: false,
};

const makeEvent = (
  overrides: Partial<ShortcutEventLike> = {}
): ShortcutEventLike => ({
  key: '',
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target: null,
  ...overrides,
});

describe('keyboardShortcuts router & Escape layering', () => {
  it('maps primary single-key and modifier shortcuts when focus is outside inputs', () => {
    expect(
      resolveAestheticShortcut(makeEvent({ key: ' ', code: 'Space' }), BASE_STATE)
    ).toBe('toggle-play');
    expect(
      resolveAestheticShortcut(makeEvent({ key: '/' }), BASE_STATE)
    ).toBe('focus-search');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'k', ctrlKey: true }), BASE_STATE)
    ).toBe('focus-search');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'K', metaKey: true }), BASE_STATE)
    ).toBe('focus-search');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'l' }), BASE_STATE)
    ).toBe('toggle-lyrics');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'L', shiftKey: true }), BASE_STATE)
    ).toBe('cycle-lyrics-mode');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'e' }), BASE_STATE)
    ).toBe('toggle-eye');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 's' }), BASE_STATE)
    ).toBe('toggle-sidebar');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'm' }), BASE_STATE)
    ).toBe('toggle-mute');
    expect(
      resolveAestheticShortcut(makeEvent({ key: '?' }), BASE_STATE)
    ).toBe('toggle-shortcuts-help');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'ArrowLeft' }), BASE_STATE)
    ).toBe('previous-track');
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'ArrowRight' }), BASE_STATE)
    ).toBe('next-track');
  });

  it('ignores shortcuts while typing in inputs (via composedPath) except Escape', () => {
    const shadowInputEvent = makeEvent({
      key: ' ',
      code: 'Space',
      target: { tagName: 'DIV' } as unknown as EventTarget,
      composedPath: () => [{ tagName: 'INPUT' } as unknown as EventTarget],
    });
    expect(resolveAestheticShortcut(shadowInputEvent, BASE_STATE)).toBeNull();

    expect(
      resolveAestheticShortcut(
        makeEvent({
          key: 'k',
          ctrlKey: true,
          composedPath: () => [{ tagName: 'INPUT' } as unknown as EventTarget],
        }),
        BASE_STATE
      )
    ).toBeNull();

    expect(
      resolveAestheticShortcut(
        makeEvent({
          key: 'Escape',
          composedPath: () => [{ tagName: 'INPUT' } as unknown as EventTarget],
        }),
        { ...BASE_STATE, searchDropdownOpen: true }
      )
    ).toBe('escape');
  });

  it('blocks browser/YTM modified combos and guards ArrowLeft/ArrowRight behind open overlays', () => {
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'l', ctrlKey: true }), BASE_STATE)
    ).toBeNull();
    expect(
      resolveAestheticShortcut(makeEvent({ key: 's', altKey: true }), BASE_STATE)
    ).toBeNull();

    expect(
      resolveAestheticShortcut(makeEvent({ key: 'ArrowLeft' }), {
        ...BASE_STATE,
        detailsModalOpen: true,
      })
    ).toBeNull();
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'ArrowRight' }), {
        ...BASE_STATE,
        searchDropdownOpen: true,
      })
    ).toBeNull();
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'ArrowRight' }), {
        ...BASE_STATE,
        settingsPopoverOpen: true,
      })
    ).toBeNull();
    expect(
      resolveAestheticShortcut(makeEvent({ key: 'ArrowLeft' }), {
        ...BASE_STATE,
        shortcutsHelpOpen: true,
      })
    ).toBeNull();
  });

  it('resolves Escape strictly from topmost modal/popover layer down to Zen/Lyrics-Only', () => {
    expect(
      resolveEscapeTarget({
        settingsPopoverOpen: true,
        shortcutsHelpOpen: true,
        detailsModalOpen: true,
        searchDropdownOpen: true,
        zenMode: true,
        lyricsOnly: true,
      })
    ).toBe('settings-popover');

    expect(
      resolveEscapeTarget({
        ...BASE_STATE,
        shortcutsHelpOpen: true,
        detailsModalOpen: true,
        searchDropdownOpen: true,
      })
    ).toBe('shortcuts-help');

    expect(
      resolveEscapeTarget({
        ...BASE_STATE,
        detailsModalOpen: true,
        searchDropdownOpen: true,
      })
    ).toBe('browse-modal');

    expect(
      resolveEscapeTarget({
        ...BASE_STATE,
        searchDropdownOpen: true,
        zenMode: true,
      })
    ).toBe('search-dropdown');

    expect(
      resolveEscapeTarget({
        ...BASE_STATE,
        zenMode: true,
        lyricsOnly: true,
      })
    ).toBe('zen-mode');

    expect(
      resolveEscapeTarget({
        ...BASE_STATE,
        lyricsOnly: true,
      })
    ).toBe('lyrics-only');

    expect(resolveEscapeTarget(BASE_STATE)).toBeNull();
  });

  it('exposes populated shortcut cheat-sheet metadata entries', () => {
    expect(SHORTCUT_HELP_ITEMS.length).toBeGreaterThanOrEqual(9);
    expect(SHORTCUT_HELP_ITEMS.every((item) => item.keys.length > 0 && item.description.length > 0)).toBe(true);
  });
});
