import React, { useEffect, useRef, useState } from 'react';
import { AestheticSettings, ThemePreset, TrackMetadata } from '../../../shared/types';
import {
  clearCustomWallpaper,
  loadCustomWallpaper,
  syncWallpaperFromExtension,
} from '../../../shared/wallpaperStore';
import { THEME_DEFINITIONS } from '../../../shared/themeTokens';

interface BackgroundEngineProps {
  settings: AestheticSettings;
  track: TrackMetadata;
  lyricsOpen: boolean;
  customWallpaperVersion: number;
  paused?: boolean;
}

interface AmbientPalette {
  primary: string;
  secondary: string;
}

interface AmbientParticleSpec {
  id: number;
  xPct: number;
  yPct: number;
  dustSizePx: number;
  bokehSizePx: number;
  dxPx: number;
  dyPx: number;
  durSec: number;
  delaySec: number;
  warm: boolean;
}

const PARTICLE_SPECS: readonly AmbientParticleSpec[] = Array.from(
  { length: 20 },
  (_, idx) => ({
    id: idx,
    xPct: ((idx * 37 + 11) % 92) + 4,
    yPct: ((idx * 53 + 17) % 86) + 6,
    dustSizePx: 2 + (idx % 3),
    bokehSizePx: 28 + ((idx * 13) % 44),
    dxPx: ((idx % 2 === 0 ? 1 : -1) * (10 + ((idx * 7) % 18))),
    dyPx: -(16 + ((idx * 9) % 24)),
    durSec: 12 + (idx % 7) * 2.5,
    delaySec: -((idx * 1.9) % 14),
    warm: idx % 3 !== 0,
  })
);

const THEME_OVERLAY_RGB: Partial<Record<ThemePreset, string>> = {
  'cozy-room': '14, 9, 6',
  'minimal-dark': '6, 6, 8',
  'velvet-noir': '16, 8, 13',
  'midnight-ocean': '5, 11, 18',
  'sakura-haze': '15, 10, 17',
};

function getThemeFallbackPalette(theme: AestheticSettings['theme']): AmbientPalette {
  const def = THEME_DEFINITIONS[theme] || THEME_DEFINITIONS['night-city'];
  return {
    primary: def.ambientPrimary,
    secondary: def.ambientSecondary,
  };
}

