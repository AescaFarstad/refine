import type { Point2 } from './ItemLib';
import { axialNeighbors, axialToPixel } from './HexMath';
import { ESSENCE_COLORS } from './RenderConstants';

export interface DrawSignatureLinesOptions {
  origin: Point2;
  hexSize: number;
  color: string;
  lineWidth: number;
  blur: number;
}

function resolveSignatureColor(color: string): string {
  return ESSENCE_COLORS[color] || color;
}

export function computeSignatureOriginForCanvas(cells: Point2[], hexSize: number, canvasSize: { w: number; h: number }): Point2 {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const c of cells) {
    const p = axialToPixel(c, hexSize, { x: 0, y: 0 });
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return {
    x: canvasSize.w / 2 - (minX + maxX) / 2,
    y: canvasSize.h / 2 - (minY + maxY) / 2,
  };
}

export function drawSignatureLines(ctx: CanvasRenderingContext2D, cells: Point2[], opts: DrawSignatureLinesOptions): void {
  const cellSet = new Set<string>();
  for (const c of cells) {
    cellSet.add(`${c.x},${c.y}`);
  }

  const color = resolveSignatureColor(opts.color);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = opts.blur;

  ctx.beginPath();

  for (const c of cells) {
    const fromKey = `${c.x},${c.y}`;
    for (const n of axialNeighbors(c)) {
      const toKey = `${n.x},${n.y}`;
      if (!cellSet.has(toKey)) continue;
      if (toKey <= fromKey) continue;

      const a = axialToPixel(c, opts.hexSize, opts.origin);
      const b = axialToPixel(n, opts.hexSize, opts.origin);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  }

  ctx.stroke();
  ctx.restore();
}
