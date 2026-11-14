import React from 'react';
import ReactDOM from 'react-dom/client';
import { AestheticApp, AestheticAppActions } from './components/AestheticApp';
import {
  AestheticSettings,
  ExtensionMessage,
  QueueTrackItem,
  YTMStatusResponse,
} from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultSettings';
import { getSettings, subscribeToSettings } from '../shared/storage';
import {
  hasValidExtensionRuntime,
  shouldShieldKeyboardTarget,
} from '../shared/runtimeSafety';
import {
  readLiveTrackMetadata,
  triggerLike,
  triggerMuteToggle,
  triggerNext,
  triggerPlayPause,
  triggerPrevious,
  triggerRepeat,
  triggerSeek,
  triggerShuffle,
  triggerVolume,
} from './adapters/playerAdapter';
import {
  fetchLiveQueue,
  playNextQueueItemAtIndex,
  readDomQueueFallback,
  removeQueueItemAtIndex,
  selectQueueItemAtIndex,
} from './adapters/queueAdapter';
import {
  clearLyricsRetryTimer,
  getCachedLyricsForCurrentTrack,
  requestLyricsForTrack,
} from './adapters/lyricsAdapter';
import { searchYouTubeMusic } from './adapters/searchAdapter';
import { syncNativeVideoModePreference } from './adapters/videoAdapter';
import shadowStyles from './styles/shadow.css?inline';
import hostOverrideStyles from './styles/ytm-override.css?inline';

const HOST_CONTAINER_ID = 'aesthetic-music-root';
const HOST_STYLE_ID = 'aesthetic-music-host-styles';
const HOST_FONT_ID = 'aesthetic-music-google-fonts';

let currentSettings: AestheticSettings = { ...DEFAULT_SETTINGS };
let cachedQueue: QueueTrackItem[] = [];
let reactRoot: ReactDOM.Root | null = null;
let shadowHost: HTMLElement | null = null;
let playerBarObserver: MutationObserver | null = null;
let queueObserver: MutationObserver | null = null;
let playerStateObserver: MutationObserver | null = null;
let attachedVideoEl: HTMLVideoElement | null = null;
let cleanupVideoListeners: (() => void) | null = null;
let queueRefreshTimer: number | null = null;
let pendingRenderRaf: number | null = null;

// Shield Shadow DOM inputs from YouTube Music's global capture/bubble keyboard shortcuts only when active
const isolatedKeyboardShield = (e: KeyboardEvent) => {
  if (!currentSettings.enabled) return;
  const path = e.composedPath?.() || [];
  if (shouldShieldKeyboardTarget(path[0] ?? e.target)) {
    e.stopImmediatePropagation();
  }
};

function installKeyboardShield() {
  window.removeEventListener('keydown', isolatedKeyboardShield, true);
  window.removeEventListener('keypress', isolatedKeyboardShield, true);
  window.removeEventListener('keyup', isolatedKeyboardShield, true);
  window.addEventListener('keydown', isolatedKeyboardShield, true);
  window.addEventListener('keypress', isolatedKeyboardShield, true);
  window.addEventListener('keyup', isolatedKeyboardShield, true);
}

function removeKeyboardShield() {
  window.removeEventListener('keydown', isolatedKeyboardShield, true);
  window.removeEventListener('keypress', isolatedKeyboardShield, true);
  window.removeEventListener('keyup', isolatedKeyboardShield, true);
}

function scheduleRender() {
  if (!currentSettings.enabled || !reactRoot) return;
  if (pendingRenderRaf !== null) return;
  pendingRenderRaf = window.requestAnimationFrame(() => {
    pendingRenderRaf = null;
    if (currentSettings.enabled && reactRoot) {
      renderShadowUI();
    }
  });
}

function scheduleQueueRefresh(delayMs = 220) {
  if (queueRefreshTimer !== null) {
    window.clearTimeout(queueRefreshTimer);
  }
  queueRefreshTimer = window.setTimeout(async () => {
    queueRefreshTimer = null;
    if (!currentSettings.enabled) return;
    if (document.hidden && currentSettings.pauseWhenHidden) return;
    const nextQueue = await fetchLiveQueue();
    if (nextQueue.length > 0) {
      cachedQueue = nextQueue;
      scheduleRender();
    }
  }, delayMs);
}

