import { indexToAxial, axialToIndex } from './Research';
import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import { computeOwnedResearchBoundary, computeHexBoundary, type HexBoundaryLoop } from './hexBoundary';
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
const MAZE_NEXUS_ARCHETYPE_ID = 'disc_maze_nexus';
const SPECIAL_RESOURCE_PUSH_WEIGHT = 1.2;
const SPECIAL_NEXUS_PUSH_WEIGHT = 1;
const SPECIAL_BOUNDARY_PUSH_AMOUNT = 0.15;
const NORMAL_EPS = 1e-8;

const traceBoundaryPath = traceSmoothHexBoundary;

function getLoopSignedArea(loop: readonly Point2[]): number {
  const segmentCount = loop.length - 1;
  let area2 = 0;
  for (let i = 0; i < segmentCount; i++) {
    const a = loop[i]!;
    const b = loop[i + 1]!;
    area2 += a.x * b.y - a.y * b.x;
  }
  return area2 * 0.5;
}

function buildSpecialBoundaryPushByCell(game: ReadonlyGameState): Map<string, number> {
  const pushByCell = new Map<string, number>();

  for (const spawn of game.mazeResourceSpawns) {
    const key = `${spawn.cell.x},${spawn.cell.y}`;
    const existing = pushByCell.get(key) ?? 0;
    if (SPECIAL_RESOURCE_PUSH_WEIGHT > existing) {
      pushByCell.set(key, SPECIAL_RESOURCE_PUSH_WEIGHT);
    }
  }

  for (let i = 0; i < game.researchCells.length; i++) {
    const cell = game.researchCells[i]!;
    if (!cell.owned) continue;

    let pushWeight = 0;
    if (cell.nexusId) {
      pushWeight = SPECIAL_NEXUS_PUSH_WEIGHT;
    } else if (cell.nodeId >= 0) {
      const node = game.lib.research.nodes.get(cell.nodeId)!;
      if (node.archetypeId === MAZE_NEXUS_ARCHETYPE_ID) {
        pushWeight = SPECIAL_NEXUS_PUSH_WEIGHT;
      }
    }
    if (pushWeight <= 0) continue;

    const axial = indexToAxial(i);
    const key = `${axial.x},${axial.y}`;
    const existing = pushByCell.get(key) ?? 0;
    if (pushWeight > existing) {
      pushByCell.set(key, pushWeight);
    }
  }

  return pushByCell;
}

function deformBoundaryLoopOutward(loop: HexBoundaryLoop, pushByCell: ReadonlyMap<string, number>): Point2[] {
  const points = loop.points;
  const segmentCount = points.length - 1;
  if (segmentCount < 3) {
    return points.map(p => ({ x: p.x, y: p.y }));
  }
  if (segmentCount !== loop.edgeOwnerCells.length) {
    throw new Error(
      `deformBoundaryLoopOutward: segment-owner mismatch, segments=${segmentCount}, owners=${loop.edgeOwnerCells.length}.`
    );
  }

  const orientationArea = getLoopSignedArea(points);
  const orientationSign = orientationArea >= 0 ? 1 : -1;

  const normalX = new Array<number>(segmentCount);
  const normalY = new Array<number>(segmentCount);
  for (let i = 0; i < segmentCount; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let nx = orientationSign > 0 ? dy : -dy;
    let ny = orientationSign > 0 ? -dx : dx;
    const mag = Math.hypot(nx, ny);
    if (mag > NORMAL_EPS) {
      nx /= mag;
      ny /= mag;
    } else {
      nx = 0;
      ny = 0;
    }
    normalX[i] = nx;
    normalY[i] = ny;
  }

  const output = new Array<Point2>(segmentCount + 1);
  for (let i = 0; i < segmentCount; i++) {
    const prevSegment = (i - 1 + segmentCount) % segmentCount;
    const nextSegment = i;
    const prevOwner = loop.edgeOwnerCells[prevSegment]!;
    const nextOwner = loop.edgeOwnerCells[nextSegment]!;
    const prevPush = pushByCell.get(`${prevOwner.x},${prevOwner.y}`) ?? 0;
    const nextPush = pushByCell.get(`${nextOwner.x},${nextOwner.y}`) ?? 0;
    const push = Math.max(prevPush, nextPush);
    if (push <= 0) {
      const base = points[i]!;
      output[i] = { x: base.x, y: base.y };
      continue;
    }

    let nx = normalX[prevSegment]! + normalX[nextSegment]!;
    let ny = normalY[prevSegment]! + normalY[nextSegment]!;
    const nMag = Math.hypot(nx, ny);
    if (nMag > NORMAL_EPS) {
      nx /= nMag;
      ny /= nMag;
    } else {
      nx = normalX[nextSegment]!;
      ny = normalY[nextSegment]!;
    }

    const base = points[i]!;
    const dist = SPECIAL_BOUNDARY_PUSH_AMOUNT * push;
    output[i] = { x: base.x + nx * dist, y: base.y + ny * dist };
  }
  output[segmentCount] = { x: output[0]!.x, y: output[0]!.y };
  return output;
}

function buildOwnedBoundaryLoopPoints(game: ReadonlyGameState): Point2[][] {
  const loops = computeOwnedResearchBoundary(game.researchCells);
  if (loops.length === 0) return [];
  const pushByCell = buildSpecialBoundaryPushByCell(game);
  if (pushByCell.size === 0) {
    return loops.map(loop => loop.points);
  }
  return loops.map(loop => deformBoundaryLoopOutward(loop, pushByCell));
}

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
  const loopPoints = loops.map(loop => loop.points);

  ctx.save();
  traceBoundaryPath(ctx, loopPoints, origin, hexSize);
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
  const loopPoints = loops.map(loop => loop.points);

  ctx.save();
  traceSmoothHexBoundary(ctx, loopPoints, origin, hexSize, undefined, {
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

  const loopPoints = buildOwnedBoundaryLoopPoints(game);
  if (loopPoints.length === 0) return;

  ctx.save();
  traceBoundaryPath(ctx, loopPoints, origin, hexSize, SHADOW_OFFSET);
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  traceBoundaryPath(ctx, loopPoints, origin, hexSize);

  let minY = Infinity;
  let maxY = -Infinity;
  for (const loop of loopPoints) {
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
  traceBoundaryPath(ctx, loopPoints, origin, hexSize);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = CELL_OUTER_STROKE_COLOR;
  ctx.lineWidth = CELL_OUTER_STROKE_WIDTH;
  ctx.stroke();

  traceBoundaryPath(ctx, loopPoints, origin, hexSize);
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
