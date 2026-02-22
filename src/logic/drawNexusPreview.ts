import type { Point2 } from './ItemLib';
import { axialToPixel } from './HexMath';
import { computeHexBoundary } from './hexBoundary';
import { traceSmoothHexBoundary } from './drawSmoothBoundary';
import {
  drawNexusItemVisuals,
  type NexusGlyphPlacement,
  type NexusImagePlacement,
  type NexusVisualCell,
} from './drawNexusItemVisuals';

const FILL_COLOR_TOP = 'rgb(34, 68, 74)';
const FILL_COLOR_MID = 'rgb(44, 84, 88)';
const FILL_COLOR_BOT = 'rgb(28, 56, 64)';
const INNER_STROKE_COLOR = 'rgba(140, 220, 210, 0.32)';
const INNER_STROKE_WIDTH = 1.5;
const ITEM_COLOR = 'rgba(248, 250, 252, 0.96)';
const IMPASSABLE_PREVIEW_FILTER = 'sepia(0.4) saturate(0.5) brightness(0.85)';

export function createNexusPreviewCanvas(
  cells: readonly Point2[],
  size: number,
  imageKey: string,
  glyph: string,
  glyphPlacement: NexusGlyphPlacement,
  imagePlacement: NexusImagePlacement = 'perCell',
  glyphScale: number = 1,
  imageScale: number = 1,
  passable: boolean = true,
): HTMLCanvasElement | null {
  const loops = computeHexBoundary(cells as Point2[]).map(loop => loop.points);
  if (loops.length === 0) return null;

  const canvas = document.createElement('canvas');
  const dpr = Math.max(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.filter = passable ? 'none' : IMPASSABLE_PREVIEW_FILTER;

  // Compute pixel bounds of boundary at hexSize=1
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const loop of loops) {
    for (const p of loop) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const padding = 2;
  const available = size - padding * 2;
  const hexSize = Math.min(available / (rawW || 1), available / (rawH || 1));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const origin = {
    x: size / 2 - centerX * hexSize,
    y: size / 2 - centerY * hexSize,
  };

  // Gradient fill
  let gMinY = Infinity, gMaxY = -Infinity;
  for (const loop of loops) {
    for (const p of loop) {
      const py = origin.y + p.y * hexSize;
      if (py < gMinY) gMinY = py;
      if (py > gMaxY) gMaxY = py;
    }
  }

  ctx.save();
  traceSmoothHexBoundary(ctx, loops, origin, hexSize);
  const grad = ctx.createLinearGradient(0, gMinY, 0, gMaxY);
  grad.addColorStop(0, FILL_COLOR_TOP);
  grad.addColorStop(0.45, FILL_COLOR_MID);
  grad.addColorStop(1, FILL_COLOR_BOT);
  ctx.fillStyle = grad;
  ctx.fill('evenodd');

  traceSmoothHexBoundary(ctx, loops, origin, hexSize);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INNER_STROKE_COLOR;
  ctx.lineWidth = INNER_STROKE_WIDTH;
  ctx.stroke();
  ctx.restore();

  const glyphSize = Math.max(8, hexSize * 1.05 * glyphScale);
  let centerPixel: Point2 = { x: 0, y: 0 };
  const visualCells: NexusVisualCell[] = [];
  for (const cell of cells) {
    const pixel = axialToPixel(cell, hexSize, origin);
    centerPixel.x += pixel.x;
    centerPixel.y += pixel.y;
    visualCells.push({
      pixel,
      glyphColor: ITEM_COLOR,
      imageOpacityMul: 1,
      glyphOpacityMul: 1,
    });
  }
  centerPixel.x /= cells.length;
  centerPixel.y /= cells.length;

  drawNexusItemVisuals({
    ctx,
    cells: visualCells,
    centerPixel,
    imageKey,
    iconMaxSize: hexSize * 1.2 * imageScale,
    glyphText: glyph,
    glyphSize,
    glyphPlacement,
    imagePlacement,
    opacity: 1,
    centerGlyphColor: ITEM_COLOR,
    centerGlyphOpacityMul: 1,
  });

  return canvas;
}