const appActions: AestheticAppActions = {
  onTogglePlay: () => {
    triggerPlayPause();
    setTimeout(scheduleRender, 80);
    scheduleQueueRefresh(400);
  },
  onPrevious: () => {
    triggerPrevious();
    setTimeout(scheduleRender, 120);
    scheduleQueueRefresh(400);
  },
  onNext: () => {
    triggerNext();
    setTimeout(scheduleRender, 120);
    scheduleQueueRefresh(400);
  },
  onToggleRepeat: () => {
    triggerRepeat();
    setTimeout(scheduleRender, 80);
  },
  onToggleShuffle: () => {
    triggerShuffle();
    setTimeout(scheduleRender, 120);
    scheduleQueueRefresh(350);
  },
  onToggleLike: () => {
    triggerLike();
    setTimeout(scheduleRender, 120);
  },
  onSeek: (seconds: number) => {
    triggerSeek(seconds);
    scheduleRender();
  },
  onVolumeChange: (volume: number) => {
    triggerVolume(volume);
    scheduleRender();
  },
  onToggleMute: () => {
    triggerMuteToggle();
    setTimeout(scheduleRender, 60);
  },
  onSelectQueueIndex: (index: number) => {
    selectQueueItemAtIndex(index);
    setTimeout(scheduleRender, 150);
    scheduleQueueRefresh(280);
  },
  onPlayNextQueueIndex: async (index: number) => {
    const nextQueue = await playNextQueueItemAtIndex(index);
    if (nextQueue && nextQueue.length > 0) {
      cachedQueue = nextQueue;
      scheduleRender();
    } else {
      scheduleQueueRefresh(80);
    }
  },
  onRemoveQueueIndex: async (index: number) => {
    const nextQueue = await removeQueueItemAtIndex(index);
    if (nextQueue) {
      cachedQueue = nextQueue;
      scheduleRender();
    } else {
      scheduleQueueRefresh(80);
    }
  },
  onRefreshQueue: () => {
    scheduleQueueRefresh(50);
  },
  onRetryLyrics: () => {
    const liveTrack = readLiveTrackMetadata();
    requestLyricsForTrack(
      liveTrack,
      () => {
        if (currentSettings.enabled) scheduleRender();
      },
      true
    );
    scheduleRender();
  },
  onSearch: async (query: string) => {
    const results = await searchYouTubeMusic(query, (nextQueue) => {
      cachedQueue = nextQueue;
      scheduleRender();
    });
    return results.map((item) => ({
      ...item,
      onSelect: () => {
        item.onSelect();
        setTimeout(scheduleRender, 250);
        scheduleQueueRefresh(650);
      },
      onAddToQueue: item.onAddToQueue
        ? async (playNext = false) => {
            const ok = await item.onAddToQueue!(playNext);
            scheduleQueueRefresh(200);
            return Boolean(ok);
          }
        : undefined,
    }));
  },
};

