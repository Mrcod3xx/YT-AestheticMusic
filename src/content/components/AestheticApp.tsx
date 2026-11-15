import React, { useEffect, useRef, useState } from 'react';
import {
  AestheticSettings,
  BackgroundMode,
  BrowseDetailsData,
  BrowseTarget,
  BrowseTrackItem,
  LibraryHubSection,
  LyricsData,
  LyricsMode,
  QueueTrackItem,
  ThemePreset,
  TrackMetadata,
} from '../../shared/types';
import {
  applyThemePreset,
  resetSettings,
  saveSettings,
} from '../../shared/storage';
import {
  getThemeTokens,
  STUDIO_THEME_ORDER,
  THEME_DEFINITIONS,
} from '../../shared/themeTokens';
import {
  clampLyricsTimingOffsetMs,
  findActiveSyncedLineIndex,
} from '../../shared/lyricsParser';
import {
  resolveAestheticShortcut,
  resolveEscapeTarget,
} from '../../shared/keyboardShortcuts';
import { BackgroundEngine } from './background/BackgroundEngine';
import { DigitalClock } from './clock/DigitalClock';
import { ContinuePlayingSidebar } from './sidebar/ContinuePlayingSidebar';
import { AlbumCarousel3D } from './carousel/AlbumCarousel3D';
import { LyricsStage } from './lyrics/LyricsStage';
import { SearchBarOverlay, SearchResultItem } from './search/SearchBarOverlay';
import type { LibraryHubResponse } from '../adapters/searchAdapter';
import { BrowseDetailsModal } from './search/BrowseDetailsModal';
import { FloatingQuickActions } from './player/FloatingQuickActions';
import { FloatingPlayerBar } from './player/FloatingPlayerBar';
import { InAppSettingsPopover } from './settings/InAppSettingsPopover';
import { ShortcutsModal } from './settings/ShortcutsModal';
import { SAMPLE_ACTIVE_TRACK, SAMPLE_QUEUE_ITEMS } from '../data/sampleData';

export interface AestheticAppActions {
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onToggleLike: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onSelectQueueIndex: (index: number) => void;
  onPlayNextQueueIndex: (index: number) => void;
  onRemoveQueueIndex: (index: number) => void;
  onRefreshQueue: () => void;
  onRetryLyrics: () => void;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onFetchLibraryHub?: (
    section: LibraryHubSection
  ) => Promise<LibraryHubResponse>;
  onStartSongRadio?: (videoId: string) => Promise<boolean> | void;
  onFetchBrowseDetails: (
    browseId: string,
    kind?: 'Artist' | 'Album' | 'Playlist'
  ) => Promise<BrowseDetailsData | null>;
  onPlayBrowseCollection: (params: {
    endpoint?: Record<string, unknown>;
    playlistId?: string;
    shuffle?: boolean;
    tracks?: BrowseTrackItem[];
  }) => void;
  onPlayBrowseTrack: (track: BrowseTrackItem) => void;
  onQueueBrowseTrack: (
    track: BrowseTrackItem,
    playNext: boolean
  ) => Promise<boolean>;
}

interface AestheticAppProps {
  settings: AestheticSettings;
  liveTrack: TrackMetadata | null;
  liveQueue: QueueTrackItem[];
  liveLyrics: LyricsData;
  actions: AestheticAppActions;
}

