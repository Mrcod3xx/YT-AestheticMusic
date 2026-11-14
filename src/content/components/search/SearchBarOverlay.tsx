import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  Play,
  Disc,
  User,
  ListMusic,
  Film,
  Loader2,
  ListPlus,
  ListStart,
  Check,
} from 'lucide-react';
import { BrowseTarget, SearchResultCategory } from '../../../shared/types';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: SearchResultCategory;
  artworkUrl: string;
  browseId?: string;
  videoId?: string;
  playlistId?: string;
  isTopResult?: boolean;
  shelfTitle?: string;
  canQueue?: boolean;
  onSelect: () => void;
  onAddToQueue?: (playNext?: boolean) => Promise<boolean> | boolean | void;
}

type SearchFilterTab = 'All' | SearchResultCategory;

interface SearchBarOverlayProps {
  visible: boolean;
  detailsOpen?: boolean;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onOpenDetails?: (target: BrowseTarget) => void;
}

const FILTER_TABS: Array<{ id: SearchFilterTab; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Artist', label: 'Artists' },
  { id: 'Song', label: 'Songs' },
  { id: 'Video', label: 'Videos' },
  { id: 'Album', label: 'Albums' },
  { id: 'Playlist', label: 'Playlists' },
];

export const SearchBarOverlay: React.FC<SearchBarOverlayProps> = ({
  visible,
  detailsOpen = false,
  onSearch,
  onOpenDetails,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<SearchFilterTab>('All');
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<string, 'queue' | 'next'>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevVisibleRef = useRef(visible);
  const latestReqId = useRef(0);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const feedbackTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = feedbackTimersRef.current;
    return () => {
      Object.values(timers).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Receive focus cleanly when user reveals Search via the Quick Actions button
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // Dismiss dropdown on outside click (Shadow DOM compatible via composedPath)
  useEffect(() => {
    if (!showDropdown || detailsOpen) return;
    const handlePointerDown = (e: Event) => {
      const el = containerRef.current;
      if (!el) return;
      const path = e.composedPath?.() || [];
      if (!path.includes(el)) {
        setShowDropdown(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [showDropdown, detailsOpen]);

  // Live search as the user types (debounced 200ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    const reqId = ++latestReqId.current;
    setShowDropdown(true);
    setIsSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const items = await onSearchRef.current(trimmed);
        if (latestReqId.current === reqId) {
          setResults(items);
        }
      } finally {
        if (latestReqId.current === reqId) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [query]);

  if (!visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const reqId = ++latestReqId.current;
    setShowDropdown(true);
    setIsSearching(true);
    try {
      const items = await onSearchRef.current(trimmed);
      if (latestReqId.current === reqId) {
        setResults(items);
      }
    } finally {
      if (latestReqId.current === reqId) {
        setIsSearching(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();

    // Explicitly guarantee Spacebar always inserts a space character inside Shadow DOM
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const input = e.currentTarget;
      const start = input.selectionStart ?? query.length;
      const end = input.selectionEnd ?? query.length;
      const nextVal = query.slice(0, start) + ' ' + query.slice(end);
      setQuery(nextVal);
      requestAnimationFrame(() => {
        input.setSelectionRange(start + 1, start + 1);
      });
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const stopPropagationOnly = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const clearSearch = () => {
    latestReqId.current++;
    setQuery('');
    setResults([]);
    setIsSearching(false);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleSelectItem = (item: SearchResultItem) => {
    const isBrowsableKind =
      item.category === 'Artist' ||
      item.category === 'Album' ||
      item.category === 'Playlist';

    if (isBrowsableKind && item.browseId && onOpenDetails) {
      onOpenDetails({
        browseId: item.browseId,
        kind: item.category as 'Artist' | 'Album' | 'Playlist',
        previewTitle: item.title,
        previewSubtitle: item.subtitle,
        previewArtworkUrl: item.artworkUrl,
      });
      return;
    }

    item.onSelect();
    setShowDropdown(false);
  };

  const handleQueueClick = async (
    e: React.MouseEvent,
    item: SearchResultItem,
    playNext: boolean
  ) => {
    e.stopPropagation();
    if (!item.onAddToQueue) return;

    const ok = await item.onAddToQueue(playNext);
    if (ok !== false) {
      if (feedbackTimersRef.current[item.id]) {
        window.clearTimeout(feedbackTimersRef.current[item.id]);
      }
      setQueuedFeedback((prev) => ({
        ...prev,
        [item.id]: playNext ? 'next' : 'queue',
      }));
      feedbackTimersRef.current[item.id] = window.setTimeout(() => {
        setQueuedFeedback((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 1800);
    }
  };

  const isDropdownVisible = showDropdown && !detailsOpen;
  const filteredResults =
    activeFilter === 'All'
      ? results
      : results.filter((r) => r.category === activeFilter);

  const explicitTop = results.filter((r) => r.isTopResult);
  const explicitTopIds = new Set(explicitTop.map((r) => r.id));
  const topResults = [
    ...explicitTop,
    ...results.filter((r) => !explicitTopIds.has(r.id)),
  ].slice(0, 6);
  const artistsList = results.filter((r) => r.category === 'Artist').slice(0, 10);
  const topIds = new Set(topResults.map((r) => r.id));
  const extraTrackResults = results
    .filter((r) => !topIds.has(r.id) && r.category !== 'Artist')
    .slice(0, 14);

  const renderQueueButtons = (item: SearchResultItem, compact = false) => {
    if (!item.canQueue || !item.onAddToQueue) return null;
    const feedback = queuedFeedback[item.id];
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => handleQueueClick(e, item, true)}
          title="Play next in Continue Playing"
          className={`${
            compact ? 'p-1.5' : 'px-2 py-1'
          } rounded-full border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
            feedback === 'next'
              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
              : 'bg-black/65 hover:bg-white/20 border-white/15 text-zinc-200 hover:text-white'
          }`}
        >
          {feedback === 'next' ? (
            <>
              <Check className="w-3 h-3" />
              {!compact && <span>Next</span>}
            </>
          ) : (
            <ListStart className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => handleQueueClick(e, item, false)}
          title="Add to queue without interrupting playback"
          className={`${
            compact ? 'p-1.5' : 'px-2.5 py-1'
          } rounded-full border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
            feedback === 'queue'
              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
              : 'bg-black/65 hover:bg-white/20 border-white/15 text-zinc-200 hover:text-white'
          }`}
        >
          {feedback === 'queue' ? (
            <>
              <Check className="w-3 h-3" />
              {!compact && <span>Queued</span>}
            </>
          ) : (
            <>
              <ListPlus className="w-3.5 h-3.5" />
              {!compact && <span>Queue</span>}
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative z-30 flex flex-col items-center w-full max-w-[560px] pointer-events-auto"
    >
      {/* Floating Search Results Panel */}
      {isDropdownVisible && (
        <div
          className="absolute bottom-[calc(100%+20px)] w-[min(780px,92vw)] max-h-[min(450px,54vh)] p-5 flex flex-col z-40 overflow-hidden"
          style={{
            borderRadius: 'calc(var(--aesthetic-radius, 22px) + 2px)',
            background:
              'rgba(var(--aesthetic-panel-rgb, 18, 19, 24), max(0.84, var(--aesthetic-panel-alpha, 0.88)))',
            backdropFilter: 'blur(34px) saturate(165%)',
            WebkitBackdropFilter: 'blur(34px) saturate(165%)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.86)',
          }}
        >
          {/* Header & Filter Bar */}
          <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 bg-white/[0.04] rounded-full p-0.5 border border-white/10 shrink-0">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                      activeFilter === tab.id
                        ? 'bg-[var(--aesthetic-accent-strong,#C28356)] text-black font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--aesthetic-accent-strong,#C28356)] shrink-0" />
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDropdown(false)}
              title="Close search results (Esc)"
              className="text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-queue-scroll space-y-5">
            {isSearching && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-zinc-300">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--aesthetic-accent-strong,#C28356)]" />
                <span>Searching "{query}"...</span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12 text-sm text-zinc-400">
                No matching {activeFilter === 'All' ? 'results' : `${activeFilter.toLowerCase()}s`} found for "{query}".
              </div>
            ) : activeFilter === 'All' ? (
              <>
                {/* Top Results Horizontal Card Row */}
                {topResults.length > 0 && (
                  <section>
                    <h3 className="text-[14.5px] font-semibold text-white/95 tracking-tight mb-2.5 px-0.5">
                      Top Results
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {topResults.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectItem(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSelectItem(item);
                            }
                          }}
                          className="group flex flex-col text-left cursor-pointer"
                        >
                          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-800/90 border border-white/12 shadow-md">
                            {item.artworkUrl ? (
                              <img
                                src={item.artworkUrl}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                <Disc className="w-6 h-6" />
                              </div>
                            )}

                            {/* Hover Play Indicator */}
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              {item.category !== 'Artist' && (
                                <div className="w-8 h-8 rounded-full bg-black/70 border border-white/25 flex items-center justify-center">
                                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                                </div>
                              )}
                            </div>

                            {/* Quick Hover Queue Actions */}
                            {item.canQueue && (
                              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                {renderQueueButtons(item, true)}
                              </div>
                            )}
                          </div>

                          <div className="mt-2 min-w-0">
                            <div className="text-[12.5px] font-semibold text-white truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {item.subtitle || item.category}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Artists Circular Avatar Row */}
                {artistsList.length > 0 && (
                  <section>
                    <h3 className="text-[14.5px] font-semibold text-white/95 tracking-tight mb-2.5 px-0.5">
                      Artists
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                      {artistsList.slice(0, 5).map((artist) => (
                        <button
                          key={`artist-${artist.id}`}
                          type="button"
                          onClick={() => handleSelectItem(artist)}
                          className="group flex flex-col items-center text-center cursor-pointer"
                        >
                          <div className="w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] rounded-full overflow-hidden bg-zinc-800 border border-white/15 shadow-lg transition-transform duration-200 group-hover:scale-105 group-hover:border-white/35">
                            {artist.artworkUrl ? (
                              <img
                                src={artist.artworkUrl}
                                alt={artist.title}
                                className="w-full h-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                <User className="w-7 h-7" />
                              </div>
                            )}
                          </div>
                          <span className="mt-2 text-[12.5px] font-medium text-white truncate w-full">
                            {artist.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* More Songs / Releases with explicit Queue Controls */}
                {extraTrackResults.length > 0 && (
                  <section className="space-y-1 pt-1 border-t border-white/10">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                      Songs, Albums & Releases
                    </h3>
                    {extraTrackResults.map((item) => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectItem(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSelectItem(item);
                          }
                        }}
                        className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-2xl hover:bg-white/[0.09] text-left transition group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/12">
                            {item.artworkUrl ? (
                              <img
                                src={item.artworkUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                <Disc className="w-4 h-4" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold text-white truncate">
                              {item.title}
                            </div>
                            <div className="text-[12px] text-zinc-400 truncate">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {renderQueueButtons(item, false)}
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10.5px] text-zinc-300 flex items-center gap-1">
                            {item.category === 'Video' && <Film className="w-3 h-3" />}
                            {item.category === 'Playlist' && <ListMusic className="w-3 h-3" />}
                            {item.category === 'Album' && <Disc className="w-3 h-3" />}
                            {item.category === 'Video' ? 'MV' : item.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </>
            ) : activeFilter === 'Artist' ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 py-1">
                {filteredResults.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => handleSelectItem(artist)}
                    className="group flex flex-col items-center text-center cursor-pointer"
                  >
                    <div className="w-[92px] h-[92px] rounded-full overflow-hidden bg-zinc-800 border border-white/15 shadow-lg transition-transform duration-200 group-hover:scale-105 group-hover:border-white/35">
                      {artist.artworkUrl ? (
                        <img
                          src={artist.artworkUrl}
                          alt={artist.title}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500">
                          <User className="w-7 h-7" />
                        </div>
                      )}
                    </div>
                    <span className="mt-2 text-[12.5px] font-medium text-white truncate w-full">
                      {artist.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate w-full">
                      {artist.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredResults.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSelectItem(item);
                      }
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl hover:bg-white/[0.10] text-left transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-white/15">
                        {item.artworkUrl ? (
                          <img
                            src={item.artworkUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500">
                            <Disc className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[12.5px] text-zinc-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderQueueButtons(item, false)}
                      <span
                        className={`px-2.5 py-1 rounded-full border text-[11px] font-medium flex items-center gap-1 ${
                          item.category === 'Video'
                            ? 'text-[var(--aesthetic-accent,#E89B63)]'
                            : 'bg-white/[0.07] border-white/10 text-zinc-300'
                        }`}
                        style={
                          item.category === 'Video'
                            ? {
                                backgroundColor:
                                  'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.2)',
                                borderColor:
                                  'rgba(var(--aesthetic-accent-rgb, 194, 131, 86), 0.4)',
                              }
                            : undefined
                        }
                      >
                        {item.category === 'Video' && <Film className="w-3 h-3" />}
                        {item.category === 'Artist' && <User className="w-3 h-3" />}
                        {item.category === 'Playlist' && <ListMusic className="w-3 h-3" />}
                        {item.category === 'Album' && <Disc className="w-3 h-3" />}
                        {item.category === 'Video' ? 'MV' : item.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar Input Pill */}
      <form
        onSubmit={handleSubmit}
        className="w-full flex items-center gap-3 px-5 h-[46px] rounded-full transition-all duration-200 focus-within:border-white/30"
        style={{
          background: 'rgba(15, 16, 20, 0.78)',
          backdropFilter: 'blur(22px) saturate(145%)',
          WebkitBackdropFilter: 'blur(22px) saturate(145%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 12px 34px rgba(0, 0, 0, 0.5)',
        }}
      >
        <button
          type="submit"
          title="Search"
          className="text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
        >
          <Search className="w-4 h-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => {
            if (query.trim().length > 0) setShowDropdown(true);
          }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={stopPropagationOnly}
          onKeyPress={stopPropagationOnly}
          placeholder="Search YouTube Music"
          className="w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-400/80 outline-none border-none select-text"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            title="Clear search"
            className="text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
};
