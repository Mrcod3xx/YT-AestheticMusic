import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { QueueTrackItem, StageStyle, TrackMetadata } from '../../../shared/types';

interface AlbumCarousel3DProps {
  visible: boolean;
  stageStyle?: StageStyle;
  lyricsOpen: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
  currentTrack: TrackMetadata;
  queue: QueueTrackItem[];
  borderRadius: number;
  onSelectQueueIndex: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onCycleLyricsMode?: () => void;
}

interface CarouselSlot {
  offset: -2 | -1 | 0 | 1 | 2;
  item: QueueTrackItem;
}

const PREVIEW_IDLE_RESET_MS = 6000;
const WHEEL_THRESHOLD = 36;
const WHEEL_STEP_COOLDOWN_MS = 95;
const DRAG_STEP_THRESHOLD_PX = 54;

export const AlbumCarousel3D: React.FC<AlbumCarousel3DProps> = ({
  visible,
  stageStyle = 'carousel',
  lyricsOpen,
  reducedMotion = false,
  paused = false,
  currentTrack,
  queue,
  borderRadius,
  onSelectQueueIndex,
  onPrevious,
  onNext,
  onTogglePlay,
  onCycleLyricsMode,
}) => {
  const [previewDelta, setPreviewDelta] = useState(0);
  const wheelAccumRef = useRef(0);
  const lastWheelStepAtRef = useRef(0);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    didSwipe: boolean;
  }>({ active: false, pointerId: -1, startX: 0, didSwipe: false });

  const activeIdx = queue.findIndex((q) => q.isSelected);
  const centerIndex = activeIdx >= 0 ? activeIdx : 0;

  useEffect(() => {
    setPreviewDelta(0);
  }, [centerIndex, currentTrack.id, stageStyle, lyricsOpen]);

  useEffect(() => {
    if (previewDelta === 0) return;
    const timer = window.setTimeout(() => {
      setPreviewDelta(0);
    }, PREVIEW_IDLE_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [previewDelta]);

  if (!visible) return null;

  const browsedCenter =
    queue.length > 0
      ? (((centerIndex + previewDelta) % queue.length) + queue.length) % queue.length
      : 0;
  const isPreviewing = previewDelta !== 0 && queue.length > 1;

  const getTrackAtOffset = (offset: -2 | -1 | 0 | 1 | 2): QueueTrackItem => {
    if (queue.length === 0) {
      return {
        index: 0,
        title: currentTrack.title,
        artist: currentTrack.artist,
        duration: '',
        artworkUrl: currentTrack.highResArtworkUrl || currentTrack.artworkUrl,
        highResArtworkUrl: currentTrack.highResArtworkUrl || currentTrack.artworkUrl,
        isSelected: offset === 0,
        isPlaying: currentTrack.isPlaying,
      };
    }

    const len = queue.length;
    const wrappedIndex = (((browsedCenter + offset) % len) + len) % len;
    const candidate = queue[wrappedIndex];

    if (offset === 0 && !isPreviewing) {
      return {
        ...candidate,
        title: currentTrack.title || candidate.title,
        artist: currentTrack.artist || candidate.artist,
        highResArtworkUrl:
          currentTrack.highResArtworkUrl ||
          candidate.highResArtworkUrl ||
          candidate.artworkUrl,
      };
    }
    return candidate;
  };

  const allOffsets: (-2 | -1 | 0 | 1 | 2)[] = [-2, -1, 0, 1, 2];
  const visibleOffsets: (-2 | -1 | 0 | 1 | 2)[] =
    stageStyle !== 'carousel' || queue.length <= 1
      ? [0]
      : queue.length === 2
      ? [0, 1]
      : queue.length <= 4
      ? [-1, 0, 1]
      : allOffsets;

  const slots: CarouselSlot[] = visibleOffsets.map((offset) => ({
    offset,
    item: getTrackAtOffset(offset),
  }));

  const stepPreview = (delta: -1 | 1) => {
    if (lyricsOpen || queue.length <= 1) return;
    setPreviewDelta((prev) => {
      const next = prev + delta;
      // Normalize modulo queue length to nearest signed offset from active center
      const normalized = (((next % queue.length) + queue.length) % queue.length);
      return normalized === 0 ? 0 : normalized > queue.length / 2 ? normalized - queue.length : normalized;
    });
  };

  const handleCardClick = (slot: CarouselSlot) => {
    if (dragStateRef.current.didSwipe) {
      dragStateRef.current.didSwipe = false;
      return;
    }

    if (slot.offset === 0) {
      if (isPreviewing) {
        onSelectQueueIndex(slot.item.index);
        setPreviewDelta(0);
      } else {
        onTogglePlay();
      }
    } else if (slot.offset === -1 && queue.length <= 1) {
      onPrevious();
    } else if (slot.offset === 1 && queue.length <= 1) {
      onNext();
    } else {
      onSelectQueueIndex(slot.item.index);
      setPreviewDelta(0);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (lyricsOpen || queue.length <= 1) return;
    const dominantDelta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(dominantDelta) < 2) return;

    e.preventDefault();
    wheelAccumRef.current += dominantDelta;

    const now = Date.now();
    if (
      Math.abs(wheelAccumRef.current) >= WHEEL_THRESHOLD &&
      now - lastWheelStepAtRef.current >= WHEEL_STEP_COOLDOWN_MS
    ) {
      const direction: -1 | 1 = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      lastWheelStepAtRef.current = now;
      stepPreview(direction);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || lyricsOpen || queue.length <= 1) return;
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      didSwipe: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) >= DRAG_STEP_THRESHOLD_PX) {
      drag.didSwipe = true;
      drag.startX = e.clientX;
      stepPreview(dx < 0 ? 1 : -1);
    }
  };

  const endPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId === e.pointerId) {
      dragStateRef.current.active = false;
    }
  };

  const getSlotStyle = (offset: -2 | -1 | 0 | 1 | 2): React.CSSProperties => {
    if (lyricsOpen) {
      if (offset === 0) {
        return {
          transform:
            stageStyle === 'vinyl'
              ? 'translate3d(clamp(-275px, -14vw, -185px), 0px, 60px) rotateY(8deg) scale(0.88)'
              : 'translate3d(clamp(-225px, -12.5vw, -150px), 0px, 60px) rotateY(14deg) scale(0.90)',
          zIndex: 30,
          opacity: 1,
          pointerEvents: 'auto',
        };
      }
      return {
        transform:
          'translate3d(clamp(-225px, -12.5vw, -150px), 0px, -80px) rotateY(14deg) scale(0.62)',
        zIndex: 5,
        opacity: 0,
        pointerEvents: 'none',
      };
    }

    if (stageStyle === 'vinyl' && offset === 0) {
      return {
        transform: 'translate3d(-72px, 0px, 95px) rotateY(0deg) scale(1)',
        zIndex: 30,
        opacity: 1,
        filter: 'brightness(1.04)',
      };
    }

    switch (offset) {
      case 0:
        return {
          transform: 'translate3d(0px, 0px, 95px) rotateY(0deg) scale(1)',
          zIndex: 30,
          opacity: 1,
          filter: 'brightness(1.04)',
        };
      case -1:
        return {
          transform: 'translate3d(-218px, 8px, 14px) rotateY(15deg) scale(0.84)',
          zIndex: 20,
          opacity: 0.94,
          filter: 'brightness(0.84)',
        };
      case 1:
        return {
          transform: 'translate3d(218px, 8px, 14px) rotateY(-15deg) scale(0.84)',
          zIndex: 20,
          opacity: 0.94,
          filter: 'brightness(0.84)',
        };
      case -2:
        return {
          transform: 'translate3d(-388px, 16px, -45px) rotateY(24deg) scale(0.70)',
          zIndex: 10,
          opacity: 0.78,
          filter: 'brightness(0.68)',
        };
      case 2:
        return {
          transform: 'translate3d(388px, 16px, -45px) rotateY(-24deg) scale(0.70)',
          zIndex: 10,
          opacity: 0.78,
          filter: 'brightness(0.68)',
        };
    }
  };

  const vinylSpinning = currentTrack.isPlaying && !paused && !isPreviewing;

  return (
    <div
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      className="relative flex flex-col items-center justify-center select-none z-20 pointer-events-auto"
      style={{
        width: '960px',
        height: '415px',
        perspective: '1450px',
        touchAction: 'pan-y',
      }}
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {slots.map((slot) => {
          const isCenter = slot.offset === 0;
          const cardStyle = getSlotStyle(slot.offset);
          const centerArt = slot.item.highResArtworkUrl || slot.item.artworkUrl;

          return (
            <div
              key={`slot-${slot.offset}`}
              onClick={() => handleCardClick(slot)}
              className="group/stagecard absolute overflow-visible cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center"
              style={{
                width: '296px',
                ...cardStyle,
              }}
            >
              <div className="relative w-full overflow-visible">
                {/* Spinning Vinyl Turntable Disc emerging from behind center sleeve in Vinyl stage mode */}
                {isCenter && stageStyle === 'vinyl' && (
                  <div
                    aria-hidden="true"
                    data-vinyl-disc={vinylSpinning ? 'spinning' : 'paused'}
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center shadow-[0_26px_60px_rgba(0,0,0,0.88)] ${
                      lyricsOpen
                        ? 'left-[144px] w-[236px] h-[236px]'
                        : 'left-[162px] w-[280px] h-[280px]'
                    }`}
                    style={{
                      zIndex: 1,
                    }}
                  >
                  {/* Entire Grooved Platter + Center Artwork Label rotate together on playback */}
                  <div
                    className={`relative w-full h-full rounded-full flex items-center justify-center ${
                      reducedMotion ? '' : 'animate-vinyl-spin'
                    }`}
                    style={{
                      background:
                        'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 34%, transparent 35%), repeating-radial-gradient(circle at center, #08090d 0px, #08090d 2px, rgba(255,255,255,0.095) 2.6px, #161821 4.2px)',
                      border: '1.5px solid rgba(255,255,255,0.28)',
                      boxShadow:
                        'inset 0 0 18px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.08)',
                      ...(reducedMotion
                        ? {}
                        : {
                            animationPlayState: vinylSpinning ? 'running' : 'paused',
                          }),
                    }}
                  >
                    {/* Asymmetric groove highlights so platter rotation is unmistakably visible */}
                    <div
                      className="absolute inset-[3px] rounded-full pointer-events-none"
                      style={{
                        background:
                          'conic-gradient(from 25deg, rgba(255,255,255,0.22) 0deg, rgba(255,255,255,0.06) 18deg, transparent 52deg, transparent 178deg, rgba(255,255,255,0.18) 202deg, rgba(255,255,255,0.04) 226deg, transparent 260deg, rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.16) 318deg, transparent 348deg)',
                        maskImage:
                          'radial-gradient(circle, transparent 0%, transparent 36%, black 38%, black 97%, transparent 100%)',
                        WebkitMaskImage:
                          'radial-gradient(circle, transparent 0%, transparent 36%, black 38%, black 97%, transparent 100%)',
                      }}
                    />
                    {/* Run-out lead groove ring */}
                    <div className="absolute inset-[28%] rounded-full border border-white/15 pointer-events-none" />

                    {/* Rotating Center Label + Strobe Dot + Spindle */}
                    <div
                      className={`relative rounded-full overflow-hidden flex items-center justify-center ring-2 ring-white/30 shadow-[0_0_16px_rgba(0,0,0,0.85)] bg-zinc-900 ${
                        lyricsOpen ? 'w-[84px] h-[84px]' : 'w-[104px] h-[104px]'
                      }`}
                    >
                      {centerArt ? (
                        <img
                          src={centerArt}
                          alt=""
                          className="w-full h-full object-cover brightness-95"
                          draggable={false}
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.85), rgba(24,24,28,0.95))',
                          }}
                        />
                      )}
                      <div className="absolute top-[7px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-white/80 shadow" />
                      {/* Center Spindle Hole */}
                      <div className="absolute w-[18px] h-[18px] rounded-full bg-zinc-200/85 border border-black/50 flex items-center justify-center shadow-md">
                        <div className="w-[8px] h-[8px] rounded-full bg-[#090a0d]" />
                      </div>
                    </div>
                  </div>

                  {/* Stationary rim sheen to ground the record in studio lighting */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 28%, transparent 72%, rgba(255,255,255,0.08) 100%)',
                    }}
                  />
                </div>
              )}

              {/* Frosted Glass Album Card Container */}
              <div
                className="relative w-full p-3.5 pb-5 flex flex-col items-center transition-all duration-300 hover:border-white/35"
                style={{
                  zIndex: 2,
                  borderRadius: `${borderRadius + 4}px`,
                  background: isCenter
                    ? 'linear-gradient(180deg, rgba(var(--aesthetic-card-top-rgb, 44, 52, 58), var(--aesthetic-card-top-alpha, 0.78)) 0%, rgba(var(--aesthetic-card-bottom-rgb, 24, 30, 35), var(--aesthetic-card-bottom-alpha, 0.90)) 100%)'
                    : 'linear-gradient(180deg, rgba(var(--aesthetic-panel-rgb, 34, 37, 44), var(--aesthetic-panel-alpha, 0.74)) 0%, rgba(var(--aesthetic-card-bottom-rgb, 19, 21, 26), 0.88) 100%)',
                  backdropFilter: 'blur(28px) saturate(145%)',
                  WebkitBackdropFilter: 'blur(28px) saturate(145%)',
                  border: isCenter
                    ? '1.5px solid rgba(var(--aesthetic-accent-hi-rgb, 255, 255, 255), 0.38)'
                    : '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: isCenter
                    ? '0 30px 75px rgba(0, 0, 0, 0.82), inset 0 1px 1px rgba(255, 255, 255, 0.28)'
                    : '0 22px 50px rgba(0, 0, 0, 0.68)',
                }}
              >
                {/* Square Rounded Album Artwork */}
                <div
                  className="w-full aspect-square overflow-hidden relative bg-zinc-900 shadow-inner"
                  style={{
                    borderRadius: `${Math.max(12, borderRadius - 4)}px`,
                  }}
                >
                  <img
                    src={centerArt}
                    alt={slot.item.title}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />

                  {/* Subtle Queue Preview Overlay Hint when scrolling/swiping without interrupting playback */}
                  {isCenter && isPreviewing && (
                    <div className="absolute inset-x-2.5 bottom-2.5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 flex items-center justify-between gap-2 text-[11px] font-medium text-white shadow-lg">
                      <span className="truncate">Previewing queue • Click to play</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDelta(0);
                        }}
                        title="Return to active track"
                        className="text-zinc-300 hover:text-white shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Song Title & Artist Inside Card Bottom */}
                <div className="w-full text-center px-2.5 pt-3.5">
                  <div
                    className={`font-semibold text-white truncate tracking-tight ${
                      isCenter ? 'text-[18.5px]' : 'text-[16px]'
                    }`}
                  >
                    {slot.item.title}
                  </div>
                  <div
                    className={`text-zinc-300/80 truncate mt-1 ${
                      isCenter ? 'text-[14px]' : 'text-[12.5px]'
                    }`}
                  >
                    {slot.item.artist}
                  </div>
                </div>

                {/* Subtle quick step chevrons for Minimal / Vinyl modes on hover */}
                {isCenter && stageStyle !== 'carousel' && !lyricsOpen && queue.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stepPreview(-1);
                      }}
                      title="Preview previous track in queue"
                      className="opacity-0 group-hover/stagecard:opacity-100 transition-opacity absolute -left-12 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-white/20 border border-white/15 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stepPreview(1);
                      }}
                      title="Preview next track in queue"
                      className={`opacity-0 group-hover/stagecard:opacity-100 transition-opacity absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-white/20 border border-white/15 flex items-center justify-center text-zinc-200 hover:text-white cursor-pointer ${
                        stageStyle === 'vinyl' ? '-right-[160px]' : '-right-12'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              </div>

              {/* "Other lyrics" / Lyrics Mode switcher pill shown beneath active card in Lyrics Mode */}
              {isCenter && lyricsOpen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCycleLyricsMode?.();
                  }}
                  title="Switch lyrics view (Focus / Compact / Full)"
                  className="mt-4 px-5 py-2.5 rounded-full flex items-center gap-2 text-[14px] font-medium text-zinc-200 hover:text-white border border-white/15 bg-black/55 hover:bg-white/15 backdrop-blur-xl shadow-lg transition cursor-pointer"
                >
                  <Search className="w-4 h-4 text-zinc-300" />
                  <span>Other lyrics</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Dots synced with queue */}
      {!lyricsOpen && queue.length > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1 z-30">
          {(() => {
            const maxDots = 9;
            const total = queue.length;
            const start =
              total <= maxDots
                ? 0
                : Math.max(0, Math.min(total - maxDots, browsedCenter - 4));
            const visibleSlice = queue.slice(start, start + maxDots);
            return visibleSlice.map((qItem, relIdx) => {
              const absIdx = start + relIdx;
              const isCurrent = absIdx === centerIndex;
              const isFocused = absIdx === browsedCenter;
              return (
                <button
                  key={`dot-${qItem.index}-${absIdx}`}
                  type="button"
                  onClick={() => {
                    setPreviewDelta(0);
                    onSelectQueueIndex(qItem.index);
                  }}
                  title={qItem.title}
                  aria-label={`Jump to ${qItem.title}`}
                  className="p-2 rounded-full flex items-center justify-center hover:bg-white/10 transition cursor-pointer group/dot"
                >
                  <span
                    className={`rounded-full transition-all duration-300 ${
                      isFocused
                        ? 'w-7 h-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]'
                        : isCurrent
                        ? 'w-4 h-2 bg-[var(--aesthetic-accent-strong,#C28356)]'
                        : 'w-2.5 h-2 bg-white/35 group-hover/dot:bg-white/75'
                    }`}
                  />
                </button>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};
