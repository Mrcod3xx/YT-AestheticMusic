import React, { useEffect, useRef, useState } from 'react';
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
  Keyboard,
  Copy,
  Check,
  CloudRain,
  Flame,
  Coffee,
  Moon,
  Timer,
  Gauge,
  Repeat,
  Plus,
  Play,
  Pause,
  Volume2,
  Scissors,
} from 'lucide-react';
import {
  AbLoopRange,
  AestheticSettings,
  AmbientParticles,
  AmbientSoundChannel,
  AmbientSoundLevels,
  BackgroundMode,
  ClockStyle,
  LyricsData,
  PlayerPosition,
  StageStyle,
  StudioScenePreset,
  ThemePreset,
  TrackMetadata,
  TrackTrimPoint,
} from '../../../shared/types';
import {
  formatLyricsForCopy,
  formatLyricsOffsetLabel,
} from '../../../shared/lyricsParser';
import {
  ACCENT_SWATCHES,
  ALL_THEME_ORDER,
  THEME_DEFINITIONS,
} from '../../../shared/themeTokens';
import {
  BUILT_IN_SCENE_PRESETS,
  MAX_CUSTOM_SCENES,
} from '../../../shared/scenePresets';
import {
  PomodoroState,
  formatCountdownMmSs,
} from '../../../shared/sleepAndFocusTimer';
import { formatShortSeconds } from '../../../shared/playbackStudio';
import {
  clearCustomWallpaper,
  saveCustomWallpaper,
} from '../../../shared/wallpaperStore';
import { EXTENSION_VERSION } from '../../../shared/version';

const COZY_AMBIENT_MIXES: Array<{
  id: string;
  label: string;
  levels: AmbientSoundLevels;
}> = [
  {
    id: 'rainy-cafe',
    label: 'Rainy Cafe',
    levels: { rain: 55, vinyl: 12, fireplace: 0, cafe: 42 },
  },
  {
    id: 'fireplace-vinyl',
    label: 'Fireplace Vinyl',
    levels: { rain: 0, vinyl: 38, fireplace: 62, cafe: 0 },
  },
  {
    id: 'midnight-study',
    label: 'Midnight Study',
    levels: { rain: 40, vinyl: 22, fireplace: 28, cafe: 15 },
  },
];

export type StudioPopoverTab = 'presets' | 'appearance' | 'sound' | 'wallpaper';

