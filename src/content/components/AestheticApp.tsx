import React, { useEffect, useRef, useState } from 'react';
import {
  AbLoopRange,
  AestheticSettings,
  AmbientSoundChannel,
  AmbientSoundLevels,
  BackgroundMode,
  BrowseDetailsData,
  BrowseTarget,
  BrowseTrackItem,
  LibraryHubSection,
  LyricsData,
  LyricsMode,
  QueueTrackItem,
  StudioScenePreset,
  ThemePreset,
  TrackMetadata,
  TrackTrimPoint,
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
import { recordTrackInHistory } from '../../shared/listeningHistory';
import {
  applySceneSnapshot,
  buildCustomScenePreset,
  MAX_CUSTOM_SCENES,
} from '../../shared/scenePresets';
import {
  advancePomodoroPhase,
  computeSleepFadeFactor,
  createInitialPomodoroState,
  formatCountdownMmSs,
  PomodoroState,
} from '../../shared/sleepAndFocusTimer';
import {
  clampPlaybackRate,
  formatShortSeconds,
  normalizeAbLoopRange,
  shouldTriggerAbLoopSeek,
} from '../../shared/playbackStudio';
import {
  clearTrackTrim,
  loadTrackTrim,
  saveTrackTrim,
  shouldSkipIntro,
  shouldSkipOutro,
} from '../../shared/trackTrimStore';
import {
  DEFAULT_AMBIENT_SOUND_LEVELS,
  disposeAmbientAudio,
  setAmbientAudioPaused,
  setAmbientMasterMultiplier,
  updateAmbientSoundLevels,
} from '../adapters/ambientAudioAdapter';
import { applyPlaybackSpeedAndPitch } from '../adapters/playerAdapter';
import type {
  AddToPlaylistOptionsResponse,
  LibraryHubResponse,
} from '../adapters/searchAdapter';
import { BackgroundEngine } from './background/BackgroundEngine';
import { DigitalClock } from './clock/DigitalClock';
import { ContinuePlayingSidebar } from './sidebar/ContinuePlayingSidebar';
import { AlbumCarousel3D } from './carousel/AlbumCarousel3D';
import { LyricsStage } from './lyrics/LyricsStage';
import { SearchBarOverlay, SearchResultItem } from './search/SearchBarOverlay';
import {
  closeMiniPip,
  openOrToggleMiniPip,
  syncMiniPipState,
} from '../adapters/pipAdapter';
import { BrowseDetailsModal } from './search/BrowseDetailsModal';
import { AddToPlaylistModal, PlaylistTargetTrack } from './search/AddToPlaylistModal';
import { FloatingQuickActions } from './player/FloatingQuickActions';
import { FloatingPlayerBar } from './player/FloatingPlayerBar';
import {
  InAppSettingsPopover,
  StudioPopoverTab,
} from './settings/InAppSettingsPopover';
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
  onReorderQueueIndex?: (fromIndex: number, toIndex: number) => void;
  onRemoveQueueIndex: (index: number) => void;
  onClearUpcomingQueue?: () => void;
  onShuffleUpcomingQueue?: () => Promise<boolean>;
  onRefreshQueue: () => void;
  onRetryLyrics: () => void;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onFetchLibraryHub?: (
    section: LibraryHubSection
  ) => Promise<LibraryHubResponse>;
  onFetchAddToPlaylistOptions?: (
    videoId: string
  ) => Promise<AddToPlaylistOptionsResponse>;
  onToggleTrackInPlaylist?: (
    playlistId: string,
    videoId: string,
    add: boolean
  ) => Promise<{ ok: boolean; added: boolean; error?: string }>;
  onCreatePlaylist?: (
    title: string,
    privacyStatus: 'PRIVATE' | 'UNLISTED' | 'PUBLIC',
    videoIdOrIds?: string | string[]
  ) => Promise<{ ok: boolean; playlistId?: string; error?: string }>;
  onClearListeningHistory?: () => Promise<void>;
  onStartSongRadio?: (videoId: string) => Promise<boolean> | void;
  onFetchBrowseDetails: (
    browseId: string,
    kind?: 'Artist' | 'Album' | 'Playlist',
    params?: string
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
  const [requestedPopoverTab, setRequestedPopoverTab] = useState<{
    tab: StudioPopoverTab;
    signal: number;
  }>({ tab: 'presets', signal: 0 });
  const [playlistModalTarget, setPlaylistModalTarget] =
    useState<PlaylistTargetTrack | null>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [ambientLevels, setAmbientLevels] = useState<AmbientSoundLevels>({
    ...DEFAULT_AMBIENT_SOUND_LEVELS,
  });
  const [sleepMode, setSleepMode] = useState<'off' | 'countdown' | 'end-of-track'>(
    'off'
  );
  const [sleepEndAtMs, setSleepEndAtMs] = useState<number | null>(null);
  const [sleepRemainingMs, setSleepRemainingMs] = useState(0);
  const sleepPreFadeVolumeRef = useRef<number | null>(null);
  const sleepPrevTrackKeyRef = useRef<string | null>(null);
  const [pomodoro, setPomodoro] = useState<PomodoroState>(() =>
    createInitialPomodoroState()
  );
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [preservePitch, setPreservePitch] = useState(true);
  const [abLoop, setAbLoop] = useState<AbLoopRange>({ aSec: null, bSec: null });
  const abLastSeekAtRef = useRef(0);
  const [trackTrim, setTrackTrim] = useState<TrackTrimPoint | null>(null);
  const introSkippedTrackIdRef = useRef<string | null>(null);
  const outroSkippedTrackIdRef = useRef<string | null>(null);
  const outroAdvanceAtRef = useRef(0);
  const lastRecordedTrackKeyRef = useRef<string | null>(null);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [searchCloseDropdownSignal, setSearchCloseDropdownSignal] = useState(0);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const hudTimerRef = useRef<number | null>(null);
  const [customWallpaperVersion, setCustomWallpaperVersion] = useState(0);
  const [activeBrowseTarget, setActiveBrowseTarget] = useState<BrowseTarget | null>(null);
  const [browseHistory, setBrowseHistory] = useState<BrowseTarget[]>([]);
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
    setAmbientLevels({ ...DEFAULT_AMBIENT_SOUND_LEVELS });
    setPlaybackSpeed(1);
    setPreservePitch(true);
    setAbLoop({ aSec: null, bSec: null });
    handleCancelSleepTimer();
    showHud('Studio Settings Reset');
  };

  const ambientAudioActive =
    ambientLevels.rain > 0 ||
    ambientLevels.vinyl > 0 ||
    ambientLevels.fireplace > 0 ||
    ambientLevels.cafe > 0;

  const handleUpdateAmbientLevel = (channel: AmbientSoundChannel, level: number) => {
    setAmbientLevels((prev) => ({
      ...prev,
      [channel]: Math.max(0, Math.min(100, Math.round(level))),
    }));
  };

  const handleMuteAmbient = () => {
    setAmbientLevels({ ...DEFAULT_AMBIENT_SOUND_LEVELS });
    showHud('Cozy Soundscapes Muted');
  };

  const handleApplyAmbientMix = (levels: AmbientSoundLevels) => {
    setAmbientLevels({ ...levels });
    showHud('Cozy Sound Mix Applied');
  };

  const handleCancelSleepTimer = () => {
    if (sleepPreFadeVolumeRef.current !== null) {
      actions.onVolumeChange(sleepPreFadeVolumeRef.current);
      sleepPreFadeVolumeRef.current = null;
    }
    setAmbientMasterMultiplier(1);
    setSleepMode('off');
    setSleepEndAtMs(null);
    setSleepRemainingMs(0);
    sleepPrevTrackKeyRef.current = null;
  };

  const handleStartSleepTimer = (choice: number | 'end-of-track') => {
    if (sleepPreFadeVolumeRef.current !== null) {
      actions.onVolumeChange(sleepPreFadeVolumeRef.current);
      sleepPreFadeVolumeRef.current = null;
    }
    setAmbientMasterMultiplier(1);

    if (choice === 'end-of-track') {
      sleepPrevTrackKeyRef.current = activeTrack.videoId || activeTrack.id;
      setSleepMode('end-of-track');
      setSleepEndAtMs(null);
      setSleepRemainingMs(0);
      showHud('Sleep Timer: After This Song');
      return;
    }

    const totalMs = Math.max(1, Math.round(choice)) * 60_000;
    const endAt = Date.now() + totalMs;
    sleepPrevTrackKeyRef.current = null;
    setSleepMode('countdown');
    setSleepEndAtMs(endAt);
    setSleepRemainingMs(totalMs);
    showHud(`Sleep Timer: ${choice} min`);
  };

  const handleTogglePomodoro = () => {
    setPomodoro((prev) => ({
      ...prev,
      active: true,
      running: !prev.running,
    }));
  };

  const handleResetPomodoro = (phase?: 'focus' | 'break') => {
    const base = createInitialPomodoroState();
    const nextPhase = phase || pomodoro.phase;
    setPomodoro({
      ...base,
      active: true,
      running: true,
      phase: nextPhase,
      remainingMs: nextPhase === 'break' ? 5 * 60_000 : 25 * 60_000,
    });
    showHud(nextPhase === 'break' ? '5m Break Timer Started' : '25m Focus Timer Started');
  };

  const handleDismissPomodoro = () => {
    setPomodoro(createInitialPomodoroState());
  };

  const handleChangePlaybackSpeed = (speed: number) => {
    const clamped = clampPlaybackRate(speed);
    setPlaybackSpeed(clamped);
    applyPlaybackSpeedAndPitch(clamped, preservePitch);
  };

  const handleTogglePreservePitch = () => {
    const nextPreserve = !preservePitch;
    setPreservePitch(nextPreserve);
    applyPlaybackSpeedAndPitch(playbackSpeed, nextPreserve);
    showHud(nextPreserve ? 'Normal Voice Pitch' : 'Vinyl Pitch Mode: On');
  };

  const handleSetAbLoopPoint = (point: 'a' | 'b') => {
    const nowSec = activeTrack.currentTime || 0;
    const nextRange = normalizeAbLoopRange(
      point === 'a' ? nowSec : abLoop.aSec,
      point === 'b' ? nowSec : abLoop.bSec,
      activeTrack.duration
    );
    setAbLoop(nextRange);
    if (nextRange.aSec !== null && nextRange.bSec !== null) {
      showHud(
        `Looping ${formatShortSeconds(nextRange.aSec)} → ${formatShortSeconds(nextRange.bSec)}`
      );
    } else {
      showHud(
        point === 'a'
          ? `Loop Start Set: ${formatShortSeconds(nowSec)}`
          : `Loop End Set: ${formatShortSeconds(nowSec)}`
      );
    }
  };

  const handleClearAbLoop = () => {
    setAbLoop({ aSec: null, bSec: null });
    showHud('A–B Loop Cleared');
  };

  const handleShuffleUpcomingQueue = async () => {
    const ok = await actions.onShuffleUpcomingQueue?.();
    showHud(ok ? 'Queue Shuffled' : 'Add at least 2 upcoming tracks to shuffle');
  };

  const handleMarkTrackTrim = async (bound: 'start' | 'end') => {
    const vid = activeTrack.videoId?.trim();
    if (!vid || activeTrack.duration <= 0) {
      showHud('Play a track first to save skip points');
      return;
    }
    const nowSec = activeTrack.currentTime || 0;
    if (bound === 'start') {
      introSkippedTrackIdRef.current = vid;
      const saved = await saveTrackTrim(
        { videoId: vid, startSec: nowSec, endSec: trackTrim?.endSec },
        activeTrack.duration
      );
      setTrackTrim(saved);
      showHud(
        `Intro Skip Saved: ${formatShortSeconds(saved?.startSec ?? nowSec)}`
      );
      return;
    }

    outroSkippedTrackIdRef.current = vid;
    const saved = await saveTrackTrim(
      { videoId: vid, startSec: trackTrim?.startSec, endSec: nowSec },
      activeTrack.duration
    );
    setTrackTrim(saved);
    showHud(`Outro Skip Saved: ${formatShortSeconds(saved?.endSec ?? nowSec)}`);
  };

  const handleClearTrackTrim = async () => {
    const vid = activeTrack.videoId?.trim();
    if (!vid) return;
    await clearTrackTrim(vid);
    introSkippedTrackIdRef.current = null;
    outroSkippedTrackIdRef.current = null;
    setTrackTrim(null);
    showHud('Intro & Outro Skip Cleared');
  };

  const handleApplyScene = (scene: StudioScenePreset) => {
    void saveSettings(applySceneSnapshot(scene.snapshot, settings));
    showHud(`Scene: ${scene.name}`);
  };

  const handleSaveCustomScene = (name: string) => {
    if (settings.customScenes.length >= MAX_CUSTOM_SCENES) {
      showHud(`Limit reached (${MAX_CUSTOM_SCENES} scenes max)`);
      return;
    }
    const created = buildCustomScenePreset(name, settings);
    const nextScenes = [...settings.customScenes, created].slice(0, MAX_CUSTOM_SCENES);
    void saveSettings({ customScenes: nextScenes });
    showHud(`Saved Scene: ${created.name}`);
  };

  const handleDeleteCustomScene = (sceneId: string) => {
    const nextScenes = settings.customScenes.filter((scene) => scene.id !== sceneId);
    void saveSettings({ customScenes: nextScenes });
    showHud('Saved Scene Removed');
  };

  const handleOpenSoundTab = () => {
    setSettingsPopoverOpen(true);
    setRequestedPopoverTab((prev) => ({ tab: 'sound', signal: prev.signal + 1 }));
  };

  const handleOpenSaveToPlaylist = (customTarget?: PlaylistTargetTrack) => {
    const target: PlaylistTargetTrack | null = customTarget?.videoId
      ? customTarget
      : activeTrack.videoId
      ? {
          title: activeTrack.title,
          artist: activeTrack.artist,
          artworkUrl: activeTrack.highResArtworkUrl || activeTrack.artworkUrl,
          videoId: activeTrack.videoId,
        }
      : null;

    if (!target) {
      showHud('Play a YouTube Music song first to save it');
      return;
    }
    setPlaylistModalTarget(target);
  };

  const handleClearListeningHistory = async () => {
    await actions.onClearListeningHistory?.();
    showHud('Recent History Cleared');
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

  const loadBrowseTarget = async (target: BrowseTarget) => {
    const reqId = ++browseRequestIdRef.current;
    setActiveBrowseTarget(target);
    setBrowseError(null);
    if (
      browseDetails?.browseId !== target.browseId ||
      Boolean(target.params)
    ) {
      setBrowseDetails(null);
    }
    setBrowseLoading(true);
    try {
      const fetched = await actions.onFetchBrowseDetails(
        target.browseId,
        target.kind,
        target.params
      );
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

  const handleOpenBrowseDetails = async (
    target: BrowseTarget,
    options?: { pushHistory?: boolean }
  ) => {
    if (options?.pushHistory && activeBrowseTarget) {
      setBrowseHistory((prev) => [...prev, activeBrowseTarget]);
    } else if (!options?.pushHistory) {
      setBrowseHistory([]);
    }
    await loadBrowseTarget(target);
  };

  const handleBrowseBack = () => {
    if (browseHistory.length === 0) return;
    const prevTarget = browseHistory[browseHistory.length - 1];
    setBrowseHistory((prev) => prev.slice(0, -1));
    void loadBrowseTarget(prevTarget);
  };

  const handleCloseBrowseModal = () => {
    setActiveBrowseTarget(null);
    setBrowseHistory([]);
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
  const playlistModalOpen = Boolean(playlistModalTarget);
  const themeTokens = getThemeTokens(settings);
  const effectsPaused = isTabHidden && settings.pauseWhenHidden;
  const effectivePanelAlpha = settings.lowGpuMode
    ? Math.min(0.92, themeTokens.panelAlpha + 0.14)
    : themeTokens.panelAlpha;

  // Cozy soundscape mixer sync + pause/unmount cleanup
  useEffect(() => {
    updateAmbientSoundLevels(ambientLevels);
  }, [ambientLevels]);

  useEffect(() => {
    setAmbientAudioPaused(!activeTrack.isPlaying || effectsPaused);
  }, [activeTrack.isPlaying, effectsPaused]);

  useEffect(() => {
    return () => {
      disposeAmbientAudio();
      applyPlaybackSpeedAndPitch(1.0, true);
    };
  }, []);

  // Re-apply playback speed & pitch cleanly when YTM swaps underlying video source
  useEffect(() => {
    applyPlaybackSpeedAndPitch(playbackSpeed, preservePitch);
  }, [playbackSpeed, preservePitch, activeTrack.videoId, activeTrack.id]);

  // Auto-clear A-B section loop whenever track changes
  const prevLoopTrackKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const trackKey = activeTrack.videoId || activeTrack.id;
    if (prevLoopTrackKeyRef.current && prevLoopTrackKeyRef.current !== trackKey) {
      setAbLoop({ aSec: null, bSec: null });
    }
    prevLoopTrackKeyRef.current = trackKey;
  }, [activeTrack.videoId, activeTrack.id]);

  // Trigger A-B section loop seek cleanly when currentTime reaches B
  useEffect(() => {
    const seekTarget = shouldTriggerAbLoopSeek(activeTrack.currentTime, abLoop);
    if (seekTarget !== null && Date.now() - abLastSeekAtRef.current > 350) {
      abLastSeekAtRef.current = Date.now();
      actions.onSeek(seekTarget);
    }
  }, [activeTrack.currentTime, abLoop]);

  // Load saved Intro/Outro trim points whenever active videoId changes
  useEffect(() => {
    const vid = hasLiveTrack ? activeTrack.videoId?.trim() || '' : '';
    introSkippedTrackIdRef.current = null;
    outroSkippedTrackIdRef.current = null;
    if (!vid) {
      setTrackTrim(null);
      return;
    }

    let cancelled = false;
    void loadTrackTrim(vid).then((loaded) => {
      if (!cancelled) {
        setTrackTrim(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasLiveTrack, activeTrack.videoId]);

  // Auto-skip saved Intro / Outro points cleanly once per track play
  useEffect(() => {
    if (!hasLiveTrack || !activeTrack.isPlaying || !activeTrack.videoId) return;
    if (!trackTrim || trackTrim.videoId !== activeTrack.videoId) return;

    const introTarget = shouldSkipIntro(
      activeTrack.currentTime,
      trackTrim,
      introSkippedTrackIdRef.current === activeTrack.videoId
    );
    if (introTarget !== null) {
      introSkippedTrackIdRef.current = activeTrack.videoId;
      actions.onSeek(introTarget);
      showHud(`Skipped Intro → ${formatShortSeconds(introTarget)}`);
      return;
    }

    if (
      shouldSkipOutro(
        activeTrack.currentTime,
        activeTrack.duration,
        trackTrim,
        outroSkippedTrackIdRef.current === activeTrack.videoId
      ) &&
      Date.now() - outroAdvanceAtRef.current > 1500
    ) {
      outroSkippedTrackIdRef.current = activeTrack.videoId;
      outroAdvanceAtRef.current = Date.now();
      handleNext();
      showHud('Skipped Outro → Next Song');
    }
  }, [
    hasLiveTrack,
    activeTrack.isPlaying,
    activeTrack.videoId,
    activeTrack.currentTime,
    activeTrack.duration,
    trackTrim,
  ]);

  // Local 50-track Recent Listening History recorder
  useEffect(() => {
    if (!hasLiveTrack || !activeTrack.videoId) return;
    const key = `${activeTrack.videoId}:${activeTrack.title}`;
    if (lastRecordedTrackKeyRef.current === key) return;
    lastRecordedTrackKeyRef.current = key;
    void recordTrackInHistory(activeTrack);
  }, [
    hasLiveTrack,
    activeTrack.videoId,
    activeTrack.title,
    activeTrack.artist,
    activeTrack.artworkUrl,
    activeTrack.highResArtworkUrl,
  ]);

  // Live refs for interval-driven Sleep Timer and End-of-Track auto-pause
  const sleepLiveRef = useRef({
    volume: activeTrack.volume,
    isPlaying: activeTrack.isPlaying,
    currentTime: activeTrack.currentTime,
    duration: activeTrack.duration,
    trackKey: activeTrack.videoId || activeTrack.id,
    onVolumeChange: actions.onVolumeChange,
    onTogglePlay: actions.onTogglePlay,
  });
  sleepLiveRef.current = {
    volume: activeTrack.volume,
    isPlaying: activeTrack.isPlaying,
    currentTime: activeTrack.currentTime,
    duration: activeTrack.duration,
    trackKey: activeTrack.videoId || activeTrack.id,
    onVolumeChange: actions.onVolumeChange,
    onTogglePlay: actions.onTogglePlay,
  };

  useEffect(() => {
    if (sleepMode !== 'countdown' || sleepEndAtMs === null) return;

    const timerId = window.setInterval(() => {
      const remaining = sleepEndAtMs - Date.now();
      setSleepRemainingMs(Math.max(0, remaining));
      const factor = computeSleepFadeFactor(remaining);
      setAmbientMasterMultiplier(factor);

      if (factor < 1) {
        if (sleepPreFadeVolumeRef.current === null) {
          sleepPreFadeVolumeRef.current = sleepLiveRef.current.volume;
        }
        sleepLiveRef.current.onVolumeChange(
          Math.max(0, Math.round(sleepPreFadeVolumeRef.current * factor))
        );
      }

      if (remaining <= 0) {
        window.clearInterval(timerId);
        if (sleepLiveRef.current.isPlaying) {
          sleepLiveRef.current.onTogglePlay();
        }
        if (sleepPreFadeVolumeRef.current !== null) {
          sleepLiveRef.current.onVolumeChange(sleepPreFadeVolumeRef.current);
          sleepPreFadeVolumeRef.current = null;
        }
        setAmbientMasterMultiplier(1);
        setSleepMode('off');
        setSleepEndAtMs(null);
        setSleepRemainingMs(0);
        showHud('Sleep Timer: Music Paused');
      }
    }, 500);

    return () => window.clearInterval(timerId);
  }, [sleepMode, sleepEndAtMs]);

  useEffect(() => {
    if (sleepMode !== 'end-of-track') return;
    const currentKey = activeTrack.videoId || activeTrack.id;
    const trackChanged =
      Boolean(sleepPrevTrackKeyRef.current) &&
      sleepPrevTrackKeyRef.current !== currentKey;
    const nearingTrackEnd =
      activeTrack.duration > 1 &&
      activeTrack.duration - activeTrack.currentTime <= 0.35 &&
      activeTrack.isPlaying;

    if (trackChanged || nearingTrackEnd) {
      if (activeTrack.isPlaying) {
        actions.onTogglePlay();
      }
      setSleepMode('off');
      sleepPrevTrackKeyRef.current = null;
      showHud('Sleep Timer: Paused After Song');
    }
  }, [
    sleepMode,
    activeTrack.videoId,
    activeTrack.id,
    activeTrack.currentTime,
    activeTrack.duration,
    activeTrack.isPlaying,
  ]);

  // Pomodoro Study / Focus countdown tick
  useEffect(() => {
    if (!pomodoro.active || !pomodoro.running) return;
    const id = window.setInterval(() => {
      setPomodoro((prev) => {
        if (!prev.active || !prev.running) return prev;
        const nextMs = prev.remainingMs - 1000;
        if (nextMs <= 0) {
          const advanced = advancePomodoroPhase(prev);
          showHud(
            advanced.phase === 'break'
              ? 'Focus session done — 5m Break started'
              : 'Break finished — Back to 25m Focus'
          );
          return advanced;
        }
        return { ...prev, remainingMs: nextMs };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pomodoro.active, pomodoro.running]);

  const shortcutHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  shortcutHandlerRef.current = (event: KeyboardEvent) => {
    if (!settings.enabled) return;

    const action = resolveAestheticShortcut(event, {
      playlistModalOpen,
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
        playlistModalOpen,
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
        case 'playlist-modal':
          setPlaylistModalTarget(null);
          break;
        case 'settings-popover':
          setSettingsPopoverOpen(false);
          break;
        case 'shortcuts-help':
          setShortcutsHelpOpen(false);
          break;
        case 'browse-modal':
          handleCloseBrowseModal();
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
      case 'toggle-pip':
        void handleTogglePip();
        break;
      case 'save-to-playlist':
        handleOpenSaveToPlaylist();
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

  const currentSyncedLyricText = (() => {
    if (
      !settings.lyricsEnabled ||
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

  const activeMiniLyricText =
    !settings.showMiniLyricLine ||
    isLyricsVisible ||
    zenMode ||
    detailsModalOpen ||
    searchDropdownOpen
      ? ''
      : currentSyncedLyricText;

  const pipCallbacksRef = useRef({
    onTogglePlay: handleTogglePlay,
    onPrevious: handlePrevious,
    onNext: handleNext,
    onSeek: actions.onSeek,
  });
  pipCallbacksRef.current = {
    onTogglePlay: handleTogglePlay,
    onPrevious: handlePrevious,
    onNext: handleNext,
    onSeek: actions.onSeek,
  };

  const buildMiniPipPayload = () => ({
    title: activeTrack.title,
    artist: activeTrack.artist,
    artworkUrl: activeTrack.highResArtworkUrl || activeTrack.artworkUrl,
    isPlaying: activeTrack.isPlaying,
    currentTime: activeTrack.currentTime,
    duration: activeTrack.duration,
    accentColor: themeTokens.accentHighlight,
    lyricLine: currentSyncedLyricText,
  });

  const handleTogglePip = async () => {
    const opened = await openOrToggleMiniPip(buildMiniPipPayload(), {
      onTogglePlay: () => pipCallbacksRef.current.onTogglePlay(),
      onPrevious: () => pipCallbacksRef.current.onPrevious(),
      onNext: () => pipCallbacksRef.current.onNext(),
      onSeek: (sec) => pipCallbacksRef.current.onSeek(sec),
      onClosed: () => setPipOpen(false),
    });
    setPipOpen(opened);
    showHud(opened ? 'Mini Desk Player Opened' : 'Mini Desk Player Closed');
  };

  useEffect(() => {
    if (pipOpen) {
      syncMiniPipState(buildMiniPipPayload());
    }
  });

  useEffect(() => {
    return () => closeMiniPip();
  }, []);

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
        onMoveTrack={
          hasLiveTrack || liveQueue.length > 0
            ? actions.onReorderQueueIndex
            : undefined
        }
        onRemoveTrack={
          hasLiveTrack || liveQueue.length > 0
            ? actions.onRemoveQueueIndex
            : undefined
        }
        onClearUpcoming={
          hasLiveTrack || liveQueue.length > 0
            ? actions.onClearUpcomingQueue
            : undefined
        }
        onShuffleUpcoming={
          hasLiveTrack || liveQueue.length > 0
            ? () => {
                void handleShuffleUpcomingQueue();
              }
            : undefined
        }
        onSaveQueueAsPlaylist={
          hasLiveTrack || liveQueue.length > 0
            ? (target) => handleOpenSaveToPlaylist(target)
            : undefined
        }
        onSaveToPlaylist={(track) => handleOpenSaveToPlaylist(track)}
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
          clockStyle={settings.clockStyle || 'digital'}
          scalePercent={settings.clockFontSize}
          color={settings.clockColor}
          fontFamily={settings.fontFamily}
          paused={effectsPaused}
          sleepCountdownText={
            sleepMode === 'countdown'
              ? formatCountdownMmSs(sleepRemainingMs)
              : sleepMode === 'end-of-track'
              ? 'After Song'
              : null
          }
          onCancelSleepTimer={
            sleepMode !== 'off' ? handleCancelSleepTimer : undefined
          }
          pomodoro={
            pomodoro.active
              ? {
                  phase: pomodoro.phase,
                  timeText: formatCountdownMmSs(pomodoro.remainingMs),
                  running: pomodoro.running,
                  onToggleRun: handleTogglePomodoro,
                  onStop: handleDismissPomodoro,
                }
              : null
          }
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
          romanizeLyrics={settings.romanizeLyrics}
          trackTitle={activeTrack.title}
          trackArtist={activeTrack.artist}
          trackAlbum={activeTrack.album}
          trackArtworkUrl={activeTrack.highResArtworkUrl || activeTrack.artworkUrl}
          accentColor={themeTokens.accentHighlight}
          onToggleRomanize={() => {
            const next = !settings.romanizeLyrics;
            void saveSettings({ romanizeLyrics: next });
            showHud(next ? 'Romanized Lyrics: On' : 'Romanized Lyrics: Off');
          }}
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
          canGoBack={browseHistory.length > 0}
          onBack={handleBrowseBack}
          onClose={handleCloseBrowseModal}
          onRetry={() => {
            if (activeBrowseTarget) {
              void loadBrowseTarget(activeBrowseTarget);
            }
          }}
          onOpenTarget={(nextTarget) => {
            void handleOpenBrowseDetails(nextTarget, { pushHistory: true });
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
          onSaveTrackToPlaylist={(track) => handleOpenSaveToPlaylist(track)}
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
          onSaveToPlaylist={(track) => handleOpenSaveToPlaylist(track)}
          onClearListeningHistory={handleClearListeningHistory}
        />

        {/* Floating Quick Action Pills */}
        <FloatingQuickActions
          zenMode={zenMode}
          lyricsOpen={isLyricsVisible}
          lyricsOnly={lyricsOnly}
          pipOpen={pipOpen}
          searchVisible={settings.showSearchBar && !zenMode}
          backgroundMode={settings.backgroundMode}
          playerPosition={settings.playerPosition}
          onToggleEye={handleToggleEye}
          onToggleSearch={handleToggleSearch}
          onCycleBackgroundMode={handleCycleBackgroundMode}
          onTogglePip={() => {
            void handleTogglePip();
          }}
          onToggleFullscreen={handleToggleFullscreen}
        />

        {/* Floating Bottom Glassmorphism Music Player */}
        <FloatingPlayerBar
          track={activeTrack}
          settings={settings}
          lyricsOpen={isLyricsVisible}
          settingsOpen={settingsPopoverOpen}
          playbackSpeed={playbackSpeed}
          abLoop={abLoop}
          trackTrim={trackTrim}
          sleepTimerActive={sleepMode !== 'off'}
          ambientAudioActive={ambientAudioActive}
          onTogglePlay={handleTogglePlay}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onToggleRepeat={actions.onToggleRepeat}
          onToggleShuffle={actions.onToggleShuffle}
          onToggleLike={actions.onToggleLike}
          onOpenSaveToPlaylist={() => handleOpenSaveToPlaylist()}
          onOpenSoundTab={handleOpenSoundTab}
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
        requestedTab={requestedPopoverTab}
        settings={settings}
        track={activeTrack}
        lyrics={liveLyrics}
        lyricsTimingOffsetMs={lyricsTimingOffsetMs}
        ambientLevels={ambientLevels}
        onUpdateAmbientLevel={handleUpdateAmbientLevel}
        onApplyAmbientMix={handleApplyAmbientMix}
        onMuteAmbient={handleMuteAmbient}
        sleepMode={sleepMode}
        sleepRemainingMs={sleepRemainingMs}
        onStartSleepTimer={handleStartSleepTimer}
        onCancelSleepTimer={handleCancelSleepTimer}
        pomodoro={pomodoro}
        onTogglePomodoro={handleTogglePomodoro}
        onResetPomodoro={handleResetPomodoro}
        onDismissPomodoro={handleDismissPomodoro}
        playbackSpeed={playbackSpeed}
        preservePitch={preservePitch}
        abLoop={abLoop}
        onChangePlaybackSpeed={handleChangePlaybackSpeed}
        onTogglePreservePitch={handleTogglePreservePitch}
        onSetAbLoopPoint={handleSetAbLoopPoint}
        onClearAbLoop={handleClearAbLoop}
        trackTrim={trackTrim}
        onMarkTrackTrim={(bound) => {
          void handleMarkTrackTrim(bound);
        }}
        onClearTrackTrim={() => {
          void handleClearTrackTrim();
        }}
        onApplyScene={handleApplyScene}
        onSaveCustomScene={handleSaveCustomScene}
        onDeleteCustomScene={handleDeleteCustomScene}
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

      <AddToPlaylistModal
        target={playlistModalTarget}
        borderRadius={settings.borderRadius}
        onClose={() => setPlaylistModalTarget(null)}
        onFetchOptions={async (videoId) =>
          actions.onFetchAddToPlaylistOptions
            ? actions.onFetchAddToPlaylistOptions(videoId)
            : {
                ok: false,
                loggedIn: true,
                options: [],
                error: 'Playlist saving is unavailable.',
              }
        }
        onTogglePlaylist={async (playlistId, videoId, add) =>
          actions.onToggleTrackInPlaylist
            ? actions.onToggleTrackInPlaylist(playlistId, videoId, add)
            : { ok: false, added: add, error: 'Playlist saving is unavailable.' }
        }
        onCreatePlaylist={async (title, privacyStatus, videoIdOrIds) =>
          actions.onCreatePlaylist
            ? actions.onCreatePlaylist(title, privacyStatus, videoIdOrIds)
            : { ok: false, error: 'Playlist creation is unavailable.' }
        }
        onNotify={showHud}
      />

      <ShortcutsModal
        open={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  );
};
