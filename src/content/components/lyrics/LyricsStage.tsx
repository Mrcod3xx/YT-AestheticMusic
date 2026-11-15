import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';
import { LyricsData, LyricsMode } from '../../../shared/types';
import { findActiveSyncedLineIndex } from '../../../shared/lyricsParser';

interface LyricsStageProps {
  open: boolean;
  mode: LyricsMode;
  lyrics: LyricsData;
  currentTimeMs: number;
  timingOffsetMs?: number;
  isPlaying: boolean;
  isVideoActive: boolean;
  carouselVisible: boolean;
  sidebarVisible: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highlightActive: boolean;
  borderRadius: number;
  reducedMotion: boolean;
  onChangeMode: (mode: LyricsMode) => void;
  onSeekSeconds: (seconds: number) => void;
  onRetry: () => void;
}

const LYRIC_MODES: LyricsMode[] = ['focus', 'compact', 'full'];

const ModePills: React.FC<{
  mode: LyricsMode;
  variant?: 'translucent' | 'solid';
  onChangeMode: (mode: LyricsMode) => void;
}> = ({ mode, variant = 'solid', onChangeMode }) => (
  <div
    className={`flex items-center gap-1 ${
      variant === 'translucent'
        ? 'bg-black/45 backdrop-blur-md border border-white/10 rounded-full p-1'
        : ''
    }`}
  >
    {LYRIC_MODES.map((m) => (
      <button
        key={m}
        onClick={() => onChangeMode(m)}
        className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium capitalize transition cursor-pointer ${
          mode === m
            ? variant === 'translucent'
              ? 'bg-white/20 text-white'
              : 'bg-[var(--aesthetic-accent-strong,#C28356)] text-black'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
        }`}
      >
        {m}
      </button>
    ))}
  </div>
);

interface LyricsStatusProps {
  lyrics: LyricsData;
  isVideoActive: boolean;
  compact: boolean;
  onRetry: () => void;
}

const LyricsStatusView: React.FC<LyricsStatusProps> = ({
  lyrics,
  isVideoActive,
  compact,
  onRetry,
}) => {
  if (lyrics.loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${
          compact ? 'py-12' : 'py-16'
        } text-zinc-300`}
      >
        <Loader2 className="w-5 h-5 animate-spin text-[var(--aesthetic-accent,#E89B63)]" />
        <span className="text-xs tracking-wide text-zinc-400">
          Fetching synced lyrics...
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2.5 text-center px-6 ${
        compact ? 'py-10' : 'py-14'
      }`}
    >
      <p className="text-sm font-medium text-zinc-300">
        {lyrics.reason || 'No lyrics available for this song.'}
      </p>
      {isVideoActive && (
        <p className="text-[11.5px] text-zinc-400/90 max-w-sm">
          Official music videos on YouTube Music sometimes have different durations or attach lyrics only to the Song version.
        </p>
      )}
      <button
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-[12.5px] font-medium text-zinc-200 transition cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Retry</span>
      </button>
    </div>
  );
};

const IntroWaitingDots: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div
    className={`flex items-center gap-1.5 ${
      compact ? 'py-1' : 'py-1.5 justify-center'
    } text-white/75`}
  >
    <span className="w-2 h-2 rounded-full bg-white/85 animate-pulse" />
    <span
      className="w-2 h-2 rounded-full bg-white/70 animate-pulse"
      style={{ animationDelay: '220ms' }}
    />
    <span
      className="w-2 h-2 rounded-full bg-white/55 animate-pulse"
      style={{ animationDelay: '440ms' }}
    />
  </div>
);

interface ScrollableLyricsListProps {
  lyrics: LyricsData;
  syncedActiveIdx: number;
  spotlightIdx: number;
  highlightActive: boolean;
  centered: boolean;
  activeLineClass: string;
  lineClass: string;
  lineRefs: React.MutableRefObject<Record<number, HTMLElement | null>>;
  onSelectLine: (idx: number, startTimeMs?: number) => void;
}

const ScrollableLyricsList: React.FC<ScrollableLyricsListProps> = ({
  lyrics,
  syncedActiveIdx,
  spotlightIdx,
  highlightActive,
  centered,
  activeLineClass,
  lineClass,
  lineRefs,
  onSelectLine,
}) => (
  <>
    {lyrics.isSynced && syncedActiveIdx === -1 && (
      <div
        ref={(el) => {
          lineRefs.current[-1] = el;
        }}
        className={`pb-1 ${centered ? 'flex justify-center' : ''}`}
      >
        <IntroWaitingDots compact={!centered} />
      </div>
    )}

    {lyrics.lines.map((line, idx) => {
      if (!line.text) {
        return <div key={idx} className={centered ? 'h-3.5' : 'h-2.5'} />;
      }

      const isActive =
        highlightActive &&
        ((lyrics.isSynced && idx === syncedActiveIdx) ||
          (!lyrics.isSynced && idx === spotlightIdx));
      const isPast = lyrics.isSynced && syncedActiveIdx >= 0 && idx < syncedActiveIdx;
      const isNextSoon =
        lyrics.isSynced &&
        ((syncedActiveIdx === -1 && idx <= 1) ||
          (syncedActiveIdx >= 0 && idx > syncedActiveIdx && idx <= syncedActiveIdx + 2));

      const clickable = lyrics.isSynced && typeof line.startTimeMs === 'number';

      return (
        <p
          key={idx}
          ref={(el) => {
            lineRefs.current[idx] = el;
          }}
          onClick={() => onSelectLine(idx, line.startTimeMs)}
          className={`transition-all duration-200 ${
            centered ? 'px-3 py-0.5 rounded-xl' : ''
          } ${clickable || !lyrics.isSynced ? 'cursor-pointer' : ''} ${
            isActive
              ? `text-white font-bold ${activeLineClass} ${
                  centered ? 'scale-[1.03]' : 'scale-[1.01] origin-left'
                }`
              : isPast
              ? `text-white/35 hover:text-white/75 ${lineClass}`
              : isNextSoon
              ? `text-white/75 hover:text-white ${lineClass}`
              : lyrics.isSynced
              ? `text-white/50 hover:text-white/85 ${lineClass}`
              : `text-zinc-100/90 hover:text-white ${
                  centered ? 'hover:bg-white/[0.04]' : ''
                } ${lineClass}`
          }`}
          style={
            isActive && highlightActive
              ? { textShadow: '0 0 18px rgba(255, 255, 255, 0.42)' }
              : undefined
          }
        >
          {line.text}
        </p>
      );
    })}
  </>
);

export const LyricsStage: React.FC<LyricsStageProps> = ({
  open,
  mode,
  lyrics,
  currentTimeMs,
  timingOffsetMs = 0,
  isPlaying,
  isVideoActive,
  carouselVisible,
  sidebarVisible,
  fontSize,
  highlightActive,
  borderRadius,
  reducedMotion,
  onChangeMode,
  onSeekSeconds,
  onRetry,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Record<number, HTMLElement | null>>({});
  const manualScrollUntilRef = useRef<number>(0);
  const manualScrollTimerRef = useRef<number | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [pausedFollow, setPausedFollow] = useState(false);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [liveTimeMs, setLiveTimeMs] = useState(currentTimeMs);

  useEffect(() => {
    manualScrollUntilRef.current = 0;
  }, [timingOffsetMs]);

  useEffect(() => {
    return () => {
      if (manualScrollTimerRef.current !== null) {
        window.clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, []);

  // Sync baseline timestamp when prop changes (e.g. timeupdate or manual seek)
  useEffect(() => {
    setLiveTimeMs(currentTimeMs);
  }, [currentTimeMs]);

  // High-precision 80ms ticker while active synced lyrics are playing so lip-sync snaps right on beat
  useEffect(() => {
    if (!open || !lyrics.isSynced || !isPlaying || document.hidden) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!videoElRef.current || !videoElRef.current.isConnected) {
        videoElRef.current = document.querySelector(
          'video.html5-main-video'
        ) as HTMLVideoElement | null;
      }
      const videoEl = videoElRef.current;
      if (videoEl && Number.isFinite(videoEl.currentTime)) {
        setLiveTimeMs(videoEl.currentTime * 1000);
      }
    }, 80);

    return () => {
      window.clearInterval(timer);
    };
  }, [open, lyrics.isSynced, isPlaying, lyrics.trackKey]);

  useEffect(() => {
    setSpotlightIdx(0);
    setPausedFollow(false);
    manualScrollUntilRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [lyrics.trackKey]);

  const syncedActiveIdx = useMemo(() => {
    if (!lyrics.isSynced || lyrics.lines.length === 0) return -1;
    return findActiveSyncedLineIndex(lyrics.lines, liveTimeMs, timingOffsetMs);
  }, [lyrics.isSynced, lyrics.lines, liveTimeMs, timingOffsetMs]);

  const scrollTargetIndex = lyrics.isSynced ? syncedActiveIdx : spotlightIdx;

  // Scroll active line into Spotify upper-middle focal sweet spot (~36% height)
  useEffect(() => {
    if (!open || pausedFollow) return;

    const container = scrollContainerRef.current;
    const targetEl = lineRefs.current[scrollTargetIndex];
    if (!container || !targetEl) return;

    const focalOffset = mode === 'focus' ? 0.45 : 0.36;
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetTop =
      container.scrollTop +
      (targetRect.top - containerRect.top) -
      container.clientHeight * focalOffset +
      targetRect.height / 2;

    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [open, mode, scrollTargetIndex, pausedFollow, reducedMotion, lyrics.lines.length]);

  if (!open) return null;

  const markManualScroll = () => {
    if (!lyrics.isSynced) return;
    manualScrollUntilRef.current = Date.now() + 4200;
    setPausedFollow(true);
    if (manualScrollTimerRef.current !== null) {
      window.clearTimeout(manualScrollTimerRef.current);
    }
    manualScrollTimerRef.current = window.setTimeout(() => {
      manualScrollTimerRef.current = null;
      if (Date.now() >= manualScrollUntilRef.current) {
        setPausedFollow(false);
      }
    }, 4300);
  };

  const handleResumeSync = () => {
    manualScrollUntilRef.current = 0;
    setPausedFollow(false);
  };

  const handleSelectLine = (idx: number, startTimeMs?: number) => {
    if (lyrics.isSynced && typeof startTimeMs === 'number') {
      handleResumeSync();
      onSeekSeconds(Math.max(0, (startTimeMs + timingOffsetMs) / 1000));
    } else if (!lyrics.isSynced) {
      setSpotlightIdx(idx);
    }
  };

  const stepStaticSpotlight = (delta: number) => {
    if (lyrics.lines.length === 0) return;
    let next = Math.min(lyrics.lines.length - 1, Math.max(0, spotlightIdx + delta));
    while (
      next >= 0 &&
      next < lyrics.lines.length &&
      !lyrics.lines[next].text &&
      next + delta >= 0 &&
      next + delta < lyrics.lines.length
    ) {
      next += delta;
    }
    setSpotlightIdx(next);
  };

  // Formula-locked directly beside Hero Album Card (same clamp shift + 133px half-card + 37px gap = +170px)
  const stageInlineStyle: React.CSSProperties = carouselVisible
    ? {
        left: 'calc(50% + clamp(-225px, -12.5vw, -150px) + 170px)',
        right: 'clamp(20px, 3vw, 48px)',
      }
    : sidebarVisible
    ? {
        left: 'clamp(310px, 26vw, 405px)',
        right: 'clamp(20px, 3vw, 48px)',
      }
    : {
        left: '24px',
        right: '24px',
      };

  const justifyClass = carouselVisible ? 'justify-start' : 'justify-center';

  const focusFontClass =
    fontSize === 'large'
      ? 'text-xl xl:text-2xl 2xl:text-3xl'
      : fontSize === 'medium'
      ? 'text-lg xl:text-xl 2xl:text-2xl'
      : 'text-base xl:text-lg 2xl:text-xl';

  const panelLineActiveClass =
    fontSize === 'large'
      ? 'text-[18.5px] leading-snug'
      : fontSize === 'medium'
      ? 'text-[16.5px] leading-snug'
      : 'text-[14.5px] leading-snug';

  const panelLineClass =
    fontSize === 'large'
      ? 'text-[15.5px] leading-relaxed'
      : fontSize === 'medium'
      ? 'text-[14.5px] leading-relaxed'
      : 'text-[13px] leading-relaxed';

  const panelRadius = `${Math.min(32, borderRadius + 4)}px`;
  const enterAnimClass = reducedMotion ? '' : 'animate-lyrics-enter';
  const hasLyrics = lyrics.available && lyrics.lines.length > 0;

  if (mode === 'focus') {
    const activeFocusIdx = lyrics.isSynced ? syncedActiveIdx : spotlightIdx;

    return (
      <div
        className={`absolute inset-y-0 flex items-center ${justifyClass} pointer-events-none z-20 ${enterAnimClass}`}
        style={stageInlineStyle}
      >
        <div className="w-full max-w-[540px] flex flex-col items-center justify-center text-center pointer-events-auto">
          {lyrics.loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--aesthetic-accent,#E89B63)]" />
              <span className="text-xs tracking-wider uppercase text-zinc-300/80">
                Loading Synced Lyrics...
              </span>
            </div>
          ) : !hasLyrics ? (
            <div className="glass-panel rounded-3xl px-8 py-6 max-w-md">
              <LyricsStatusView
                lyrics={lyrics}
                isVideoActive={isVideoActive}
                compact
                onRetry={onRetry}
              />
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <div
                ref={scrollContainerRef}
                onWheel={markManualScroll}
                onTouchMove={markManualScroll}
                className="relative w-full max-h-[300px] overflow-y-auto px-3 py-14 space-y-3 custom-queue-scroll"
                style={{
                  maskImage:
                    'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
                }}
              >
                {lyrics.isSynced && syncedActiveIdx === -1 && (
                  <div
                    ref={(el) => {
                      lineRefs.current[-1] = el;
                    }}
                    className="py-2 flex flex-col items-center gap-1"
                  >
                    <IntroWaitingDots />
                  </div>
                )}

                {lyrics.lines.map((line, idx) => {
                  if (!line.text) {
                    return <div key={idx} className="h-3" />;
                  }

                  const isActive = idx === activeFocusIdx;
                  const isPast = lyrics.isSynced && syncedActiveIdx >= 0 && idx < syncedActiveIdx;
                  const clickable = lyrics.isSynced && typeof line.startTimeMs === 'number';

                  return (
                    <button
                      key={idx}
                      ref={(el) => {
                        lineRefs.current[idx] = el;
                      }}
                      onClick={() => handleSelectLine(idx, line.startTimeMs)}
                      className={`block w-full text-center transition-all duration-200 ${
                        clickable || !lyrics.isSynced ? 'cursor-pointer' : ''
                      } ${isActive ? 'py-2.5 px-6 rounded-lg' : 'py-1 px-4'}`}
                      style={
                        isActive
                          ? {
                              background:
                                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 22%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0.14) 78%, rgba(255,255,255,0) 100%)',
                              backdropFilter: 'blur(6px)',
                            }
                          : undefined
                      }
                    >
                      <span
                        className={
                          isActive
                            ? `${focusFontClass} font-extrabold uppercase tracking-[0.06em] text-white leading-tight block`
                            : isPast
                            ? 'text-sm font-medium text-white/32 hover:text-white/65 leading-snug block'
                            : 'text-sm xl:text-base font-medium text-white/62 hover:text-white/90 leading-snug block'
                        }
                        style={
                          isActive && highlightActive
                            ? {
                                textShadow:
                                  '0 0 24px rgba(255, 255, 255, 0.48), 0 6px 24px rgba(0, 0, 0, 0.85)',
                              }
                            : { textShadow: '0 2px 10px rgba(0, 0, 0, 0.7)' }
                        }
                      >
                        {line.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2.5 flex-wrap justify-center">
            {hasLyrics && !lyrics.isSynced && (
              <div className="flex items-center gap-1 bg-black/45 backdrop-blur-md border border-white/10 rounded-full p-1">
                <button
                  onClick={() => stepStaticSpotlight(-1)}
                  title="Previous lyric line"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => stepStaticSpotlight(1)}
                  title="Next lyric line"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}

            {lyrics.isSynced && pausedFollow && (
              <button
                onClick={handleResumeSync}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[var(--aesthetic-accent,#E89B63)] cursor-pointer border"
                style={{
                  backgroundColor: 'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.30)',
                  borderColor: 'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.70)',
                }}
              >
                Follow Sync
              </button>
            )}

            <ModePills mode={mode} variant="translucent" onChangeMode={onChangeMode} />

            {lyrics.source && (
              <span className="hidden sm:inline-block px-3 py-1.5 rounded-full bg-black/40 border border-white/10 text-[11px] text-zinc-400">
                {lyrics.source}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isCompact = mode === 'compact';

  return (
    <div
      className={`absolute inset-y-0 flex items-center ${justifyClass} pointer-events-none z-20 ${enterAnimClass}`}
      style={stageInlineStyle}
    >
      <div
        className={`w-full glass-panel flex flex-col justify-between pointer-events-auto ${
          isCompact
            ? 'max-w-[445px] h-[315px] p-5'
            : 'max-w-[540px] h-[410px] max-h-[48vh] p-6'
        }`}
        style={{ borderRadius: panelRadius }}
      >
        <div
          className={`flex items-center justify-between border-b border-white/10 shrink-0 ${
            isCompact ? 'pb-2.5 mb-3' : 'pb-3 mb-4'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {lyrics.isSynced && (
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"
                title="Live synced lyrics active"
              />
            )}
            <span className="text-xs font-semibold text-white uppercase tracking-wider shrink-0">
              {lyrics.loading
                ? 'Loading...'
                : lyrics.available
                ? lyrics.isSynced
                  ? isCompact
                    ? 'Synced Lyrics'
                    : 'Full Synced Lyrics'
                  : isCompact
                  ? 'Lyrics'
                  : 'Full Lyrics'
                : 'Lyrics Unavailable'}
            </span>
            {!isCompact && lyrics.source && (
              <span className="text-[11px] text-zinc-400 truncate">• {lyrics.source}</span>
            )}
            {lyrics.isSynced && pausedFollow && (
              <button
                onClick={handleResumeSync}
                className="px-3 py-1 rounded-full text-[11.5px] font-medium text-[var(--aesthetic-accent,#E89B63)] cursor-pointer shrink-0 border"
                style={{
                  backgroundColor: 'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.25)',
                  borderColor: 'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.60)',
                }}
              >
                Follow Sync
              </button>
            )}
          </div>
          <ModePills mode={mode} onChangeMode={onChangeMode} />
        </div>

        <div
          ref={scrollContainerRef}
          onWheel={markManualScroll}
          onTouchMove={markManualScroll}
          className={`relative flex-1 overflow-y-auto pr-2 custom-queue-scroll ${
            isCompact ? 'space-y-2.5' : 'space-y-3 text-center'
          }`}
        >
          {lyrics.loading || !hasLyrics ? (
            <LyricsStatusView
              lyrics={lyrics}
              isVideoActive={isVideoActive}
              compact={isCompact}
              onRetry={onRetry}
            />
          ) : (
            <ScrollableLyricsList
              lyrics={lyrics}
              syncedActiveIdx={syncedActiveIdx}
              spotlightIdx={spotlightIdx}
              highlightActive={highlightActive}
              centered={!isCompact}
              activeLineClass={panelLineActiveClass}
              lineClass={panelLineClass}
              lineRefs={lineRefs}
              onSelectLine={handleSelectLine}
            />
          )}
        </div>

        {isCompact && lyrics.source && hasLyrics && (
          <div className="pt-2 mt-1.5 border-t border-white/10 text-[10.5px] text-zinc-400 flex items-center justify-between shrink-0">
            <span>{lyrics.source}</span>
            {lyrics.isSynced && <span className="text-zinc-500">Click any line to seek</span>}
          </div>
        )}
      </div>
    </div>
  );
};
