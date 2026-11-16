export interface MiniPipState {
  title: string;
  artist: string;
  artworkUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  accentColor: string;
  lyricLine: string;
}

export interface MiniPipCallbacks {
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onClosed: () => void;
}

interface DocumentPictureInPictureApi {
  window: Window | null;
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
}

interface DocPipRefs {
  artImg: HTMLImageElement;
  artFallback: HTMLDivElement;
  liveDot: HTMLSpanElement;
  titleEl: HTMLDivElement;
  artistEl: HTMLDivElement;
  lyricEl: HTMLDivElement;
  progressBar: HTMLDivElement;
  progressFill: HTMLDivElement;
  timeEl: HTMLSpanElement;
  playBtn: HTMLButtonElement;
  playIcon: SVGSVGElement;
  pauseIcon: SVGSVGElement;
}

let activeMode: 'document' | 'canvas' | null = null;
let activePipWindow: Window | null = null;
let docRefs: DocPipRefs | null = null;
let lastDocArtUrl = '';

let canvasEl: HTMLCanvasElement | null = null;
let canvasVideoEl: HTMLVideoElement | null = null;
let canvasStream: MediaStream | null = null;
let canvasArtImg: HTMLImageElement | null = null;
let canvasArtSrc = '';
let lastCanvasDrawMs = 0;

let latestState: MiniPipState | null = null;
let latestCallbacks: MiniPipCallbacks | null = null;

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDocPipApi(): DocumentPictureInPictureApi | undefined {
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPictureApi })
    .documentPictureInPicture;
}

function createSvgIcon(
  doc: Document,
  dList: string[],
  filled = true
): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of dList) {
    const path = doc.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function cleanupResources(notifyCallback: boolean): void {
  const hadMode = activeMode !== null;
  activeMode = null;

  if (activePipWindow) {
    try {
      if (!activePipWindow.closed) activePipWindow.close();
    } catch {
      // Ignore close errors
    }
    activePipWindow = null;
  }
  docRefs = null;
  lastDocArtUrl = '';

  if (canvasVideoEl) {
    if (document.pictureInPictureElement === canvasVideoEl) {
      void document.exitPictureInPicture?.().catch(() => {});
    }
    try {
      canvasVideoEl.pause();
      canvasVideoEl.srcObject = null;
      canvasVideoEl.remove();
    } catch {
      // Ignore cleanup errors
    }
    canvasVideoEl = null;
  }

  if (canvasStream) {
    canvasStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // Ignore track stop errors
      }
    });
    canvasStream = null;
  }

  canvasEl = null;
  canvasArtImg = null;
  canvasArtSrc = '';

  if (notifyCallback && hadMode) {
    latestCallbacks?.onClosed();
  }
}

