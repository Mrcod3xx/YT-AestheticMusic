import { TrackMetadata } from '../../shared/types';
import { callMainWorldBridge } from './bridgeClient';
import { detectVideoState } from './videoAdapter';

let cachedPlayerBar: HTMLElement | null = null;
let cachedVideoEl: HTMLVideoElement | null = null;

function getConnectedPlayerBar(): HTMLElement | null {
  if (cachedPlayerBar && cachedPlayerBar.isConnected) {
    return cachedPlayerBar;
  }
  cachedPlayerBar = document.querySelector('ytmusic-player-bar') as HTMLElement | null;
  return cachedPlayerBar;
}

function getConnectedVideoEl(): HTMLVideoElement | null {
  if (cachedVideoEl && cachedVideoEl.isConnected) {
    return cachedVideoEl;
  }
  cachedVideoEl =
    (document.querySelector('video.html5-main-video') as HTMLVideoElement | null) ||
    (document.querySelector('#movie_player video') as HTMLVideoElement | null) ||
    (document.querySelector('video') as HTMLVideoElement | null);
  return cachedVideoEl;
}

export function upgradeArtworkUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.includes('lh3.googleusercontent.com') || rawUrl.includes('yt3.ggpht.com')) {
    return rawUrl.replace(/=w\d+-h\d+[^&?]*/g, '=w1000-h1000-l90-rj');
  }
  if (rawUrl.includes('i.ytimg.com')) {
    return rawUrl.replace(/(hqdefault|mqdefault|sddefault)\.jpg/, 'hq720.jpg');
  }
  return rawUrl;
}

export function readLiveTrackMetadata(): TrackMetadata | null {
  const playerBar = getConnectedPlayerBar();
  const titleEl = playerBar?.querySelector('.title');
  const bylineEl = playerBar?.querySelector('.byline');
  const thumbEl = playerBar?.querySelector('img.image') as HTMLImageElement | null;
  const videoEl = getConnectedVideoEl();
  const likeRenderer = playerBar?.querySelector('ytmusic-like-button-renderer');
  const likeBtn = likeRenderer?.querySelector(
    '#button-shape-like button, tp-yt-paper-icon-button.like'
  );

  const title =
    titleEl?.textContent?.trim() ||
    navigator.mediaSession?.metadata?.title ||
    '';

  if (!title) return null;

  const bylineText = bylineEl?.textContent || '';
  const bylineParts = bylineText
    .split('•')
    .map((s) => s.trim())
    .filter(Boolean);

  const artist =
    bylineParts[0] || navigator.mediaSession?.metadata?.artist || 'Unknown Artist';
  const album =
    bylineParts[1] || navigator.mediaSession?.metadata?.album || '';

  const artworks = navigator.mediaSession?.metadata?.artwork || [];
  const bestMediaSessionArt =
    artworks.length > 0 ? artworks[artworks.length - 1].src : '';

  const rawThumb =
    (thumbEl?.src && !thumbEl.src.startsWith('data:image/gif') ? thumbEl.src : '') ||
    bestMediaSessionArt ||
    '';

  const repeatAttr =
    (playerBar?.getAttribute('repeat-mode') as 'NONE' | 'ALL' | 'ONE' | null) ||
    'NONE';

  const { hasVideo, isVideoActive, videoToggleLocked } = detectVideoState();

  const isLiked =
    likeBtn?.getAttribute('aria-pressed') === 'true' ||
    likeRenderer?.getAttribute('like-status') === 'LIKE';

  const playPauseBtn = playerBar?.querySelector('#play-pause-button') as HTMLElement | null;
  const playBtnInner = playPauseBtn?.querySelector('button') as HTMLElement | null;
  const playStateLabel = (
    playPauseBtn?.getAttribute('title') ||
    playPauseBtn?.getAttribute('aria-label') ||
    playBtnInner?.getAttribute('aria-label') ||
    ''
  ).toLowerCase();
  const isPlayingFromButton = playStateLabel.includes('pause');
  const isPausedFromButton = playStateLabel.includes('play');
  const isPlaying = videoEl
    ? !videoEl.paused && !videoEl.ended
    : isPlayingFromButton ||
      (!isPausedFromButton && Boolean(playerBar?.hasAttribute('playing')));

  return {
    id: `${title}-${artist}`,
    title,
    artist,
    album,
    artworkUrl: rawThumb,
    highResArtworkUrl: upgradeArtworkUrl(rawThumb) || rawThumb,
    duration:
      videoEl?.duration && Number.isFinite(videoEl.duration) ? videoEl.duration : 0,
    currentTime: videoEl?.currentTime || 0,
    isPlaying,
    isLiked,
    hasVideo,
    isVideoActive,
    videoToggleLocked,
    shuffleOn: playerBar?.hasAttribute('shuffle-on') || false,
    repeatMode: repeatAttr,
    volume: videoEl
      ? Math.round((fadeRestoreVolume !== null ? fadeRestoreVolume : videoEl.volume) * 100)
      : 100,
    isMuted: videoEl ? videoEl.muted : false,
  };
}

