import { GalleryItem, PhotoAnalysisResult } from '../types/nova';
import { SAMPLE_SCENES } from './sampleScenes';
import { applyColorGradingToCanvas, getProfileById } from './colorProfiles';

const DB_NAME = 'nova_cam_ai_gallery_v1';
const STORE_NAME = 'media_items';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listGalleryItems(): Promise<GalleryItem[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as GalleryItem[]).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveGalleryItem(item: GalleryItem): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function appendAnalysisToItem(id: string, analysis: PhotoAnalysisResult): Promise<void> {
  const items = await listGalleryItems();
  const target = items.find((i) => i.id === id);
  if (!target) return;
  target.analysisHistory = [analysis, ...target.analysisHistory];
  await saveGalleryItem(target);
}

export async function clearAllAnalysisHistory(): Promise<void> {
  const items = await listGalleryItems();
  for (const item of items) {
    if (item.analysisHistory.length > 0) {
      await saveGalleryItem({ ...item, analysisHistory: [] });
    }
  }
}

async function renderSampleGradedPair(src: string): Promise<{ original: string; graded: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 1200;
      const h = img.naturalHeight || 900;
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w;
      origCanvas.height = h;
      const oCtx = origCanvas.getContext('2d');
      oCtx?.drawImage(img, 0, 0, w, h);
      const original = origCanvas.toDataURL('image/jpeg', 0.92);

      const gradedCanvas = document.createElement('canvas');
      gradedCanvas.width = w;
      gradedCanvas.height = h;
      const gCtx = gradedCanvas.getContext('2d');
      if (gCtx) {
        gCtx.drawImage(img, 0, 0, w, h);
        const cinematic = getProfileById('cinematic');
        applyColorGradingToCanvas(gCtx, w, h, 'cinematic', cinematic.defaults, 0, 5500);
      }
      const graded = gradedCanvas.toDataURL('image/jpeg', 0.92);
      resolve({ original, graded, w, h });
    };
    img.onerror = () => resolve({ original: src, graded: src, w: 1200, h: 900 });
    img.src = src;
  });
}

const SEEDED_FLAG_KEY = 'nova_cam_gallery_seeded_v1';

export async function ensureInitialGallerySeeded(): Promise<GalleryItem[]> {
  const existing = await listGalleryItems();
  if (existing.length > 0 || localStorage.getItem(SEEDED_FLAG_KEY) === 'true') {
    return existing;
  }

  const seeded: GalleryItem[] = [];
  const profileConfigs = [
    { scene: SAMPLE_SCENES[0], album: 'Portraits', iso: 160, shutter: '1/250s', ev: 0.1, wb: 5350, fav: true },
    { scene: SAMPLE_SCENES[1], album: 'Landscapes', iso: 100, shutter: '1/1000s', ev: -0.3, wb: 5900, fav: true },
    { scene: SAMPLE_SCENES[2], album: 'Night & Street', iso: 640, shutter: '1/50s', ev: 0.2, wb: 4400, fav: false },
    { scene: SAMPLE_SCENES[3], album: 'Architecture', iso: 100, shutter: '1/640s', ev: -0.1, wb: 5500, fav: false },
  ];

  for (let i = 0; i < profileConfigs.length; i++) {
    const cfg = profileConfigs[i];
    const pair = await renderSampleGradedPair(cfg.scene.src);
    const item: GalleryItem = {
      id: `seed-${cfg.scene.id}`,
      mediaType: 'photo',
      title: cfg.scene.title,
      album: cfg.album,
      favorite: cfg.fav,
      createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
      originalDataUrl: pair.original,
      gradedDataUrl: pair.graded,
      mimeType: 'image/jpeg',
      width: pair.w,
      height: pair.h,
      exif: {
        cameraModel: 'NOVA CAM Studio Reference',
        lensLabel: cfg.scene.lensLabel,
        focalLengthMm: cfg.scene.lensLabel.split(' ')[0],
        aperture: cfg.scene.lensLabel.split(' ')[1] || 'f/1.7',
        iso: cfg.iso,
        shutterSpeed: cfg.shutter,
        ev: cfg.ev,
        wbKelvin: cfg.wb,
        profileName: 'Cinematic',
        sceneDetected: cfg.scene.sceneHint,
        aiOptimized: true,
      },
      analysisHistory: [],
    };
    await saveGalleryItem(item);
    seeded.push(item);
  }

  localStorage.setItem(SEEDED_FLAG_KEY, 'true');
  return seeded;
}
