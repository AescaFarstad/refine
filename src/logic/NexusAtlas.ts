import type { Point2 } from './ItemLib';
import { createNexusPreviewCanvas } from './drawNexusPreview';
import atlasStorage from './AtlasStorage';
import { NEXUS_ATLAS_TILE_SIZE } from './NexusPreviewCanvas';

let nexusAtlasReady = false;
let nexusAtlasLoading: Promise<void> | null = null;

type NexusAtlasItemSource = {
  glyph: string;
  placableInstanceDescription: {
    passable: boolean;
    cells: readonly Point2[];
    image: string;
    glyphPlacement: 'perCell' | 'center';
    iconScale: number;
  };
};

async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load nexus atlas image'));
    };
    img.src = url;
  });
  return img;
}

export async function ensureNexusAtlas(nexusItems: ReadonlyMap<string, NexusAtlasItemSource>): Promise<void> {
  if (nexusAtlasReady) return;
  if (nexusAtlasLoading) return nexusAtlasLoading;

  nexusAtlasLoading = (async () => {
    if (typeof document === 'undefined') return;

    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) {
      // Allow fallback drawing if items atlas fails to load.
    }

    const dpr = Math.max(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 2) || 2);

    type PackedEntry = {
      key: string;
      w: number;
      h: number;
      canvas: HTMLCanvasElement;
    };

    const packed: PackedEntry[] = [];

    for (const [id, def] of nexusItems) {
      const cells = def.placableInstanceDescription.cells;
      const canvas = createNexusPreviewCanvas(
        cells,
        NEXUS_ATLAS_TILE_SIZE,
        def.placableInstanceDescription.image,
        def.glyph,
        def.placableInstanceDescription.glyphPlacement,
        def.placableInstanceDescription.iconScale,
        def.placableInstanceDescription.passable,
      );
      if (canvas) {
        packed.push({
          key: `nexus:${id}`,
          w: NEXUS_ATLAS_TILE_SIZE,
          h: NEXUS_ATLAS_TILE_SIZE,
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
        // Source canvas is NEXUS_ATLAS_TILE_SIZE*dpr pixels representing NEXUS_ATLAS_TILE_SIZE logical pixels
        // Draw it into the atlas at the dpr-scaled position
        ctx.drawImage(p.canvas, p.x * dpr, p.y * dpr);
        frames.set(p.key, {
          x: p.x * dpr,
          y: p.y * dpr,
          w: NEXUS_ATLAS_TILE_SIZE * dpr,
          h: NEXUS_ATLAS_TILE_SIZE * dpr,
        });
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
