import { QueueTrackItem, TrackMetadata } from '../../shared/types';

/**
 * Generates an atmospheric, high-contrast SVG album cover Data URI
 * for fallback / sample preview when no track is actively loaded in YouTube Music.
 */
function createArtworkDataUri(
  bgStart: string,
  bgEnd: string,
  accent: string,
  title: string,
  subtitle: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="38%" r="55%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${bgEnd}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="300" cy="230" r="260" fill="url(#glow)"/>
    <circle cx="300" cy="250" r="110" fill="none" stroke="${accent}" stroke-opacity="0.25" stroke-width="2"/>
    <circle cx="300" cy="250" r="45" fill="${accent}" fill-opacity="0.18"/>
    <rect x="255" y="520" width="90" height="28" rx="4" fill="rgba(255,255,255,0.85)"/>
    <text x="300" y="538" text-anchor="middle" fill="#000" font-family="Inter, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5">ADVISORY</text>
    <text x="300" y="435" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-family="Inter, sans-serif" font-size="26" font-weight="700" letter-spacing="2">${title}</text>
    <text x="300" y="468" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="Inter, sans-serif" font-size="15" font-weight="500" letter-spacing="3">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_QUEUE_ITEMS: QueueTrackItem[] = [
  {
    index: 0,
    title: 'Jerry Sprunger',
    artist: 'Tory Lanez & T-Pain',
    duration: '3:53',
    artworkUrl: createArtworkDataUri('#3b121e', '#0d060a', '#e05368', 'CHIXTAPE 5', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#3b121e', '#0d060a', '#e05368', 'CHIXTAPE 5', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
  {
    index: 1,
    title: 'Traphouse',
    artist: 'Tory Lanez & Nyce',
    duration: '4:08',
    artworkUrl: createArtworkDataUri('#d8d4cb', '#8c857B', '#4a3f35', 'TRAPHOUSE', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#d8d4cb', '#8c857B', '#4a3f35', 'TRAPHOUSE', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
  {
    index: 2,
    title: 'Lavender Sunflower',
    artist: 'Tory Lanez',
    duration: '2:32',
    artworkUrl: createArtworkDataUri('#2a1508', '#080504', '#e5853b', 'ALONE AT PROM', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#2a1508', '#080504', '#e5853b', 'ALONE AT PROM', 'TORY LANEZ'),
    isSelected: true,
    isPlaying: true,
  },
  {
    index: 3,
    title: 'The Take (feat. Chris Brown)',
    artist: 'Tory Lanez',
    duration: '4:05',
    artworkUrl: createArtworkDataUri('#421324', '#14050b', '#f2648d', 'CHIXTAPE 5', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#421324', '#14050b', '#f2648d', 'CHIXTAPE 5', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
  {
    index: 4,
    title: 'The Color Violet',
    artist: 'Tory Lanez',
    duration: '3:46',
    artworkUrl: createArtworkDataUri('#241434', '#09040e', '#a855f7', 'ALONE AT PROM', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#241434', '#09040e', '#a855f7', 'ALONE AT PROM', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
  {
    index: 5,
    title: 'Say It',
    artist: 'Tory Lanez',
    duration: '4:00',
    artworkUrl: createArtworkDataUri('#1f242b', '#0a0c0e', '#94a3b8', 'I TOLD YOU', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#1f242b', '#0a0c0e', '#94a3b8', 'I TOLD YOU', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
  {
    index: 6,
    title: 'LUV',
    artist: 'Tory Lanez',
    duration: '4:09',
    artworkUrl: createArtworkDataUri('#1e2329', '#090b0d', '#cbd5e1', 'I TOLD YOU', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#1e2329', '#090b0d', '#cbd5e1', 'I TOLD YOU', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
  {
    index: 7,
    title: 'In For It (feat. RL Grime)',
    artist: 'Tory Lanez',
    duration: '4:52',
    artworkUrl: createArtworkDataUri('#0f2338', '#060c14', '#38bdf8', 'CRUEL INTENTIONS', 'TORY LANEZ'),
    highResArtworkUrl: createArtworkDataUri('#0f2338', '#060c14', '#38bdf8', 'CRUEL INTENTIONS', 'TORY LANEZ'),
    isSelected: false,
    isPlaying: false,
  },
];

export const SAMPLE_ACTIVE_TRACK: TrackMetadata = {
  id: 'sample-lavender-sunflower',
  title: 'Lavender Sunflower',
  artist: 'Tory Lanez',
  album: 'Alone at Prom',
  artworkUrl: SAMPLE_QUEUE_ITEMS[2].artworkUrl,
  highResArtworkUrl: SAMPLE_QUEUE_ITEMS[2].highResArtworkUrl,
  duration: 152,
  currentTime: 58,
  isPlaying: false,
  isLiked: false,
  hasVideo: false,
  isVideoActive: false,
  videoToggleLocked: false,
  shuffleOn: false,
  repeatMode: 'NONE',
  volume: 85,
  isMuted: false,
};
