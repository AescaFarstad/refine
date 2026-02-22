import atlasStorage from './AtlasStorage';

export const NEXUS_ATLAS_TILE_SIZE = 56;
export const NEXUS_ATLAS_TILE_PADDING = 2;
export const NEXUS_UI_PREVIEW_SIZE = NEXUS_ATLAS_TILE_SIZE;

export function createNexusPreviewFrameCanvas(nexusItemId: string, size: number): HTMLCanvasElement {
  const frame = atlasStorage.getNexusFrame(`nexus:${nexusItemId}`)!;
  const source = atlasStorage.getNexusSource();
  const dpr = Math.max(2, window.devicePixelRatio || 1);

  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    source,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    0,
    0,
    size * dpr,
    size * dpr,
  );
  return canvas;
}