interface InAppSettingsPopoverProps {
  open: boolean;
  requestedTab?: { tab: StudioPopoverTab; signal: number };
  settings: AestheticSettings;
  track: TrackMetadata;
  lyrics: LyricsData;
  lyricsTimingOffsetMs: number;
  ambientLevels: AmbientSoundLevels;
  onUpdateAmbientLevel: (channel: AmbientSoundChannel, level: number) => void;
  onApplyAmbientMix: (levels: AmbientSoundLevels) => void;
  onMuteAmbient: () => void;
  sleepMode: 'off' | 'countdown' | 'end-of-track';
  sleepRemainingMs: number;
  onStartSleepTimer: (choice: number | 'end-of-track') => void;
  onCancelSleepTimer: () => void;
  pomodoro: PomodoroState;
  onTogglePomodoro: () => void;
  onResetPomodoro: (phase?: 'focus' | 'break') => void;
  onDismissPomodoro: () => void;
  playbackSpeed: number;
  preservePitch: boolean;
  abLoop: AbLoopRange;
  onChangePlaybackSpeed: (speed: number) => void;
  onTogglePreservePitch: () => void;
  onSetAbLoopPoint: (point: 'a' | 'b') => void;
  onClearAbLoop: () => void;
  trackTrim?: TrackTrimPoint | null;
  onMarkTrackTrim: (bound: 'start' | 'end') => void;
  onClearTrackTrim: () => void;
  onApplyScene: (scene: StudioScenePreset) => void;
  onSaveCustomScene: (name: string) => void;
  onDeleteCustomScene: (id: string) => void;
  onAdjustLyricsOffset: (deltaMs: number) => void;
  onResetLyricsOffset: () => void;
  onClose: () => void;
  onOpenShortcutsHelp?: () => void;
  onUpdateSettings: (partial: Partial<AestheticSettings>) => void;
  onSelectTheme: (preset: ThemePreset) => void;
  onReset: () => void;
  onWallpaperUploaded: () => void;
}

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
  requestedTab,
  settings,
  track,
  lyrics,
  lyricsTimingOffsetMs,
  ambientLevels,
  onUpdateAmbientLevel,
  onApplyAmbientMix,
  onMuteAmbient,
  sleepMode,
  sleepRemainingMs,
  onStartSleepTimer,
  onCancelSleepTimer,
  pomodoro,
  onTogglePomodoro,
  onResetPomodoro,
  onDismissPomodoro,
  playbackSpeed,
  preservePitch,
  abLoop,
  onChangePlaybackSpeed,
  onTogglePreservePitch,
  onSetAbLoopPoint,
  onClearAbLoop,
  trackTrim = null,
  onMarkTrackTrim,
  onClearTrackTrim,
  onApplyScene,
  onSaveCustomScene,
  onDeleteCustomScene,
  onAdjustLyricsOffset,
  onResetLyricsOffset,
  onClose,
  onOpenShortcutsHelp,
  onUpdateSettings,
  onSelectTheme,
  onReset,
  onWallpaperUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<StudioPopoverTab>('presets');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');

  const hasLyrics = lyrics.available && lyrics.lines.length > 0;

  useEffect(() => {
    if (requestedTab && requestedTab.signal > 0) {
      setActiveTab(requestedTab.tab);
    }
  }, [requestedTab?.signal, requestedTab?.tab]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCopiedLyrics(false);
  }, [lyrics.trackKey, open]);

  const handleCopyLyrics = async () => {
    const text = formatLyricsForCopy(lyrics.lines);
    if (!text) return;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedLyrics(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedLyrics(false);
        copyTimerRef.current = null;
      }, 1500);
    }
  };

  // Close Studio Controls when clicking outside (Shadow DOM safe via composedPath)
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: Event) => {
      const panel = popoverRef.current;
      if (!panel) return;
      const path = e.composedPath?.() || [];
      if (path.includes(panel)) return;
      const hitTrigger = path.some(
        (node) =>
          node instanceof Element &&
          node.getAttribute('data-aesthetic-settings-trigger') === 'true'
      );
      if (!hitTrigger) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open, onClose]);

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
    { id: 'auto', label: 'Auto (Video + Art)', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'video', label: 'Video Only', icon: <Film className="w-4 h-4" /> },
    { id: 'ambient', label: 'Album Ambient', icon: <Disc className="w-4 h-4" /> },
    { id: 'custom', label: 'Custom BG', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'off', label: 'Minimal Off', icon: <EyeOff className="w-4 h-4" /> },
  ];

  const themeOrder = ALL_THEME_ORDER;

  const tabs: { id: StudioPopoverTab; label: string; icon: React.ReactNode }[] = [
    { id: 'presets', label: 'Presets', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'appearance', label: 'UI & Lyrics', icon: <Type className="w-3.5 h-3.5" /> },
    { id: 'sound', label: 'Sound', icon: <Volume2 className="w-3.5 h-3.5" /> },
    { id: 'wallpaper', label: 'Wallpaper', icon: <ImageIcon className="w-3.5 h-3.5" /> },
  ];

  const anyAmbientActive =
    ambientLevels.rain > 0 ||
    ambientLevels.vinyl > 0 ||
    ambientLevels.fireplace > 0 ||
    ambientLevels.cafe > 0;

  return (
    <div
      ref={popoverRef}
      className="fixed bottom-28 right-8 xl:right-[14vw] w-[400px] max-h-[72vh] flex flex-col rounded-3xl p-5 z-50 text-zinc-100 pointer-events-auto"
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
        <div className="flex items-center gap-1 shrink-0">
          {onOpenShortcutsHelp && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShortcutsHelp();
              }}
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close Studio Controls (Esc)"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
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
      <div className="grid grid-cols-4 gap-1 p-1 mt-3 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1 py-2.5 px-1 rounded-lg text-[11.5px] font-medium transition cursor-pointer ${
                active
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-4 custom-queue-scroll">
        {activeTab === 'presets' && (
          <>
            {/* 1-Click Studio Scenes */}
            <div className="space-y-2 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Studio Scene Presets
                </label>
                <span className="text-[10px] text-zinc-500">1-click room mood</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BUILT_IN_SCENE_PRESETS.map((scene) => {
                  const def = THEME_DEFINITIONS[scene.snapshot.theme];
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => onApplyScene(scene)}
                      className="p-2.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                          style={{ background: def?.previewGradient || '#C28356' }}
                        />
                        <span className="text-[12px] font-semibold text-white truncate">
                          {scene.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                        {scene.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>

              {settings.customScenes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    My Saved Scenes ({settings.customScenes.length}/{MAX_CUSTOM_SCENES})
                  </div>
                  <div className="space-y-1">
                    {settings.customScenes.map((scene) => (
                      <div
                        key={scene.id}
                        className="flex items-center gap-1.5 rounded-xl bg-white/[0.03] border border-white/10 px-2.5 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => onApplyScene(scene)}
                          className="flex-1 min-w-0 text-left text-[11.5px] font-medium text-zinc-200 hover:text-white truncate cursor-pointer"
                        >
                          {scene.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCustomScene(scene.id)}
                          title="Delete saved scene"
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-300 hover:bg-red-500/15 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  maxLength={28}
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSceneName.trim()) {
                      e.preventDefault();
                      onSaveCustomScene(newSceneName.trim());
                      setNewSceneName('');
                    }
                  }}
                  placeholder={
                    settings.customScenes.length >= MAX_CUSTOM_SCENES
                      ? 'Limit reached (6 scenes)'
                      : 'Name current look...'
                  }
                  disabled={settings.customScenes.length >= MAX_CUSTOM_SCENES}
                  className="flex-1 min-w-0 rounded-xl px-2.5 py-1.5 bg-white/[0.05] border border-white/10 text-[11.5px] text-white placeholder-zinc-500 focus:outline-none focus:border-white/25 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={
                    !newSceneName.trim() ||
                    settings.customScenes.length >= MAX_CUSTOM_SCENES
                  }
                  onClick={() => {
                    if (!newSceneName.trim()) return;
                    onSaveCustomScene(newSceneName.trim());
                    setNewSceneName('');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-[11px] font-medium text-white transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>

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
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                        id === 'custom' ? 'col-span-2' : ''
                      } ${
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
                        <span className="text-[13px] font-semibold text-white truncate">
                          {def.label}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-zinc-400 line-clamp-1">{def.tagline}</p>
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

            {/* Vignette, Film Grain & Aurora */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onUpdateSettings({ vignette: !settings.vignette })}
                className={`py-2.5 px-2.5 rounded-xl text-[12px] font-medium border transition cursor-pointer ${
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
                className={`py-2.5 px-2.5 rounded-xl text-[12px] font-medium border transition cursor-pointer ${
                  settings.filmGrain
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400'
                }`}
              >
                Grain: {settings.filmGrain ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ ambientAurora: !settings.ambientAurora })}
                className={`py-2.5 px-2.5 rounded-xl text-[12px] font-medium border transition cursor-pointer ${
                  settings.ambientAurora
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400'
                }`}
              >
                Aurora: {settings.ambientAurora ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Ambient Particles */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Ambient Particles
                </label>
                {settings.lowGpuMode && (
                  <span className="text-[10px] text-amber-300/80">Paused in Low GPU Mode</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'none', label: 'Off' },
                    { id: 'dust', label: 'Warm Dust' },
                    { id: 'bokeh', label: 'Soft Bokeh' },
                    { id: 'rain', label: 'Glass Rain' },
                    { id: 'petals', label: 'Sakura Petals' },
                    { id: 'embers', label: 'Warm Embers' },
                  ] as { id: AmbientParticles; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ambientParticles: p.id })}
                    className={`py-2 rounded-xl text-[11.5px] font-medium border transition cursor-pointer ${
                      settings.ambientParticles === p.id
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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
              <div className="grid grid-cols-3 gap-2">
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
                    className={`py-2.5 px-2.5 rounded-xl text-[12px] font-medium border transition cursor-pointer ${
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
                  className="w-8 h-7 rounded cursor-pointer bg-transparent border border-white/20"
                />
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
                        onUpdateSettings({
                          accentColor: sw.color,
                          clockColor: sw.color,
                        })
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

            {/* Stage Style */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Center Stage Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'carousel', label: '3D Carousel' },
                    { id: 'vinyl', label: 'Vinyl Disc' },
                    { id: 'cassette', label: 'Cassette Deck' },
                    { id: 'poster', label: 'Poster Frame' },
                    { id: 'minimal', label: 'Minimal' },
                  ] as { id: StageStyle; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateSettings({ stageStyle: s.id })}
                    className={`py-2 px-1.5 rounded-xl text-[11.5px] font-medium border transition cursor-pointer ${
                      settings.stageStyle === s.id
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Typography Style
              </label>
              <div className="grid grid-cols-3 gap-2">
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
                    className={`py-2.5 rounded-xl text-[12.5px] font-medium border transition cursor-pointer ${
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
              <div className="grid grid-cols-3 gap-2">
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
                    className={`py-2.5 rounded-xl text-[12.5px] font-medium border transition cursor-pointer ${
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

            {/* Clock Style */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                Clock Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'digital', label: 'Clean Digital' },
                    { id: 'flip', label: 'Retro Flip Cards' },
                  ] as { id: ClockStyle; label: string }[]
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdateSettings({ clockStyle: c.id })}
                    className={`py-2.5 rounded-xl text-[12px] font-medium border transition cursor-pointer ${
                      (settings.clockStyle || 'digital') === c.id
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {c.label}
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

            {/* Lyrics Timing Sync & Copy */}
            <div className="space-y-2.5 pt-2.5 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Lyrics Sync & Copy
                </label>
                {lyrics.source && (
                  <span className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                    {lyrics.source}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showMiniLyricLine: !settings.showMiniLyricLine })
                }
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-left transition cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-zinc-200">
                    Mini 1-Line Subtitle
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    Show synced lyric above dock when Lyrics panel is closed
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 transition ${
                    settings.showMiniLyricLine
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-black/35 border-white/10 text-zinc-500'
                  }`}
                >
                  {settings.showMiniLyricLine ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ romanizeLyrics: !settings.romanizeLyrics })
                }
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-left transition cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-zinc-200">
                    Auto-Romanize Lyrics
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    Pronunciation guides for Korean & Japanese lines
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 transition ${
                    settings.romanizeLyrics
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-black/35 border-white/10 text-zinc-500'
                  }`}
                >
                  {settings.romanizeLyrics ? 'ON' : 'OFF'}
                </span>
              </button>

              <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-zinc-200">
                    Sync Timing Offset
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {lyrics.isSynced
                      ? 'Shift live lyric highlight earlier or later'
                      : 'Available when synced lyrics are active'}
                  </div>
                </div>

                <div className="inline-flex items-center rounded-xl bg-black/40 border border-white/10 p-0.5 text-[11px] shrink-0">
                  <button
                    type="button"
                    disabled={!lyrics.isSynced}
                    onClick={() => onAdjustLyricsOffset(-500)}
                    title="Shift lyrics 0.5s earlier"
                    aria-label="Shift lyrics 0.5 seconds earlier"
                    className="px-2 py-1 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                  >
                    -0.5s
                  </button>
                  <button
                    type="button"
                    disabled={!lyrics.isSynced || lyricsTimingOffsetMs === 0}
                    onClick={onResetLyricsOffset}
                    title="Reset lyric timing offset to 0.0s"
                    aria-label="Reset lyric timing offset"
                    className={`px-2 py-1 rounded-lg font-mono text-[10.5px] transition cursor-pointer disabled:pointer-events-none ${
                      lyricsTimingOffsetMs !== 0 && lyrics.isSynced
                        ? 'text-white bg-white/15 hover:bg-white/20'
                        : 'text-zinc-500'
                    }`}
                  >
                    {formatLyricsOffsetLabel(lyricsTimingOffsetMs)}
                  </button>
                  <button
                    type="button"
                    disabled={!lyrics.isSynced}
                    onClick={() => onAdjustLyricsOffset(500)}
                    title="Shift lyrics 0.5s later"
                    aria-label="Shift lyrics 0.5 seconds later"
                    className="px-2 py-1 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                  >
                    +0.5s
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={!hasLyrics}
                onClick={() => void handleCopyLyrics()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[12px] font-medium border transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                  copiedLyrics
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-200'
                }`}
              >
                {copiedLyrics ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied Lyrics to Clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      {hasLyrics ? 'Copy Current Track Lyrics' : 'No Lyrics Loaded Yet'}
                    </span>
                  </>
                )}
              </button>
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
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12.5px] font-medium border transition cursor-pointer ${
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
                  <div className="flex items-center gap-2 shrink-0">
                    {settings.backgroundMode !== 'custom' && (
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ backgroundMode: 'custom' })}
                        className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-medium text-white cursor-pointer"
                      >
                        Use
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearWallpaper}
                      title="Remove custom wallpaper"
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/15 hover:bg-red-500/25 text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
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

        {activeTab === 'sound' && (
          <>
            {/* Cozy Soundscapes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  Cozy Background Sounds
                </span>
                {anyAmbientActive && (
                  <button
                    type="button"
                    onClick={onMuteAmbient}
                    className="text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    Turn All Off
                  </button>
                )}
              </div>

              {/* 1-Tap Cozy Mixes */}
              <div className="grid grid-cols-2 gap-1.5">
                {COZY_AMBIENT_MIXES.map((mix) => {
                  const isActiveMix =
                    ambientLevels.rain === mix.levels.rain &&
                    ambientLevels.vinyl === mix.levels.vinyl &&
                    ambientLevels.fireplace === mix.levels.fireplace &&
                    ambientLevels.cafe === mix.levels.cafe;
                  return (
                    <button
                      key={mix.id}
                      type="button"
                      onClick={() => onApplyAmbientMix(mix.levels)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
                        isActiveMix
                          ? 'bg-white/15 border-white/30 text-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/10 text-zinc-300'
                      }`}
                    >
                      {mix.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onMuteAmbient}
                  className="px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.09] text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {(
                [
                  { id: 'rain', label: 'Soft Rain', icon: <CloudRain className="w-3.5 h-3.5 text-sky-300" /> },
                  { id: 'vinyl', label: 'Vinyl Crackle', icon: <Disc className="w-3.5 h-3.5 text-amber-300" /> },
                  { id: 'fireplace', label: 'Warm Fireplace', icon: <Flame className="w-3.5 h-3.5 text-orange-400" /> },
                  { id: 'cafe', label: 'Cozy Cafe Murmur', icon: <Coffee className="w-3.5 h-3.5 text-emerald-300" /> },
                ] as { id: AmbientSoundChannel; label: string; icon: React.ReactNode }[]
              ).map((ch) => (
                <div key={ch.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      {ch.icon}
                      <span>{ch.label}</span>
                    </span>
                    <span className="font-mono text-zinc-200">{ambientLevels[ch.id]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={ambientLevels[ch.id]}
                    onChange={(e) => onUpdateAmbientLevel(ch.id, Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    style={{ accentColor: 'var(--aesthetic-accent-strong, #C28356)' }}
                  />
                </div>
              ))}
              <p className="text-[10.5px] text-zinc-500">
                Mixes softly behind your music and pauses automatically when you pause playback.
              </p>
            </div>

            {/* Sleep Timer */}
            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Moon className="w-3.5 h-3.5" />
                  <span>Sleep Timer</span>
                </span>
                {sleepMode !== 'off' && (
                  <button
                    type="button"
                    onClick={onCancelSleepTimer}
                    className="text-[11px] text-red-300 hover:text-red-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {([15, 30, 45, 60] as number[]).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onStartSleepTimer(mins)}
                    className="py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-[11px] font-medium text-zinc-200 transition cursor-pointer"
                  >
                    {mins}m
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onStartSleepTimer('end-of-track')}
                  className={`py-1.5 rounded-xl border text-[10.5px] font-medium transition cursor-pointer ${
                    sleepMode === 'end-of-track'
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/10 text-zinc-200'
                  }`}
                >
                  End Track
                </button>
              </div>
              {sleepMode === 'countdown' && (
                <p className="text-[11px] text-emerald-300/90">
                  Music fades out smoothly and pauses in {formatCountdownMmSs(sleepRemainingMs)}.
                </p>
              )}
              {sleepMode === 'end-of-track' && (
                <p className="text-[11px] text-emerald-300/90">
                  Music will pause automatically right after this song ends.
                </p>
              )}
            </div>

            {/* Study / Focus Timer (Pomodoro) */}
            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Focus Timer</span>
                </span>
                {pomodoro.active && (
                  <button
                    type="button"
                    onClick={onDismissPomodoro}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Hide Pill
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/10">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-200">
                    {pomodoro.phase === 'focus' ? 'Study Focus' : 'Short Break'}
                  </div>
                  <div className="text-sm font-mono font-semibold text-white">
                    {formatCountdownMmSs(pomodoro.remainingMs)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onTogglePomodoro}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-[11px] font-medium text-white transition cursor-pointer"
                  >
                    {pomodoro.running ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Start</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onResetPomodoro(pomodoro.phase === 'focus' ? 'break' : 'focus')
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-[11px] text-zinc-300 transition cursor-pointer"
                  >
                    {pomodoro.phase === 'focus' ? '5m Break' : '25m Focus'}
                  </button>
                </div>
              </div>
            </div>

            {/* Playback Studio: Speed, Pitch & A-B Loop */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Gauge className="w-3.5 h-3.5" />
                  <span>Playback Speed & Pitch</span>
                </span>
                {playbackSpeed !== 1 && (
                  <button
                    type="button"
                    onClick={() => onChangePlaybackSpeed(1)}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Reset 1.0×
                  </button>
                )}
              </div>

              <SliderControl
                label="Speed"
                valueLabel={`${playbackSpeed.toFixed(2)}×`}
                min={75}
                max={150}
                value={Math.round(playbackSpeed * 100)}
                onChange={(pct) => onChangePlaybackSpeed(Number((pct / 100).toFixed(2)))}
              />

              <div className="flex items-center gap-1.5">
                {[0.85, 1.0, 1.15, 1.25].map((presetSpeed) => (
                  <button
                    key={presetSpeed}
                    type="button"
                    onClick={() => onChangePlaybackSpeed(presetSpeed)}
                    className={`flex-1 py-1.5 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
                      Math.abs(playbackSpeed - presetSpeed) < 0.02
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {presetSpeed}×
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onTogglePreservePitch}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition cursor-pointer"
              >
                <div className="text-left">
                  <div className="text-[12px] font-medium text-zinc-200">
                    Vinyl Pitch Mode (Slowed = Deeper Voice)
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {!preservePitch
                      ? 'Active — pitch shifts naturally with speed'
                      : 'Off — voice pitch stays normal'}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    !preservePitch
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {!preservePitch ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ softAudioFade: !(settings.softAudioFade ?? true) })
                }
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition cursor-pointer"
              >
                <div className="text-left">
                  <div className="text-[12px] font-medium text-zinc-200">
                    Soft-Fade Audio on Play &amp; Skip
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {(settings.softAudioFade ?? true)
                      ? 'Smooth gentle ramp — no harsh volume pops'
                      : 'Instant hard start and stop'}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    (settings.softAudioFade ?? true)
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {(settings.softAudioFade ?? true) ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* A-B Section Loop */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Loop Part of Song (A–B)</span>
                  </span>
                  {(abLoop.aSec !== null || abLoop.bSec !== null) && (
                    <button
                      type="button"
                      onClick={onClearAbLoop}
                      className="text-[11px] text-red-300 hover:text-red-200 cursor-pointer"
                    >
                      Clear Loop
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSetAbLoopPoint('a')}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-left transition cursor-pointer"
                  >
                    <div className="text-[10px] text-zinc-400">Mark Start (A)</div>
                    <div className="text-xs font-mono font-semibold text-white">
                      {abLoop.aSec !== null ? formatShortSeconds(abLoop.aSec) : 'Tap at start'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAbLoopPoint('b')}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-left transition cursor-pointer"
                  >
                    <div className="text-[10px] text-zinc-400">Mark End (B)</div>
                    <div className="text-xs font-mono font-semibold text-white">
                      {abLoop.bSec !== null ? formatShortSeconds(abLoop.bSec) : 'Tap at end'}
                    </div>
                  </button>
                </div>
                <p className="text-[10.5px] text-zinc-500">
                  Repeats your chosen chorus or solo automatically. Clears when the song changes.
                </p>
              </div>

              {/* Per-Song Skip Intro / Outro Saver */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Skip Video Intro / Outro</span>
                  </span>
                  {(trackTrim?.startSec !== undefined || trackTrim?.endSec !== undefined) && (
                    <button
                      type="button"
                      onClick={onClearTrackTrim}
                      className="text-[11px] text-red-300 hover:text-red-200 cursor-pointer"
                    >
                      Clear Trim
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!track.videoId || track.duration <= 0}
                    onClick={() => onMarkTrackTrim('start')}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-45 border border-white/10 text-left transition cursor-pointer"
                  >
                    <div className="text-[10px] text-zinc-400">Skip Intro (Start Here)</div>
                    <div className="text-xs font-mono font-semibold text-white">
                      {trackTrim?.startSec !== undefined
                        ? formatShortSeconds(trackTrim.startSec)
                        : 'Tap at drop'}
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={!track.videoId || track.duration <= 0}
                    onClick={() => onMarkTrackTrim('end')}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] disabled:opacity-45 border border-white/10 text-left transition cursor-pointer"
                  >
                    <div className="text-[10px] text-zinc-400">Skip Outro (End Here)</div>
                    <div className="text-xs font-mono font-semibold text-white">
                      {trackTrim?.endSec !== undefined
                        ? formatShortSeconds(trackTrim.endSec)
                        : 'Tap before end'}
                    </div>
                  </button>
                </div>

                <p className="text-[10.5px] text-zinc-500">
                  {track.videoId
                    ? 'Remembers this song forever — automatically jumps past long intros and skits.'
                    : 'Play a song on YouTube Music to save custom intro/outro skip points.'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.07] transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={openFullOptions}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.07] transition cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Full Settings</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onUpdateSettings({ enabled: false })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 text-[12.5px] font-medium transition cursor-pointer"
        >
          <Power className="w-4 h-4" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
};