export function triggerPlayPause(): void {
  const btn = document.querySelector(
    'ytmusic-player-bar #play-pause-button'
  ) as HTMLElement | null;
  const title = document.querySelector('ytmusic-player-bar .title')?.textContent?.trim();

  // If no song is loaded yet in the player bar, click the first playable item on the page/queue
  if (!title) {
    callMainWorldBridge('PLAY_QUEUE_INDEX', { index: 0 });
    return;
  }

  if (btn) {
    btn.click();
  } else {
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    if (video) {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }
  }
}

export function triggerPrevious(): void {
  const btn = document.querySelector(
    'ytmusic-player-bar .previous-button'
  ) as HTMLElement | null;
  btn?.click();
}

export function triggerNext(): void {
  const btn = document.querySelector(
    'ytmusic-player-bar .next-button'
  ) as HTMLElement | null;
  btn?.click();
}

export function triggerRepeat(): void {
  const btn = document.querySelector(
    'ytmusic-player-bar .repeat'
  ) as HTMLElement | null;
  btn?.click();
}

export async function triggerShuffle(): Promise<{
  shuffleOn: boolean;
  manualShuffled: boolean;
  moved: number;
}> {
  const res = await callMainWorldBridge<{
    shuffleOn?: boolean;
    manualShuffled?: boolean;
    moved?: number;
  }>('TOGGLE_SHUFFLE', {}, 2500);

  if (res) {
    return {
      shuffleOn: Boolean(res.shuffleOn),
      manualShuffled: Boolean(res.manualShuffled),
      moved: res.moved ?? 0,
    };
  }

  const btn = (document.querySelector('ytmusic-player-bar .shuffle button#button') ||
    document.querySelector('ytmusic-player-bar #expand-shuffle button#button') ||
    document.querySelector('ytmusic-player-bar .shuffle')) as HTMLElement | null;
  btn?.click();
  const playerBar = document.querySelector('ytmusic-player-bar');
  return {
    shuffleOn: playerBar?.hasAttribute('shuffle-on') || false,
    manualShuffled: false,
    moved: 0,
  };
}

export async function triggerShuffleUpcomingQueue(): Promise<{
  shuffled: boolean;
  moved: number;
}> {
  const res = await callMainWorldBridge<{
    shuffled?: boolean;
    moved?: number;
  }>('SHUFFLE_UPCOMING_QUEUE', {}, 2500);
  return {
    shuffled: Boolean(res?.shuffled),
    moved: res?.moved ?? 0,
  };
}

export function triggerLike(): void {
  const btn = document.querySelector(
    'ytmusic-player-bar ytmusic-like-button-renderer #button-shape-like button, ytmusic-player-bar ytmusic-like-button-renderer tp-yt-paper-icon-button.like'
  ) as HTMLElement | null;
  btn?.click();
}

export function triggerSeek(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  if (video) {
    video.currentTime = seconds;
  }
  callMainWorldBridge('SEEK_TO', { seconds });
}

let activeFadeToken = 0;
let activeFadeRaf = 0;
let fadeRestoreVolume: number | null = null;

function cancelPendingAudioFade(restoreOriginal = false): void {
  activeFadeToken += 1;
  if (activeFadeRaf) {
    cancelAnimationFrame(activeFadeRaf);
    activeFadeRaf = 0;
  }
  if (restoreOriginal && fadeRestoreVolume !== null) {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video) {
      video.volume = Math.max(0, Math.min(1, fadeRestoreVolume));
    }
    fadeRestoreVolume = null;
  }
}

function tweenVideoVolume(
  video: HTMLVideoElement,
  from: number,
  to: number,
  durationMs: number,
  token: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const clampedFrom = Math.max(0, Math.min(1, from));
    const clampedTo = Math.max(0, Math.min(1, to));
    if (durationMs <= 0 || Math.abs(clampedTo - clampedFrom) < 0.005) {
      if (token === activeFadeToken) {
        video.volume = clampedTo;
        resolve(true);
      } else {
        resolve(false);
      }
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      if (token !== activeFadeToken) {
        resolve(false);
        return;
      }
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * progress);
      video.volume = Math.max(0, Math.min(1, clampedFrom + (clampedTo - clampedFrom) * eased));
      if (progress >= 1) {
        activeFadeRaf = 0;
        resolve(true);
        return;
      }
      activeFadeRaf = requestAnimationFrame(step);
    };
    activeFadeRaf = requestAnimationFrame(step);
  });
}

