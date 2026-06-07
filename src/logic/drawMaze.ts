import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import type { MazeVisibilityDebugPolygons, MazeVisibilityPolygon } from './MazeVision';
import {
  renderMazeTerrainLayer as renderMazeTerrainComposedLayer,
  renderMazeTerrainVisibilityOverlay,
} from './drawMazeTerrain';
import { renderMazeFurnitureLayer as renderMazeFurnitureModuleLayer } from './drawMazeFurniture';
import { axialToPixel } from './HexMath';
import { indexToAxial } from './Research';

function renderMazeVisitedCellsLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  const radius = Math.max(2, Math.min(4, hexSize * 0.11));

  for (let i = 0; i < game.researchCells.length; i++) {
    const cell = game.researchCells[i]!;
    if (cell.mazeVisitVersion !== game.mazeVisitCounter) continue;

    const axial = indexToAxial(i);
    const center = axialToPixel(axial, hexSize, origin);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  renderMazeTerrainComposedLayer(
    ctx,
    game,
    origin,
    hexSize,
    visibleHexBoundaryLoops,
    debugVisibilityPolygon,
    debugVisibilityPolygons,
  );
}

export function renderMazeVisibilityOverlay(
  ctx: CanvasRenderingContext2D,
  origin: Point2,
  hexSize: number,
  visibleHexBoundaryLoops: readonly (readonly Point2[])[] | null = null,
  debugVisibilityPolygon: MazeVisibilityPolygon | null = null,
  debugVisibilityPolygons: MazeVisibilityDebugPolygons | null = null,
): void {
  renderMazeTerrainVisibilityOverlay(
    ctx,
    origin,
    hexSize,
    visibleHexBoundaryLoops,
    debugVisibilityPolygon,
    debugVisibilityPolygons,
  );
}

export function renderMazeFurnitureLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  takenCells: readonly { readonly x: number; readonly y: number }[],
  hoveredCell: Point2 | null = null,
  highlightedResourceCellKeys?: ReadonlySet<string>,
  visuallyTakenCellKeys?: ReadonlySet<string>,
): void {
  renderMazeFurnitureModuleLayer(
    ctx,
    game,
    origin,
    hexSize,
    takenCells,
    hoveredCell,
    highlightedResourceCellKeys,
    visuallyTakenCellKeys,
  );
  renderMazeVisitedCellsLayer(ctx, game, origin, hexSize);
}
