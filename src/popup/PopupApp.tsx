import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Power,
  Film,
  Disc,
  Image as ImageIcon,
  EyeOff,
  Settings,
  ExternalLink,
  CheckCircle2,
  Radio,
  Clock,
  Layers,
  PanelLeft,
  RotateCcw,
} from 'lucide-react';
import {
  AestheticSettings,
  BackgroundMode,
  ThemePreset,
  YTMStatusResponse,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultSettings';
import { THEME_DEFINITIONS } from '../shared/themeTokens';
import { EXTENSION_VERSION } from '../shared/version';
import { clearCustomWallpaper } from '../shared/wallpaperStore';
import {
  applyThemePreset,
  getSettings,
  resetSettings,
  saveSettings,
  subscribeToSettings,
} from '../shared/storage';
import { broadcastToYTM, sendMessageToYTMTab } from '../shared/messaging';

export const PopupApp: React.FC = () => {
  const [settings, setSettings] = useState<AestheticSettings>(DEFAULT_SETTINGS);
  const [ytmStatus, setYtmStatus] = useState<YTMStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      const loaded = await getSettings();
      if (!mounted) return;
      setSettings(loaded);

      const status = await sendMessageToYTMTab({ type: 'GET_YTM_STATUS' });
      if (mounted) {
        setYtmStatus(status);
        setLoading(false);
      }
    }

    loadInitial();

    const unsubscribe = subscribeToSettings((updated) => {
      if (mounted) {
        setSettings(updated);
      }
    });

    const interval = setInterval(async () => {
      const status = await sendMessageToYTMTab({ type: 'GET_YTM_STATUS' });
      if (mounted) setYtmStatus(status);
    }, 2000);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleToggleEnabled = async () => {
    const nextEnabled = !settings.enabled;
    const updated = await saveSettings({ enabled: nextEnabled });
    setSettings(updated);
    await broadcastToYTM({ type: 'SET_AESTHETIC_MODE', enabled: nextEnabled });
    const status = await sendMessageToYTMTab({ type: 'GET_YTM_STATUS' });
    setYtmStatus(status);
  };

  const handleUpdateSetting = async (partial: Partial<AestheticSettings>) => {
    const updated = await saveSettings(partial);
    setSettings(updated);
    await broadcastToYTM({ type: 'SETTINGS_UPDATED', settings: partial });
  };

  const handleThemeChange = async (preset: ThemePreset) => {
    const updated = await applyThemePreset(preset);
    setSettings(updated);
    await broadcastToYTM({ type: 'SETTINGS_UPDATED', settings: updated });
  };

  const handleReset = async () => {
    await clearCustomWallpaper();
    const defaults = await resetSettings();
    setSettings(defaults);
    await broadcastToYTM({ type: 'RESET_SETTINGS' });
  };

  const openOptionsPage = () => {
    if (chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  const openYouTubeMusic = () => {
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: 'https://music.youtube.com/' });
    }
  };

  const bgModes: { id: BackgroundMode; label: string; icon: React.ReactNode }[] = [
    { id: 'auto', label: 'Auto (Video + Art)', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'video', label: 'Video Only', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'ambient', label: 'Album Ambient', icon: <Disc className="w-3.5 h-3.5" /> },
    { id: 'custom', label: 'Custom', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: 'off', label: 'Minimal Off', icon: <EyeOff className="w-3.5 h-3.5" /> },
  ];

  const themeOrder: ThemePreset[] = ['night-city', 'minimal-dark', 'cozy-room', 'custom'];

  return (
    <div className="p-4 flex flex-col gap-4 bg-[#0d0d11] text-zinc-100 select-none">
      {/* Header + Master Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C28356]/30 to-black border border-[#C28356]/40 flex items-center justify-center shadow-inner">
            <Sparkles className="w-4 h-4 text-[#C28356]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold tracking-tight text-white">Aesthetic Music</h1>
              <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-mono text-zinc-400">
                v{EXTENSION_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">YouTube Music Desktop Player</p>
          </div>
        </div>

        <button
          onClick={handleToggleEnabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
            settings.enabled
              ? 'bg-[#C28356] text-black border-[#d89b6e] shadow-[0_0_16px_rgba(194,131,86,0.35)]'
              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-zinc-200'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{settings.enabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Live Website Status Card */}
      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex items-center justify-between">
        {ytmStatus?.isYouTubeMusic ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-200 truncate">
                {ytmStatus.trackTitle || 'YouTube Music Connected'}
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {ytmStatus.trackArtist
                  ? `${ytmStatus.trackArtist} • ${
                      ytmStatus.aestheticEnabled ? 'Aesthetic Active' : 'Original UI'
                    }`
                  : ytmStatus.aestheticEnabled
                  ? 'Aesthetic Mode Active'
                  : 'Original YTM Interface Active'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-zinc-500" />
              <div>
                <div className="text-xs font-medium text-zinc-300">
                  {loading ? 'Checking tabs...' : 'No active YTM tab found'}
                </div>
                <div className="text-[11px] text-zinc-500">Open music.youtube.com to start</div>
              </div>
            </div>
            <button
              onClick={openYouTubeMusic}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C28356]/20 hover:bg-[#C28356]/30 text-[#e4a678] border border-[#C28356]/30 text-[11px] font-medium transition"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Background Mode Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Background Engine
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {bgModes.map((mode) => {
            const active = settings.backgroundMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleUpdateSetting({ backgroundMode: mode.id })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium border text-left transition ${
                  active
                    ? 'bg-[#C28356]/20 border-[#C28356]/60 text-white'
                    : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                } ${mode.id === 'auto' ? 'col-span-2' : ''}`}
              >
                <span className={active ? 'text-[#C28356]' : 'text-zinc-500'}>{mode.icon}</span>
                <span className="truncate">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Theme Preset
          </label>
          {settings.customBackgroundName && (
            <span className="text-[10px] text-zinc-400 truncate max-w-[170px]">
              BG: {settings.customBackgroundName}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {themeOrder.map((id) => {
            const def = THEME_DEFINITIONS[id];
            const active = settings.theme === id;
            return (
              <button
                key={id}
                onClick={() => handleThemeChange(id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium border transition ${
                  active
                    ? 'bg-white/[0.09] border-[#C28356]/60 text-white'
                    : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/25 shrink-0"
                  style={{ background: def.previewGradient }}
                />
                <span className="truncate">{def.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Layout Toggles & Sliders */}
      <div className="space-y-2.5 pt-1 border-t border-white/10">
        <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Quick Layout & Atmosphere
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => handleUpdateSetting({ showClock: !settings.showClock })}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] transition ${
              settings.showClock
                ? 'bg-white/[0.08] border-white/20 text-white'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Clock</span>
          </button>

          <button
            onClick={() => handleUpdateSetting({ showCarousel: !settings.showCarousel })}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] transition ${
              settings.showCarousel
                ? 'bg-white/[0.08] border-white/20 text-white'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Carousel</span>
          </button>

          <button
            onClick={() => handleUpdateSetting({ showSidebar: !settings.showSidebar })}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] transition ${
              settings.showSidebar
                ? 'bg-white/[0.08] border-white/20 text-white'
                : 'bg-white/[0.02] border-white/5 text-zinc-500'
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span>Sidebar</span>
          </button>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Darkness Overlay</span>
            <span className="text-zinc-300 font-mono text-[11px]">{settings.darknessOverlay}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={85}
            value={settings.darknessOverlay}
            onChange={(e) =>
              handleUpdateSetting({ darknessOverlay: Number(e.target.value) })
            }
            className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Ambient Blur</span>
            <span className="text-zinc-300 font-mono text-[11px]">{settings.blurIntensity}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={96}
            value={settings.blurIntensity}
            onChange={(e) =>
              handleUpdateSetting({ blurIntensity: Number(e.target.value) })
            }
            className="w-full h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition"
          title="Reset to default settings"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <button
          onClick={openOptionsPage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-100 transition"
        >
          <Settings className="w-3.5 h-3.5 text-[#C28356]" />
          <span>Full Settings</span>
        </button>
      </div>
    </div>
  );
};
