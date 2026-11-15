import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ListStart,
  Radio,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { QueueTrackItem, TrackMetadata } from '../../../shared/types';

interface ContinuePlayingSidebarProps {
  visible: boolean;
  currentTrack: TrackMetadata;
  queue: QueueTrackItem[];
  onSelectTrack: (index: number) => void;
  onPlayNextTrack?: (index: number) => void;
  onRemoveTrack?: (index: number) => void;
  onStartRadio?: (track: { videoId?: string; title: string }) => void;
  onRefreshQueue: () => void;
}

export const ContinuePlayingSidebar: React.FC<ContinuePlayingSidebarProps> = ({
  visible,
  currentTrack,
  queue,
  onSelectTrack,
  onPlayNextTrack,
  onRemoveTrack,
  onStartRadio,
  onRefreshQueue,
}) => {
  const [showEarlier, setShowEarlier] = useState(false);
  const [upNextCollapsed, setUpNextCollapsed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState('');
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  if (!visible) return null;

  const activeIndex = queue.findIndex((item) => item.isSelected);
  const activeItem: QueueTrackItem =
    activeIndex >= 0
      ? queue[activeIndex]
      : {
          index: 0,
          title: currentTrack.title,
          artist: currentTrack.artist,
          duration: '',
          artworkUrl: currentTrack.artworkUrl,
          highResArtworkUrl: currentTrack.highResArtworkUrl,
          isSelected: true,
          isPlaying: currentTrack.isPlaying,
          videoId: currentTrack.videoId,
        };

  const activeRadioVideoId = activeItem.videoId || currentTrack.videoId;
  const upcomingItems =
    activeIndex >= 0 ? queue.slice(activeIndex + 1) : queue.slice(1);
  const earlierItems = activeIndex > 0 ? queue.slice(0, activeIndex) : [];

  const normalizedFilter = queueFilter.trim().toLowerCase();
  const matchesQueueFilter = (item: QueueTrackItem) =>
    !normalizedFilter ||
    item.title.toLowerCase().includes(normalizedFilter) ||
    item.artist.toLowerCase().includes(normalizedFilter);

  const filteredUpcoming = upcomingItems.filter(matchesQueueFilter);
  const filteredEarlier = earlierItems.filter(matchesQueueFilter);

  const toggleQueueFilter = () => {
    setFilterOpen((prev) => {
      const next = !prev;
      if (next) {
        if (upNextCollapsed) setUpNextCollapsed(false);
        requestAnimationFrame(() => filterInputRef.current?.focus());
      } else {
        setQueueFilter('');
      }
      return next;
    });
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const input = e.currentTarget;
      const start = input.selectionStart ?? queueFilter.length;
      const end = input.selectionEnd ?? queueFilter.length;
      const nextVal = queueFilter.slice(0, start) + ' ' + queueFilter.slice(end);
      setQueueFilter(nextVal);
      requestAnimationFrame(() => {
        input.setSelectionRange(start + 1, start + 1);
      });
    } else if (e.key === 'Escape') {
      setQueueFilter('');
      setFilterOpen(false);
      e.currentTarget.blur();
    }
  };

  const stopKeyboardPropagation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const renderQueueRow = (
    item: QueueTrackItem,
    {
      canPlayNext,
      muted = false,
    }: { canPlayNext: boolean; muted?: boolean }
  ) => (
    <div
      key={`${item.index}-${item.videoId || item.title}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelectTrack(item.index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectTrack(item.index);
        }
      }}
      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.09] text-left transition group cursor-pointer ${
        muted ? 'opacity-70 hover:opacity-100' : ''
      }`}
    >
      <img
        src={item.artworkUrl}
        alt={item.title}
        className="w-11 h-11 rounded-xl object-cover shrink-0 shadow border border-white/10 group-hover:scale-105 transition-transform"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-zinc-100 group-hover:text-white truncate drop-shadow-sm">
          {item.title}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <span className="text-[12px] text-zinc-400 group-hover:text-zinc-300 truncate">
            {item.artist}
          </span>
          {item.isAutomix && (
            <span className="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/10 text-[9.5px] font-medium uppercase tracking-wide text-zinc-300 shrink-0">
              Radio
            </span>
          )}
        </div>
      </div>
      {(onPlayNextTrack || onRemoveTrack || (onStartRadio && item.videoId)) && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {onStartRadio && item.videoId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRadio({ videoId: item.videoId, title: item.title });
              }}
              title="Start Song Radio"
              aria-label={`Start song radio for ${item.title}`}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.18] border border-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
            </button>
          )}
          {onPlayNextTrack && canPlayNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayNextTrack(item.index);
              }}
              title="Play Next"
              aria-label={`Play ${item.title} next`}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.18] border border-white/10 text-zinc-300 transition cursor-pointer"
              style={{ borderColor: 'rgba(var(--aesthetic-accent-hi-rgb, 232, 155, 99), 0.35)' }}
            >
              <ListStart className="w-4 h-4 text-[var(--aesthetic-accent,#E89B63)]" />
            </button>
          )}
          {onRemoveTrack && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTrack(item.index);
              }}
              title="Remove from queue"
              aria-label={`Remove ${item.title} from queue`}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.08] hover:bg-red-500/20 border border-white/10 hover:border-red-400/40 text-zinc-400 hover:text-red-300 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <aside
      className="fixed left-6 xl:left-8 2xl:left-11 top-[19vh] bottom-[13vh] w-[275px] xl:w-[300px] 2xl:w-[345px] z-40 flex flex-col select-none pointer-events-auto"
      style={{
        perspective: '1200px',
      }}
    >
      <div
        className="w-full h-full flex flex-col transition-transform duration-500 ease-out"
        style={{
          transform: 'rotateY(14deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Header: Continue Playing (Click toggles upcoming list) */}
        <div className="flex items-center justify-between px-2.5 mb-3.5">
          <button
            type="button"
            onClick={() => setUpNextCollapsed((prev) => !prev)}
            aria-expanded={!upNextCollapsed}
            title={upNextCollapsed ? 'Expand upcoming tracks' : 'Collapse upcoming tracks'}
            className="flex items-center gap-3 text-left group cursor-pointer min-w-0"
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/20 shadow-md shrink-0 bg-zinc-900">
              <img
                src={activeItem.artworkUrl}
                alt={activeItem.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[16.5px] font-semibold text-white tracking-tight drop-shadow">
                <span>Continue Playing</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-300 transition-transform duration-200 ${
                    upNextCollapsed ? '-rotate-90' : ''
                  }`}
                />
              </div>
              <div className="text-[12px] text-zinc-400 font-medium truncate">
                {upNextCollapsed
                  ? upcomingItems.length > 0
                    ? `Up next hidden (${upcomingItems.length})`
                    : 'Up next hidden'
                  : upcomingItems.length > 0
                  ? `Up next on YouTube Music (${upcomingItems.length})`
                  : 'Up next on YouTube Music'}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleQueueFilter}
              title="Filter queue by title or artist"
              aria-label="Filter queue"
              aria-pressed={filterOpen}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition cursor-pointer shrink-0 ${
                filterOpen || normalizedFilter
                  ? 'bg-white/20 border-white/35 text-white'
                  : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/15 text-zinc-300 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onRefreshQueue}
              title="Synchronize queue with YouTube Music"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Queue Search Filter */}
        {filterOpen && (
          <div className="px-2 mb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/45 border border-white/15 focus-within:border-white/30">
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                ref={filterInputRef}
                type="text"
                value={queueFilter}
                onChange={(e) => setQueueFilter(e.target.value)}
                onKeyDown={handleFilterKeyDown}
                onKeyUp={stopKeyboardPropagation}
                onKeyPress={stopKeyboardPropagation}
                placeholder="Filter queue..."
                className="w-full bg-transparent text-[12.5px] text-white placeholder-zinc-400/80 outline-none border-none select-text"
              />
              {queueFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setQueueFilter('');
                    filterInputRef.current?.focus();
                  }}
                  title="Clear queue filter"
                  className="text-zinc-400 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Playing Track Pop-Out Card */}
        <div
          onClick={() => activeIndex >= 0 && onSelectTrack(activeIndex)}
          className="relative mb-4 px-4 py-3.5 flex items-center justify-between gap-3.5 cursor-pointer transition-all duration-300"
          style={{
            borderRadius: 'calc(var(--aesthetic-radius, 22px) * 0.78)',
            background:
              'linear-gradient(135deg, rgba(var(--aesthetic-active-card-start, 82, 74, 70), var(--aesthetic-panel-alpha, 0.75)) 0%, rgba(var(--aesthetic-active-card-end, 36, 35, 40), 0.85) 100%)',
            backdropFilter: 'blur(24px) saturate(145%)',
            WebkitBackdropFilter: 'blur(24px) saturate(145%)',
            border: '1.2px solid rgba(var(--aesthetic-accent-hi-rgb, 226, 155, 100), 0.52)',
            boxShadow:
              '-8px 14px 34px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
            transform: 'translateZ(18px) scale(1.03)',
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={activeItem.artworkUrl}
              alt={activeItem.title}
              className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md border border-white/15"
            />
            <div className="min-w-0">
              <div
                className="text-[15px] font-semibold truncate"
                style={{ color: 'var(--aesthetic-accent, #E89B63)' }}
              >
                {activeItem.title}
              </div>
              <div className="text-[12.5px] text-zinc-300/85 truncate mt-0.5">
                {activeItem.artist}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onStartRadio && activeRadioVideoId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRadio({
                    videoId: activeRadioVideoId,
                    title: activeItem.title,
                  });
                }}
                title="Start Song Radio from current track"
                aria-label={`Start song radio for ${activeItem.title}`}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-black/35 hover:bg-white/15 border border-white/15 text-zinc-200 hover:text-white transition cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
              </button>
            )}

            {/* Animated 3-bar Equalizer Indicator */}
            <div className="flex items-end gap-[3px] h-4 shrink-0 pr-1">
              <span
                className={`w-[3px] rounded-full transition-all ${
                  currentTrack.isPlaying ? 'animate-eq-bar-1 h-3.5' : 'h-2'
                }`}
                style={{ backgroundColor: 'var(--aesthetic-accent, #E89B63)' }}
              />
              <span
                className={`w-[3px] rounded-full transition-all ${
                  currentTrack.isPlaying ? 'animate-eq-bar-2 h-4' : 'h-3'
                }`}
                style={{ backgroundColor: 'var(--aesthetic-accent, #E89B63)' }}
              />
              <span
                className={`w-[3px] rounded-full transition-all ${
                  currentTrack.isPlaying ? 'animate-eq-bar-3 h-2.5' : 'h-1.5'
                }`}
                style={{ backgroundColor: 'var(--aesthetic-accent, #E89B63)' }}
              />
            </div>
          </div>
        </div>

        {/* Upcoming Queue Scroll List */}
        {!upNextCollapsed && (
          <div
            className="flex-1 overflow-y-auto pr-3.5 pb-4 space-y-2.5 custom-queue-scroll"
            style={{
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {filteredUpcoming.length > 0 ? (
              filteredUpcoming.map((item) =>
                renderQueueRow(item, {
                  canPlayNext:
                    upcomingItems.findIndex((u) => u.index === item.index) > 0,
                })
              )
            ) : (
              <div className="px-3 py-4 text-[12.5px] text-zinc-400">
                {normalizedFilter
                  ? 'No upcoming tracks match filter.'
                  : 'No upcoming tracks in queue.'}
              </div>
            )}

            {filteredEarlier.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEarlier((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {showEarlier || normalizedFilter ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Played earlier ({filteredEarlier.length})
                  </span>
                </button>
                {(showEarlier || Boolean(normalizedFilter)) && (
                  <div className="mt-1 space-y-2">
                    {filteredEarlier.map((item) =>
                      renderQueueRow(item, { canPlayNext: true, muted: true })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
