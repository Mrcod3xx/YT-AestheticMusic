export interface LyricCardLine {
  primary: string;
  secondary?: string;
}

export interface LyricCardRenderOptions {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  lines: LyricCardLine[];
  accentColor: string;
  accentHighlight?: string;
}

function drawRoundedRectPath(
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

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const wrapped: string[] = [];
  let current = '';

  const pushLongToken = (token: string) => {
    let slice = '';
    for (const char of token) {
      if (ctx.measureText(slice + char).width > maxWidth && slice) {
        wrapped.push(slice);
        slice = char;
      } else {
        slice += char;
      }
    }
    current = slice;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else if (ctx.measureText(word).width > maxWidth) {
      if (current) wrapped.push(current);
      pushLongToken(word);
    } else {
      if (current) wrapped.push(current);
      current = word;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

function loadCorsImage(url: string, timeoutMs = 4500): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Renders a shareable 1080x1350 aesthetic song & lyric poster card into a PNG Blob.
 */
export async function renderLyricPosterCard(
  options: LyricCardRenderOptions
): Promise<Blob> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const accent = options.accentColor || '#C28356';
  const accentHi = options.accentHighlight || accent;
  const artworkImg = await loadCorsImage(options.artworkUrl || '');

  // 1. Atmospheric gradient backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0b0e14');
  bgGrad.addColorStop(0.55, '#12151f');
  bgGrad.addColorStop(1, '#07080c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle blurred artwork ambiance behind card when CORS image loads
  if (artworkImg) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.filter = 'blur(72px) saturate(150%)';
    ctx.drawImage(artworkImg, -80, -80, width + 160, height + 160);
    ctx.restore();
  }

  const topBloom = ctx.createRadialGradient(260, 260, 20, 260, 260, 640);
  topBloom.addColorStop(0, `${accentHi}40`);
  topBloom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topBloom;
  ctx.fillRect(0, 0, width, height);

  const botBloom = ctx.createRadialGradient(width - 200, height - 220, 10, width - 200, height - 220, 560);
  botBloom.addColorStop(0, `${accent}33`);
  botBloom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = botBloom;
  ctx.fillRect(0, 0, width, height);

  // 2. Frosted Glass Outer Card
  const cardX = 86;
  const cardY = 96;
  const cardW = width - cardX * 2;
  const cardH = height - cardY * 2;

  ctx.save();
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 48);
  const glassGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  glassGrad.addColorStop(0, 'rgba(22, 25, 34, 0.86)');
  glassGrad.addColorStop(1, 'rgba(11, 13, 18, 0.94)');
  ctx.fillStyle = glassGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 64;
  ctx.shadowOffsetY = 24;
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 3. Header: Artwork + Track Metadata
  const pad = 64;
  const innerX = cardX + pad;
  const innerW = cardW - pad * 2;
  const artSize = 188;
  const artX = innerX;
  const artY = cardY + pad;

  ctx.save();
  drawRoundedRectPath(ctx, artX, artY, artSize, artSize, 28);
  ctx.clip();
  if (artworkImg) {
    ctx.drawImage(artworkImg, artX, artY, artSize, artSize);
  } else {
    const vinylFallback = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
    vinylFallback.addColorStop(0, accentHi);
    vinylFallback.addColorStop(1, '#181a24');
    ctx.fillStyle = vinylFallback;
    ctx.fillRect(artX, artY, artSize, artSize);

    ctx.beginPath();
    ctx.arc(artX + artSize / 2, artY + artSize / 2, 46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
    ctx.fill();
  }
  ctx.restore();

  const metaX = artX + artSize + 36;
  const metaMaxW = innerW - artSize - 36;

  ctx.fillStyle = accentHi;
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText('NOW LISTENING', metaX, artY + 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px Inter, system-ui, sans-serif';
  const titleLines = wrapTextLines(ctx, options.title || 'Untitled Track', metaMaxW).slice(0, 2);
  let metaY = artY + 88;
  for (const tl of titleLines) {
    ctx.fillText(tl, metaX, metaY);
    metaY += 48;
  }

  ctx.fillStyle = 'rgba(228, 228, 231, 0.78)';
  ctx.font = '500 27px Inter, system-ui, sans-serif';
  const artistStr = wrapTextLines(ctx, options.artist || 'YouTube Music', metaMaxW)[0] || '';
  ctx.fillText(artistStr, metaX, metaY + 6);

  if (options.album && options.album !== options.title) {
    ctx.fillStyle = 'rgba(161, 161, 170, 0.65)';
    ctx.font = '400 22px Inter, system-ui, sans-serif';
    const albumStr = wrapTextLines(ctx, options.album, metaMaxW)[0] || '';
    ctx.fillText(albumStr, metaX, metaY + 42);
  }

  // Divider below header
  const dividerY = artY + artSize + 44;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, dividerY);
  ctx.lineTo(innerX + innerW, dividerY);
  ctx.stroke();

  // 4. Centerpiece Lyric Quote Block
  const quoteTop = dividerY + 62;
  const quoteMaxBottom = cardY + cardH - 132;
  const selectedLines = options.lines.slice(0, 4);

  if (selectedLines.length > 0) {
    // Decorative vertical accent rail
    const barW = 6;
    const textX = innerX + 34;
    const textMaxW = innerW - 34;

    let cursorY = quoteTop + 44;
    const barStartY = quoteTop;
    let barEndY = quoteTop + 80;

    for (const item of selectedLines) {
      if (cursorY > quoteMaxBottom - 20) break;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 46px Inter, system-ui, sans-serif';
      const primaryWrapped = wrapTextLines(ctx, item.primary, textMaxW);
      for (const pw of primaryWrapped) {
        if (cursorY > quoteMaxBottom) break;
        ctx.fillText(pw, textX, cursorY);
        barEndY = cursorY + 12;
        cursorY += 60;
      }

      if (item.secondary && cursorY <= quoteMaxBottom) {
        ctx.fillStyle = 'rgba(212, 212, 216, 0.66)';
        ctx.font = '500 28px Inter, system-ui, sans-serif';
        const secWrapped = wrapTextLines(ctx, item.secondary, textMaxW);
        for (const sw of secWrapped) {
          if (cursorY > quoteMaxBottom) break;
          ctx.fillText(sw, textX, cursorY);
          barEndY = cursorY + 8;
          cursorY += 38;
        }
      }

      cursorY += 22;
    }

    ctx.save();
    drawRoundedRectPath(
      ctx,
      innerX,
      barStartY,
      barW,
      Math.max(48, barEndY - barStartY),
      3
    );
    ctx.fillStyle = accentHi;
    ctx.fill();
    ctx.restore();
  }

  // 5. Footer Strip
  const footerY = cardY + cardH - 54;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, footerY - 38);
  ctx.lineTo(innerX + innerW, footerY - 38);
  ctx.stroke();

  ctx.fillStyle = 'rgba(212, 212, 216, 0.65)';
  ctx.font = '600 21px Inter, system-ui, sans-serif';
  ctx.fillText('Aesthetic Music • YouTube Music', innerX, footerY);

  ctx.textAlign = 'right';
  ctx.fillStyle = accentHi;
  ctx.font = '500 20px ui-monospace, monospace';
  ctx.fillText('LYRIC POSTER', innerX + innerW, footerY);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG poster card'));
    }, 'image/png');
  });
}

/** Attempts to write a rendered PNG card Blob to the OS clipboard. */
export async function copyLyricCardBlob(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    return false;
  }
  const ClipboardItemCtor = (
    window as unknown as {
      ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
    }
  ).ClipboardItem;
  if (!ClipboardItemCtor) return false;

  try {
    await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Triggers a clean PNG download for a rendered lyric poster Blob. */
export function downloadLyricCardBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
