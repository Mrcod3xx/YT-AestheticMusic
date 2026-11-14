import React, { useRef, useState } from 'react';
import {
  X,
  Sparkles,
  Film,
  Disc,
  Image as ImageIcon,
  EyeOff,
  Power,
  RotateCcw,
  Upload,
  CheckCircle2,
  Sliders,
  Type,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  AestheticSettings,
  BackgroundMode,
  PlayerPosition,
  ThemePreset,
  TrackMetadata,
} from '../../../shared/types';
import {
  ACCENT_SWATCHES,
  THEME_DEFINITIONS,
} from '../../../shared/themeTokens';
import {
  clearCustomWallpaper,
  saveCustomWallpaper,
} from '../../../shared/wallpaperStore';
import { EXTENSION_VERSION } from '../../../shared/version';

interface InAppSettingsPopoverProps {
  open: boolean;
  settings: AestheticSettings;
  track: TrackMetadata;
  onClose: () => void;
  onUpdateSettings: (partial: Partial<AestheticSettings>) => void;
  onSelectTheme: (preset: ThemePreset) => void;
  onReset: () => void;
  onWallpaperUploaded: () => void;
}

type PopoverTab = 'presets' | 'appearance' | 'wallpaper';

interface SliderControlProps {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  valueLabel,
  min,
  max,
  value,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[11.5px]">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-200">{valueLabel}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
      style={{ accentColor: 'var(--aesthetic-accent-strong, #C28356)' }}
    />
  </div>
);

