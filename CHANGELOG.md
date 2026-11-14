# Changelog

All notable changes to **Aesthetic Music** will be documented in this file.

The project follows [Semantic Versioning](https://semver.org/):
- **PATCH (`0.2.x`)**: Bug fixes, UI polish, performance tuning, and minor hardening updates.
- **MINOR (`0.x.0`)**: New user-facing features, new theme presets, completed roadmap phases, and backward-compatible enhancements.
- **MAJOR (`x.0.0`)**: Breaking architectural overhauls or public release milestones (e.g., `1.0.0`).

Use `npm run version:bump -- <patch|minor|major|x.y.z>` after implementing and verifying changes so [package.json](package.json), [public/manifest.json](public/manifest.json), and [src/shared/version.ts](src/shared/version.ts) always stay synchronized.

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