function buildDocumentPipDom(pipWin: Window): void {
  const doc = pipWin.document;
  doc.title = 'Aesthetic Music Mini Player';

  const style = doc.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: radial-gradient(circle at 18% 20%, rgba(255,255,255,0.08), transparent 55%), #090b10;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      user-select: none;
    }
    .shell {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 12px 14px 10px;
      gap: 10px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .art-wrap {
      position: relative;
      width: 72px;
      height: 72px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      background: #18181b;
      border: 1px solid rgba(255,255,255,0.16);
      box-shadow: 0 10px 24px rgba(0,0,0,0.65);
    }
    .art-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .art-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: rgba(255,255,255,0.55);
    }
    .live-dot {
      position: absolute;
      right: 5px;
      bottom: 5px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      border: 1.5px solid rgba(9,11,16,0.9);
      background: #71717a;
    }
    .meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .artist {
      font-size: 12px;
      color: #a1a1aa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lyric {
      font-size: 11px;
      color: var(--pip-accent, #E89B63);
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-height: 15px;
    }
    .progress-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bar {
      position: relative;
      flex: 1;
      height: 6px;
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      cursor: pointer;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      width: 0%;
      border-radius: 999px;
      background: var(--pip-accent, #E89B63);
      transition: width 180ms linear;
    }
    .time {
      font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, monospace;
      color: #a1a1aa;
      flex-shrink: 0;
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }
    .btn {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 140ms ease, transform 120ms ease;
    }
    .btn:hover { background: rgba(255,255,255,0.16); color: #ffffff; }
    .btn:active { transform: scale(0.94); }
    .btn-play {
      width: 36px;
      height: 36px;
      background: var(--pip-accent, #E89B63);
      color: #0b0c10;
      border-color: transparent;
    }
    .btn-play:hover { filter: brightness(1.08); background: var(--pip-accent, #E89B63); color: #0b0c10; }
  `;
  doc.head.appendChild(style);

  const shell = doc.createElement('div');
  shell.className = 'shell';

  const top = doc.createElement('div');
  top.className = 'top';

  const artWrap = doc.createElement('div');
  artWrap.className = 'art-wrap';
  const artFallback = doc.createElement('div');
  artFallback.className = 'art-fallback';
  artFallback.textContent = '♪';
  const artImg = doc.createElement('img');
  artImg.className = 'art-img';
  artImg.alt = '';
  const liveDot = doc.createElement('span');
  liveDot.className = 'live-dot';
  artWrap.append(artFallback, artImg, liveDot);

  const meta = doc.createElement('div');
  meta.className = 'meta';
  const titleEl = doc.createElement('div');
  titleEl.className = 'title';
  const artistEl = doc.createElement('div');
  artistEl.className = 'artist';
  const lyricEl = doc.createElement('div');
  lyricEl.className = 'lyric';
  meta.append(titleEl, artistEl, lyricEl);

  top.append(artWrap, meta);

  const progressWrap = doc.createElement('div');
  progressWrap.className = 'progress-wrap';
  const progressBar = doc.createElement('div');
  progressBar.className = 'bar';
  progressBar.title = 'Click to seek';
  const progressFill = doc.createElement('div');
  progressFill.className = 'fill';
  progressBar.appendChild(progressFill);
  const timeEl = doc.createElement('span');
  timeEl.className = 'time';
  progressWrap.append(progressBar, timeEl);

  progressBar.addEventListener('click', (e) => {
    const duration = latestState?.duration || 0;
    if (duration <= 0) return;
    const rect = progressBar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    latestCallbacks?.onSeek(ratio * duration);
  });

  const controls = doc.createElement('div');
  controls.className = 'controls';

  const prevBtn = doc.createElement('button');
  prevBtn.className = 'btn';
  prevBtn.title = 'Previous Track';
  prevBtn.appendChild(createSvgIcon(doc, ['M19 20L9 12l10-8v16z', 'M5 19V5']));
  prevBtn.addEventListener('click', () => latestCallbacks?.onPrevious());

  const playBtn = doc.createElement('button');
  playBtn.className = 'btn btn-play';
  playBtn.title = 'Play / Pause';
  const playIcon = createSvgIcon(doc, ['M6 4l14 8-14 8V4z']);
  const pauseIcon = createSvgIcon(doc, ['M7 4h3v16H7z', 'M14 4h3v16h-3z']);
  playBtn.append(playIcon, pauseIcon);
  playBtn.addEventListener('click', () => latestCallbacks?.onTogglePlay());

  const nextBtn = doc.createElement('button');
  nextBtn.className = 'btn';
  nextBtn.title = 'Next Track';
  nextBtn.appendChild(createSvgIcon(doc, ['M5 4l10 8-10 8V4z', 'M19 5v14']));
  nextBtn.addEventListener('click', () => latestCallbacks?.onNext());

  controls.append(prevBtn, playBtn, nextBtn);
  shell.append(top, progressWrap, controls);
  doc.body.appendChild(shell);

  docRefs = {
    artImg,
    artFallback,
    liveDot,
    titleEl,
    artistEl,
    lyricEl,
    progressBar,
    progressFill,
    timeEl,
    playBtn,
    playIcon,
    pauseIcon,
  };
}

function updateDocumentPipDom(state: MiniPipState): void {
  if (!docRefs || !activePipWindow || activePipWindow.closed) return;
  activePipWindow.document.documentElement.style.setProperty(
    '--pip-accent',
    state.accentColor || '#E89B63'
  );

  docRefs.titleEl.textContent = state.title || 'Not Playing';
  docRefs.artistEl.textContent = state.artist || 'YouTube Music';
  docRefs.lyricEl.textContent = state.lyricLine || '';

  if (state.artworkUrl && state.artworkUrl !== lastDocArtUrl) {
    lastDocArtUrl = state.artworkUrl;
    docRefs.artImg.src = state.artworkUrl;
    docRefs.artImg.style.display = 'block';
    docRefs.artFallback.style.display = 'none';
  } else if (!state.artworkUrl) {
    docRefs.artImg.style.display = 'none';
    docRefs.artFallback.style.display = 'flex';
  }

  docRefs.liveDot.style.background = state.isPlaying
    ? state.accentColor || '#34d399'
    : '#71717a';

  const ratio =
    state.duration > 0 ? Math.min(1, Math.max(0, state.currentTime / state.duration)) : 0;
  docRefs.progressFill.style.width = `${(ratio * 100).toFixed(1)}%`;
  docRefs.timeEl.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;

  docRefs.playIcon.style.display = state.isPlaying ? 'none' : 'block';
  docRefs.pauseIcon.style.display = state.isPlaying ? 'block' : 'none';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCanvasFallbackFrame(state: MiniPipState): void {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  const w = canvasEl.width;
  const h = canvasEl.height;
  const accent = state.accentColor || '#E89B63';

  if (state.artworkUrl && state.artworkUrl !== canvasArtSrc) {
    canvasArtSrc = state.artworkUrl;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvasArtImg = img;
      if (latestState) drawCanvasFallbackFrame(latestState);
    };
    img.onerror = () => {
      canvasArtImg = null;
    };
    img.src = state.artworkUrl;
  }

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#12151f');
  bg.addColorStop(1, '#08090d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(110, 120, 10, 110, 120, 260);
  glow.addColorStop(0, 'rgba(232, 155, 99, 0.24)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Artwork card
  ctx.save();
  drawRoundedRect(ctx, 36, 48, 176, 176, 20);
  ctx.clip();
  if (canvasArtImg && canvasArtImg.complete && canvasArtImg.naturalWidth > 0) {
    ctx.drawImage(canvasArtImg, 36, 48, 176, 176);
  } else {
    ctx.fillStyle = '#1f232e';
    ctx.fillRect(36, 48, 176, 176);
  }
  ctx.restore();

  // Text block
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillText((state.title || 'Not Playing').slice(0, 26), 238, 102);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '400 20px Inter, system-ui, sans-serif';
  ctx.fillText((state.artist || 'YouTube Music').slice(0, 32), 238, 138);

  if (state.lyricLine) {
    ctx.fillStyle = accent;
    ctx.font = '500 18px Inter, system-ui, sans-serif';
    ctx.fillText(state.lyricLine.slice(0, 36), 238, 186);
  }

  // Progress Bar
  const ratio =
    state.duration > 0 ? Math.min(1, Math.max(0, state.currentTime / state.duration)) : 0;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  drawRoundedRect(ctx, 36, 276, w - 72, 10, 5);
  ctx.fill();

  ctx.fillStyle = accent;
  drawRoundedRect(ctx, 36, 276, Math.max(10, (w - 72) * ratio), 10, 5);
  ctx.fill();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 16px ui-monospace, monospace';
  ctx.fillText(
    `${state.isPlaying ? 'PLAYING' : 'PAUSED'}   ${formatTime(state.currentTime)} / ${formatTime(state.duration)}`,
    36,
    316
  );
}

async function openCanvasFallbackPip(state: MiniPipState): Promise<boolean> {
  if (typeof document.pictureInPictureEnabled === 'boolean' && !document.pictureInPictureEnabled) {
    return false;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  canvasEl = canvas;

  drawCanvasFallbackFrame(state);

  const captureStreamFn = (
    canvas as unknown as { captureStream?: (fps?: number) => MediaStream }
  ).captureStream;
  if (typeof captureStreamFn !== 'function') {
    cleanupResources(false);
    return false;
  }

  const stream = captureStreamFn.call(canvas, 4);
  canvasStream = stream;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  video.srcObject = stream;
  document.body.appendChild(video);
  canvasVideoEl = video;

  if (typeof video.requestPictureInPicture !== 'function') {
    cleanupResources(false);
    return false;
  }

  await video.play();
  await video.requestPictureInPicture();
  activeMode = 'canvas';

  video.addEventListener('leavepictureinpicture', () => {
    cleanupResources(true);
  });

  return true;
}

export function isMiniPipOpen(): boolean {
  if (activeMode === 'document') {
    return Boolean(activePipWindow && !activePipWindow.closed);
  }
  if (activeMode === 'canvas') {
    return Boolean(canvasVideoEl && document.pictureInPictureElement === canvasVideoEl);
  }
  return false;
}

export async function openOrToggleMiniPip(
  initialState: MiniPipState,
  callbacks: MiniPipCallbacks
): Promise<boolean> {
  latestState = initialState;
  latestCallbacks = callbacks;

  if (isMiniPipOpen()) {
    cleanupResources(false);
    return false;
  }

  const docPip = getDocPipApi();
  if (docPip && typeof docPip.requestWindow === 'function') {
    try {
      const pipWin = await docPip.requestWindow({ width: 392, height: 184 });
      activePipWindow = pipWin;
      activeMode = 'document';
      buildDocumentPipDom(pipWin);
      updateDocumentPipDom(initialState);
      pipWin.addEventListener('pagehide', () => {
        cleanupResources(true);
      });
      return true;
    } catch {
      cleanupResources(false);
    }
  }

  try {
    return await openCanvasFallbackPip(initialState);
  } catch {
    cleanupResources(false);
    return false;
  }
}

export function syncMiniPipState(state: MiniPipState): void {
  latestState = state;
  if (!isMiniPipOpen()) return;

  if (activeMode === 'document') {
    updateDocumentPipDom(state);
  } else if (activeMode === 'canvas') {
    const now = Date.now();
    if (now - lastCanvasDrawMs >= 240) {
      lastCanvasDrawMs = now;
      drawCanvasFallbackFrame(state);
    }
  }
}

export function closeMiniPip(): void {
  cleanupResources(false);
}
