/**
 * IndexedDB Store for Custom Image & Video Wallpapers
 * Keeps user wallpapers 100% local in the browser without hitting chrome.storage quotas.
 */

const DB_NAME = 'AestheticMusicWallpaperDB';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const CURRENT_WALLPAPER_KEY = 'active_custom_wallpaper';

export interface StoredWallpaper {
  blob: Blob;
  mimeType: string;
  fileName: string;
  mediaType: 'image' | 'video';
  updatedAt: number;
}

function openWallpaperDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomWallpaper(
  file: File,
  updatedAt = Date.now()
): Promise<StoredWallpaper> {
  const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const validVideoTypes = ['video/mp4', 'video/webm'];

  const isImage = validImageTypes.includes(file.type);
  const isVideo = validVideoTypes.includes(file.type);

  if (!isImage && !isVideo) {
    throw new Error('Unsupported format. Please upload JPG, PNG, WebP, GIF, MP4, or WebM.');
  }

  const maxBytes = 150 * 1024 * 1024; // 150MB limit
  if (file.size > maxBytes) {
    throw new Error('File exceeds the 150MB local wallpaper limit.');
  }

  const record: StoredWallpaper = {
    blob: file,
    mimeType: file.type,
    fileName: file.name,
    mediaType: isVideo ? 'video' : 'image',
    updatedAt,
  };

  return saveCustomWallpaperRecord(record);
}

export async function saveCustomWallpaperRecord(
  record: StoredWallpaper
): Promise<StoredWallpaper> {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record, CURRENT_WALLPAPER_KEY);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
  }
  return btoa(parts.join(''));
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Pulls a wallpaper stored in the extension's origin IndexedDB (via background worker chunks)
 * and caches it into the current page origin's IndexedDB so music.youtube.com can render
 * wallpapers uploaded from OptionsApp cleanly without size quota issues.
 */
export async function syncWallpaperFromExtension(): Promise<StoredWallpaper | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return null;
  }

  try {
    const meta = (await chrome.runtime.sendMessage({
      type: 'GET_WALLPAPER_META',
    })) as
      | {
          ok: boolean;
          rev?: number;
          mimeType?: string;
          fileName?: string;
          mediaType?: 'image' | 'video';
          totalSize?: number;
        }
      | undefined;

    if (!meta?.ok || !meta.totalSize || !meta.mimeType || !meta.fileName || !meta.mediaType) {
      return null;
    }

    const chunkSize = 512 * 1024;
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    for (let offset = 0; offset < meta.totalSize; offset += chunkSize) {
      const part = (await chrome.runtime.sendMessage({
        type: 'GET_WALLPAPER_CHUNK',
        offset,
        length: chunkSize,
      })) as { ok?: boolean; chunkBase64?: string } | undefined;

      if (!part?.ok || typeof part.chunkBase64 !== 'string') {
        return null;
      }
      chunks.push(base64ToUint8Array(part.chunkBase64));
    }

    const blob = new Blob(chunks, { type: meta.mimeType });
    const record: StoredWallpaper = {
      blob,
      mimeType: meta.mimeType,
      fileName: meta.fileName,
      mediaType: meta.mediaType,
      updatedAt: meta.rev || Date.now(),
    };
    return await saveCustomWallpaperRecord(record);
  } catch {
    return null;
  }
}

export async function loadCustomWallpaper(): Promise<StoredWallpaper | null> {
  try {
    const db = await openWallpaperDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CURRENT_WALLPAPER_KEY);
      req.onsuccess = () => resolve((req.result as StoredWallpaper) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearCustomWallpaper(): Promise<void> {
  try {
    const db = await openWallpaperDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(CURRENT_WALLPAPER_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore errors
  }
}
