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
    volume: videoEl ? Math.round(videoEl.volume * 100) : 100,
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

export function triggerShuffle(): void {
  const btn = document.querySelector(
    'ytmusic-player-bar .shuffle'
  ) as HTMLElement | null;
  btn?.click();
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

export function triggerVolume(volumePercent: number): void {
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
