import React from 'react';
import { Eye, EyeOff, Search, Disc, Minimize2, Maximize2 } from 'lucide-react';
import { BackgroundMode, PlayerPosition } from '../../../shared/types';

interface FloatingQuickActionsProps {
  zenMode: boolean;
  lyricsOpen?: boolean;
  lyricsOnly?: boolean;
  searchVisible: boolean;
  backgroundMode: BackgroundMode;
  playerPosition?: PlayerPosition;
  onToggleEye: () => void;
  onToggleSearch: () => void;
  onCycleBackgroundMode: () => void;
  onToggleFullscreen: () => void;
}

export const FloatingQuickActions: React.FC<FloatingQuickActionsProps> = ({
  zenMode,
  lyricsOpen = false,
  lyricsOnly = false,
  searchVisible,
  backgroundMode,
  playerPosition = 'bottom-center',
  onToggleEye,
  onToggleSearch,
  onCycleBackgroundMode,
  onToggleFullscreen,
}) => {
  const isFullscreen = Boolean(document.fullscreenElement);
  const eyeActive = lyricsOpen ? lyricsOnly : zenMode;

  const containerWidthClass =
    playerPosition === 'bottom-wide'
      ? 'max-w-[1040px]'
      : playerPosition === 'compact-dock'
      ? 'max-w-[680px]'
      : 'max-w-[880px]';

  const pillClass =
    'w-11 h-11 rounded-full flex items-center justify-center border border-white/15 bg-black/55 hover:bg-white/15 text-zinc-200 hover:text-white backdrop-blur-xl transition-all duration-200 cursor-pointer shadow-lg';

  const eyeTitle = lyricsOpen
    ? lyricsOnly
      ? 'Show album card & sidebar'
      : 'Lyrics-only view (hide album card)'
    : zenMode
    ? 'Show interface panels'
    : 'Hide panels (Immersive view)';

  return (
    <div
      className={`w-full ${containerWidthClass} flex items-center justify-between px-1 mb-1 z-30 pointer-events-auto transition-all duration-300`}
    >
      {/* Left: Lyrics-only toggle (in Lyrics Mode) or Zen Visibility Toggle */}
      <button
        type="button"
        onClick={onToggleEye}
        title={eyeTitle}
        aria-pressed={eyeActive}
        className={`${pillClass} ${
          eyeActive ? 'text-[var(--aesthetic-accent,#E89B63)]' : ''
        }`}
        style={
          eyeActive
            ? { borderColor: 'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.6)' }
            : undefined
        }
      >
        {eyeActive ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {/* Right: Search Toggle, Background Mode Cycle, Fullscreen Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSearch}
          title="Toggle Search Bar"
          className={`${pillClass} ${
            searchVisible ? 'bg-white/15 border-white/30 text-white' : ''
          }`}
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onCycleBackgroundMode}
          title={`Background Mode: ${backgroundMode.toUpperCase()} (Click to cycle)`}
          className={pillClass}
        >
          <Disc className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className={pillClass}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5" />
          ) : (
            <Maximize2 className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
