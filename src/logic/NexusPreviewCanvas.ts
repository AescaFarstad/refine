import atlasStorage from './AtlasStorage';

export const NEXUS_ATLAS_TILE_SIZE = 56;
export const NEXUS_ATLAS_TILE_PADDING = 2;
export const NEXUS_UI_PREVIEW_SIZE = NEXUS_ATLAS_TILE_SIZE;

export function createNexusPreviewFrameCanvas(
  nexusItemId: string,
  size: number,
  rotationStep: number = 0,
): HTMLCanvasElement {
  const frame = atlasStorage.getNexusFrame(`nexus:${nexusItemId}`)!;
  const source = atlasStorage.getNexusSource();
  const dpr = Math.max(2, window.devicePixelRatio || 1);
  const normalizedRotationStep = ((rotationStep % 6) + 6) % 6;
  const drawSize = size * dpr;

  const canvas = document.createElement('canvas');
  canvas.width = drawSize;
  canvas.height = drawSize;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.save();
  if (normalizedRotationStep !== 0) {
    const center = drawSize / 2;
    ctx.translate(center, center);
    ctx.rotate(normalizedRotationStep * Math.PI / 3);
    ctx.translate(-center, -center);
  }
  ctx.drawImage(source, frame.x, frame.y, frame.w, frame.h, 0, 0, drawSize, drawSize);
  ctx.restore();
  return canvas;
}
