import { indexToAxial, axialToIndex } from './Research';
import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import { computeOwnedResearchBoundary, computeHexBoundary } from './hexBoundary';
import { traceSmoothHexBoundary } from './drawSmoothBoundary';
import type { MazeVisibilityDebugPolygons, MazeVisibilityPolygon } from './MazeVision';

const SHADOW_COLOR = 'rgba(0, 0, 0, 0.55)';
const SHADOW_OFFSET = { x: 3, y: 4 };
const CELL_FILL_COLOR_TOP = 'rgb(34, 68, 74)';
const CELL_FILL_COLOR_MID = 'rgb(44, 84, 88)';
const CELL_FILL_COLOR_BOT = 'rgb(28, 56, 64)';
const ZERO_MOVE_COST_FILL_COLOR = 'rgba(122, 208, 196, 0.22)';
const CELL_OUTER_STROKE_COLOR = 'rgba(4, 18, 22, 0.65)';
const CELL_OUTER_STROKE_WIDTH = 6;
const CELL_INNER_STROKE_COLOR = 'rgba(140, 220, 210, 0.32)';
const CELL_INNER_STROKE_WIDTH = 2.5;
const VISION_FILL = 'rgba(245, 255, 190, 0.22)';
const VISION_STROKE = 'rgba(245, 255, 190, 0.72)';
const VISION_STROKE_WIDTH = 2;
const VISION_DEBUG_STROKE = 'rgba(255, 96, 96, 0.92)';
const VISION_DEBUG_STROKE_WIDTH = 1.8;
const VOID_FILL_COLOR = 'rgba(0, 0, 0, 0.18)';
const VOID_NEAR_OWNED_RADIUS = 3;
const VOID_BOUNDARY_SMOOTHNESS = 1.2;
const VOID_BOUNDARY_CONCAVE_BLEND = 0.9;
const VOID_BOUNDARY_CONCAVE_BLEND_NU = 0.25;

const traceBoundaryPath = traceSmoothHexBoundary;