export const BackgroundEngine: React.FC<BackgroundEngineProps> = ({
  settings,
  track,
  lyricsOpen,
  customWallpaperVersion,
  paused = false,
}) => {
  const customVideoRef = useRef<HTMLVideoElement | null>(null);
  // Dual-buffer artwork crossfade state
  const targetArt = track.highResArtworkUrl || track.artworkUrl || '';
  const [currentArt, setCurrentArt] = useState<string>(targetArt);
  const [prevArt, setPrevArt] = useState<string>('');
  const [fadeInNewArt, setFadeInNewArt] = useState<boolean>(true);
  const [palette, setPalette] = useState<AmbientPalette>(
    getThemeFallbackPalette(settings.theme)
  );

  // Custom wallpaper state from IndexedDB
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customMediaType, setCustomMediaType] = useState<'image' | 'video' | null>(null);

  // Handle smooth dual-buffer crossfade when album artwork URL changes
  useEffect(() => {
    if (!targetArt || targetArt === currentArt) return;

    setPrevArt(currentArt);
    setCurrentArt(targetArt);
    setFadeInNewArt(false);

    const raf = requestAnimationFrame(() => {
      setFadeInNewArt(true);
    });

    const cleanupTimer = window.setTimeout(() => {
      setPrevArt('');
    }, 950);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cleanupTimer);
    };
  }, [targetArt, currentArt]);

  // Extract dominant ambient glow colors from current album artwork
  useEffect(() => {
    const fallback = getThemeFallbackPalette(settings.theme);
    if (!currentArt || settings.lowGpuMode || settings.theme === 'minimal-dark') {
      setPalette(fallback);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let r1 = 0,
          g1 = 0,
          b1 = 0,
          count1 = 0;
        let r2 = 0,
          g2 = 0,
          b2 = 0,
          count2 = 0;

        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 20 && lum < 235) {
            if (i < data.length / 2) {
              r1 += r;
              g1 += g;
              b1 += b;
              count1++;
            } else {
              r2 += r;
              g2 += g;
              b2 += b;
              count2++;
            }
          }
        }

        if (count1 > 0 && count2 > 0) {
          setPalette({
            primary: `rgba(${Math.round(r1 / count1)}, ${Math.round(
              g1 / count1
            )}, ${Math.round(b1 / count1)}, 0.42)`,
            secondary: `rgba(${Math.round(r2 / count2)}, ${Math.round(
              g2 / count2
            )}, ${Math.round(b2 / count2)}, 0.35)`,
          });
        } else {
          setPalette(fallback);
        }
      } catch {
        setPalette(fallback);
      }
    };
    img.onerror = () => {
      if (!cancelled) setPalette(fallback);
    };
    img.src = currentArt;

    return () => {
      cancelled = true;
    };
  }, [currentArt, settings.theme, settings.lowGpuMode]);

  // Load Custom Wallpaper from IndexedDB (syncing from extension origin when uploaded via Options)
  useEffect(() => {
    let activeObjectUrl = '';
    let mounted = true;

    async function fetchWallpaper() {
      if (settings.customBackgroundType === 'none' || !settings.customBackgroundName) {
        await clearCustomWallpaper();
        if (mounted) {
          setCustomUrl('');
          setCustomMediaType(null);
        }
        return;
      }

      let record = await loadCustomWallpaper();
      const targetRev = settings.customWallpaperVersion || 0;
      const needsExtensionSync =
        !record ||
        record.fileName !== settings.customBackgroundName ||
        (targetRev > 0 && record.updatedAt < targetRev);

      if (needsExtensionSync) {
        const synced = await syncWallpaperFromExtension();
        if (synced) {
          record = synced;
        }
      }

      if (!mounted) return;
      if (record && record.blob) {
        activeObjectUrl = URL.createObjectURL(record.blob);
        setCustomUrl(activeObjectUrl);
        setCustomMediaType(record.mediaType);
      } else {
        setCustomUrl('');
        setCustomMediaType(null);
      }
    }

    fetchWallpaper();

    return () => {
      mounted = false;
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [
    settings.backgroundMode,
    settings.customBackgroundType,
    settings.customBackgroundName,
    settings.customWallpaperVersion,
    customWallpaperVersion,
  ]);

  // Priority Rules:
  // 1. Actual Music Video (promoted directly behind Shadow DOM at z-index: 1)
  // 2. Custom Wallpaper (when mode is 'custom' and file is uploaded)
  // 3. Animated Ambient Album Artwork (fallback whenever no video is active)
  // 4. Minimal Dark Off (when mode is 'off')
  const showVideoLayer =
    (settings.backgroundMode === 'auto' || settings.backgroundMode === 'video') &&
    track.isVideoActive;

  const showCustomLayer =
    settings.backgroundMode === 'custom' && Boolean(customUrl && customMediaType);

  const showAmbientLayer =
    settings.backgroundMode !== 'off' && !showCustomLayer;

  // Toggle native <video class="html5-main-video"> CSS promotion on <html>
  useEffect(() => {
    const videoEl = document.querySelector(
      'video.html5-main-video'
    ) as HTMLVideoElement | null;

    let r1 = 0;
    let r2 = 0;

    if (showVideoLayer) {
      document.documentElement.setAttribute('data-aesthetic-bg', 'video');
      if (videoEl) {
        videoEl.style.filter = `brightness(${settings.backgroundBrightness / 100})`;
      }
      // Notify YouTube ABR & layout that the player container is full-screen
      window.dispatchEvent(new Event('resize'));
      r1 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 180);
      r2 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 650);
    } else {
      document.documentElement.removeAttribute('data-aesthetic-bg');
      if (videoEl) {
        videoEl.style.filter = '';
      }
    }

    return () => {
      window.clearTimeout(r1);
      window.clearTimeout(r2);
      if (videoEl) {
        videoEl.style.filter = '';
      }
    };
  }, [showVideoLayer, settings.backgroundBrightness]);

  const darknessAlpha = Math.min(
    0.92,
    Math.max(
      0.08,
      settings.darknessOverlay / 100 +
        (lyricsOpen && settings.lyricsDimBackground ? 0.18 : 0)
    )
  );

  const driftDurationSec = Math.max(
    10,
    Math.round(26 / Math.max(0.25, settings.animationSpeed || 1))
  );

  const blurPx = settings.lowGpuMode
    ? Math.min(18, Math.max(6, Math.round(settings.blurIntensity * 0.4)))
    : Math.max(12, settings.blurIntensity);
  const customBlurPx = settings.lowGpuMode
    ? Math.min(8, Math.round(settings.blurIntensity * 0.2))
    : Math.round(settings.blurIntensity * 0.35);
  const brightnessRatio = settings.backgroundBrightness / 100;
  const saturatePercent = 105 + Math.round(settings.glowIntensity * 0.75);

  useEffect(() => {
    const vid = customVideoRef.current;
    if (!vid) return;
    if (paused) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [paused, customUrl]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-700 ${
        showVideoLayer ? 'bg-transparent' : 'bg-[#06070a]'
      }`}
    >
      {/* LAYER 1: Dual-Buffer Animated Ambient Album Artwork (Fades smoothly to transparent when native video plays underneath) */}
      {showAmbientLayer && (
        <div
          className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ${
            showVideoLayer ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* Previous Artwork Buffer (Fading Out) */}
          {prevArt && (
            <img
              src={prevArt}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
              style={{
                filter: `blur(${blurPx}px) brightness(${brightnessRatio}) saturate(${saturatePercent}%)`,
                transform: 'scale(1.26)',
                opacity: fadeInNewArt ? 0 : 0.88,
              }}
            />
          )}

          {/* Current Artwork Primary Buffer (Fading In + Slow Orbital Drift) */}
          {currentArt && (
            <img
              src={currentArt}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                settings.reducedMotion ? '' : 'animate-ambient-drift'
              }`}
              style={{
                filter: `blur(${blurPx}px) brightness(${brightnessRatio}) saturate(${saturatePercent}%)`,
                transform: 'scale(1.26)',
                opacity: fadeInNewArt ? 0.88 : 0,
                animationDuration: `${driftDurationSec}s`,
              }}
            />
          )}

          {/* Secondary Counter-Drifting Ambient Color Glow Layer */}
          {currentArt && !settings.lowGpuMode && settings.glowIntensity > 10 && (
            <img
              src={currentArt}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 w-full h-full object-cover mix-blend-screen transition-opacity duration-1000 ${
                settings.reducedMotion ? '' : 'animate-ambient-drift-reverse'
              }`}
              style={{
                filter: `blur(${Math.round(blurPx * 1.35)}px) saturate(${
                  saturatePercent + 35
                }%)`,
                transform: 'scale(1.38)',
                opacity: Math.min(0.55, (settings.glowIntensity / 100) * 0.45),
                animationDuration: `${Math.round(driftDurationSec * 1.25)}s`,
              }}
            />
          )}

          {/* Dynamic Extracted Color Aura Gradient */}
          <div
            className="absolute inset-0 transition-all duration-1000"
            style={{
              background: `radial-gradient(circle at 52% 40%, ${palette.primary} 0%, ${palette.secondary} 52%, rgba(6, 7, 10, 0.90) 100%)`,
            }}
          />
        </div>
      )}

      {/* LAYER 2: Custom User Wallpaper (Image or MP4/WebM Video from IndexedDB) */}
      {showCustomLayer && (
        <div className="absolute inset-0 overflow-hidden transition-opacity duration-700">
          {customMediaType === 'video' ? (
            <video
              ref={customVideoRef}
              src={customUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{
                filter: `blur(${customBlurPx}px) brightness(${brightnessRatio})`,
                transform: customBlurPx > 0 ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          ) : (
            <img
              src={customUrl}
              alt=""
              className={`w-full h-full object-cover ${
                settings.reducedMotion ? '' : 'animate-ambient-drift'
              }`}
              style={{
                filter: `blur(${customBlurPx}px) brightness(${brightnessRatio})`,
                transform: 'scale(1.12)',
              }}
            />
          )}
        </div>
      )}

      {/* LAYER 3: Adjustable Cinematic Darkness Overlay (Sits above native video and ambient layers) */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          backgroundColor: `rgba(${
            THEME_OVERLAY_RGB[settings.theme] ?? '5, 6, 9'
          }, ${darknessAlpha})`,
        }}
      />

      {/* LAYER 3.5: Optional Ambient Aurora Flow */}
      {settings.ambientAurora &&
        !settings.lowGpuMode &&
        !settings.reducedMotion &&
        !paused &&
        settings.backgroundMode !== 'off' && (
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden mix-blend-screen">
            <div
              className="absolute -left-[12%] -top-[18%] w-[72vw] h-[58vh] rounded-full blur-[110px] opacity-[0.26] animate-aurora-a"
              style={{
                background: `radial-gradient(ellipse at center, ${
                  (THEME_DEFINITIONS[settings.theme] || THEME_DEFINITIONS['night-city'])
                    .accentHighlight
                } 0%, rgba(56,189,248,0.34) 46%, transparent 74%)`,
                animationDuration: `${Math.round(24 / Math.max(0.4, settings.animationSpeed || 1))}s`,
              }}
            />
            <div
              className="absolute -right-[10%] -bottom-[16%] w-[68vw] h-[54vh] rounded-full blur-[115px] opacity-[0.24] animate-aurora-b"
              style={{
                background: `radial-gradient(ellipse at center, ${
                  (THEME_DEFINITIONS[settings.theme] || THEME_DEFINITIONS['night-city']).accent
                } 0%, rgba(168,85,247,0.32) 48%, transparent 74%)`,
                animationDuration: `${Math.round(30 / Math.max(0.4, settings.animationSpeed || 1))}s`,
              }}
            />
          </div>
        )}

      {/* LAYER 4: Optional Vignette */}
      {settings.vignette && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.76) 100%)',
          }}
        />
      )}

      {/* LAYER 5: Optional Film Grain */}
      {settings.filmGrain && !settings.lowGpuMode && (
        <div
          className="absolute inset-0 opacity-[0.038] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      )}

      {/* LAYER 6: Optional GPU-Light Ambient Particles (Dust / Bokeh / Rain / Petals / Embers) */}
      {settings.ambientParticles !== 'none' &&
        !settings.lowGpuMode &&
        !settings.reducedMotion &&
        !paused &&
        settings.backgroundMode !== 'off' && (
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
            {PARTICLE_SPECS.map((p) => {
              const mode = settings.ambientParticles;
              const speedFactor = Math.max(0.4, Math.min(2, settings.animationSpeed || 1));
              const themeAccent =
                (THEME_DEFINITIONS[settings.theme] || THEME_DEFINITIONS['night-city'])
                  .accentHighlight;

              if (mode === 'rain') {
                const duration = Math.round(((0.95 + (p.id % 5) * 0.16) / speedFactor) * 10) / 10;
                const streakH = 22 + (p.id % 4) * 7;
                return (
                  <span
                    key={p.id}
                    className="absolute animate-rain-fall rounded-full"
                    style={
                      {
                        left: `${p.xPct}%`,
                        top: '0%',
                        width: '1.5px',
                        height: `${streakH}px`,
                        background:
                          'linear-gradient(180deg, transparent 0%, rgba(196,228,255,0.68) 65%, rgba(255,255,255,0.85) 100%)',
                        '--p-dur': `${duration}s`,
                        '--p-delay': `${-((p.id * 0.27) % 1.8)}s`,
                        '--p-opacity-max': p.warm ? '0.32' : '0.48',
                      } as React.CSSProperties
                    }
                  />
                );
              }

              if (mode === 'petals') {
                const duration = Math.round(((10 + (p.id % 6) * 2.1) / speedFactor) * 10) / 10;
                const w = 8 + (p.id % 4) * 2;
                const h = 5 + (p.id % 3) * 1.5;
                return (
                  <span
                    key={p.id}
                    className="absolute animate-petal-drift"
                    style={
                      {
                        left: `${p.xPct}%`,
                        top: '0%',
                        width: `${w}px`,
                        height: `${h}px`,
                        borderRadius: '72% 28% 68% 32%',
                        background: p.warm
                          ? 'linear-gradient(135deg, rgba(251,182,206,0.88), rgba(244,114,182,0.58))'
                          : 'linear-gradient(135deg, rgba(255,241,246,0.9), rgba(251,207,232,0.68))',
                        boxShadow: '0 0 8px rgba(244,114,182,0.22)',
                        '--p-dx': `${p.dxPx * 2.2}px`,
                        '--p-dx2': `${-p.dxPx * 1.4}px`,
                        '--p-dur': `${duration}s`,
                        '--p-delay': `${p.delaySec}s`,
                        '--p-opacity-max': '0.68',
                      } as React.CSSProperties
                    }
                  />
                );
              }

              if (mode === 'embers') {
                const duration = Math.round(((6.2 + (p.id % 5) * 1.5) / speedFactor) * 10) / 10;
                const size = 2.5 + (p.id % 3) * 1.2;
                return (
                  <span
                    key={p.id}
                    className="absolute rounded-full animate-ember-rise"
                    style={
                      {
                        left: `${p.xPct}%`,
                        bottom: '2%',
                        width: `${size}px`,
                        height: `${size}px`,
                        background: p.warm
                          ? `radial-gradient(circle, #fde68a 0%, ${themeAccent} 58%, transparent 100%)`
                          : 'radial-gradient(circle, #fff7ed 0%, #fb923c 62%, transparent 100%)',
                        boxShadow: `0 0 10px ${p.warm ? themeAccent : '#fb923c'}`,
                        '--p-dx': `${p.dxPx * 1.6}px`,
                        '--p-dur': `${duration}s`,
                        '--p-delay': `${-((p.id * 0.85) % 9)}s`,
                        '--p-opacity-min': '0.40',
                        '--p-opacity-max': '0.82',
                      } as React.CSSProperties
                    }
                  />
                );
              }

              const isBokeh = mode === 'bokeh';
              const size = isBokeh ? p.bokehSizePx : p.dustSizePx;
              const duration = Math.round((p.durSec / speedFactor) * 10) / 10;

              return (
                <span
                  key={p.id}
                  className="absolute rounded-full animate-particle-float"
                  style={
                    {
                      left: `${p.xPct}%`,
                      top: `${p.yPct}%`,
                      width: `${size}px`,
                      height: `${size}px`,
                      background: isBokeh
                        ? `radial-gradient(circle, ${
                            p.warm ? themeAccent : 'rgba(255,255,255,0.85)'
                          } 0%, transparent 72%)`
                        : `radial-gradient(circle, ${
                            p.warm ? themeAccent : 'rgba(255,248,236,0.95)'
                          } 0%, transparent 78%)`,
                      '--p-dx': `${p.dxPx}px`,
                      '--p-dy': `${p.dyPx}px`,
                      '--p-dur': `${duration}s`,
                      '--p-delay': `${p.delaySec}s`,
                      '--p-opacity-min': isBokeh ? '0.07' : '0.18',
                      '--p-opacity-max': isBokeh ? '0.20' : '0.58',
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>
        )}
    </div>
  );
};
