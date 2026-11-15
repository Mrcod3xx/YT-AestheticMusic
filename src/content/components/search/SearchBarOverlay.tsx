import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  Play,
  Shuffle,
  RotateCw,
  Disc,
  User,
  ListMusic,
  Film,
  Loader2,
  ListPlus,
  ListStart,
  Check,
  Heart,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  BrowseDetailsData,
  BrowseTarget,
  BrowseTrackItem,
  LibraryHubSection,
  SearchResultCategory,
} from '../../../shared/types';
import type { LibraryHubResponse } from '../../adapters/searchAdapter';

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
  focusSignal?: number;
  closeDropdownSignal?: number;
  onDropdownVisibilityChange?: (open: boolean) => void;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onFetchLibraryHub?: (section: LibraryHubSection) => Promise<LibraryHubResponse>;
  onOpenDetails?: (target: BrowseTarget) => void;
  onFetchBrowseDetails?: (
    browseId: string,
    kind?: 'Artist' | 'Album' | 'Playlist'
  ) => Promise<BrowseDetailsData | null>;
  onPlayBrowseCollection?: (params: {
    endpoint?: Record<string, unknown>;
    playlistId?: string;
    shuffle?: boolean;
    tracks?: BrowseTrackItem[];
  }) => void;
  onPlayBrowseTrack?: (track: BrowseTrackItem) => void;
  onQueueBrowseTrack?: (
    track: BrowseTrackItem,
    playNext: boolean
  ) => Promise<boolean>;
}

