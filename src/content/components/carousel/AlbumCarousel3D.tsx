import React from 'react';
import { Search } from 'lucide-react';
import { QueueTrackItem, TrackMetadata } from '../../../shared/types';

interface AlbumCarousel3DProps {
  visible: boolean;
  lyricsOpen: boolean;
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

export const AlbumCarousel3D: React.FC<AlbumCarousel3DProps> = ({
  visible,
  lyricsOpen,
  currentTrack,
  queue,
  borderRadius,
  onSelectQueueIndex,
  onPrevious,
  onNext,
  onTogglePlay,
  onCycleLyricsMode,
}) => {
  if (!visible) return null;

  const activeIdx = queue.findIndex((q) => q.isSelected);
  const centerIndex = activeIdx >= 0 ? activeIdx : 0;

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
    const wrappedIndex = (((centerIndex + offset) % len) + len) % len;
    const candidate = queue[wrappedIndex];

    if (offset === 0) {
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

  const offsets: (-2 | -1 | 0 | 1 | 2)[] = [-2, -1, 0, 1, 2];
  const slots: CarouselSlot[] = offsets.map((offset) => ({
    offset,
    item: getTrackAtOffset(offset),
  }));

  const handleCardClick = (slot: CarouselSlot) => {
    if (slot.offset === 0) {
      onTogglePlay();
    } else if (slot.offset === -1 && queue.length <= 1) {
      onPrevious();
    } else if (slot.offset === 1 && queue.length <= 1) {
      onNext();
    } else {
      onSelectQueueIndex(slot.item.index);
    }
  };

  const getSlotStyle = (offset: -2 | -1 | 0 | 1 | 2): React.CSSProperties => {
    if (lyricsOpen) {
      if (offset === 0) {
        return {
          transform:
            'translate3d(clamp(-225px, -12.5vw, -150px), 0px, 60px) rotateY(14deg) scale(0.90)',
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

    switch (offset) {
      case 0:
        return {
          transform: 'translate3d(0px, 0px, 90px) rotateY(0deg) scale(1)',
          zIndex: 30,
          opacity: 1,
          filter: 'brightness(1.04)',
        };
      case -1:
        return {
          transform: 'translate3d(-205px, 8px, 12px) rotateY(16deg) scale(0.84)',
          zIndex: 20,
          opacity: 0.94,
          filter: 'brightness(0.82)',
        };
      case 1:
        return {
          transform: 'translate3d(205px, 8px, 12px) rotateY(-16deg) scale(0.84)',
          zIndex: 20,
          opacity: 0.94,
          filter: 'brightness(0.82)',
        };
      case -2:
        return {
          transform: 'translate3d(-368px, 16px, -45px) rotateY(26deg) scale(0.70)',
          zIndex: 10,
          opacity: 0.78,
          filter: 'brightness(0.66)',
        };
      case 2:
        return {
          transform: 'translate3d(368px, 16px, -45px) rotateY(-26deg) scale(0.70)',
          zIndex: 10,
          opacity: 0.78,
          filter: 'brightness(0.66)',
        };
    }
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none z-20 pointer-events-auto"
      style={{
        width: '960px',
        height: '415px',
        perspective: '1450px',
      }}
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {slots.map((slot) => {
          const isCenter = slot.offset === 0;
          const cardStyle = getSlotStyle(slot.offset);

          return (
            <div
              key={`slot-${slot.offset}`}
              onClick={() => handleCardClick(slot)}
              className="absolute cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center"
              style={{
                width: '296px',
                ...cardStyle,
              }}
            >
              {/* Frosted Glass Album Card Container */}
              <div
                className="w-full p-3.5 pb-5 flex flex-col items-center transition-all duration-300 hover:border-white/35"
                style={{
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
                    src={slot.item.highResArtworkUrl || slot.item.artworkUrl}
                    alt={slot.item.title}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
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
              </div>

              {/* "Other lyrics" / Lyrics Mode switcher pill shown beneath active card in Lyrics Mode */}
              {isCenter && lyricsOpen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCycleLyricsMode?.();
                  }}
                  title="Switch lyrics view (Focus / Compact / Full)"
                  className="mt-3.5 px-4 py-2 rounded-full flex items-center gap-2 text-[13px] font-medium text-zinc-200 hover:text-white border border-white/15 bg-black/55 backdrop-blur-xl shadow-lg transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Other lyrics</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
