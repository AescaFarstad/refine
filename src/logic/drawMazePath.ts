import { axialToPixel } from './HexMath';
import type { Point2 } from './ItemLib';

const MAZE_PATH_COLOR = 'rgba(255, 255, 255, 1)';
const MAZE_PATH_OVER_COLOR = 'rgba(245, 101, 101, 0.7)';
const MAZE_PATH_SMOOTHNESS = 1;

function strokeSmoothPath(
  ctx: CanvasRenderingContext2D,
  points: readonly Point2[],
  smoothness: number,
): void {
  ctx.beginPath();
  const first = points[0]!;
  ctx.moveTo(first.x, first.y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1]! : points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = i + 2 < points.length ? points[i + 2]! : p2;

    const c1x = p1.x + ((p2.x - p0.x) * smoothness) / 6;
    const c1y = p1.y + ((p2.y - p0.y) * smoothness) / 6;
    const c2x = p2.x - ((p3.x - p1.x) * smoothness) / 6;
    const c2y = p2.y - ((p3.y - p1.y) * smoothness) / 6;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }

  ctx.stroke();
}

export function renderMazePathOverlay(
  ctx: CanvasRenderingContext2D,
  path: readonly Point2[],
  avatarCell: Point2,
  origin: Point2,
  hexSize: number,
  remainingPool: number,
): void {
  if (path.length === 0) return;

  ctx.save();
  const transform = ctx.getTransform();
  const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
  ctx.lineWidth = 1 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Split path into affordable and over-budget segments
  const splitIndex = Math.min(remainingPool, path.length);
  const avatarPixel = axialToPixel(avatarCell, hexSize, origin);
  const pathPixels = path.map((cell) => axialToPixel(cell, hexSize, origin));

  // Draw affordable portion
  if (splitIndex > 0) {
    ctx.strokeStyle = MAZE_PATH_COLOR;
    const affordablePoints = [avatarPixel, ...pathPixels.slice(0, splitIndex)];
    strokeSmoothPath(ctx, affordablePoints, MAZE_PATH_SMOOTHNESS);
  }

  // Draw over-budget portion
  if (splitIndex < path.length) {
    ctx.strokeStyle = MAZE_PATH_OVER_COLOR;
    const overStart = splitIndex > 0 ? pathPixels[splitIndex - 1]! : avatarPixel;
    const overBudgetPoints = [overStart, ...pathPixels.slice(splitIndex)];
    strokeSmoothPath(ctx, overBudgetPoints, MAZE_PATH_SMOOTHNESS);
  }

  ctx.restore();
}