export const InAppSettingsPopover: React.FC<InAppSettingsPopoverProps> = ({
  open,
  settings,
  track,
  onClose,
  onUpdateSettings,
  onSelectTheme,
  onReset,
  onWallpaperUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<PopoverTab>('presets');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  if (!open) return null;

  const isVideoStreaming =
    (settings.backgroundMode === 'auto' || settings.backgroundMode === 'video') &&
    track.isVideoActive;

  const activeSourceLabel = isVideoStreaming
    ? 'Live Music Video Active'
    : settings.backgroundMode === 'custom' && settings.customBackgroundName
    ? `Custom: ${settings.customBackgroundName}`
    : settings.backgroundMode === 'off'
    ? 'Minimal Dark (Off)'
    : track.videoToggleLocked &&
      (settings.backgroundMode === 'auto' || settings.backgroundMode === 'video')
    ? 'Ambient Fallback (Select MV in Search or Premium)'
    : 'Ambient Album Artwork Active';

  const processWallpaperFile = async (file: File) => {
    try {
      setUploadStatus('Saving wallpaper locally...');
      const rev = Date.now();
      const saved = await saveCustomWallpaper(file, rev);
      onUpdateSettings({
        backgroundMode: 'custom',
        customBackgroundType: saved.mediaType,
        customBackgroundName: saved.fileName,
        customWallpaperVersion: saved.updatedAt,
      });
      onWallpaperUploaded();
      setUploadStatus(`Active: ${saved.fileName}`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processWallpaperFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processWallpaperFile(file);
    }
  };

  const handleClearWallpaper = async () => {
    await clearCustomWallpaper();
    try {
      chrome.runtime?.sendMessage?.({ type: 'CLEAR_EXTENSION_WALLPAPER' });
    } catch {
      // Ignore runtime error if extension context reloaded
    }
    onUpdateSettings({
      backgroundMode: settings.backgroundMode === 'custom' ? 'auto' : settings.backgroundMode,
      theme: settings.theme === 'custom' ? 'night-city' : settings.theme,
      customBackgroundType: 'none',
      customBackgroundName: '',
      customWallpaperVersion: Date.now(),
    });
    onWallpaperUploaded();
    setUploadStatus('Custom wallpaper cleared.');
  };

  const openFullOptions = () => {
    try {
      chrome.runtime?.sendMessage?.({ type: 'OPEN_OPTIONS_PAGE' });
    } catch {
      // Ignore if context invalid
    }
  };

  const bgModes: { id: BackgroundMode; label: string; icon: React.ReactNode }[] = [
    { id: 'auto', label: 'Auto (Video + Art)', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'video', label: 'Video Only', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'ambient', label: 'Album Ambient', icon: <Disc className="w-3.5 h-3.5" /> },
    { id: 'custom', label: 'Custom BG', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: 'off', label: 'Minimal Off', icon: <EyeOff className="w-3.5 h-3.5" /> },
  ];

  const themeOrder: ThemePreset[] = ['night-city', 'minimal-dark', 'cozy-room', 'custom'];

  const tabs: { id: PopoverTab; label: string; icon: React.ReactNode }[] = [
    { id: 'presets', label: 'Presets', icon: <Sparkles className="w-3 h-3" /> },
    { id: 'appearance', label: 'Clock & UI', icon: <Type className="w-3 h-3" /> },
    { id: 'wallpaper', label: 'Wallpaper', icon: <ImageIcon className="w-3 h-3" /> },
  ];

  return (
    <div
      className="fixed bottom-28 right-8 xl:right-[14vw] w-[372px] max-h-[72vh] flex flex-col rounded-3xl p-5 z-50 text-zinc-100 pointer-events-auto"
      style={{
        background: 'rgba(16, 17, 23, 0.92)',
        backdropFilter: 'blur(32px) saturate(165%)',
        WebkitBackdropFilter: 'blur(32px) saturate(165%)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--aesthetic-accent-strong,#C28356)]" />
          <span className="text-xs font-semibold tracking-wide text-white uppercase">
            Aesthetic Studio Controls
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[9.5px] font-mono text-zinc-400">
            v{EXTENSION_VERSION}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Live Background Engine Status Badge */}
      <div className="flex items-center justify-between px-3 py-2 mt-3 rounded-xl bg-white/[0.05] border border-white/10 text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2
            className={`w-3.5 h-3.5 shrink-0 ${
              isVideoStreaming
                ? 'text-emerald-400'
                : 'text-[var(--aesthetic-accent,#E89B63)]'
            }`}
          />
          <span className="truncate font-medium text-zinc-200">{activeSourceLabel}</span>
        </div>
        <span className="text-[10px] text-zinc-400 capitalize shrink-0 ml-2">
          {THEME_DEFINITIONS[settings.theme]?.label}
        </span>
      </div>

      {/* Studio Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 mt-3 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11.5px] font-medium transition cursor-pointer ${
                active
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-4 custom-queue-scroll">
        {activeTab === 'presets' && (
          <>
            {/* Theme Presets with Visual Swatch Preview */}
            <div className="space-y-2">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Theme Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {themeOrder.map((id) => {
                  const def = THEME_DEFINITIONS[id];
                  const active = settings.theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectTheme(id)}
                      className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                        active
                          ? 'border-[var(--aesthetic-accent-strong,#C28356)] bg-white/[0.09]'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-5 h-5 rounded-full border border-white/25 shrink-0"
                          style={{ background: def.previewGradient }}
                        />
                        <span className="text-[12px] font-semibold text-white truncate">
                          {def.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-1">{def.tagline}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Atmosphere Tuning */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <SliderControl
                label="Darkness Overlay"
                valueLabel={`${settings.darknessOverlay}%`}
                min={0}
                max={85}
                value={settings.darknessOverlay}
                onChange={(val) => onUpdateSettings({ darknessOverlay: val })}
              />
              <SliderControl
                label="Ambient Blur"
                valueLabel={`${settings.blurIntensity}px`}
                min={0}
                max={96}
                value={settings.blurIntensity}
                onChange={(val) => onUpdateSettings({ blurIntensity: val })}
              />
              <SliderControl
                label="Ambient Color Glow"
                valueLabel={`${settings.glowIntensity}%`}
                min={0}
                max={100}
                value={settings.glowIntensity}
                onChange={(val) => onUpdateSettings({ glowIntensity: val })}
              />
              <SliderControl
                label="Background Brightness"
                valueLabel={`${settings.backgroundBrightness}%`}
                min={25}
                max={115}
                value={settings.backgroundBrightness}
                onChange={(val) => onUpdateSettings({ backgroundBrightness: val })}
              />
            </div>

            {/* Vignette & Film Grain */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onUpdateSettings({ vignette: !settings.vignette })}
                className={`py-1.5 px-3 rounded-xl text-[11.5px] font-medium border transition cursor-pointer ${
                  settings.vignette
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400'
                }`}
              >
                Vignette: {settings.vignette ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ filmGrain: !settings.filmGrain })}
                className={`py-1.5 px-3 rounded-xl text-[11.5px] font-medium border transition cursor-pointer ${
                  settings.filmGrain
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400'
                }`}
              >
                Film Grain: {settings.filmGrain ? 'ON' : 'OFF'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'appearance' && (
          <>
            {/* Panel Visibility Quick Toggles */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Interface Panels
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'showClock' as const, label: 'Clock', val: settings.showClock },
                  { key: 'clock24Hour' as const, label: '24-Hour', val: settings.clock24Hour },
                  { key: 'showSidebar' as const, label: 'Sidebar', val: settings.showSidebar },
                  { key: 'showCarousel' as const, label: 'Carousel', val: settings.showCarousel },
                  { key: 'showSearchBar' as const, label: 'Search', val: settings.showSearchBar },
                  { key: 'lyricsEnabled' as const, label: 'Lyrics', val: settings.lyricsEnabled },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onUpdateSettings({ [item.key]: !item.val })}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-medium border transition cursor-pointer ${
                      item.val
                        ? 'bg-white/15 border-white/25 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-500'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent & Clock Color Swatches */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Accent & Clock Color
                </label>
                <input
                  type="color"
                  value={settings.accentColor || settings.clockColor || '#C28356'}
                  onChange={(e) =>
                    onUpdateSettings({
                      accentColor: e.target.value,
                      clockColor: e.target.value,
                    })
                  }
                  title="Pick custom accent & clock color"
                  className="w-6 h-5 rounded cursor-pointer bg-transparent border border-white/20"
                />
              </div>
              <div className="flex items-center gap-2">
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
                        onUpdateSettings({
                          accentColor: sw.color,
                          clockColor: sw.color,
                        })
                      }
                      className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                        selected ? 'border-white scale-110' : 'border-white/20 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: sw.color }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Typography Style
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'modern', label: 'Modern' },
                    { id: 'editorial', label: 'Editorial' },
                    { id: 'mono', label: 'Mono' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdateSettings({ fontFamily: f.id })}
                    className={`py-1.5 rounded-xl text-[11.5px] font-medium border transition cursor-pointer ${
                      settings.fontFamily === f.id
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Player Layout Width */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Player Dock Width
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'bottom-center', label: 'Standard' },
                    { id: 'bottom-wide', label: 'Wide' },
                    { id: 'compact-dock', label: 'Compact' },
                  ] as { id: PlayerPosition; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdateSettings({ playerPosition: p.id })}
                    className={`py-1.5 rounded-xl text-[11.5px] font-medium border transition cursor-pointer ${
                      settings.playerPosition === p.id
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clock Size, Glass Opacity & Corner Radius */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <SliderControl
                label="Clock Scale"
                valueLabel={`${settings.clockFontSize}%`}
                min={75}
                max={140}
                value={settings.clockFontSize}
                onChange={(val) => onUpdateSettings({ clockFontSize: val })}
              />
              <SliderControl
                label="Glass Panel Opacity"
                valueLabel={`${settings.panelTransparency}%`}
                min={25}
                max={95}
                value={settings.panelTransparency}
                onChange={(val) => onUpdateSettings({ panelTransparency: val })}
              />
              <SliderControl
                label="Player Bar Opacity"
                valueLabel={`${settings.playerGlassOpacity}%`}
                min={35}
                max={95}
                value={settings.playerGlassOpacity}
                onChange={(val) => onUpdateSettings({ playerGlassOpacity: val })}
              />
              <SliderControl
                label="Corner Radius"
                valueLabel={`${settings.borderRadius}px`}
                min={12}
                max={32}
                value={settings.borderRadius}
                onChange={(val) => onUpdateSettings({ borderRadius: val })}
              />
            </div>
          </>
        )}

        {activeTab === 'wallpaper' && (
          <>
            {/* Background Priority Mode */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Background Priority Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {bgModes.map((m) => {
                  const active = settings.backgroundMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onUpdateSettings({ backgroundMode: m.id })}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[12px] font-medium border transition cursor-pointer ${
                        active
                          ? 'bg-white/15 border-white/30 text-white'
                          : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                      } ${m.id === 'auto' ? 'col-span-2' : ''}`}
                      style={
                        active
                          ? { borderColor: 'var(--aesthetic-accent-strong, #C28356)' }
                          : undefined
                      }
                    >
                      <span
                        className={
                          active ? 'text-[var(--aesthetic-accent,#E89B63)]' : 'text-zinc-500'
                        }
                      >
                        {m.icon}
                      </span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drag-and-Drop / Upload Custom Wallpaper */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Custom Image or Video Wallpaper
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-5 px-4 rounded-2xl border border-dashed text-center transition cursor-pointer ${
                  isDragging
                    ? 'bg-white/15 border-[var(--aesthetic-accent,#E89B63)]'
                    : 'bg-white/[0.05] hover:bg-white/[0.09] border-white/25'
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-[var(--aesthetic-accent,#E89B63)]" />
                <div className="text-xs font-medium text-zinc-100">
                  Click or drop JPG, PNG, WebP, GIF, MP4, WebM
                </div>
                <div className="text-[10.5px] text-zinc-400 mt-0.5">
                  Stored locally in your browser (up to 150MB)
                </div>
              </div>

              {settings.customBackgroundName && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10">
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-medium text-white truncate">
                      {settings.customBackgroundName}
                    </div>
                    <div className="text-[10px] text-zinc-400 uppercase">
                      {settings.customBackgroundType} •{' '}
                      {settings.backgroundMode === 'custom' ? 'Active' : 'Saved (Switch to Custom BG)'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {settings.backgroundMode !== 'custom' && (
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ backgroundMode: 'custom' })}
                        className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10.5px] text-white cursor-pointer"
                      >
                        Use
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearWallpaper}
                      title="Remove custom wallpaper"
                      className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {uploadStatus && (
                <p className="text-[11px] text-zinc-400 text-center truncate">
                  {uploadStatus}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11.5px] text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={openFullOptions}
            className="flex items-center gap-1 text-[11.5px] text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Full Settings</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onUpdateSettings({ enabled: false })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 text-[11.5px] font-medium transition cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
};
