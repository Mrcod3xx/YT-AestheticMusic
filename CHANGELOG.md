# Changelog

All notable changes to **Aesthetic Music** will be documented in this file.

The project follows [Semantic Versioning](https://semver.org/):
- **PATCH (`0.2.x`)**: Bug fixes, UI polish, performance tuning, and minor hardening updates.
- **MINOR (`0.x.0`)**: New user-facing features, new theme presets, completed roadmap phases, and backward-compatible enhancements.
- **MAJOR (`x.0.0`)**: Breaking architectural overhauls or public release milestones (e.g., `1.0.0`).

Use `npm run version:bump -- <patch|minor|major|x.y.z>` after implementing and verifying changes so [package.json](package.json), [public/manifest.json](public/manifest.json), and [src/shared/version.ts](src/shared/version.ts) always stay synchronized.

---

## [0.3.1] - 2026-11-15 — Laptop-Friendly Ergonomic Button & Hit-Target Upgrade

### Changed
- **Floating Player Bar & Quick Action Pills (`FloatingPlayerBar.tsx`, `FloatingQuickActions.tsx`)**:
  - Enlarged all transport controls (`Play/Pause` to `w-11 h-11` w/ `w-6 h-6` icon, `Previous`/`Next` to `w-10 h-10` w/ `w-[22px] h-[22px]` icons, `Shuffle`/`Repeat` to `w-9 h-9` w/ `w-[18px] h-[18px]` icons) and utility actions (`Like`, `Sidebar`, `Lyrics`, `Studio Controls`, `Theme`, `Volume` to `w-10 h-10` rounded hover pills w/ `w-5 h-5` icons).
  - Enlarged `FloatingQuickActions` buttons (`Eye`, `Search`, `Disc`, `Fullscreen`) from `w-9 h-9` to `w-11 h-11` with `w-5 h-5` icons.
  - Expanded player dock dimensions proportionally (`bottom-center` to `max-w-[880px] h-[76px]`, `bottom-wide` to `max-w-[1040px] h-[76px]`, `compact-dock` to `max-w-[680px] h-[68px]`) with matching quick-action container alignment and expanded vertical pointer hit padding on the seek bar (`py-1.5 -my-1.5`).
- **Sidebar, Carousel & Search Controls (`ContinuePlayingSidebar.tsx`, `AlbumCarousel3D.tsx`, `SearchBarOverlay.tsx`, `BrowseDetailsModal.tsx`)**:
  - Enlarged queue row action buttons (`Play Next`, `Remove`) from `w-7 h-7` to `w-9 h-9`, queue `Refresh` from `w-8 h-8` to `w-10 h-10`, and padded the `Played earlier` accordion row.
  - Enlarged the Lyrics-mode `"Other lyrics"` switcher pill (`px-5 py-2.5 text-[14px]`) and wrapped carousel pagination dots in `p-2` rounded hover targets with `h-2` indicators so small trackpads click cleanly.
  - Enlarged `SearchBarOverlay` (`h-[52px]` input pill, `w-9 h-9` search/clear icon pills, `w-10 h-10` close button, larger filter tabs and `Queue`/`Play Next` buttons) and `BrowseDetailsModal` (`Play`, `Shuffle`, `Retry`, `×` close button, and row queue buttons).
- **Lyrics Mode, Studio Controls, Popup & Options (`LyricsStage.tsx`, `InAppSettingsPopover.tsx`, `PopupApp.tsx`, `OptionsApp.tsx`)**:
  - Enlarged `Focus` / `Compact` / `Full` mode pills, `Follow Sync` buttons, `Retry`, and static lyric up/down chevron pills (`w-9 h-9`).
  - Widened `InAppSettingsPopover` (`400px`) and enlarged its tabs, close button, toggle chips, theme preset tiles, swatches (`w-8 h-8`), wallpaper controls, and footer buttons (`Reset`, `Full Settings`, `Exit`).
  - Enlarged interactive buttons and toggles across the toolbar `PopupApp` and full `OptionsApp` settings pages.

## [0.3.0] - 2026-11-15 — Reference Experience Completion: Rich Search, Artist/Album/Playlist Details & Lyrics-Only Mode

### Added
- **Unified Artist, Album & Playlist Details Panel (`BrowseDetailsModal.tsx`)**:
  - Split 2-column dark glass modal displaying high-res entity artwork, title, bio/metadata, real `Play` & `Shuffle` triggers, and scrollable tracklists (`Top Songs`, `Tracks`, `Playlist Tracks`) with artwork, subtitles, durations, hover `Play Next` / `Add to Queue` buttons, and live active song highlighting.
  - Added InnerTube `/youtubei/v1/browse` (`FETCH_BROWSE_DETAILS`) and playback (`PLAY_ENDPOINT`) handlers in `mainWorldBridge.ts` + pure parsers in `src/shared/innertubeParsers.ts` (handling immersive Artist headers, two-column Album headers, `musicPlaylistShelfRenderer` Playlists, and Artist Top Songs expansion when YTM returns a `Show all` endpoint).
- **Rich Visual Search Overlay (`SearchBarOverlay.tsx`)**:
  - Upgraded `All` view with **Top Results** square card grid, **Artists** circular avatar shelf, and `Songs, Albums & Releases` rows with direct `Play Next` and `Queue` actions.
  - Added filter tabs for `All | Artists | Songs | Videos | Albums | Playlists`, automatic `<input>` focus when opening Search, Shadow DOM `composedPath` click-outside dismissal, and query/results preservation when inspecting and returning from Details panels.
- **Lyrics-Only Eye Toggle (`AestheticApp.tsx`, `FloatingQuickActions.tsx`)**:
  - Clicking the Eye button while in Lyrics Mode now switches between **Lyrics with Artwork** and **Lyrics-only centered mode** (hiding the collapsed left album card and `Continue Playing` sidebar without hiding `LyricsStage`), restoring both on second click.
- **Carousel Pagination & Short-Queue Handling (`AlbumCarousel3D.tsx`)**:
  - Added synced clickable pagination dots beneath the 5-card 3D carousel (`!lyricsOpen`) and avoided duplicating identical cards when queues contain fewer than 5 tracks.
- **InnerTube Parser Test Coverage (`tests/innertubeParsers.test.ts`)**:
  - Added unit tests covering category classification, `Top Results` & `Artists` search extraction, Artist/Album/Playlist browse parsing, artwork inheritance, and Shuffle endpoint extraction.

### Changed
- Merged `queueMediaItem` helper in `src/content/adapters/searchAdapter.ts` for consistent search and detail-panel queuing, and populated `TrackMetadata.videoId` from active queue state in `src/content/index.tsx` for exact track highlight matching.
- Synchronized `FloatingQuickActions` container width with `settings.playerPosition` (`bottom-wide`, `compact-dock`, `bottom-center`) and refined 3D carousel spacing and perspective angles.
- Cleaned up `LyricsStage.tsx` manual-scroll timeout tracking on unmount and cached `<video>` element lookup in the `80ms` lip-sync interval.

### Fixed
- Clicking an Artist, Album, or Playlist result in Search no longer triggers silent background `yt-navigate` on the hidden YouTube Music page; instead it opens the corresponding `BrowseDetailsModal` directly inside Aesthetic Mode and returns cleanly to preserved search results on close (`×` or `Esc`).
- Improved category classification in `classifySearchCategory` so Top Result Artist/Album cards with companion radio buttons remain classified accurately and songs containing `"EP"` or `"Single"` are not misclassified.

---

## [0.2.0] - 2026-11-15 — Customization Milestone, Optimization & Hardening (Phases 6 & 7)

### Added
- **Theme Presets & Typography System (Phase 6)**:
  - Unified theme token engine (`Night City`, `Minimal Dark`, `Cozy Room`, and `Custom Studio`) driving accent highlights, frost glass surfaces, active queue cards, and ambient overlays.
  - Accent color swatches and custom color support, plus typography family switcher (`Modern / Antonio + Inter`, `Editorial / Playfair Display`, `Mono / JetBrains Mono`).
  - Layout controls for Player Bar Dock position (`Bottom Center`, `Floating`), Thumbnail Corner Radius, Panel Transparency, Clock Font Scale, and Carousel Visibility.
  - 3-tab In-App Studio Settings Popover (`Presets`, `Clock & UI`, `Wallpaper`) and expanded Options studio with drag-and-drop image/video wallpaper uploads persisted in IndexedDB and synced cleanly to YouTube Music tabs.
- **Performance Optimization & Visibility Management (Phase 7)**:
  - Coalesced DOM/video UI updates using `requestAnimationFrame` (`scheduleRender`) to eliminate redundant mid-frame React re-renders.
  - Proper `<video>` listener lifecycle cleanup (`detachVideoListeners`) on element swaps and Aesthetic Mode exit.
  - Active `pauseWhenHidden` wiring via `document.visibilitychange` to suspend CSS animations, `DigitalClock` 1-second intervals, custom wallpaper video playback, and observer redraws while the tab is hidden.
  - Stronger `lowGpuMode` optimization disabling expensive `backdrop-filter` glass blurs across panels while boosting card legibility opacity and capping ambient artwork blur radius.
- **Automated Testing & Release Versioning System (Phase 7)**:
  - Added **Vitest** unit test suite covering theme token resolution, LRC/plain lyrics parsing and candidate ranking, artwork URL upgrading, keyboard shield input detection, MV3 runtime safety, and version/changelog synchronization.
  - Added `scripts/bump-version.mjs` (`npm run version:bump` & `npm run check:version` enforced on build) and surfaced the live extension version badge (`v0.2.0`) in the Popup, Options page, In-App Studio header, and LRCLIB client header.

### Changed
- Scoped global keyboard isolation strictly to active Aesthetic Mode sessions and extended input guards to `<select>`, `isContentEditable`, and ARIA `[role="textbox" | "searchbox" | "combobox"]` controls.
- Extracted pure lyrics parsing helpers into `src/shared/lyricsParser.ts` and removed unused legacy `VisualOverlays.tsx`.
- Exposed **Auto-Activate Aesthetic Mode on YouTube Music Launch** (`autoActivateOnYTM`) and **Remember Custom Settings Across Browser Restarts** (`rememberSettings`) controls in the Options page and enforced them at startup.

### Fixed
- Invalidated or malformed custom accent hex strings now safely fall back to the active preset accent color instead of passing invalid CSS values or mismatched RGB fallbacks.
- Fullscreen toggle icon (`FloatingQuickActions`) now syncs immediately on `fullscreenchange` (e.g., exiting via `Esc`).
- Quick-switching background modes (`Ambient` <-> `Video`) on the same track bypasses the 1-second transition cooldown so native MV switching responds immediately.
- Prevented exhausted `staleTransition` retries or transient network errors in `lyricsAdapter.ts` from returning stale previous-track lyrics or permanently caching failed `"No lyrics available"` results.
- Guarded `chrome.storage`, `chrome.tabs`, and `chrome.runtime` calls against `"Extension context invalidated"` errors when hot-reloading the unpacked extension.

---

## [0.1.0] - 2026-11-14 — Initial Baseline (Phases 0–5)

### Added
- **MV3 Extension Foundation (Phases 0–1)**: Shadow DOM content script on `https://music.youtube.com/`, reversible host CSS restoration (`data-aesthetic-mode`), persistent `chrome.storage.local` settings, toolbar popup toggle, and background badge sync.
- **Desktop Player Interface (Phase 2)**: Tall digital clock, 3D-angled `Continue Playing` glass sidebar, 5-card 3D Coverflow album carousel, glass search pill, quick action buttons, and floating glass player bar.
- **Real Music, Queue & Search Integration (Phase 3)**: MAIN-world YouTube Music Polymer/Redux bridge with live track metadata, transport/volume/seek/like/shuffle/repeat controls, real-time queue subscription, Play Next & Remove queue controls, and inline Search dropdown with Add to Queue / Play Next actions.
- **Dynamic Background Engine (Phase 4)**: Full-viewport promotion of native `<video class="html5-main-video">` with `object-fit: cover`, Song/Video detection, dual-buffer blurred ambient album artwork crossfade, and canvas palette glow extraction.
- **Synced & Static Lyrics Stage (Phase 5)**: Native YouTube Music lyrics + parallel LRCLIB millisecond LRC fallback with Spotify-style auto-scrolling (`Focus`, `Compact`, and `Full` modes), interactive line click-to-seek, and 5-card to 1-card carousel transition.