const LIBRARY_HUB_CHIPS: Array<{
  id: LibraryHubSection;
  label: string;
}> = [
  { id: 'liked', label: 'Liked Songs' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'home', label: 'Quick Picks' },
];

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
  focusSignal = 0,
  closeDropdownSignal = 0,
  onDropdownVisibilityChange,
  onSearch,
  onFetchLibraryHub,
  onOpenDetails,
  onFetchBrowseDetails,
  onPlayBrowseCollection,
  onPlayBrowseTrack,
  onQueueBrowseTrack,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<SearchFilterTab>('All');
  const [activeLibrarySection, setActiveLibrarySection] =
    useState<LibraryHubSection | null>(null);
  const [libraryLoggedIn, setLibraryLoggedIn] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [selectedPlaylistKey, setSelectedPlaylistKey] = useState<string | null>(null);
  const [playlistDetailsMap, setPlaylistDetailsMap] = useState<
    Record<string, BrowseDetailsData>
  >({});
  const [playlistLoadingKey, setPlaylistLoadingKey] = useState<string | null>(null);
  const [playlistErrorMap, setPlaylistErrorMap] = useState<Record<string, string>>({});
  const [inputFocused, setInputFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<string, 'queue' | 'next'>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevVisibleRef = useRef(visible);
  const prevFocusSignalRef = useRef(focusSignal);
  const prevCloseSignalRef = useRef(closeDropdownSignal);
  const latestReqId = useRef(0);
  const latestPlaylistReqId = useRef(0);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const onFetchLibraryHubRef = useRef(onFetchLibraryHub);
  onFetchLibraryHubRef.current = onFetchLibraryHub;
  const onFetchBrowseDetailsRef = useRef(onFetchBrowseDetails);
  onFetchBrowseDetailsRef.current = onFetchBrowseDetails;
  const playlistDetailsCacheRef = useRef<Record<string, BrowseDetailsData>>({});
  const feedbackTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = feedbackTimersRef.current;
    return () => {
      Object.values(timers).forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Receive focus cleanly when user reveals Search via Quick Actions or presses '/' / 'Ctrl+K'
  useEffect(() => {
    const becameVisible = visible && !prevVisibleRef.current;
    const focusRequested = focusSignal !== prevFocusSignalRef.current;
    if (visible && (becameVisible || focusRequested)) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    prevVisibleRef.current = visible;
    prevFocusSignalRef.current = focusSignal;
  }, [visible, focusSignal]);

  // Allow parent Escape priority chain to dismiss the results dropdown cleanly
  useEffect(() => {
    if (closeDropdownSignal !== prevCloseSignalRef.current) {
      prevCloseSignalRef.current = closeDropdownSignal;
      setShowDropdown(false);
      setInputFocused(false);
    }
  }, [closeDropdownSignal]);

  const isDropdownVisible = showDropdown && !detailsOpen;
  const isEmptyFocusShelfVisible =
    visible &&
    Boolean(onFetchLibraryHub) &&
    !detailsOpen &&
    !query.trim() &&
    (inputFocused || isDropdownVisible);

  useEffect(() => {
    onDropdownVisibilityChange?.(visible && isDropdownVisible);
  }, [visible, isDropdownVisible, onDropdownVisibilityChange]);

  // Dismiss dropdown and quick hub strip on outside click (Shadow DOM compatible via composedPath)
  useEffect(() => {
    if ((!showDropdown && !inputFocused) || detailsOpen) return;
    const handlePointerDown = (e: Event) => {
      const el = containerRef.current;
      if (!el) return;
      const path = e.composedPath?.() || [];
      if (!path.includes(el)) {
        setShowDropdown(false);
        setInputFocused(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [showDropdown, inputFocused, detailsOpen]);

  // Live search as the user types (debounced 200ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setActiveLibrarySection(null);
      setShowDropdown(false);
      return;
    }

    setActiveLibrarySection(null);
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
      if (showDropdown) {
        setShowDropdown(false);
      } else {
        setInputFocused(false);
        inputRef.current?.blur();
      }
    }
  };

  const resolvePlaylistBrowseKey = (item: SearchResultItem): string =>
    item.browseId ||
    (item.playlistId === 'LM'
      ? 'FEmusic_liked_videos'
      : item.playlistId
      ? item.playlistId.startsWith('VL')
        ? item.playlistId
        : `VL${item.playlistId}`
      : item.id);

  const loadPlaylistContents = async (item: SearchResultItem, force = false) => {
    const browseKey = resolvePlaylistBrowseKey(item);
    setSelectedPlaylistKey(browseKey);
    if (!onFetchBrowseDetailsRef.current || !browseKey) return;

    if (!force && playlistDetailsCacheRef.current[browseKey]) {
      return;
    }

    const reqId = ++latestPlaylistReqId.current;
    setPlaylistLoadingKey(browseKey);
    setPlaylistErrorMap((prev) => {
      const next = { ...prev };
      delete next[browseKey];
      return next;
    });

    try {
      const details = await onFetchBrowseDetailsRef.current(browseKey, 'Playlist');
      if (latestPlaylistReqId.current !== reqId) return;
      if (details) {
        playlistDetailsCacheRef.current[browseKey] = details;
        setPlaylistDetailsMap((prev) => ({ ...prev, [browseKey]: details }));
      } else {
        setPlaylistErrorMap((prev) => ({
          ...prev,
          [browseKey]: 'Unable to load tracks for this playlist.',
        }));
      }
    } catch {
      if (latestPlaylistReqId.current === reqId) {
        setPlaylistErrorMap((prev) => ({
          ...prev,
          [browseKey]: 'Network error while loading playlist tracks.',
        }));
      }
    } finally {
      if (latestPlaylistReqId.current === reqId) {
        setPlaylistLoadingKey((curr) => (curr === browseKey ? null : curr));
      }
    }
  };

  const handleLoadLibrarySection = async (section: LibraryHubSection) => {
    if (!onFetchLibraryHubRef.current) return;

    const reqId = ++latestReqId.current;
    setActiveLibrarySection(section);
    setActiveFilter('All');
    setResults([]);
    setLibraryError(null);
    setSelectedPlaylistKey(null);
    if (section === 'playlists') {
      playlistDetailsCacheRef.current = {};
      setPlaylistDetailsMap({});
      setPlaylistErrorMap({});
    }
    setShowDropdown(true);
    setIsSearching(true);
    try {
      const response = await onFetchLibraryHubRef.current(section);
      if (latestReqId.current !== reqId) return;
      setLibraryLoggedIn(response.loggedIn);
      setLibraryError(response.ok ? null : response.error || 'Library request failed.');
      setResults(response.items);
      if (section === 'playlists' && response.items.length > 0) {
        void loadPlaylistContents(response.items[0]);
      }
    } catch (err) {
      if (latestReqId.current === reqId) {
        setLibraryError(String(err));
      }
    } finally {
      if (latestReqId.current === reqId) {
        setIsSearching(false);
      }
    }
  };

  const stopPropagationOnly = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  const clearSearch = () => {
    latestReqId.current++;
    setQuery('');
    setResults([]);
    setActiveLibrarySection(null);
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

  const runQueueFeedbackAction = async (
    e: React.MouseEvent,
    feedbackId: string,
    playNext: boolean,
    fn?: () => Promise<boolean> | boolean | void
  ) => {
    e.stopPropagation();
    if (!fn) return;

    const ok = await fn();
    if (ok !== false) {
      if (feedbackTimersRef.current[feedbackId]) {
        window.clearTimeout(feedbackTimersRef.current[feedbackId]);
      }
      setQueuedFeedback((prev) => ({
        ...prev,
        [feedbackId]: playNext ? 'next' : 'queue',
      }));
      feedbackTimersRef.current[feedbackId] = window.setTimeout(() => {
        setQueuedFeedback((prev) => {
          const next = { ...prev };
          delete next[feedbackId];
          return next;
        });
      }, 1800);
    }
  };

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
    .slice(0, activeLibrarySection ? 30 : 14);

  const renderQueueButtonsForAction = (
    feedbackId: string,
    onQueueAction: (playNext: boolean) => Promise<boolean> | boolean | void,
    compact = false
  ) => {
    const feedback = queuedFeedback[feedbackId];
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) =>
            void runQueueFeedbackAction(e, feedbackId, true, () => onQueueAction(true))
          }
          title="Play next in Continue Playing"
          className={`${
            compact ? 'w-8 h-8 justify-center' : 'px-3 py-1.5'
          } rounded-full border text-[11.5px] font-medium flex items-center gap-1.5 transition cursor-pointer ${
            feedback === 'next'
              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
              : 'bg-black/65 hover:bg-white/20 border-white/15 text-zinc-200 hover:text-white'
          }`}
        >
          {feedback === 'next' ? (
            <>
              <Check className="w-3.5 h-3.5" />
              {!compact && <span>Next</span>}
            </>
          ) : (
            <ListStart className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) =>
            void runQueueFeedbackAction(e, feedbackId, false, () => onQueueAction(false))
          }
          title="Add to queue without interrupting playback"
          className={`${
            compact ? 'w-8 h-8 justify-center' : 'px-3 py-1.5'
          } rounded-full border text-[11.5px] font-medium flex items-center gap-1.5 transition cursor-pointer ${
            feedback === 'queue'
              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
              : 'bg-black/65 hover:bg-white/20 border-white/15 text-zinc-200 hover:text-white'
          }`}
        >
          {feedback === 'queue' ? (
            <>
              <Check className="w-3.5 h-3.5" />
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

  const renderQueueButtons = (item: SearchResultItem, compact = false) => {
    if (!item.canQueue || !item.onAddToQueue) return null;
    return renderQueueButtonsForAction(item.id, item.onAddToQueue, compact);
  };

  const selectedPlaylistItem =
    activeLibrarySection === 'playlists'
      ? results.find((r) => resolvePlaylistBrowseKey(r) === selectedPlaylistKey) ||
        results[0] ||
        null
      : null;
  const activePlaylistKey = selectedPlaylistItem
    ? resolvePlaylistBrowseKey(selectedPlaylistItem)
    : null;
  const activePlaylistDetails = activePlaylistKey
    ? playlistDetailsMap[activePlaylistKey] || null
    : null;
  const activePlaylistError = activePlaylistKey
    ? playlistErrorMap[activePlaylistKey] || null
    : null;
  const activeSectionLabel =
    LIBRARY_HUB_CHIPS.find((c) => c.id === activeLibrarySection)?.label || 'Library';

  return (
    <div
      ref={containerRef}
      className="relative z-30 flex flex-col items-center w-full max-w-[600px] pointer-events-auto"
    >
      {/* Floating Search Results Panel */}
      {isDropdownVisible && (
        <div
          className={`absolute bottom-[calc(100%+20px)] ${
            activeLibrarySection === 'playlists' && results.length > 0
              ? 'w-[min(880px,94vw)] max-h-[min(500px,62vh)]'
              : 'w-[min(780px,92vw)] max-h-[min(460px,56vh)]'
          } p-5 flex flex-col z-40 overflow-hidden`}
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
              {activeLibrarySection ? (
                <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-full p-1 border border-white/10 shrink-0">
                  {LIBRARY_HUB_CHIPS.map((chip) => {
                    const active = activeLibrarySection === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => void handleLoadLibrarySection(chip.id)}
                        className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          active
                            ? 'bg-[var(--aesthetic-accent-strong,#C28356)] text-black font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        {chip.id === 'liked' && <Heart className="w-3.5 h-3.5" />}
                        {chip.id === 'playlists' && <ListMusic className="w-3.5 h-3.5" />}
                        {chip.id === 'home' && <Sparkles className="w-3.5 h-3.5" />}
                        <span>{chip.label}</span>
                      </button>
                    );
                  })}
                  {activeLibrarySection === 'liked' && onOpenDetails && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDetails({
                          browseId: 'FEmusic_liked_videos',
                          kind: 'Playlist',
                          previewTitle: 'Liked Music',
                        })
                      }
                      title="Open Liked Music in full modal"
                      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[12px] font-medium text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Open All</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-white/[0.04] rounded-full p-1 border border-white/10 shrink-0">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition cursor-pointer ${
                        activeFilter === tab.id
                          ? 'bg-[var(--aesthetic-accent-strong,#C28356)] text-black font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--aesthetic-accent-strong,#C28356)] shrink-0" />
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowDropdown(false)}
              title="Close search results (Esc)"
              className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-queue-scroll space-y-5">
            {isSearching && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2.5 py-14 text-sm text-zinc-300">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--aesthetic-accent-strong,#C28356)]" />
                <span>
                  {activeLibrarySection
                    ? `Loading ${activeSectionLabel}...`
                    : `Searching "${query}"...`}
                </span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-10 px-4">
                <div className="text-sm text-zinc-300 max-w-md">
                  {activeLibrarySection
                    ? !libraryLoggedIn
                      ? 'Not signed in to YouTube Music in this tab. Sign in on music.youtube.com, then click Retry.'
                      : libraryError
                      ? `Unable to sync ${activeSectionLabel}: ${libraryError}`
                      : `No ${activeSectionLabel.toLowerCase()} found in your signed-in YouTube Music library yet.`
                    : `No matching ${
                        activeFilter === 'All'
                          ? 'results'
                          : `${activeFilter.toLowerCase()}s`
                      } found for "${query}".`}
                </div>
                {activeLibrarySection && (
                  <button
                    type="button"
                    onClick={() => void handleLoadLibrarySection(activeLibrarySection)}
                    className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{libraryLoggedIn ? 'Refresh' : 'Retry'}</span>
                  </button>
                )}
              </div>
            ) : activeLibrarySection === 'liked' ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="text-[13px] text-zinc-300 font-medium flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[var(--aesthetic-accent,#E89B63)]" />
                    <span>Liked Songs ({results.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onPlayBrowseCollection) {
                        const first = results[0];
                        onPlayBrowseCollection({
                          playlistId: 'LM',
                          tracks: first?.videoId
                            ? [
                                {
                                  id: first.id,
                                  index: 0,
                                  title: first.title,
                                  subtitle: first.subtitle,
                                  duration: '',
                                  artworkUrl: first.artworkUrl,
                                  videoId: first.videoId,
                                  playlistId: first.playlistId || 'LM',
                                },
                              ]
                            : undefined,
                        });
                        setShowDropdown(false);
                      } else if (results[0]) {
                        handleSelectItem(results[0]);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Play All</span>
                  </button>
                </div>
                <div className="space-y-1">
                  {results.map((item, idx) => (
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
                      className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-2xl hover:bg-white/[0.10] text-left transition group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-[11px] text-zinc-500 tabular-nums shrink-0">
                          {idx + 1}
                        </span>
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
                      {renderQueueButtons(item, false)}
                    </div>
                  ))}
                </div>
              </div>
            ) : activeLibrarySection === 'playlists' ? (
              <div className="grid grid-cols-1 md:grid-cols-[248px_1fr] gap-4 items-stretch min-h-[270px]">
                {/* Left Pane: Playlist Directory */}
                <div className="flex flex-col gap-1.5 md:border-r md:border-white/10 md:pr-3 max-h-[160px] md:max-h-[370px] overflow-y-auto custom-queue-scroll">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 px-1.5 pb-1">
                    Your Playlists ({results.length})
                  </div>
                  {results.map((playlist) => {
                    const key = resolvePlaylistBrowseKey(playlist);
                    const isSelected = key === activePlaylistKey;
                    return (
                      <div
                        key={playlist.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void loadPlaylistContents(playlist)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void loadPlaylistContents(playlist);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl border text-left transition group cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.14] border-white/25 text-white'
                            : 'bg-white/[0.02] border-transparent hover:bg-white/[0.08] text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/12">
                            {playlist.artworkUrl ? (
                              <img
                                src={playlist.artworkUrl}
                                alt={playlist.title}
                                className="w-full h-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                <ListMusic className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold truncate">
                              {playlist.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {playlist.subtitle}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onPlayBrowseCollection && playlist.playlistId) {
                              onPlayBrowseCollection({
                                playlistId: playlist.playlistId,
                              });
                              setShowDropdown(false);
                            } else {
                              playlist.onSelect();
                              setShowDropdown(false);
                            }
                          }}
                          title={`Play ${playlist.title}`}
                          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition shrink-0 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right Pane: Selected Playlist Contents (Actual Tracks) */}
                <div className="flex flex-col min-w-0 max-h-[300px] md:max-h-[370px] overflow-hidden">
                  {selectedPlaylistItem && (
                    <>
                      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2 border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-800 border border-white/15 shrink-0">
                            {(activePlaylistDetails?.artworkUrl ||
                              selectedPlaylistItem.artworkUrl) ? (
                              <img
                                src={
                                  activePlaylistDetails?.artworkUrl ||
                                  selectedPlaylistItem.artworkUrl
                                }
                                alt={selectedPlaylistItem.title}
                                className="w-full h-full object-cover"
                                draggable={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                <ListMusic className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14.5px] font-semibold text-white truncate">
                              {activePlaylistDetails?.title || selectedPlaylistItem.title}
                            </div>
                            <div className="text-[11.5px] text-zinc-400 truncate">
                              {activePlaylistDetails
                                ? `${activePlaylistDetails.tracks.length} tracks${
                                    activePlaylistDetails.subtitle
                                      ? ` • ${activePlaylistDetails.subtitle}`
                                      : ''
                                  }`
                                : selectedPlaylistItem.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (onPlayBrowseCollection) {
                                onPlayBrowseCollection({
                                  endpoint: activePlaylistDetails?.playEndpoint,
                                  playlistId:
                                    activePlaylistDetails?.playlistId ||
                                    selectedPlaylistItem.playlistId,
                                  shuffle: false,
                                  tracks: activePlaylistDetails?.tracks,
                                });
                                setShowDropdown(false);
                              } else {
                                selectedPlaylistItem.onSelect();
                                setShowDropdown(false);
                              }
                            }}
                            className="px-3 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-black" />
                            <span>Play</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (onPlayBrowseCollection) {
                                onPlayBrowseCollection({
                                  endpoint: activePlaylistDetails?.shuffleEndpoint,
                                  playlistId:
                                    activePlaylistDetails?.playlistId ||
                                    selectedPlaylistItem.playlistId,
                                  shuffle: true,
                                  tracks: activePlaylistDetails?.tracks,
                                });
                                setShowDropdown(false);
                              }
                            }}
                            title="Shuffle playlist"
                            className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white flex items-center gap-1 transition cursor-pointer"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Shuffle</span>
                          </button>

                          {onOpenDetails && activePlaylistKey && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDetails({
                                  browseId: activePlaylistKey,
                                  kind: 'Playlist',
                                  previewTitle: selectedPlaylistItem.title,
                                  previewSubtitle: selectedPlaylistItem.subtitle,
                                  previewArtworkUrl: selectedPlaylistItem.artworkUrl,
                                })
                              }
                              title="Open full playlist details"
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-1 custom-queue-scroll space-y-1">
                        {playlistLoadingKey === activePlaylistKey &&
                        !activePlaylistDetails ? (
                          <div className="flex items-center justify-center gap-2 py-12 text-xs text-zinc-300">
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--aesthetic-accent-strong,#C28356)]" />
                            <span>Loading playlist tracks...</span>
                          </div>
                        ) : activePlaylistError && !activePlaylistDetails ? (
                          <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                            <span className="text-xs text-zinc-400">
                              {activePlaylistError}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void loadPlaylistContents(selectedPlaylistItem, true)
                              }
                              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                              <span>Retry</span>
                            </button>
                          </div>
                        ) : activePlaylistDetails &&
                          activePlaylistDetails.tracks.length > 0 ? (
                          activePlaylistDetails.tracks.map((track, idx) => (
                            <div
                              key={track.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                onPlayBrowseTrack?.(track);
                                setShowDropdown(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  onPlayBrowseTrack?.(track);
                                  setShowDropdown(false);
                                }
                              }}
                              className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.10] text-left transition group cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 text-center text-[11px] text-zinc-500 tabular-nums shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
                                  {track.artworkUrl ? (
                                    <img
                                      src={track.artworkUrl}
                                      alt={track.title}
                                      className="w-full h-full object-cover"
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                      <Disc className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Play className="w-3.5 h-3.5 text-white fill-white" />
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[13px] font-medium text-white truncate">
                                    {track.title}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 truncate">
                                    {track.artist || track.subtitle}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {onQueueBrowseTrack &&
                                  renderQueueButtonsForAction(
                                    track.id,
                                    (playNext) => onQueueBrowseTrack(track, playNext),
                                    true
                                  )}
                                {track.duration && (
                                  <span className="text-[11px] text-zinc-400 tabular-nums w-10 text-right">
                                    {track.duration}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-xs text-zinc-400">
                            This playlist currently has no playable tracks.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
                                <div className="w-10 h-10 rounded-full bg-black/70 border border-white/25 flex items-center justify-center">
                                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
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

      {/* Empty-Focus Library & Quick Picks Chips */}
      {isEmptyFocusShelfVisible && !isDropdownVisible && (
        <div className="mb-2 flex items-center justify-center gap-2 flex-wrap">
          {LIBRARY_HUB_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => void handleLoadLibrarySection(chip.id)}
              className="px-3.5 py-1.5 rounded-full bg-black/55 hover:bg-white/15 backdrop-blur-xl border border-white/15 text-[12px] font-medium text-zinc-200 hover:text-white shadow-lg transition cursor-pointer flex items-center gap-1.5"
            >
              {chip.id === 'liked' && (
                <Heart className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
              )}
              {chip.id === 'playlists' && (
                <ListMusic className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
              )}
              {chip.id === 'home' && (
                <Sparkles className="w-3.5 h-3.5 text-[var(--aesthetic-accent,#E89B63)]" />
              )}
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Bar Input Pill */}
      <form
        onSubmit={handleSubmit}
        className="w-full flex items-center gap-2.5 px-4 h-[52px] rounded-full transition-all duration-200 focus-within:border-white/30"
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
          className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => {
            setInputFocused(true);
            if (query.trim().length > 0 || activeLibrarySection !== null) {
              setShowDropdown(true);
            }
          }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={stopPropagationOnly}
          onKeyPress={stopPropagationOnly}
          placeholder="Search YouTube Music"
          className="w-full bg-transparent text-[15px] text-zinc-100 placeholder-zinc-400/80 outline-none border-none select-text"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            title="Clear search"
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        )}
      </form>
    </div>
  );
};