export const AestheticApp: React.FC<AestheticAppProps> = ({
  settings,
  liveTrack,
  liveQueue,
  liveLyrics,
  actions,
}) => {
  const [zenMode, setZenMode] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(settings.lyricsOpen);
  const [lyricsOnly, setLyricsOnly] = useState(false);
  const [lyricsMode, setLyricsMode] = useState<LyricsMode>(settings.defaultLyricsMode);
  const [lyricsTimingOffsetMs, setLyricsTimingOffsetMs] = useState(0);

  useEffect(() => {
    setLyricsTimingOffsetMs(0);
  }, [liveLyrics.trackKey]);
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [searchCloseDropdownSignal, setSearchCloseDropdownSignal] = useState(0);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const hudTimerRef = useRef<number | null>(null);
  const [customWallpaperVersion, setCustomWallpaperVersion] = useState(0);
  const [activeBrowseTarget, setActiveBrowseTarget] = useState<BrowseTarget | null>(null);
  const [browseDetails, setBrowseDetails] = useState<BrowseDetailsData | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const browseRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current !== null) {
        window.clearTimeout(hudTimerRef.current);
      }
    };
  }, []);

  const showHud = (message: string) => {
    setHudMessage(message);
    if (hudTimerRef.current !== null) {
      window.clearTimeout(hudTimerRef.current);
    }
    hudTimerRef.current = window.setTimeout(() => {
      setHudMessage(null);
      hudTimerRef.current = null;
    }, 1600);
  };
  const [isTabHidden, setIsTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );

  useEffect(() => {
    const onVisibility = () => setIsTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    setLyricsOpen(settings.lyricsOpen);
    if (!settings.lyricsOpen) {
      setLyricsOnly(false);
    }
  }, [settings.lyricsOpen]);

  useEffect(() => {
    if (!settings.showSearchBar) {
      setActiveBrowseTarget(null);
    }
  }, [settings.showSearchBar]);

  useEffect(() => {
    setLyricsMode(settings.defaultLyricsMode);
  }, [settings.defaultLyricsMode]);

  const [sampleIndex, setSampleIndex] = useState(2);
  const [samplePlaying, setSamplePlaying] = useState(false);

  const hasLiveTrack = Boolean(liveTrack && liveTrack.title);
  const selectedQueueItem =
    liveQueue.find((q) => q.isSelected) || liveQueue[0] || null;

  const activeTrack: TrackMetadata = hasLiveTrack
    ? {
        ...liveTrack!,
        videoId: liveTrack!.videoId || selectedQueueItem?.videoId,
      }
    : selectedQueueItem
    ? {
        ...SAMPLE_ACTIVE_TRACK,
        id: `queue-${selectedQueueItem.index}-${selectedQueueItem.title}`,
        videoId: selectedQueueItem.videoId,
        title: selectedQueueItem.title,
        artist: selectedQueueItem.artist,
        album: '',
        artworkUrl:
          selectedQueueItem.artworkUrl || SAMPLE_ACTIVE_TRACK.artworkUrl,
        highResArtworkUrl:
          selectedQueueItem.highResArtworkUrl ||
          selectedQueueItem.artworkUrl ||
          SAMPLE_ACTIVE_TRACK.highResArtworkUrl,
        duration: 0,
        currentTime: 0,
        isPlaying: selectedQueueItem.isPlaying,
      }
    : {
        ...SAMPLE_ACTIVE_TRACK,
        title: SAMPLE_QUEUE_ITEMS[sampleIndex]?.title || SAMPLE_ACTIVE_TRACK.title,
        artist: SAMPLE_QUEUE_ITEMS[sampleIndex]?.artist || SAMPLE_ACTIVE_TRACK.artist,
        artworkUrl:
          SAMPLE_QUEUE_ITEMS[sampleIndex]?.artworkUrl || SAMPLE_ACTIVE_TRACK.artworkUrl,
        highResArtworkUrl:
          SAMPLE_QUEUE_ITEMS[sampleIndex]?.highResArtworkUrl ||
          SAMPLE_ACTIVE_TRACK.highResArtworkUrl,
        isPlaying: samplePlaying,
      };

  const activeQueue: QueueTrackItem[] =
    liveQueue.length > 0
      ? liveQueue
      : SAMPLE_QUEUE_ITEMS.map((item, idx) => ({
          ...item,
          isSelected: idx === sampleIndex,
          isPlaying: idx === sampleIndex && samplePlaying,
        }));

  const handleUpdateSettings = async (partial: Partial<AestheticSettings>) => {
    await saveSettings(partial);
  };

  const handleSelectTheme = async (preset: ThemePreset) => {
    await applyThemePreset(preset);
  };

  const handleResetSettings = async () => {
    await resetSettings();
  };

  const handleCycleTheme = async () => {
    const order: ThemePreset[] =
      settings.customBackgroundType !== 'none'
        ? [...STUDIO_THEME_ORDER, 'custom']
        : [...STUDIO_THEME_ORDER];
    const idx = order.indexOf(settings.theme);
    const nextTheme = order[(idx + 1) % order.length];
    await applyThemePreset(nextTheme);
    showHud(`Theme: ${THEME_DEFINITIONS[nextTheme].label}`);
  };

  const handleCycleBackgroundMode = async () => {
    const order: BackgroundMode[] = ['auto', 'video', 'ambient', 'off'];
    const idx = order.indexOf(settings.backgroundMode);
    const nextMode = order[(idx + 1) % order.length];
    await saveSettings({ backgroundMode: nextMode });
    const bgLabels: Record<BackgroundMode, string> = {
      auto: !activeTrack.hasVideo
        ? 'Background: Auto (Ambient)'
        : activeTrack.isVideoActive
        ? 'Background: Auto (MV)'
        : 'Background: Auto (Ambient)',
      video: activeTrack.hasVideo
        ? 'Background: Music Video'
        : 'Background: MV Unavailable (Ambient)',
      ambient: 'Background: Ambient',
      off: 'Background: Dark Canvas',
      custom: 'Background: Custom Wallpaper',
    };
    showHud(bgLabels[nextMode]);
  };

  const handleCycleLyricsMode = () => {
    const order: LyricsMode[] = ['focus', 'compact', 'full'];
    const next = order[(order.indexOf(lyricsMode) + 1) % order.length];
    setLyricsMode(next);
    saveSettings({ defaultLyricsMode: next });
    const modeLabels: Record<LyricsMode, string> = {
      focus: 'Lyrics: Focus',
      compact: 'Lyrics: Compact',
      full: 'Lyrics: Full View',
    };
    showHud(modeLabels[next]);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleTogglePlay = () => {
    if (hasLiveTrack || liveQueue.length > 0) {
      actions.onTogglePlay();
    } else {
      setSamplePlaying((p) => !p);
    }
  };

  const handlePrevious = () => {
    if (hasLiveTrack || liveQueue.length > 0) {
      actions.onPrevious();
    } else {
      setSampleIndex((i) => (i - 1 + SAMPLE_QUEUE_ITEMS.length) % SAMPLE_QUEUE_ITEMS.length);
    }
  };

  const handleNext = () => {
    if (hasLiveTrack || liveQueue.length > 0) {
      actions.onNext();
    } else {
      setSampleIndex((i) => (i + 1) % SAMPLE_QUEUE_ITEMS.length);
    }
  };

  const handleSelectQueueItem = (index: number) => {
    if (hasLiveTrack || liveQueue.length > 0) {
      actions.onSelectQueueIndex(index);
    } else {
      setSampleIndex(index);
      setSamplePlaying(true);
    }
  };

  const handleOpenBrowseDetails = async (target: BrowseTarget) => {
    const reqId = ++browseRequestIdRef.current;
    setActiveBrowseTarget(target);
    setBrowseError(null);
    if (browseDetails?.browseId !== target.browseId) {
      setBrowseDetails(null);
    }
    setBrowseLoading(true);
    try {
      const fetched = await actions.onFetchBrowseDetails(target.browseId, target.kind);
      if (browseRequestIdRef.current !== reqId) return;
      if (fetched) {
        setBrowseDetails(fetched);
      } else {
        setBrowseError('Unable to load YouTube Music details for this selection.');
      }
    } catch {
      if (browseRequestIdRef.current === reqId) {
        setBrowseError('Network error while loading YouTube Music details.');
      }
    } finally {
      if (browseRequestIdRef.current === reqId) {
        setBrowseLoading(false);
      }
    }
  };

  const handleToggleEye = () => {
    if (isLyricsVisible) {
      setLyricsOnly((prev) => {
        const next = !prev;
        showHud(next ? 'Lyrics-Only View' : 'Standard Lyrics View');
        return next;
      });
    } else {
      setZenMode((prev) => {
        const next = !prev;
        showHud(next ? 'Zen Mode: On' : 'Zen Mode: Off');
        return next;
      });
    }
  };

  const handleToggleSearch = () => {
    const nextShow = !settings.showSearchBar;
    if (!nextShow) {
      setActiveBrowseTarget(null);
      setSearchDropdownOpen(false);
    }
    handleUpdateSettings({ showSearchBar: nextShow });
    showHud(nextShow ? 'Search Bar: Shown' : 'Search Bar: Hidden');
  };

  const handleFocusSearchShortcut = () => {
    setZenMode(false);
    setActiveBrowseTarget(null);
    if (!settings.showSearchBar) {
      void saveSettings({ showSearchBar: true });
    }
    setSearchFocusSignal((n) => n + 1);
  };

  const handleToggleLyrics = () => {
    const nextOpen = !lyricsOpen;
    setLyricsOpen(nextOpen);
    if (!nextOpen) {
      setLyricsOnly(false);
    }
    setActiveBrowseTarget(null);
    saveSettings({ lyricsOpen: nextOpen });
    showHud(nextOpen ? 'Lyrics: Shown' : 'Lyrics: Hidden');
  };

  const handleToggleSidebar = () => {
    const nextShow = !settings.showSidebar;
    handleUpdateSettings({ showSidebar: nextShow });
    showHud(nextShow ? 'Queue Sidebar: Shown' : 'Queue Sidebar: Hidden');
  };

  const handleToggleMute = () => {
    actions.onToggleMute();
    showHud(activeTrack.isMuted ? 'Unmuted' : 'Muted');
  };

  const isLyricsVisible = lyricsOpen && settings.lyricsEnabled;
  const hideLyricsArtwork = isLyricsVisible && lyricsOnly;
  const detailsModalOpen = Boolean(activeBrowseTarget) && !zenMode;
  const themeTokens = getThemeTokens(settings);
  const effectsPaused = isTabHidden && settings.pauseWhenHidden;
  const effectivePanelAlpha = settings.lowGpuMode
    ? Math.min(0.92, themeTokens.panelAlpha + 0.14)
    : themeTokens.panelAlpha;

  const shortcutHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  shortcutHandlerRef.current = (event: KeyboardEvent) => {
    if (!settings.enabled) return;

    const action = resolveAestheticShortcut(event, {
      settingsPopoverOpen,
      shortcutsHelpOpen,
      detailsModalOpen,
      searchDropdownOpen,
      zenMode,
      lyricsOnly,
    });
    if (!action) return;

    if (action === 'escape') {
      const layer = resolveEscapeTarget({
        settingsPopoverOpen,
        shortcutsHelpOpen,
        detailsModalOpen,
        searchDropdownOpen,
        zenMode,
        lyricsOnly,
      });
      if (!layer) return;
      event.preventDefault();
      event.stopPropagation();

      const eventTarget = event.composedPath?.()[0] ?? event.target;
      if (
        eventTarget instanceof HTMLElement &&
        (eventTarget.tagName === 'INPUT' || eventTarget.tagName === 'TEXTAREA')
      ) {
        eventTarget.blur();
      }

      switch (layer) {
        case 'settings-popover':
          setSettingsPopoverOpen(false);
          break;
        case 'shortcuts-help':
          setShortcutsHelpOpen(false);
          break;
        case 'browse-modal':
          setActiveBrowseTarget(null);
          break;
        case 'search-dropdown':
          setSearchCloseDropdownSignal((n) => n + 1);
          break;
        case 'zen-mode':
          setZenMode(false);
          showHud('Zen Mode: Off');
          break;
        case 'lyrics-only':
          setLyricsOnly(false);
          showHud('Standard Lyrics View');
          break;
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    switch (action) {
      case 'toggle-play': {
        const eventTarget = event.composedPath?.()[0] ?? event.target;
        const rootNode =
          eventTarget instanceof Node ? eventTarget.getRootNode?.() : null;
        if (rootNode && 'activeElement' in rootNode) {
          const activeEl = (rootNode as ShadowRoot).activeElement;
          if (activeEl instanceof HTMLButtonElement) {
            activeEl.blur();
          }
        }
        handleTogglePlay();
        showHud(activeTrack.isPlaying ? 'Paused' : 'Playing');
        break;
      }
      case 'focus-search':
        handleFocusSearchShortcut();
        break;
      case 'toggle-lyrics':
        if (!settings.lyricsEnabled) {
          showHud('Lyrics disabled in Studio');
          return;
        }
        handleToggleLyrics();
        break;
      case 'cycle-lyrics-mode':
        if (!settings.lyricsEnabled) {
          showHud('Lyrics disabled in Studio');
          return;
        }
        if (!lyricsOpen) {
          setLyricsOpen(true);
          setActiveBrowseTarget(null);
          void saveSettings({ lyricsOpen: true });
        }
        handleCycleLyricsMode();
        break;
      case 'toggle-eye':
        handleToggleEye();
        break;
      case 'toggle-sidebar':
        handleToggleSidebar();
        break;
      case 'toggle-mute':
        handleToggleMute();
        break;
      case 'previous-track':
        handlePrevious();
        showHud('Previous Track');
        break;
      case 'next-track':
        handleNext();
        showHud('Next Track');
        break;
      case 'toggle-shortcuts-help':
        setShortcutsHelpOpen((prev) => !prev);
        break;
    }
  };

  const handleStartRadio = async (track: { videoId?: string; title: string }) => {
    if (!track.videoId || !actions.onStartSongRadio) return;
    await actions.onStartSongRadio(track.videoId);
    showHud(`Radio: ${track.title}`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      shortcutHandlerRef.current(event);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const activeMiniLyricText = (() => {
    if (
      !settings.showMiniLyricLine ||
      !settings.lyricsEnabled ||
      isLyricsVisible ||
      zenMode ||
      detailsModalOpen ||
      searchDropdownOpen ||
      !liveLyrics.available ||
      !liveLyrics.isSynced ||
      liveLyrics.lines.length === 0
    ) {
      return '';
    }
    const lineIdx = findActiveSyncedLineIndex(
      liveLyrics.lines,
      activeTrack.currentTime * 1000,
      lyricsTimingOffsetMs
    );
    return lineIdx >= 0 ? liveLyrics.lines[lineIdx]?.text?.trim() || '' : '';
  })();

  return (
    <div
      className="aesthetic-viewport flex flex-col justify-between items-center relative"
      data-tab-hidden={effectsPaused ? 'true' : 'false'}
      data-low-gpu={settings.lowGpuMode ? 'true' : 'false'}
      style={
        {
          '--aesthetic-accent': themeTokens.accentHighlight,
          '--aesthetic-accent-strong': themeTokens.accent,
          '--aesthetic-accent-rgb': themeTokens.accentRgb,
          '--aesthetic-accent-hi-rgb': themeTokens.accentHighlightRgb,
          '--aesthetic-panel-rgb': themeTokens.def.panelRgb,
          '--aesthetic-panel-alpha': String(effectivePanelAlpha),
          '--aesthetic-card-top-rgb': themeTokens.def.cardTopRgb,
          '--aesthetic-card-bottom-rgb': themeTokens.def.cardBottomRgb,
          '--aesthetic-card-top-alpha': String(themeTokens.cardTopAlpha),
          '--aesthetic-card-bottom-alpha': String(themeTokens.cardBottomAlpha),
          '--aesthetic-player-rgb': themeTokens.def.playerRgb,
          '--aesthetic-active-card-start': themeTokens.def.activeCardStartRgb,
          '--aesthetic-active-card-end': themeTokens.def.activeCardEndRgb,
          '--aesthetic-radius': `${settings.borderRadius}px`,
          '--aesthetic-font-family': themeTokens.fontFamilyCss,
          '--aesthetic-clock-font': themeTokens.clockFontFamilyCss,
          fontFamily: themeTokens.fontFamilyCss,
        } as React.CSSProperties
      }
    >
      {/* Phase 4: Dynamic Background Engine (Live Video + Dual-Buffer Ambient Artwork + Custom Wallpaper) */}
      <BackgroundEngine
        settings={settings}
        track={activeTrack}
        lyricsOpen={isLyricsVisible}
        customWallpaperVersion={customWallpaperVersion}
        paused={effectsPaused}
      />

      {/* Left Floating 3D-Angled "Continue Playing" Sidebar */}
      <ContinuePlayingSidebar
        visible={settings.showSidebar && !zenMode && !hideLyricsArtwork}
        currentTrack={activeTrack}
        queue={activeQueue}
        onSelectTrack={handleSelectQueueItem}
        onPlayNextTrack={
          hasLiveTrack || liveQueue.length > 0
            ? actions.onPlayNextQueueIndex
            : undefined
        }
        onRemoveTrack={
          hasLiveTrack || liveQueue.length > 0
            ? actions.onRemoveQueueIndex
            : undefined
        }
        onStartRadio={
          hasLiveTrack && actions.onStartSongRadio ? handleStartRadio : undefined
        }
        onRefreshQueue={actions.onRefreshQueue}
      />

      {/* Top Section: Large Digital Clock */}
      <header className="w-full pt-[3.2vh] flex flex-col items-center z-20 pointer-events-none">
        <DigitalClock
          visible={settings.showClock}
          use24Hour={settings.clock24Hour}
          scalePercent={settings.clockFontSize}
          color={settings.clockColor}
          fontFamily={settings.fontFamily}
          paused={effectsPaused}
        />
      </header>

      {/* Center Stage: 3D Album Carousel / Lyrics Stage / Browse Details Modal */}
      <main className="flex-1 w-full flex flex-col items-center justify-center relative z-20 px-6 pointer-events-none">
        <AlbumCarousel3D
          visible={
            settings.showCarousel &&
            !zenMode &&
            !detailsModalOpen &&
            !hideLyricsArtwork
          }
          stageStyle={settings.stageStyle}
          lyricsOpen={isLyricsVisible}
          reducedMotion={settings.reducedMotion}
          paused={effectsPaused}
          currentTrack={activeTrack}
          queue={activeQueue}
          borderRadius={settings.borderRadius}
          onSelectQueueIndex={handleSelectQueueItem}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onTogglePlay={handleTogglePlay}
          onCycleLyricsMode={handleCycleLyricsMode}
        />

        <LyricsStage
          open={isLyricsVisible && !zenMode && !detailsModalOpen}
          mode={lyricsMode}
          lyrics={liveLyrics}
          currentTimeMs={activeTrack.currentTime * 1000}
          timingOffsetMs={lyricsTimingOffsetMs}
          isPlaying={activeTrack.isPlaying}
          isVideoActive={activeTrack.isVideoActive}
          carouselVisible={
            settings.showCarousel && !zenMode && !hideLyricsArtwork
          }
          sidebarVisible={
            settings.showSidebar && !zenMode && !hideLyricsArtwork
          }
          fontSize={settings.lyricsFontSize}
          highlightActive={settings.lyricsHighlightActive}
          borderRadius={settings.borderRadius}
          reducedMotion={settings.reducedMotion}
          onChangeMode={(m) => {
            setLyricsMode(m);
            saveSettings({ defaultLyricsMode: m });
          }}
          onSeekSeconds={actions.onSeek}
          onRetry={actions.onRetryLyrics}
        />

        <BrowseDetailsModal
          target={detailsModalOpen ? activeBrowseTarget : null}
          details={browseDetails}
          loading={browseLoading}
          error={browseError}
          activeTrack={activeTrack}
          borderRadius={settings.borderRadius}
          onClose={() => setActiveBrowseTarget(null)}
          onRetry={() => {
            if (activeBrowseTarget) {
              void handleOpenBrowseDetails(activeBrowseTarget);
            }
          }}
          onPlayCollection={(shuffle) => {
            if (!browseDetails) return;
            actions.onPlayBrowseCollection({
              endpoint: shuffle
                ? browseDetails.shuffleEndpoint
                : browseDetails.playEndpoint,
              playlistId: browseDetails.playlistId,
              shuffle,
              tracks: browseDetails.tracks,
            });
          }}
          onPlayTrack={(track) => actions.onPlayBrowseTrack(track)}
          onQueueTrack={(track, playNext) =>
            actions.onQueueBrowseTrack(track, playNext)
          }
        />
      </main>

      {/* Bottom Dock Area: Mini Lyric Line + Search Bar + Quick Action Pills + Floating Player Bar */}
      <footer className="w-full pb-[2.8vh] px-6 flex flex-col items-center gap-3 z-30 pointer-events-none">
        {activeMiniLyricText && (
          <button
            type="button"
            onClick={handleToggleLyrics}
            title="Open synced lyrics (L)"
            className="pointer-events-auto max-w-[min(640px,86vw)] px-4 py-1.5 rounded-full bg-black/50 hover:bg-black/65 backdrop-blur-xl border border-white/15 shadow-lg transition cursor-pointer flex items-center gap-2"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: themeTokens.accentHighlight }}
            />
            <span className="text-[13px] font-medium text-white/95 truncate tracking-tight">
              {activeMiniLyricText}
            </span>
          </button>
        )}

        {/* Integrated Search Bar */}
        <SearchBarOverlay
          visible={settings.showSearchBar && !zenMode}
          detailsOpen={detailsModalOpen}
          focusSignal={searchFocusSignal}
          closeDropdownSignal={searchCloseDropdownSignal}
          onDropdownVisibilityChange={setSearchDropdownOpen}
          onSearch={actions.onSearch}
          onFetchLibraryHub={actions.onFetchLibraryHub}
          onOpenDetails={handleOpenBrowseDetails}
          onFetchBrowseDetails={actions.onFetchBrowseDetails}
          onPlayBrowseCollection={actions.onPlayBrowseCollection}
          onPlayBrowseTrack={actions.onPlayBrowseTrack}
          onQueueBrowseTrack={actions.onQueueBrowseTrack}
        />

        {/* Floating Quick Action Pills */}
        <FloatingQuickActions
          zenMode={zenMode}
          lyricsOpen={isLyricsVisible}
          lyricsOnly={lyricsOnly}
          searchVisible={settings.showSearchBar && !zenMode}
          backgroundMode={settings.backgroundMode}
          playerPosition={settings.playerPosition}
          onToggleEye={handleToggleEye}
          onToggleSearch={handleToggleSearch}
          onCycleBackgroundMode={handleCycleBackgroundMode}
          onToggleFullscreen={handleToggleFullscreen}
        />

        {/* Floating Bottom Glassmorphism Music Player */}
        <FloatingPlayerBar
          track={activeTrack}
          settings={settings}
          lyricsOpen={isLyricsVisible}
          settingsOpen={settingsPopoverOpen}
          onTogglePlay={handleTogglePlay}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onToggleRepeat={actions.onToggleRepeat}
          onToggleShuffle={actions.onToggleShuffle}
          onToggleLike={actions.onToggleLike}
          onSeek={actions.onSeek}
          onVolumeChange={actions.onVolumeChange}
          onToggleMute={handleToggleMute}
          onToggleLyrics={handleToggleLyrics}
          onToggleSidebar={handleToggleSidebar}
          onToggleSettingsPopover={() => setSettingsPopoverOpen((s) => !s)}
          onCycleTheme={handleCycleTheme}
        />
      </footer>

      {hudMessage && (
        <div
          key={hudMessage}
          role="status"
          aria-live="polite"
          className="fixed top-5 right-6 z-[60] pointer-events-none px-4 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/15 shadow-2xl text-xs font-medium text-white tracking-wide flex items-center gap-2"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: themeTokens.accentHighlight }}
          />
          <span>{hudMessage}</span>
        </div>
      )}

      {/* In-App Studio Settings Popover */}
      <InAppSettingsPopover
        open={settingsPopoverOpen}
        settings={settings}
        track={activeTrack}
        lyrics={liveLyrics}
        lyricsTimingOffsetMs={lyricsTimingOffsetMs}
        onAdjustLyricsOffset={(deltaMs) =>
          setLyricsTimingOffsetMs((prev) =>
            clampLyricsTimingOffsetMs(prev + deltaMs)
          )
        }
        onResetLyricsOffset={() => setLyricsTimingOffsetMs(0)}
        onClose={() => setSettingsPopoverOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onSelectTheme={handleSelectTheme}
        onReset={handleResetSettings}
        onWallpaperUploaded={() => setCustomWallpaperVersion((v) => v + 1)}
        onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
      />

      <ShortcutsModal
        open={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  );
};
