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

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Song' | 'Video' | 'Album' | 'Artist' | 'Playlist';
  artworkUrl: string;
  canQueue?: boolean;
  onSelect: () => void;
  onAddToQueue?: (playNext?: boolean) => Promise<boolean> | boolean | void;
}

interface SearchBarOverlayProps {
  visible: boolean;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
}

export const SearchBarOverlay: React.FC<SearchBarOverlayProps> = ({
  visible,
  onSearch,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Video' | 'Song' | 'Album'>('All');
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<string, 'queue' | 'next'>>({});

  const latestReqId = useRef(0);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const feedbackTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(feedbackTimersRef.current).forEach((id) => window.clearTimeout(id));
    };
  }, []);

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

    // Explicitly guarantee Spacebar always inserts a space character into the input
    // even if YouTube Music's capture-phase shortcut listener called preventDefault()
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

  const filteredResults =
    activeFilter === 'All'
      ? results
      : results.filter((r) => r.category === activeFilter);

  return (
    <div className="relative z-30 flex flex-col items-center w-full max-w-[560px] pointer-events-auto">
      {/* Live Search Results Popover (opens upward with crisp separation above the search bar) */}
      {showDropdown && (
        <div
          className="absolute bottom-[calc(100%+22px)] w-[min(660px,92vw)] max-h-[min(400px,50vh)] p-4 flex flex-col z-40 overflow-hidden"
          style={{
            borderRadius: 'calc(var(--aesthetic-radius, 22px) + 2px)',
            background:
              'rgba(var(--aesthetic-panel-rgb, 18, 19, 24), max(0.84, var(--aesthetic-panel-alpha, 0.88)))',
            backdropFilter: 'blur(32px) saturate(165%)',
            WebkitBackdropFilter: 'blur(32px) saturate(165%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85)',
          }}
        >
          <div className="flex items-center justify-between px-2.5 pb-2.5 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
                  Live Search
                </span>
                {isSearching && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--aesthetic-accent-strong,#C28356)]" />
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-white/[0.04] rounded-full p-0.5 border border-white/10">
                {(['All', 'Video', 'Song', 'Album'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveFilter(tab)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                      activeFilter === tab
                        ? 'bg-[var(--aesthetic-accent-strong,#C28356)] text-black font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tab === 'Video' ? 'Videos (MV)' : tab === 'All' ? 'All' : `${tab}s`}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowDropdown(false)}
              className="text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 custom-queue-scroll">
            {isSearching && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-zinc-300">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--aesthetic-accent-strong,#C28356)]" />
                <span>Searching "{query}"...</span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-10 text-sm text-zinc-400">
                No matching {activeFilter === 'All' ? 'tracks' : activeFilter.toLowerCase()}s found for "{query}".
              </div>
            ) : (
              filteredResults.map((item) => {
                const feedback = queuedFeedback[item.id];
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      item.onSelect();
                      setShowDropdown(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        item.onSelect();
                        setShowDropdown(false);
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
                      {item.canQueue && item.onAddToQueue && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleQueueClick(e, item, true)}
                            title="Play next in Continue Playing"
                            className={`px-2 py-1 rounded-full border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                              feedback === 'next'
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                : 'bg-white/[0.06] hover:bg-white/[0.15] border-white/10 text-zinc-300 hover:text-white'
                            }`}
                          >
                            {feedback === 'next' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Next</span>
                              </>
                            ) : (
                              <ListStart className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleQueueClick(e, item, false)}
                            title="Add to queue without interrupting playback"
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                              feedback === 'queue'
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/15 text-zinc-200 hover:text-white'
                            }`}
                          >
                            {feedback === 'queue' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Queued</span>
                              </>
                            ) : (
                              <>
                                <ListPlus className="w-3.5 h-3.5" />
                                <span>Queue</span>
                              </>
                            )}
                          </button>
                        </>
                      )}

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
                );
              })
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
          type="text"
          value={query}
          onFocus={() => {
            if (query.trim().length > 0) setShowDropdown(true);
          }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={stopPropagationOnly}
          onKeyPress={stopPropagationOnly}
          placeholder="Search YouTube Music..."
          className="w-full bg-transparent text-[14.5px] text-zinc-100 placeholder-zinc-400/80 outline-none border-none select-text"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
};
