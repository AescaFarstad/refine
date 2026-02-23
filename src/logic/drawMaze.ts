import type { Point2 } from './ItemLib';
import type { ReadonlyGameState } from './UIState';
import type { MazeVisibilityDebugPolygons, MazeVisibilityPolygon } from './MazeVision';
import {
  renderMazeTerrainBaseLayer,
  renderMazeTerrainLayer as renderMazeTerrainComposedLayer,
  renderMazeTerrainVisibilityOverlay,
} from './drawMazeTerrain';
import { renderMazeFurnitureLayer as renderMazeFurnitureModuleLayer } from './drawMazeFurniture';

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
}

export function renderMazeBaseLayer(
  ctx: CanvasRenderingContext2D,
  game: ReadonlyGameState,
  origin: Point2,
  hexSize: number,
  takenCells: readonly { readonly x: number; readonly y: number }[],
  hoveredCell: Point2 | null = null,
  highlightedResourceCellKeys?: ReadonlySet<string>,
  visuallyTakenCellKeys?: ReadonlySet<string>,
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
}