export async function triggerPlayPauseWithFade(softFadeEnabled: boolean): Promise<void> {
  const video = document.querySelector('video') as HTMLVideoElement | null;
  if (!softFadeEnabled || !video || video.muted) {
    cancelPendingAudioFade(true);
    triggerPlayPause();
    return;
  }

  const targetVol = fadeRestoreVolume ?? video.volume;
  if (targetVol <= 0.02 && video.paused) {
    cancelPendingAudioFade(true);
    triggerPlayPause();
    return;
  }

  activeFadeToken += 1;
  if (activeFadeRaf) {
    cancelAnimationFrame(activeFadeRaf);
    activeFadeRaf = 0;
  }
  const token = activeFadeToken;

  if (!video.paused) {
    fadeRestoreVolume = targetVol;
    const completed = await tweenVideoVolume(video, video.volume, 0.01, 160, token);
    if (!completed || token !== activeFadeToken) return;
    triggerPlayPause();
    setTimeout(() => {
      if (token !== activeFadeToken) return;
      video.volume = Math.max(0, Math.min(1, targetVol));
      fadeRestoreVolume = null;
    }, 30);
    return;
  }

  const resumeVol = targetVol > 0.02 ? targetVol : 0.75;
  fadeRestoreVolume = resumeVol;
  video.volume = 0.01;
  triggerPlayPause();
  const completed = await tweenVideoVolume(video, 0.01, resumeVol, 220, token);
  if (completed && token === activeFadeToken) {
    fadeRestoreVolume = null;
  }
}

export async function triggerSkipWithFade(
  direction: 'next' | 'prev',
  softFadeEnabled: boolean
): Promise<void> {
  const triggerFn = direction === 'next' ? triggerNext : triggerPrevious;
  const video = document.querySelector('video') as HTMLVideoElement | null;
  if (!softFadeEnabled || !video || video.muted || video.paused || video.volume <= 0.02) {
    cancelPendingAudioFade(true);
    triggerFn();
    return;
  }

  const targetVol = fadeRestoreVolume ?? video.volume;
  activeFadeToken += 1;
  if (activeFadeRaf) {
    cancelAnimationFrame(activeFadeRaf);
    activeFadeRaf = 0;
  }
  const token = activeFadeToken;
  fadeRestoreVolume = targetVol;

  const dipped = await tweenVideoVolume(video, video.volume, 0.04, 130, token);
  if (!dipped || token !== activeFadeToken) return;
  triggerFn();

  await new Promise((resolve) => setTimeout(resolve, 70));
  if (token !== activeFadeToken) return;

  const risen = await tweenVideoVolume(video, Math.min(video.volume, 0.06), targetVol, 220, token);
  if (risen && token === activeFadeToken) {
    fadeRestoreVolume = null;
  }
}

export function triggerVolume(volumePercent: number): void {
  cancelPendingAudioFade(false);
  const clamped = Math.min(100, Math.max(0, volumePercent));
  const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  if (video) {
    video.muted = clamped === 0;
    video.volume = clamped / 100;
  }
  const slider = document.querySelector(
    'ytmusic-player-bar #volume-slider'
  ) as (HTMLElement & { value?: number }) | null;
  if (slider) {
    slider.value = clamped;
    slider.setAttribute('value', String(clamped));
  }
  callMainWorldBridge('SET_VOLUME', { volume: clamped });
}

export function triggerMuteToggle(): void {
  const muteBtn = document.querySelector(
    'ytmusic-player-bar .volume'
  ) as HTMLElement | null;
  if (muteBtn) {
    muteBtn.click();
  } else {
    const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
    if (video) {
      video.muted = !video.muted;
    }
  }
}

/**
 * Safely applies playback speed and analog pitch shifting directly onto the active
 * <video> element without touching MediaSource/WebAudio routing.
 */
export function applyPlaybackSpeedAndPitch(
  playbackRate: number,
  preservePitch: boolean
): void {
  const video = getConnectedVideoEl();
  if (!video) return;

  const safeRate = Number.isFinite(playbackRate)
    ? Math.max(0.75, Math.min(1.5, Math.round(playbackRate * 20) / 20))
    : 1.0;

  if (Math.abs(video.playbackRate - safeRate) > 0.005) {
    video.playbackRate = safeRate;
  }

  const pitchEl = video as HTMLVideoElement & {
    preservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  if (typeof pitchEl.preservesPitch === 'boolean') {
    pitchEl.preservesPitch = preservePitch;
  }
  if (typeof pitchEl.webkitPreservesPitch === 'boolean') {
    pitchEl.webkitPreservesPitch = preservePitch;
  }
}