function drawVisibleHexBoundary(
  ctx: CanvasRenderingContext2D,
  loops: readonly (readonly Point2[])[],
  origin: Point2,
  hexSize: number,
): void {
  if (loops.length === 0) {
    throw new Error('drawVisibleHexBoundary: expected at least one boundary loop');
  }

  ctx.save();
  traceBoundaryPath(ctx, loops, origin, hexSize);
  ctx.fillStyle = VISION_FILL;
  ctx.fill('evenodd');
  ctx.strokeStyle = VISION_STROKE;
  ctx.lineWidth = VISION_STROKE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawDebugVisibilityPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: MazeVisibilityPolygon,
  origin: Point2,
  hexSize: number,
): void {
  if (polygon.pointCount < 3) {
    throw new Error(`drawDebugVisibilityPolygon: expected at least 3 points, got ${polygon.pointCount}`);
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    origin.x + polygon.pointX[0]! * hexSize,
    origin.y + polygon.pointY[0]! * hexSize,
  );
  for (let i = 1; i < polygon.pointCount; i++) {
    ctx.lineTo(
      origin.x + polygon.pointX[i]! * hexSize,
      origin.y + polygon.pointY[i]! * hexSize,
    );
  }
  ctx.closePath();
  ctx.strokeStyle = VISION_DEBUG_STROKE;
  ctx.lineWidth = VISION_DEBUG_STROKE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawDebugVisibilityPolygons(
  ctx: CanvasRenderingContext2D,
  polygons: MazeVisibilityDebugPolygons,
  origin: Point2,
  hexSize: number,
): void {
  for (let i = 0; i < polygons.polygonCount; i++) {
    const pointCount = polygons.pointCountByPolygon[i]!;
    if (pointCount < 3) continue;
    const start = i * polygons.pointStride;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(
      origin.x + polygons.pointX[start]! * hexSize,
      origin.y + polygons.pointY[start]! * hexSize,
    );
    for (let j = 1; j < pointCount; j++) {
      ctx.lineTo(
        origin.x + polygons.pointX[start + j]! * hexSize,
        origin.y + polygons.pointY[start + j]! * hexSize,
      );
    }
    ctx.closePath();
    ctx.strokeStyle = VISION_DEBUG_STROKE;
    ctx.lineWidth = VISION_DEBUG_STROKE_WIDTH;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

function drawZeroMoveCostOverlay(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
): void {
  const zeroCostCells: Point2[] = [];
  for (let i = 0; i < game.researchCells.length; i++) {
    const cell = game.researchCells[i]!;
    if (!cell.owned || !cell.passable || cell.mazeMoveCostMult !== 0) continue;
    zeroCostCells.push(indexToAxial(i));
  }
  if (zeroCostCells.length === 0) return;

  const loops = computeHexBoundary(zeroCostCells);
  if (loops.length === 0) return;

  ctx.save();
  traceBoundaryPath(ctx, loops, origin, hexSize);
  ctx.fillStyle = ZERO_MOVE_COST_FILL_COLOR;
  ctx.fill('evenodd');
  ctx.restore();
}

function drawVoidBoundary(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
): void {
  const voidCells: Point2[] = [];
  for (let i = 0; i < game.researchCells.length; i++) {
    const cell = game.researchCells[i]!;
    if (!cell.blocked) continue;

    const ax = indexToAxial(i);
    let nearOwned = false;

    for (let dx = -VOID_NEAR_OWNED_RADIUS; dx <= VOID_NEAR_OWNED_RADIUS; dx++) {
      for (
        let dy = Math.max(-VOID_NEAR_OWNED_RADIUS, -dx - VOID_NEAR_OWNED_RADIUS);
        dy <= Math.min(VOID_NEAR_OWNED_RADIUS, -dx + VOID_NEAR_OWNED_RADIUS);
        dy++
      ) {
        const nx = ax.x + dx;
        const ny = ax.y + dy;
        const nIdx = axialToIndex(nx, ny);
        if (nIdx >= 0 && nIdx < game.researchCells.length) {
          if (game.researchCells[nIdx]!.owned) {
            nearOwned = true;
            break;
          }
        }
      }
      if (nearOwned) break;
    }

    if (nearOwned) {
      voidCells.push(ax);
    }
  }

  if (voidCells.length === 0) return;

  const loops = computeHexBoundary(voidCells);
  if (loops.length === 0) return;

  ctx.save();
  traceSmoothHexBoundary(ctx, loops, origin, hexSize, undefined, {
    smoothness: VOID_BOUNDARY_SMOOTHNESS,
    concaveBlend: VOID_BOUNDARY_CONCAVE_BLEND,
    concaveBlendNu: VOID_BOUNDARY_CONCAVE_BLEND_NU,
  });
  ctx.fillStyle = VOID_FILL_COLOR;
  ctx.fill('evenodd');
  ctx.restore();
}

export function renderMazeTerrainBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
): void {
  drawVoidBoundary(ctx, game, origin, hexSize);

  const loops = computeOwnedResearchBoundary(game.researchCells);
  if (loops.length === 0) return;

  ctx.save();
  traceBoundaryPath(ctx, loops, origin, hexSize, SHADOW_OFFSET);
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  traceBoundaryPath(ctx, loops, origin, hexSize);

  let minY = Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    for (const p of loop) {
      const py = origin.y + p.y * hexSize;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  grad.addColorStop(0, CELL_FILL_COLOR_TOP);
  grad.addColorStop(0.45, CELL_FILL_COLOR_MID);
  grad.addColorStop(1, CELL_FILL_COLOR_BOT);
  ctx.fillStyle = grad;
  ctx.fill('evenodd');
  ctx.restore();

  drawZeroMoveCostOverlay(ctx, game, origin, hexSize);

  ctx.save();
  traceBoundaryPath(ctx, loops, origin, hexSize);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CELL_OUTER_STROKE_COLOR;
  ctx.lineWidth = CELL_OUTER_STROKE_WIDTH;
  ctx.stroke();

  traceBoundaryPath(ctx, loops, origin, hexSize);
  ctx.strokeStyle = CELL_INNER_STROKE_COLOR;
  ctx.lineWidth = CELL_INNER_STROKE_WIDTH;
  ctx.stroke();
  ctx.restore();
}

export function renderMazeTerrainVisibilityOverlay(
  ctx: CanvasRenderingContext2D,
  origin: Point2,
  hexSize: number,
  visibleHexBoundaryLoops: readonly (readonly Point2[])[] | null = null,
  debugVisibilityPolygon: MazeVisibilityPolygon | null = null,
  debugVisibilityPolygons: MazeVisibilityDebugPolygons | null = null,
): void {
  if (visibleHexBoundaryLoops !== null) {
    drawVisibleHexBoundary(ctx, visibleHexBoundaryLoops, origin, hexSize);
  }
  if (debugVisibilityPolygon !== null) {
    drawDebugVisibilityPolygon(ctx, debugVisibilityPolygon, origin, hexSize);
  }
  if (debugVisibilityPolygons !== null) {
    drawDebugVisibilityPolygons(ctx, debugVisibilityPolygons, origin, hexSize);
  }
}

export function renderMazeTerrainLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  visibleHexBoundaryLoops: readonly (readonly Point2[])[] | null = null,
  debugVisibilityPolygon: MazeVisibilityPolygon | null = null,
  debugVisibilityPolygons: MazeVisibilityDebugPolygons | null = null,
): void {
  renderMazeTerrainBaseLayer(ctx, game, origin, hexSize);
  renderMazeTerrainVisibilityOverlay(
    ctx,
    origin,
    hexSize,
    visibleHexBoundaryLoops,
    debugVisibilityPolygon,
    debugVisibilityPolygons,
  );
}
