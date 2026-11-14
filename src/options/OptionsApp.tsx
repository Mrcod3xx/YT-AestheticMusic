import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Power,
  RotateCcw,
  Film,
  Palette,
  MessageSquareQuote,
  Cpu,
  Type,
  Upload,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  AestheticSettings,
  BackgroundMode,
  LyricsMode,
  PlayerPosition,
  ThemePreset,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultSettings';
import { EXTENSION_VERSION } from '../shared/version';
import {
  ACCENT_SWATCHES,
  THEME_DEFINITIONS,
} from '../shared/themeTokens';
import {
  applyThemePreset,
  getSettings,
  resetSettings,
  saveSettings,
  subscribeToSettings,
} from '../shared/storage';
import { broadcastToYTM } from '../shared/messaging';
import {
  clearCustomWallpaper,
  saveCustomWallpaper,
} from '../shared/wallpaperStore';

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="accent-[#C28356] cursor-pointer"
    />
  </label>
);

interface RangeRowProps {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

const RangeRow: React.FC<RangeRowProps> = ({
  label,
  valueLabel,
  min,
  max,
  step = 1,
  value,
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-300">{valueLabel}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#C28356] cursor-pointer"
    />
  </div>
);

export const OptionsApp: React.FC = () => {
  const [settings, setSettings] = useState<AestheticSettings>(DEFAULT_SETTINGS);
  const [wallpaperStatus, setWallpaperStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    return subscribeToSettings(setSettings);
  }, []);

  const update = async (partial: Partial<AestheticSettings>) => {
    const next = await saveSettings(partial);
    setSettings(next);
    if ('enabled' in partial && typeof partial.enabled === 'boolean') {
      await broadcastToYTM({ type: 'SET_AESTHETIC_MODE', enabled: partial.enabled });
    } else {
      await broadcastToYTM({ type: 'SETTINGS_UPDATED', settings: partial });
    }
  };

  const selectTheme = async (preset: ThemePreset) => {
    const next = await applyThemePreset(preset);
    setSettings(next);
    await broadcastToYTM({ type: 'SETTINGS_UPDATED', settings: next });
  };

  const handleReset = async () => {
    await clearCustomWallpaper();
    const defaults = await resetSettings();
    setSettings(defaults);
    setWallpaperStatus('');
    await broadcastToYTM({ type: 'RESET_SETTINGS' });
  };

  const handleWallpaperFile = async (file: File) => {
    try {
      setWallpaperStatus('Saving & syncing wallpaper...');
      const rev = Date.now();
      const saved = await saveCustomWallpaper(file, rev);
      const patch: Partial<AestheticSettings> = {
        backgroundMode: 'custom',
        customBackgroundType: saved.mediaType,
        customBackgroundName: saved.fileName,
        customWallpaperVersion: saved.updatedAt,
      };
      const next = await saveSettings(patch);
      setSettings(next);
      await broadcastToYTM({ type: 'SETTINGS_UPDATED', settings: patch });
      await broadcastToYTM({ type: 'WALLPAPER_UPDATED', version: saved.updatedAt });
      setWallpaperStatus(`Loaded: ${saved.fileName}`);
    } catch (err) {
      setWallpaperStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleClearWallpaper = async () => {
    await clearCustomWallpaper();
    const patch: Partial<AestheticSettings> = {
      backgroundMode: settings.backgroundMode === 'custom' ? 'auto' : settings.backgroundMode,
      theme: settings.theme === 'custom' ? 'night-city' : settings.theme,
      customBackgroundType: 'none',
      customBackgroundName: '',
      customWallpaperVersion: Date.now(),
    };
    const next = await saveSettings(patch);
    setSettings(next);
    await broadcastToYTM({ type: 'SETTINGS_UPDATED', settings: patch });
    setWallpaperStatus('Custom wallpaper cleared.');
  };

  const themeOrder: ThemePreset[] = ['night-city', 'minimal-dark', 'cozy-room', 'custom'];

  return (
    <div className="min-h-screen w-full bg-[#0b0b0e] text-zinc-100 py-10 px-6 flex justify-center">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C28356]/30 to-black border border-[#C28356]/40 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#C28356]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-white">
                  Aesthetic Music Studio Settings
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-mono text-zinc-400">
                  v{EXTENSION_VERSION}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Customize themes, typography, glass surfaces, and custom wallpapers for YouTube Music
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[13px] font-medium text-zinc-300 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={() => update({ enabled: !settings.enabled })}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border transition cursor-pointer ${
                settings.enabled
                  ? 'bg-[#C28356] text-black border-[#d89b6e]'
                  : 'bg-zinc-900 text-zinc-400 border-white/10'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>Aesthetic Mode: {settings.enabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </header>

        {/* Grid Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Presets & Panels */}
          <section className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Palette className="w-4 h-4 text-[#C28356]" />
              <span>Theme Presets & Layout</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {themeOrder.map((id) => {
                const def = THEME_DEFINITIONS[id];
                const active = settings.theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTheme(id)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-[#C28356]/15 border-[#C28356] text-white'
                        : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <span
                        className="w-6 h-6 rounded-full border border-white/25 shrink-0"
                        style={{ background: def.previewGradient }}
                      />
                      <span className="text-xs font-semibold">{def.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">{def.tagline}</p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 pt-3 border-t border-white/10">
              <ToggleRow
                label="Display Large Digital Clock"
                checked={settings.showClock}
                onChange={(v) => update({ showClock: v })}
              />
              <ToggleRow
                label="Use 24-Hour Time Format"
                checked={settings.clock24Hour}
                onChange={(v) => update({ clock24Hour: v })}
              />
              <ToggleRow
                label="Display 3D Album Carousel"
                checked={settings.showCarousel}
                onChange={(v) => update({ showCarousel: v })}
              />
              <ToggleRow
                label='Display "Continue Playing" Sidebar'
                checked={settings.showSidebar}
                onChange={(v) => update({ showSidebar: v })}
              />
              <ToggleRow
                label="Display Integrated Search Bar"
                checked={settings.showSearchBar}
                onChange={(v) => update({ showSearchBar: v })}
              />
            </div>
          </section>

          {/* Clock, Typography & Glass Surface */}
          <section className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Type className="w-4 h-4 text-[#C28356]" />
              <span>Clock, Typography & Surfaces</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400">Interface Typography</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'modern', label: 'Modern Sans' },
                    { id: 'editorial', label: 'Editorial Serif' },
                    { id: 'mono', label: 'Mono Studio' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => update({ fontFamily: item.id })}
                    className={`px-3.5 py-2.5 rounded-xl text-[13px] font-medium border transition cursor-pointer ${
                      settings.fontFamily === item.id
                        ? 'bg-[#C28356]/20 border-[#C28356] text-white'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400">Accent & Clock Color</label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase">
                    {settings.accentColor || settings.clockColor}
                  </span>
                  <input
                    type="color"
                    value={settings.accentColor || settings.clockColor || '#C28356'}
                    onChange={(e) =>
                      update({ accentColor: e.target.value, clockColor: e.target.value })
                    }
                    className="w-8 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {ACCENT_SWATCHES.map((sw) => {
                  const selected =
                    (settings.accentColor || settings.clockColor).toLowerCase() ===
                    sw.color.toLowerCase();
                  return (
                    <button
                      key={sw.color}
                      type="button"
                      title={sw.label}
                      onClick={() =>
                        update({ accentColor: sw.color, clockColor: sw.color })
                      }
                      className={`w-8 h-8 rounded-full border-2 transition cursor-pointer ${
                        selected ? 'border-white scale-110' : 'border-white/20 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: sw.color }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <RangeRow
                label="Digital Clock Scale"
                valueLabel={`${settings.clockFontSize}%`}
                min={75}
                max={140}
                value={settings.clockFontSize}
                onChange={(v) => update({ clockFontSize: v })}
              />
              <RangeRow
                label="Glass Panel Transparency"
                valueLabel={`${settings.panelTransparency}%`}
                min={25}
                max={95}
                value={settings.panelTransparency}
                onChange={(v) => update({ panelTransparency: v })}
              />
              <RangeRow
                label="Card Corner Radius"
                valueLabel={`${settings.borderRadius}px`}
                min={12}
                max={32}
                value={settings.borderRadius}
                onChange={(v) => update({ borderRadius: v })}
              />
            </div>
          </section>

          {/* Background Engine & Custom Wallpaper Upload */}
          <section className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Film className="w-4 h-4 text-[#C28356]" />
              <span>Background Engine & Custom Wallpaper</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400">Background Priority Mode</label>
              <select
                value={settings.backgroundMode}
                onChange={(e) => update({ backgroundMode: e.target.value as BackgroundMode })}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#C28356]"
              >
                <option value="auto">Automatic (Music Video → Ambient Artwork)</option>
                <option value="video">Music Video Only</option>
                <option value="ambient">Ambient Album Artwork Only</option>
                <option value="custom">Custom Wallpaper</option>
                <option value="off">Minimal Dark (Off)</option>
              </select>
            </div>

            {/* Custom Wallpaper Dropzone */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await handleWallpaperFile(f);
                  e.target.value = '';
                }}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) await handleWallpaperFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border border-dashed p-4 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-[#C28356] bg-[#C28356]/15'
                    : 'border-white/20 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <Upload className="w-4 h-4 text-[#E89B63] mx-auto mb-1.5" />
                <div className="text-xs font-medium text-zinc-200">
                  Upload or drop custom wallpaper (JPG, PNG, WebP, GIF, MP4, WebM)
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Automatically syncs with your active YouTube Music tabs
                </div>
              </div>

              {settings.customBackgroundName && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="w-4 h-4 text-[#E89B63] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {settings.customBackgroundName}
                      </div>
                      <div className="text-[10.5px] text-zinc-400 uppercase">
                        {settings.customBackgroundType}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {settings.backgroundMode !== 'custom' && (
                      <button
                        type="button"
                        onClick={() => update({ backgroundMode: 'custom' })}
                        className="px-3.5 py-2 rounded-xl bg-[#C28356]/25 hover:bg-[#C28356]/35 text-[#E89B63] text-xs font-medium cursor-pointer transition"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearWallpaper}
                      title="Remove custom wallpaper"
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/15 hover:bg-red-500/25 text-red-300 cursor-pointer transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {wallpaperStatus && (
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E89B63] shrink-0" />
                  <span className="truncate">{wallpaperStatus}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <RangeRow
                label="Ambient Blur Intensity"
                valueLabel={`${settings.blurIntensity}px`}
                min={0}
                max={96}
                value={settings.blurIntensity}
                onChange={(v) => update({ blurIntensity: v })}
              />
              <RangeRow
                label="Darkness Overlay"
                valueLabel={`${settings.darknessOverlay}%`}
                min={0}
                max={85}
                value={settings.darknessOverlay}
                onChange={(v) => update({ darknessOverlay: v })}
              />
              <RangeRow
                label="Ambient Color Glow"
                valueLabel={`${settings.glowIntensity}%`}
                min={0}
                max={100}
                value={settings.glowIntensity}
                onChange={(v) => update({ glowIntensity: v })}
              />
              <RangeRow
                label="Background Brightness"
                valueLabel={`${settings.backgroundBrightness}%`}
                min={25}
                max={115}
                value={settings.backgroundBrightness}
                onChange={(v) => update({ backgroundBrightness: v })}
              />
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-zinc-400">Vignette & Film Grain</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.vignette}
                      onChange={(e) => update({ vignette: e.target.checked })}
                      className="accent-[#C28356]"
                    />
                    <span>Vignette</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.filmGrain}
                      onChange={(e) => update({ filmGrain: e.target.checked })}
                      className="accent-[#C28356]"
                    />
                    <span>Grain</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Music Player, Lyrics & Performance */}
          <div className="space-y-6">
            <section className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquareQuote className="w-4 h-4 text-[#C28356]" />
                <span>Player & Lyrics Controls</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">Player Dock Style</label>
                  <select
                    value={settings.playerPosition}
                    onChange={(e) =>
                      update({ playerPosition: e.target.value as PlayerPosition })
                    }
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#C28356]"
                  >
                    <option value="bottom-center">Standard Center</option>
                    <option value="bottom-wide">Wide Studio Bar</option>
                    <option value="compact-dock">Compact Pill</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">Default Lyrics Mode</label>
                  <select
                    value={settings.defaultLyricsMode}
                    onChange={(e) => update({ defaultLyricsMode: e.target.value as LyricsMode })}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#C28356]"
                  >
                    <option value="focus">Focus Mode</option>
                    <option value="compact">Compact Panel</option>
                    <option value="full">Full Lyrics View</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">Player Artwork Size</label>
                  <select
                    value={settings.thumbnailSize}
                    onChange={(e) =>
                      update({
                        thumbnailSize: e.target.value as AestheticSettings['thumbnailSize'],
                      })
                    }
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#C28356]"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">Lyrics Text Size</label>
                  <select
                    value={settings.lyricsFontSize}
                    onChange={(e) =>
                      update({
                        lyricsFontSize: e.target.value as AestheticSettings['lyricsFontSize'],
                      })
                    }
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#C28356]"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <RangeRow
                label="Player Bar Glass Opacity"
                valueLabel={`${settings.playerGlassOpacity}%`}
                min={35}
                max={95}
                value={settings.playerGlassOpacity}
                onChange={(v) => update({ playerGlassOpacity: v })}
              />

              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <ToggleRow
                  label="Show Shuffle & Repeat Buttons"
                  checked={settings.showShuffleRepeat}
                  onChange={(v) => update({ showShuffleRepeat: v })}
                />
                <ToggleRow
                  label="Show Like / Heart Button"
                  checked={settings.showLikeButton}
                  onChange={(v) => update({ showLikeButton: v })}
                />
                <ToggleRow
                  label="Show Volume Control"
                  checked={settings.showVolumeControl}
                  onChange={(v) => update({ showVolumeControl: v })}
                />
                <ToggleRow
                  label="Enable Lyrics Integration"
                  checked={settings.lyricsEnabled}
                  onChange={(v) => update({ lyricsEnabled: v })}
                />
                <ToggleRow
                  label="Dim Background When Lyrics Open"
                  checked={settings.lyricsDimBackground}
                  onChange={(v) => update({ lyricsDimBackground: v })}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Cpu className="w-4 h-4 text-[#C28356]" />
                <span>Performance & Behavior</span>
              </div>

              <RangeRow
                label="Ambient Motion Speed"
                valueLabel={`${settings.animationSpeed.toFixed(1)}x`}
                min={0.2}
                max={2.0}
                step={0.2}
                value={settings.animationSpeed}
                onChange={(v) => update({ animationSpeed: v })}
              />

              <div className="space-y-2.5 pt-1">
                <ToggleRow
                  label="Auto-Activate Aesthetic Mode on YouTube Music Launch"
                  checked={settings.autoActivateOnYTM}
                  onChange={(v) => update({ autoActivateOnYTM: v })}
                />
                <ToggleRow
                  label="Remember Custom Settings Across Browser Restarts"
                  checked={settings.rememberSettings}
                  onChange={(v) => update({ rememberSettings: v })}
                />
                <ToggleRow
                  label="Pause Visual Effects When Tab is Hidden"
                  checked={settings.pauseWhenHidden}
                  onChange={(v) => update({ pauseWhenHidden: v })}
                />
                <ToggleRow
                  label="Reduced Motion Mode"
                  checked={settings.reducedMotion}
                  onChange={(v) => update({ reducedMotion: v })}
                />
                <ToggleRow
                  label="Low GPU Usage Mode (Disable Heavy Glow, Blur & Grain)"
                  checked={settings.lowGpuMode}
                  onChange={(v) => update({ lowGpuMode: v })}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
