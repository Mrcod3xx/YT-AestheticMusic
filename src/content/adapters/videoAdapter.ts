import { BackgroundMode } from '../../shared/types';

let lastProcessedTrackKey = '';
let lastRequestedBackgroundMode: BackgroundMode | null = null;
let lastModeAttemptTime = 0;

export interface VideoDetectionState {
  hasVideo: boolean;
  isVideoActive: boolean;
  videoToggleLocked: boolean;
  videoElement: HTMLVideoElement | null;
}

function findAvButton(
  avToggle: HTMLElement | null,
  selector: string
): HTMLElement | null {
  if (!avToggle) return null;
  return (
    (avToggle.shadowRoot?.querySelector(selector) as HTMLElement | null) ||
    (avToggle.querySelector(selector) as HTMLElement | null)
  );
}

/**
 * Ensures <ytmusic-player-page> is open in the background DOM when a track is playing
 * so that <ytmusic-av-toggle>, <ytmusic-player-queue>, and full-resolution <video> decoding stay active.
 */
export function ensurePlayerPageActiveIfPlaying(): void {
  const appLayout = document.querySelector('ytmusic-app-layout');
  const videoEl = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  if (!appLayout || !videoEl || videoEl.paused) return;

  const isPlayerPageOpen = appLayout.hasAttribute('player-page-open');
  if (!isPlayerPageOpen) {
    const toggleBtn = document.querySelector(
      'ytmusic-player-bar .toggle-player-page-button, ytmusic-player-bar tp-yt-paper-icon-button.toggle-player-page-button'
    ) as HTMLElement | null;
    if (toggleBtn) {
      const innerBtn = toggleBtn.shadowRoot?.querySelector('button') as HTMLElement | null;
      if (innerBtn) {
        innerBtn.click();
      } else {
        toggleBtn.click();
      }
    }
  }
}

export function detectVideoState(): VideoDetectionState {
  const videoEl = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  const avToggle = document.querySelector('ytmusic-av-toggle') as HTMLElement | null;
  const playerPage = document.querySelector('ytmusic-player-page') as HTMLElement | null;
  const ytmPlayer = document.querySelector('ytmusic-player') as HTMLElement | null;
  const songImage = document.querySelector('ytmusic-player #song-image') as HTMLElement | null;
  const songVideo = document.querySelector('ytmusic-player #song-video') as HTMLElement | null;

  if (!videoEl) {
    return {
      hasVideo: false,
      isVideoActive: false,
      videoToggleLocked: false,
      videoElement: null,
    };
  }

  // Note: On free accounts for paired ATV tracks, YTM sets toggle-disabled on ytmusic-av-toggle
  const videoToggleLocked = Boolean(
    avToggle &&
      (avToggle.hasAttribute('toggle-disabled') || avToggle.hasAttribute('disabled'))
  );

  const videoBtn = findAvButton(
    avToggle,
    '.video-button, button.video-button, tp-yt-paper-button.video-button, [aria-label*="Video"]'
  );

  const videoBtnDisabled =
    !videoBtn ||
    videoBtn.hasAttribute('disabled') ||
    videoBtn.getAttribute('aria-disabled') === 'true';

  // Playback mode lives on <ytmusic-player playback-mode="..."> AND video-mode lives on <ytmusic-player-page>
  const playerPlaybackMode =
    ytmPlayer?.getAttribute('playback-mode') ||
    avToggle?.getAttribute('playback-mode') ||
    '';

  const songVideoVisible = songVideo
    ? window.getComputedStyle(songVideo).display !== 'none' &&
      !songVideo.hasAttribute('hidden')
    : false;

  const songImageHidden = songImage
    ? window.getComputedStyle(songImage).display === 'none' ||
      songImage.hasAttribute('hidden')
    : false;

  const isPlayerInVideoMode =
    Boolean(playerPage?.hasAttribute('video-mode')) ||
    Boolean(ytmPlayer?.hasAttribute('video-mode')) ||
    playerPlaybackMode === 'OMV_PREFERRED' ||
    (songVideoVisible && songImageHidden);

  const hasValidVideoDimensions =
    videoEl.videoWidth > 0 && videoEl.videoHeight > 0 && videoEl.readyState >= 2;

  const isVideoActive = hasValidVideoDimensions && isPlayerInVideoMode;
  const hasVideo = isVideoActive || (!videoToggleLocked && !videoBtnDisabled);

  return {
    hasVideo,
    isVideoActive,
    videoToggleLocked,
    videoElement: videoEl,
  };
}

/**
 * Synchronizes YouTube Music's Song/Video toggle with the user's Aesthetic Background Mode preference.
 * Respects YouTube Music's native toggle state and never bypasses Premium-locked tracks.
 */
export function syncNativeVideoModePreference(
  backgroundMode: BackgroundMode,
  trackId: string
): void {
  const now = Date.now();
  const modeChanged = backgroundMode !== lastRequestedBackgroundMode;

  if (!modeChanged && now - lastModeAttemptTime < 1000 && trackId === lastProcessedTrackKey) {
    return;
  }

  ensurePlayerPageActiveIfPlaying();

  const avToggle = document.querySelector('ytmusic-av-toggle') as HTMLElement | null;
  const ytmPlayer = document.querySelector('ytmusic-player') as HTMLElement | null;
  if (!avToggle) return;

  const toggleDisabled =
    avToggle.hasAttribute('disabled') || avToggle.hasAttribute('toggle-disabled');
  if (toggleDisabled) {
    lastRequestedBackgroundMode = backgroundMode;
    return;
  }

  const playbackMode =
    ytmPlayer?.getAttribute('playback-mode') ||
    avToggle.getAttribute('playback-mode') ||
    '';

  const videoBtn = findAvButton(
    avToggle,
    '.video-button, button.video-button, tp-yt-paper-button.video-button'
  );
  const songBtn = findAvButton(
    avToggle,
    '.song-button, button.song-button, tp-yt-paper-button.song-button'
  );

  const wantsVideo = backgroundMode === 'auto' || backgroundMode === 'video';

  if (wantsVideo) {
    const videoBtnDisabled =
      !videoBtn ||
      videoBtn.hasAttribute('disabled') ||
      videoBtn.getAttribute('aria-disabled') === 'true';

    if (!videoBtnDisabled && playbackMode === 'ATV_PREFERRED') {
      lastModeAttemptTime = now;
      lastProcessedTrackKey = trackId;
      lastRequestedBackgroundMode = backgroundMode;
      videoBtn.click();
    } else if (playbackMode) {
      lastRequestedBackgroundMode = backgroundMode;
    }
  } else if (backgroundMode === 'ambient' || backgroundMode === 'off') {
    const songBtnDisabled =
      !songBtn ||
      songBtn.hasAttribute('disabled') ||
      songBtn.getAttribute('aria-disabled') === 'true';

    if (
      !songBtnDisabled &&
      playbackMode === 'OMV_PREFERRED' &&
      (modeChanged || trackId !== lastProcessedTrackKey)
    ) {
      lastModeAttemptTime = now;
      lastProcessedTrackKey = trackId;
      lastRequestedBackgroundMode = backgroundMode;
      songBtn.click();
    } else if (playbackMode) {
      lastRequestedBackgroundMode = backgroundMode;
    }
  } else {
    lastRequestedBackgroundMode = backgroundMode;
  }
}
