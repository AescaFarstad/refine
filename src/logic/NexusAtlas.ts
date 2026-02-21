import { parseNexusItemDefinitions } from './NexusLib';
import rawNexusItems from '../data/nexus';
import { createNexusPreviewCanvas } from './drawNexusPreview';
import atlasStorage from './AtlasStorage';

let nexusAtlasReady = false;
let nexusAtlasLoading: Promise<void> | null = null;

const PREVIEW_SIZE = 48;

async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load nexus atlas image'));
    };
    img.src = url;
  });
  return img;
}

export async function ensureNexusAtlas(): Promise<void> {
  if (nexusAtlasReady) return;
  if (nexusAtlasLoading) return nexusAtlasLoading;

  nexusAtlasLoading = (async () => {
    if (typeof document === 'undefined') return;

    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) {
      // Allow fallback drawing if items atlas fails to load.
    }

    const items = parseNexusItemDefinitions(rawNexusItems);
    const dpr = Math.max(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 2) || 2);

    type PackedEntry = {
      key: string;
      w: number;
      h: number;
      canvas: HTMLCanvasElement;
    };

    const packed: PackedEntry[] = [];

    for (const [id, def] of items) {
      const cells = def.placableInstanceDescription.cells;
      const canvas = createNexusPreviewCanvas(
        cells,
        PREVIEW_SIZE,
        def.placableInstanceDescription.image,
        def.glyph,
        def.placableInstanceDescription.glyphPlacement,
      );
      if (canvas) {
        packed.push({
          key: `nexus:${id}`,
          w: PREVIEW_SIZE,
          h: PREVIEW_SIZE,
          canvas,
        });
      }
    }

    if (packed.length === 0) {
      nexusAtlasReady = true;
      return;
    }

    // Pack into a single atlas canvas
    const maxRowW = 1024;
    const padding = 2;
    let x = padding;
    let y = padding;
    let rowH = 0;
    let usedW = 0;
    const placed: Array<{ key: string; canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }> = [];

    for (const e of packed) {
      if (x + e.w + padding > maxRowW) {
        x = padding;
        y += rowH + padding;
        rowH = 0;
      }
      placed.push({ key: e.key, canvas: e.canvas, x, y, w: e.w, h: e.h });
      x += e.w + padding;
      rowH = Math.max(rowH, e.h);
      usedW = Math.max(usedW, x);
    }

    const atlasW = Math.max(1, usedW + padding);
    const atlasH = Math.max(1, y + rowH + padding);

    // The source canvases are rendered at dpr scale; the atlas stores logical coordinates
    // but the actual canvas pixels are dpr-scaled.
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = atlasW * dpr;
    atlasCanvas.height = atlasH * dpr;
    const ctx = atlasCanvas.getContext('2d');
    if (ctx) {
      const frames = new Map<string, { x: number; y: number; w: number; h: number }>();
      for (const p of placed) {
        // Source canvas is PREVIEW_SIZE*dpr pixels representing PREVIEW_SIZE logical pixels
        // Draw it into the atlas at the dpr-scaled position
        ctx.drawImage(p.canvas, p.x * dpr, p.y * dpr);
        frames.set(p.key, { x: p.x * dpr, y: p.y * dpr, w: PREVIEW_SIZE * dpr, h: PREVIEW_SIZE * dpr });
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        atlasCanvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
      const img = await imageFromBlob(blob);
      atlasStorage.setRuntimeAtlas('nexus', { source: img, frames, meta: { w: atlasW * dpr, h: atlasH * dpr, padding } });
    }

    nexusAtlasReady = true;
  })()
    .finally(() => {
      nexusAtlasLoading = null;
    });

  return nexusAtlasLoading;
}
