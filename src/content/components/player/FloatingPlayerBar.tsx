import React, { useRef, useState } from 'react';
import {
  Rewind,
  FastForward,
  Play,
  Pause,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  MoreHorizontal,
  MessageSquareQuote,
  SlidersHorizontal,
  Moon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AestheticSettings, TrackMetadata } from '../../../shared/types';

interface FloatingPlayerBarProps {
  track: TrackMetadata;
  settings: AestheticSettings;
  lyricsOpen: boolean;
  settingsOpen: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onToggleLike: () => void;
  onSeek: (newTimeSeconds: number) => void;
  onVolumeChange: (newVolume: number) => void;
  onToggleMute: () => void;
  onToggleLyrics: () => void;
  onToggleSidebar: () => void;
  onToggleSettingsPopover: () => void;
  onCycleTheme: () => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const FloatingPlayerBar: React.FC<FloatingPlayerBarProps> = ({
  track,
  settings,
  lyricsOpen,
  settingsOpen,
  onTogglePlay,
  onPrevious,
  onNext,
  onToggleRepeat,
  onToggleShuffle,
  onToggleLike,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleLyrics,
  onToggleSidebar,
  onToggleSettingsPopover,
  onCycleTheme,
}) => {
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement | null>(null);

  const displayedTime = scrubTime !== null ? scrubTime : track.currentTime;
  const progressPercent =
    track.duration > 0
      ? Math.min(100, Math.max(0, (displayedTime / track.duration) * 100))
      : 0;

  const calculateSeekSeconds = (clientX: number): number => {
    if (!seekBarRef.current || track.duration <= 0) return 0;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * track.duration;
  };

  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (track.duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const nextSec = calculateSeekSeconds(e.clientX);
    setScrubTime(nextSec);
  };

  const handleSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubTime === null) return;
    setScrubTime(calculateSeekSeconds(e.clientX));
  };

  const handleSeekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubTime === null) return;
    const finalSec = calculateSeekSeconds(e.clientX);
    setScrubTime(null);
    onSeek(finalSec);
  };

  const glassAlpha = Math.min(0.92, Math.max(0.35, settings.playerGlassOpacity / 100));
  const barSizeClass =
    settings.playerPosition === 'bottom-wide'
      ? 'max-w-[1040px] h-[76px] px-7 gap-5'
      : settings.playerPosition === 'compact-dock'
      ? 'max-w-[680px] h-[68px] px-5 gap-3.5'
      : 'max-w-[880px] h-[76px] px-6 gap-4';
  const miniArtClass =
    settings.thumbnailSize === 'small'
      ? 'w-9 h-9'
      : settings.thumbnailSize === 'large'
      ? 'w-12 h-12'
      : 'w-10 h-10';

  return (
    <div
      className={`relative w-full ${barSizeClass} rounded-full flex items-center justify-between z-30 pointer-events-auto select-none transition-all duration-300`}
      style={{
        background: `rgba(var(--aesthetic-player-rgb, 34, 36, 42), ${glassAlpha})`,
        backdropFilter: 'blur(28px) saturate(165%)',
        WebkitBackdropFilter: 'blur(28px) saturate(165%)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        boxShadow:
          '0 22px 55px rgba(0, 0, 0, 0.72), inset 0 1px 1px rgba(255, 255, 255, 0.18)',
      }}
    >
      {/* Left: YTM Badge + Transport Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Red YouTube Music Circular Emblem */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md mr-1"
          style={{
            background: 'linear-gradient(135deg, #FF2A54 0%, #D9143A 100%)',
          }}
          title="Connected to YouTube Music"
        >
          <div className="w-[18px] h-[18px] rounded-full border border-white/90 flex items-center justify-center">
            <Play className="w-2.5 h-2.5 text-white fill-white ml-[0.5px]" />
          </div>
        </div>

        {/* Previous / Rewind */}
        <button
          onClick={onPrevious}
          title="Previous Track"
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 transition transform active:scale-90 cursor-pointer"
        >
          <Rewind className="w-[22px] h-[22px] fill-current" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          title={track.isPlaying ? 'Pause' : 'Play'}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-white/[0.12] hover:bg-white/[0.22] text-white hover:scale-105 transition transform active:scale-95 cursor-pointer"
        >
          {track.isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        {/* Next / Fast-Forward */}
        <button
          onClick={onNext}
          title="Next Track"
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 transition transform active:scale-90 cursor-pointer"
        >
          <FastForward className="w-[22px] h-[22px] fill-current" />
        </button>

        {/* Shuffle & Repeat */}
        {settings.showShuffleRepeat && (
          <>
            <button
              onClick={onToggleShuffle}
              title={`Shuffle: ${track.shuffleOn ? 'ON' : 'OFF'}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition cursor-pointer ${
                track.shuffleOn
                  ? 'text-[var(--aesthetic-accent,#E89B63)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Shuffle className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={onToggleRepeat}
              title={`Repeat: ${track.repeatMode}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition cursor-pointer ${
                track.repeatMode !== 'NONE'
                  ? 'text-[var(--aesthetic-accent,#E89B63)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {track.repeatMode === 'ONE' ? (
                <Repeat1 className="w-[18px] h-[18px]" />
              ) : (
                <Repeat className="w-[18px] h-[18px]" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Center: Mini Artwork + Track Title/Artist + Integrated Draggable Progress Bar */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={track.artworkUrl}
            alt={track.title}
            className={`${miniArtClass} rounded-lg object-cover shrink-0 border border-white/15 shadow`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14.5px] font-semibold text-white truncate">
                {track.title}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                {formatSeconds(displayedTime)} / {formatSeconds(track.duration)}
              </span>
            </div>
            <div className="text-[12.5px] text-zinc-400 truncate">
              {track.artist}
              {track.album ? ` — ${track.album}` : ''}
            </div>
          </div>
        </div>

        {/* Draggable & Clickable Seek Bar with Expanded Pointer Hit Area */}
        <div
          ref={seekBarRef}
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          className="w-full py-1.5 -my-1.5 cursor-pointer group/seek relative"
          title="Click or drag to seek"
        >
          <div className="w-full h-[5px] group-hover/seek:h-[8px] bg-white/20 rounded-full overflow-hidden transition-all relative">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right: Utility Action Icons (Like, Queue, Lyrics, Settings, Theme, Volume) */}
      <div className="flex items-center gap-1 shrink-0">
        {settings.showLikeButton && (
          <button
            onClick={onToggleLike}
            title={track.isLiked ? 'Unlike' : 'Like song'}
            className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition cursor-pointer ${
              track.isLiked
                ? 'text-[#FF2A54]'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Heart
              className={`w-5 h-5 ${track.isLiked ? 'fill-current' : ''}`}
            />
          </button>
        )}

        {/* Queue Sidebar Toggle (⋯) */}
        <button
          onClick={onToggleSidebar}
          title="Toggle Continue Playing Sidebar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>

        {/* Lyrics Button */}
        {settings.lyricsEnabled && (
          <button
            onClick={onToggleLyrics}
            title="Toggle Lyrics Mode"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              lyricsOpen
                ? 'bg-white text-black shadow-[0_0_14px_rgba(255,255,255,0.6)]'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquareQuote className="w-5 h-5" />
          </button>
        )}

        {/* Studio Visual Controls (🎚️) */}
        <button
          onClick={onToggleSettingsPopover}
          title="Aesthetic Studio Controls"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
            settingsOpen
              ? 'bg-[var(--aesthetic-accent-strong,#C28356)] text-black'
              : 'text-zinc-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>

        {/* Theme Preset Cycle (🌙) */}
        <button
          onClick={onCycleTheme}
          title={`Theme: ${settings.theme} (Click to switch)`}
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-[var(--aesthetic-accent,#E89B63)] hover:bg-white/10 transition cursor-pointer"
        >
          <Moon className="w-5 h-5" />
        </button>

        {/* Volume Button + Popover Slider */}
        {settings.showVolumeControl && (
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumePopover(true)}
            onMouseLeave={() => setShowVolumePopover(false)}
          >
            <button
              onClick={onToggleMute}
              title={track.isMuted ? 'Unmute' : `Volume: ${Math.round(track.volume)}%`}
              className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              {track.isMuted || track.volume === 0 ? (
                <VolumeX className="w-5 h-5 text-zinc-500" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {showVolumePopover && (
              <div
                className="absolute bottom-12 right-0 px-4 py-3 rounded-xl flex items-center gap-3 z-50"
                style={{
                  background: 'rgba(18, 19, 25, 0.94)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                }}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={track.isMuted ? 0 : track.volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="w-32 h-2 bg-zinc-700 rounded-lg cursor-pointer accent-white"
                />
                <span className="text-xs font-mono text-zinc-300 w-9 text-right">
                  {Math.round(track.isMuted ? 0 : track.volume)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
