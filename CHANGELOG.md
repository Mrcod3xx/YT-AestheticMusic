# Changelog

All notable changes to **Aesthetic Music** will be documented in this file.

The project follows [Semantic Versioning](https://semver.org/):
- **PATCH (`0.2.x`)**: Bug fixes, UI polish, performance tuning, and minor hardening updates.
- **MINOR (`0.x.0`)**: New user-facing features, new theme presets, completed roadmap phases, and backward-compatible enhancements.
- **MAJOR (`x.0.0`)**: Breaking architectural overhauls or public release milestones (e.g., `1.0.0`).

Use `npm run version:bump -- <patch|minor|major|x.y.z>` after implementing and verifying changes so [package.json](package.json), [public/manifest.json](public/manifest.json), and [src/shared/version.ts](src/shared/version.ts) always stay synchronized.

---

## [0.8.0] - 2026-11-15

### Fixed
- **Shuffle Reliability Everywhere (`mainWorldBridge.ts`, `playerAdapter.ts`, `index.tsx`, `ContinuePlayingSidebar.tsx`)**: Routed `triggerShuffle()` through MAIN-world `TOGGLE_SHUFFLE` to click the active inner `.shuffle button#button` / `#expand-shuffle button#button` (or invoke Polymer's `onShuffleButtonClick`), refreshed `cachedQueue` immediately, and added Fisher–Yates Redux `MOVE_ITEM` reordering on upcoming manual tracks whenever YouTube Music flips `shuffle-on` without shuffling single-song/radio queues, plus a direct **Shuffle Queue** button (`SHUFFLE_UPCOMING_QUEUE`) in the sidebar header.

### Added
- **Save Whole Queue as Playlist (`mainWorldBridge.ts`, `searchAdapter.ts`, `ContinuePlayingSidebar.tsx`, `AddToPlaylistModal.tsx`)**: Added a 1-click **Save Playlist** utility button in `ContinuePlayingSidebar` that opens `AddToPlaylistModal` directly in batch creation mode and creates a new YouTube Music playlist populated with all deduplicated queue songs at once.
- **Per-Song Skip Intro / Outro Saver (`trackTrimStore.ts`, `InAppSettingsPopover.tsx`, `FloatingPlayerBar.tsx`, `AestheticApp.tsx`)**: Persists custom per-song `{ startSec, endSec }` skip bounds in `chrome.storage.local` (bounded LRU up to 200 songs), displays emerald/rose markers on the seek bar, automatically jumps past saved intros once when playback starts, and advances past saved outros automatically.
- **Soft-Fade Audio on Play, Pause & Skip (`playerAdapter.ts`, `index.tsx`, `InAppSettingsPopover.tsx`, `OptionsApp.tsx`)**: Added an optional cancelable `softAudioFade` volume fade (`default: true`) using `requestAnimationFrame` on `<video>.volume` while preserving and restoring exact user volume cleanly even on rapid button clicks.
- **Retro Flip Clock Style & 1-Tap Cozy Mixes (`DigitalClock.tsx`, `InAppSettingsPopover.tsx`, `OptionsApp.tsx`)**: Added a dark smoked-glass `flip` split-flap clock display option (`clockStyle: 'digital' | 'flip'`) and 1-tap cozy sound mix buttons (**Rainy Cafe**, **Fireplace Vinyl**, **Midnight Study**, **Clear All**) in the **Sound** tab.

## [0.7.0] - 2026-11-15

### Added
- **Cozy Background Soundscapes (`ambientAudioAdapter.ts`, `InAppSettingsPopover.tsx`)**: Added an isolated standalone Web Audio synthesizer in a new **Sound** tab inside Studio Controls with independent sliders for **Soft Rain**, **Vinyl Crackle**, **Warm Fireplace**, and **Cozy Cafe Murmur**, automatically pausing when playback pauses.
- **Sleep Timer & Focus Timer (`sleepAndFocusTimer.ts`, `DigitalClock.tsx`, `InAppSettingsPopover.tsx`)**: Added quick Sleep Timer presets (`15m`, `30m`, `45m`, `60m`, and **End of Song**) with a smooth 15-second linear/smoothstep volume fade-out, automatic pause, and pre-sleep volume restoration; plus an optional Pomodoro **Focus / Break** pill displayed beneath `DigitalClock`.
- **Playback Studio — Speed, Vinyl Pitch & A–B Loop (`playbackStudio.ts`, `playerAdapter.ts`, `FloatingPlayerBar.tsx`)**: Added `0.75×`–`1.50×` playback speed control (`preservesPitch` toggle for classic slowed vinyl pitch), and `[A` / `B]` loop markers rendered directly on the player seek bar with automatic track-change reset.
- **Save to Playlist, Create Playlist, Queue Reorder & Recent History (`AddToPlaylistModal.tsx`, `mainWorldBridge.ts`, `queueAdapter.ts`, `listeningHistory.ts`, `ContinuePlayingSidebar.tsx`, `SearchBarOverlay.tsx`, `BrowseDetailsModal.tsx`)**: Added live playlist membership loading/toggling (`BookmarkPlus` buttons and `B` shortcut), inline YouTube Music playlist creation (`Private`/`Unlisted`/`Public`), up/down queue track reordering, clear-upcoming action, and a local 50-track **Recent** listening history hub chip.
- **1-Click Studio Scene Presets (`scenePresets.ts`, `InAppSettingsPopover.tsx`, `OptionsApp.tsx`, `storage.ts`)**: Added 4 curated 1-click visual scenes (*Night Rain Desk*, *Warm Vinyl Lounge*, *Sakura Study*, *Editorial Cinema*) and support for saving/exporting/importing up to 6 custom scenes.

## [0.6.0] - 2026-11-15

### Fixed
- **Search Filter Scrollbar Clipping**: Added `.no-scrollbar` utility rules inside Shadow DOM CSS (`shadow.css`) and adjusted flex overflow/spinner positioning in `SearchBarOverlay.tsx` so the horizontal filter pill row never renders a browser scrollbar while typing.

### Added
- **Expanded Stage Modes (`StageStyle`)**: Added **Retro Cassette Tape Deck** (`cassette`) with dual spoked spinning reels and live tape transfer ratio, **Editorial Poster Frame** (`poster`) with track metadata and live progress bar, and an articulated metallic **Turntable Tonearm** SVG needle on `vinyl` mode (`AlbumCarousel3D.tsx`).
- **Living Atmosphere Effects**: Added optional **Aurora Flow** (`ambientAurora`) gradients and expanded `AmbientParticles` with `rain`, `petals`, and `embers` animations alongside `dust` and `bokeh` (`BackgroundEngine.tsx`, `shadow.css`, `InAppSettingsPopover.tsx`, `OptionsApp.tsx`).
- **Floating Mini Desk Player (`Document PiP`)**: Added `pipAdapter.ts` supporting Chromium `documentPictureInPicture` (with HTML5 Canvas `captureStream` video PiP fallback) showing track artwork, 1-line synced lyric, progress bar, and Prev/Play-Pause/Next controls, toggled via the header/action pill (`FloatingQuickActions.tsx`) or `P` shortcut (`keyboardShortcuts.ts`).
- **Artist Discography Shelves & Moods/Explore Discovery**: Expanded `parseBrowseDetails` to parse Artist `Albums`, `Singles & EPs`, `Videos`, and `Similar Artists` carousels into `shelves` with in-modal `<- Back` navigation (`BrowseDetailsModal.tsx`, `innertubeParsers.ts`), and added a **Moods & Explore** chip (`explore`) backed by `FEmusic_moods_and_genres` and `FEmusic_explore` (`SearchBarOverlay.tsx`, `mainWorldBridge.ts`).
- **Offline Lyric Romanization & Shareable Lyric Poster PNG**: Added offline Hangul & Japanese Kana transliteration (`romanize.ts`) shown beneath non-Latin lyrics with an inline `Aa` toggle, plus a `1080×1350` PNG **Share Lyric Poster** modal (`lyricCardRenderer.ts`, `LyricsStage.tsx`) with clipboard Copy PNG & Download controls.

## [0.5.1] - 2026-11-15 — Vinyl Rotation Visibility, Brave Session Auth, Liked Songs & Playlist Contents

### Fixed
- **Spinning Vinyl Showcase Visibility & Playback Sync (`AlbumCarousel3D.tsx`, `shadow.css`, `playerAdapter.ts`)**:
  - Removed negative stacking (`zIndex: -1`) that hid the vinyl disc behind the backdrop-filtered center cover sleeve and set explicit platter (`zIndex: 1`) vs sleeve (`zIndex: 2`) stacking order with `overflow-visible`.
  - Extended the turntable platter (`left-[168px]`, `266px` diameter; sleeve offset `translate3d(-72px, 0px, 95px)`) so both the grooved disc and center artwork label emerge prominently past the sleeve edge and rotated the entire grooved platter + asymmetric groove sheen arcs + center label together at `9s linear infinite`, synced to live playback state (`running` / `paused`).
  - Hardened `readLiveTrackMetadata()` playback detection in `playerAdapter.ts` with multi-selector `<video>` lookup and `#play-pause-button` fallback so play/pause transitions always keep the vinyl and UI synchronized.
- **Authenticated YouTube Music Session Detection & Library Retrieval (`innertubeAuth.ts`, `mainWorldBridge.ts`)**:
  - Added `SAPISIDHASH` / `SAPISID1PHASH` / `SAPISID3PHASH` request signing (`computeSapisidHash`, `buildSapisidAuthorizationHeader`), `X-Origin`, `X-Goog-AuthUser` (`SESSION_INDEX`), `X-Goog-PageId` (`DELEGATED_SESSION_ID`), `X-Goog-Visitor-Id`, and `X-Youtube-Bootstrap-Logged-In` headers plus `credentials: 'include'` on InnerTube `/youtubei/v1/browse` and `/search` requests so Brave's existing signed-in session authenticates properly.
  - Added multi-signal session detection (`detectYtmSessionState` combining `ytcfg`, auth tokens/cookies, and `<ytmusic-nav-bar>` DOM state) and passed `{ ok, loggedIn, hasAuthCookies, items, error }` through `searchAdapter.ts` -> `index.tsx` -> `AestheticApp.tsx` -> `SearchBarOverlay.tsx` so signed-in sessions no longer falsely display `"Sign in to YouTube Music"`.
  - Added fallback playlist discovery (`FEmusic_liked_playlists` -> `FEmusic_library_landing`), fallback liked-songs extraction (`parseBrowseDetails`), and bare playlist ID normalization (`normalizeBrowseIdForRequest`, e.g., `PL...` -> `VLPL...`).
- **Playlist Tracks & Liked Songs UI (`innertubeParsers.ts`, `SearchBarOverlay.tsx`)**:
  - Updated `parseBrowseDetails()`, `extractTracksFromBrowseShelf()`, and `findHeaderRenderer()` to flatten nested `itemSectionRenderer.contents` wrappers returned by `twoColumnBrowseResultsRenderer` playlists and `musicEditablePlaylistDetailHeaderRenderer` headers, and added fallback `playlistVideoRenderer` & `playlistItemData.videoId` extraction while filtering `"New playlist"` action cards (`createPlaylistEndpoint`).
  - Upgraded `SearchBarOverlay.tsx` so **Playlists** opens a split view that automatically loads and displays the selected playlist's **actual tracks** inline (with `Play`, `Shuffle`, `Full View`, and per-track Play / Play Next / Queue controls), and **Liked Songs** renders a direct numbered tracklist with `Play All`, `Open All`, Play Next, and Queue controls.

## [0.5.0] - 2026-11-15 — Vinyl Showcase, Library Hub, Studio Worlds & Mini Lyrics

### Added
- **In-App Library & Quick Picks Hub (`SearchBarOverlay.tsx`, `innertubeParsers.ts`, `mainWorldBridge.ts`, `searchAdapter.ts`)**:
  - Added empty-focus quick hub chips (**Liked Songs**, **Playlists**, **Quick Picks**) backed by authenticated InnerTube `/youtubei/v1/browse` (`FEmusic_liked_videos`, `FEmusic_liked_playlists`, `FEmusic_home`), allowing immediate playback, queueing, or opening full playlist/liked tracklists inside `BrowseDetailsModal`.
- **Spinning Vinyl Showcase + Carousel Swipe/Wheel Navigation (`AlbumCarousel3D.tsx`, `shadow.css`, `InAppSettingsPopover.tsx`)**:
  - Added `stageStyle` (`carousel` / `vinyl` / `minimal`) to settings, featuring a realistic grooved vinyl record disc emerging from the frosted center cover sleeve synced cleanly to play/pause and `reducedMotion`.
  - Added smooth throttled mouse-wheel and horizontal pointer-swipe queue browsing (`previewDelta`) that previews tracks safely without interrupting playback until clicked.
- **3 New Studio Worlds & Ambient Particles (`themeTokens.ts`, `defaultSettings.ts`, `BackgroundEngine.tsx`)**:
  - Added **Velvet Noir**, **Midnight Ocean**, and **Sakura Haze** studio theme presets across `PopupApp`, `OptionsApp`, `InAppSettingsPopover`, and `T` theme cycling via canonical `STUDIO_THEME_ORDER` / `ALL_THEME_ORDER`.
  - Added optional GPU-light `ambientParticles` (`none` / `dust` / `bokeh`) layer in `BackgroundEngine`, paused automatically when tab-hidden, `reducedMotion`, `lowGpuMode`, or `backgroundMode === 'off'`.
- **Mini 1-Line Lyric Subtitle, Song Radio & Queue Filter (`AestheticApp.tsx`, `ContinuePlayingSidebar.tsx`, `storage.ts`)**:
  - Added optional `showMiniLyricLine` frosted subtitle pill above the search/player dock when the main Lyrics stage is closed.
  - Added inline Queue Search Filter (`Search` toggle) and one-click **Start Song Radio** (`RDAMVM<videoId>`) on active and upcoming queue items in `ContinuePlayingSidebar`.

## [0.4.0] - 2026-11-15 — Keyboard Shortcuts, Player Polish, Lyrics Timing Offset & Settings Backup

### Added
- **Global Keyboard Shortcuts & Help Modal (`keyboardShortcuts.ts`, `ShortcutsModal.tsx`, `AestheticApp.tsx`)**:
  - Added single-key and modified shortcuts in Shadow DOM (`Space` play/pause, `/` or `Ctrl/Cmd+K` search, `L` lyrics toggle, `Shift+L` lyrics view cycle, `E` Zen/Lyrics-Only toggle, `S` sidebar toggle, `M` mute, `Left/Right` previous/next track, `?` shortcut help modal), cleanly shielded whenever typing inside inputs, textareas, or `contenteditable` targets.
  - Added `ShortcutsModal` accessible from `?` or the new keyboard button in `InAppSettingsPopover`.
- **Layered `Escape` & Outside-Click Dismiss (`AestheticApp.tsx`, `InAppSettingsPopover.tsx`)**:
  - `Escape` dismisses overlays from topmost to base: `SettingsPopover` -> `ShortcutsModal` -> `BrowseDetailsModal` -> `SearchDropdown` -> `ZenMode` / `LyricsOnly`.
  - Clicking outside `InAppSettingsPopover` dismisses it via Shadow-DOM-safe `composedPath()` detection.
- **Player, Sidebar & Status HUD Polish (`FloatingPlayerBar.tsx`, `ContinuePlayingSidebar.tsx`, `AestheticApp.tsx`)**:
  - Added a hover seek timestamp preview pill on the progress bar, eliminated the hover gap on the vertical volume popover, and added mouse-wheel volume stepping (`±4%`).
  - Made the `"Continue Playing"` sidebar queue header collapsible while keeping the active pop-out card pinned, and added a `"Radio"` pill badge on automix (`isAutomix`) queue items.
  - Added a `1.6s` top-right transient status HUD pill for shortcut, theme, background mode, and Eye toggles.
- **Synced Lyrics Timing Offset, Copy Lyrics & Settings JSON Backup (`lyricsParser.ts`, `InAppSettingsPopover.tsx`, `storage.ts`, `OptionsApp.tsx`)**:
  - Added `-0.5s` / offset / `+0.5s` lyric sync timing adjustments (clamped `±10s`, resettable) and one-click `Copy Current Track Lyrics` inside Studio Controls (`InAppSettingsPopover` -> `UI & Lyrics`) to keep the lyrics canvas clean.
  - Added `Export JSON` and `Import JSON` studio settings backup in `OptionsApp.tsx` backed by strict type/range sanitization in `parseAndSanitizeImportedSettings`.
  - Added unit test coverage in `tests/keyboardShortcuts.test.ts`, `tests/lyricsParser.test.ts`, and `tests/runtimeAndAdapters.test.ts`.

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