function injectHostFontsAndStyles() {
  if (!document.getElementById(HOST_FONT_ID)) {
    const linkEl = document.createElement('link');
    linkEl.id = HOST_FONT_ID;
    linkEl.rel = 'stylesheet';
    linkEl.href =
      'https://fonts.googleapis.com/css2?family=Antonio:wght@200;300;400;600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@400;500;600;700&display=swap';
    document.head.appendChild(linkEl);
  }

  if (!document.getElementById(HOST_STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = HOST_STYLE_ID;
    styleEl.textContent = hostOverrideStyles;
    document.head.appendChild(styleEl);
  }
}

function removeHostOverrideStyles() {
  const styleEl = document.getElementById(HOST_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
}

function detachVideoListeners() {
  if (cleanupVideoListeners) {
    cleanupVideoListeners();
    cleanupVideoListeners = null;
  }
  attachedVideoEl = null;
}

function bindVideoListeners() {
  const videoEl = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  if (!videoEl) {
    detachVideoListeners();
    return;
  }
  if (videoEl === attachedVideoEl) return;

  detachVideoListeners();
  attachedVideoEl = videoEl;

  const onVideoEvent = () => {
    if (!currentSettings.enabled) return;
    if (document.hidden && currentSettings.pauseWhenHidden) return;
    scheduleRender();
  };
  const onTrackTransition = () => {
    if (!currentSettings.enabled) return;
    if (document.hidden && currentSettings.pauseWhenHidden) return;
    scheduleRender();
    scheduleQueueRefresh(300);
  };

  videoEl.addEventListener('timeupdate', onVideoEvent);
  videoEl.addEventListener('play', onVideoEvent);
  videoEl.addEventListener('playing', onTrackTransition);
  videoEl.addEventListener('pause', onVideoEvent);
  videoEl.addEventListener('volumechange', onVideoEvent);
  videoEl.addEventListener('loadedmetadata', onTrackTransition);
  videoEl.addEventListener('loadeddata', onTrackTransition);
  videoEl.addEventListener('resize', onTrackTransition);
  videoEl.addEventListener('durationchange', onTrackTransition);

  cleanupVideoListeners = () => {
    videoEl.removeEventListener('timeupdate', onVideoEvent);
    videoEl.removeEventListener('play', onVideoEvent);
    videoEl.removeEventListener('playing', onTrackTransition);
    videoEl.removeEventListener('pause', onVideoEvent);
    videoEl.removeEventListener('volumechange', onVideoEvent);
    videoEl.removeEventListener('loadedmetadata', onTrackTransition);
    videoEl.removeEventListener('loadeddata', onTrackTransition);
    videoEl.removeEventListener('resize', onTrackTransition);
    videoEl.removeEventListener('durationchange', onTrackTransition);
  };
}

function renderShadowUI() {
  if (!reactRoot) return;
  bindVideoListeners();

  const liveTrack = readLiveTrackMetadata();
  if (liveTrack && currentSettings.enabled) {
    syncNativeVideoModePreference(currentSettings.backgroundMode, liveTrack.id);
    if (currentSettings.lyricsEnabled) {
      requestLyricsForTrack(liveTrack, () => {
        if (currentSettings.enabled) {
          scheduleRender();
        }
      });
    }
  }
  const liveLyrics = getCachedLyricsForCurrentTrack(liveTrack);
  const liveQueue =
    cachedQueue.length > 0 ? cachedQueue : readDomQueueFallback();

  reactRoot.render(
    <React.StrictMode>
      <AestheticApp
        settings={currentSettings}
        liveTrack={liveTrack}
        liveQueue={liveQueue}
        liveLyrics={liveLyrics}
        actions={appActions}
      />
    </React.StrictMode>
  );
}

function onHostQueueChanged() {
  if (!currentSettings.enabled) return;
  if (document.hidden && currentSettings.pauseWhenHidden) return;
  scheduleQueueRefresh(25);
}

function onVisibilityChanged() {
  if (!currentSettings.enabled) return;
  if (!document.hidden) {
    scheduleRender();
    scheduleQueueRefresh(80);
  }
}

function onFullscreenChanged() {
  if (!currentSettings.enabled) return;
  scheduleRender();
}

function activateAestheticMode() {
  injectHostFontsAndStyles();
  installKeyboardShield();
  document.documentElement.setAttribute('data-aesthetic-mode', 'on');

  if (!shadowHost) {
    shadowHost = document.getElementById(HOST_CONTAINER_ID);
    if (!shadowHost) {
      shadowHost = document.createElement('div');
      shadowHost.id = HOST_CONTAINER_ID;
      document.body.appendChild(shadowHost);
    }

    const shadowRoot = shadowHost.shadowRoot || shadowHost.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = '';

    const styleEl = document.createElement('style');
    styleEl.textContent = shadowStyles;
    shadowRoot.appendChild(styleEl);

    const mountPoint = document.createElement('div');
    mountPoint.id = 'aesthetic-shadow-mount';
    shadowRoot.appendChild(mountPoint);

    reactRoot = ReactDOM.createRoot(mountPoint);
  }

  window.removeEventListener('aesthetic-music:queue-changed', onHostQueueChanged);
  window.addEventListener('aesthetic-music:queue-changed', onHostQueueChanged);
  document.removeEventListener('visibilitychange', onVisibilityChanged);
  document.addEventListener('visibilitychange', onVisibilityChanged);
  document.removeEventListener('fullscreenchange', onFullscreenChanged);
  document.addEventListener('fullscreenchange', onFullscreenChanged);

  renderShadowUI();
  startObservers();
  scheduleQueueRefresh(150);
}

function deactivateAestheticMode() {
  removeKeyboardShield();
  window.removeEventListener('aesthetic-music:queue-changed', onHostQueueChanged);
  document.removeEventListener('visibilitychange', onVisibilityChanged);
  document.removeEventListener('fullscreenchange', onFullscreenChanged);

  if (pendingRenderRaf !== null) {
    window.cancelAnimationFrame(pendingRenderRaf);
    pendingRenderRaf = null;
  }
  if (queueRefreshTimer !== null) {
    window.clearTimeout(queueRefreshTimer);
    queueRefreshTimer = null;
  }

  detachVideoListeners();
  clearLyricsRetryTimer();
  document.documentElement.removeAttribute('data-aesthetic-mode');
  document.documentElement.removeAttribute('data-aesthetic-bg');
  removeHostOverrideStyles();

  if (playerBarObserver) {
    playerBarObserver.disconnect();
    playerBarObserver = null;
  }
  if (queueObserver) {
    queueObserver.disconnect();
    queueObserver = null;
  }
  if (playerStateObserver) {
    playerStateObserver.disconnect();
    playerStateObserver = null;
  }
  window.dispatchEvent(new Event('resize'));

  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
  } else {
    document.getElementById(HOST_CONTAINER_ID)?.remove();
  }
}

function startObservers() {
  if (!playerBarObserver) {
    const playerBar = document.querySelector('ytmusic-player-bar') || document.body;
    playerBarObserver = new MutationObserver(() => {
      if (!currentSettings.enabled) return;
      if (document.hidden && currentSettings.pauseWhenHidden) return;
      scheduleRender();
    });
    playerBarObserver.observe(playerBar, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }

  if (!queueObserver) {
    const queueContainer =
      document.querySelector('ytmusic-player-queue#queue') || document.body;
    queueObserver = new MutationObserver(() => {
      if (!currentSettings.enabled) return;
      if (document.hidden && currentSettings.pauseWhenHidden) return;
      scheduleQueueRefresh(250);
    });
    queueObserver.observe(queueContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['selected', 'play-button-state'],
    });
  }

  if (!playerStateObserver) {
    const playerPage = document.querySelector('ytmusic-player-page') || document.body;
    playerStateObserver = new MutationObserver(() => {
      if (!currentSettings.enabled) return;
      if (document.hidden && currentSettings.pauseWhenHidden) return;
      scheduleRender();
    });
    playerStateObserver.observe(playerPage, {
      subtree: true,
      attributes: true,
      attributeFilter: [
        'video-mode',
        'playback-mode',
        'toggle-disabled',
        'disabled',
        'player-page-open',
        'hidden',
      ],
    });
  }

  bindVideoListeners();
}

async function initContentScript() {
  const loaded = await getSettings();
  let lastStorageEnabled = loaded.enabled;
  let lastAutoActivate = loaded.autoActivateOnYTM;

  const activateOnInit = loaded.enabled && loaded.autoActivateOnYTM;
  currentSettings = activateOnInit ? loaded : { ...loaded, enabled: false };

  if (currentSettings.enabled) {
    activateAestheticMode();
  } else {
    deactivateAestheticMode();
  }

  subscribeToSettings((newSettings) => {
    const wasEnabled = currentSettings.enabled;
    const storageEnabledChanged = newSettings.enabled !== lastStorageEnabled;
    const autoActivateTurnedOn =
      newSettings.autoActivateOnYTM && !lastAutoActivate && newSettings.enabled;

    lastStorageEnabled = newSettings.enabled;
    lastAutoActivate = newSettings.autoActivateOnYTM;

    const effectiveEnabled =
      storageEnabledChanged || autoActivateTurnedOn
        ? newSettings.enabled
        : wasEnabled;

    currentSettings = { ...newSettings, enabled: effectiveEnabled };

    if (effectiveEnabled && !wasEnabled) {
      activateAestheticMode();
    } else if (!effectiveEnabled && wasEnabled) {
      deactivateAestheticMode();
    } else if (effectiveEnabled) {
      scheduleRender();
    }
  });

  if (!hasValidExtensionRuntime() || !chrome.runtime?.onMessage) {
    return;
  }

  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: YTMStatusResponse) => void
    ) => {
      if (message.type === 'SET_AESTHETIC_MODE') {
        lastStorageEnabled = message.enabled;
        currentSettings = { ...currentSettings, enabled: message.enabled };
        if (message.enabled) {
          activateAestheticMode();
        } else {
          deactivateAestheticMode();
        }
      } else if (message.type === 'SETTINGS_UPDATED') {
        const effectiveEnabled =
          typeof message.settings.enabled === 'boolean'
            ? message.settings.enabled
            : currentSettings.enabled;
        if (typeof message.settings.enabled === 'boolean') {
          lastStorageEnabled = message.settings.enabled;
        }
        currentSettings = {
          ...currentSettings,
          ...message.settings,
          enabled: effectiveEnabled,
        };
        if (currentSettings.enabled) {
          scheduleRender();
        }
      } else if (message.type === 'WALLPAPER_UPDATED') {
        currentSettings = {
          ...currentSettings,
          customWallpaperVersion: message.version,
        };
        if (currentSettings.enabled) {
          scheduleRender();
        }
      } else if (message.type === 'RESET_SETTINGS') {
        lastStorageEnabled = DEFAULT_SETTINGS.enabled;
        lastAutoActivate = DEFAULT_SETTINGS.autoActivateOnYTM;
        currentSettings = { ...DEFAULT_SETTINGS };
        if (currentSettings.enabled) {
          activateAestheticMode();
        }
      }

      const liveTrack = readLiveTrackMetadata();
      const activeSource = !currentSettings.enabled
        ? 'off'
        : (currentSettings.backgroundMode === 'auto' ||
            currentSettings.backgroundMode === 'video') &&
          liveTrack?.isVideoActive
        ? 'video'
        : currentSettings.backgroundMode === 'custom'
        ? 'custom'
        : currentSettings.backgroundMode === 'off'
        ? 'off'
        : 'ambient';

      sendResponse({
        isYouTubeMusic: true,
        aestheticEnabled: currentSettings.enabled,
        trackTitle: liveTrack?.title || '',
        trackArtist: liveTrack?.artist || '',
        isPlaying: liveTrack?.isPlaying || false,
        hasVideo: liveTrack?.hasVideo || false,
        activeBackgroundSource: activeSource,
      });
      return true;
    }
  );
}

initContentScript();
