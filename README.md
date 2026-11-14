# Aesthetic Music — YouTube Music Desktop Transformation Extension

**Current Version:** `0.3.0` — see [CHANGELOG.md](./CHANGELOG.md)

A Chromium Manifest V3 extension for **Brave Browser** that transforms `https://music.youtube.com/` into a cinematic, macOS-style standalone music player while preserving native playback, live music video backgrounds, and queue/lyrics integration.

---

## Development Roadmap & Progress

- [x] **Phase 0:** Technical Research, Feasibility Analysis & System Architecture
- [x] **Phase 1:** Extension Foundation (MV3, Vite + React + TypeScript + Tailwind, Toolbar Popup, ON/OFF Toggle, Persistent Settings, Shadow DOM Content Script & Clean Original UI Restoration)
- [x] **Phase 2:** Main Interface (Tall Digital Clock, 3D-Angled "Continue Playing" Sidebar, 5-Card 3D Album Carousel, Search Bar, Floating Glass Player)
- [x] **Phase 3:** Real Music Integration (Live Track/Artist/High-Res Artwork, Transport Controls, Seek/Volume, Queue & Native Search)
- [x] **Phase 4:** Dynamic Background Engine (Native `<video>` Full-Screen Promotion, Song/Video Detection, Dual-Buffer Ambient Album Artwork Fallback, Custom Wallpapers)
- [x] **Phase 5:** Lyrics Integration (Focus / Compact / Full Modes, Timed & Static Lyrics Sync, 5-Card to 1-Card Carousel Transition)
- [x] **Phase 6:** Customization & Theme Presets (Night City, Minimal Dark, Cozy Room, Custom Wallpaper Upload, Fonts & Accent Swatches)
- [x] **Phase 7:** Performance Optimization, Edge-Case Hardening, Automated Tests & Release Versioning

---

## Building, Testing & Versioning

### 1. Run Automated Unit Tests
```bash
npm test
```

### 2. Bump Version (Updates `package.json`, `public/manifest.json`, and `src/shared/version.ts`)
```bash
npm run version:bump -- patch   # or minor / major / x.y.z
npm run check:version           # verify version sync across all files
```

### 3. Install Dependencies & Build
```bash
npm install
npm run build
```
This compiles the extension into the `dist/` directory:
- `dist/manifest.json`
- `dist/popup/index.html` (Toolbar Popup UI)
- `dist/options/index.html` (Full Settings UI)
- `dist/background.js` (Service Worker)
- `dist/content.js` (Isolated-World Shadow DOM Content Script)
- `dist/mainWorldBridge.js` (MAIN-World Polymer/Player Bridge)

### 2. Load Unpacked in Brave
1. Open Brave Browser and navigate to `brave://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist` folder inside this project (`c:\Users\Admin\Documents\YTmusic extension\dist`).
5. Open `https://music.youtube.com/` and click the **Aesthetic Music** icon in your Brave toolbar to toggle **Aesthetic Mode ON / OFF**.
