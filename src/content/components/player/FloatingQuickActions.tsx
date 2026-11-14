import React from 'react';
import { Eye, EyeOff, Search, Disc, Minimize2, Maximize2 } from 'lucide-react';
import { BackgroundMode } from '../../../shared/types';

interface FloatingQuickActionsProps {
  zenMode: boolean;
  searchVisible: boolean;
  backgroundMode: BackgroundMode;
  onToggleZenMode: () => void;
  onToggleSearch: () => void;
  onCycleBackgroundMode: () => void;
  onToggleFullscreen: () => void;
}

export const FloatingQuickActions: React.FC<FloatingQuickActionsProps> = ({
  zenMode,
  searchVisible,
  backgroundMode,
  onToggleZenMode,
  onToggleSearch,
  onCycleBackgroundMode,
  onToggleFullscreen,
}) => {
  const isFullscreen = Boolean(document.fullscreenElement);

  const pillClass =
    'w-9 h-9 rounded-full flex items-center justify-center border border-white/15 bg-black/55 hover:bg-white/15 text-zinc-200 hover:text-white backdrop-blur-xl transition-all duration-200 cursor-pointer shadow-lg';

  return (
    <div className="w-full max-w-[760px] flex items-center justify-between px-1 mb-1 z-30 pointer-events-auto">
      {/* Left: Zen / Immersive UI Visibility Toggle */}
      <button
        onClick={onToggleZenMode}
        title={zenMode ? 'Show interface panels' : 'Hide panels (Immersive view)'}
        className={`${pillClass} ${
          zenMode ? 'text-[var(--aesthetic-accent,#E89B63)]' : ''
        }`}
        style={
          zenMode
            ? { borderColor: 'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.6)' }
            : undefined
        }
      >
        {zenMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>

      {/* Right: Search Toggle, Background Mode Cycle, Fullscreen Toggle */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSearch}
          title="Toggle Search Bar"
          className={`${pillClass} ${
            searchVisible ? 'bg-white/15 border-white/30 text-white' : ''
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={onCycleBackgroundMode}
          title={`Background Mode: ${backgroundMode.toUpperCase()} (Click to cycle)`}
          className={pillClass}
        >
          <Disc className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className={pillClass}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
