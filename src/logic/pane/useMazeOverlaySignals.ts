import type { Ref, ComputedRef } from 'vue';
import { bfsMazePath } from '../MazeBFS';
import { axialToPixel } from '../HexMath';
import type { Point2 } from '../ItemLib';
import { getMazeNexusPlacementPreviewResourceSpawn, isMazeEntranceCell } from '../Maze';
import type { ReadonlyGameState } from '../UIState';
import type { MazeResourceHoverHint, MazeResourceKey } from './MazeOverlayState';

type Point2Ref = Ref<Point2> | ComputedRef<Point2>;

export interface MazeOverlaySignalsOptions {
  getGameState: () => ReadonlyGameState;
  getHighlightResourceKey: () => MazeResourceKey | null;
  getDragPreview: () => { itemId: string; axial: Point2 | null; valid: boolean };
  getQueuedAvatarCell: () => Point2;
  origin: Point2Ref;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  hoverAxial: Ref<Point2 | null>;
  hexSize: number;
  emitResourceHover: (hint: MazeResourceHoverHint | null) => void;
  emitResourceHoverBatch: (hints: MazeResourceHoverHint[]) => void;
  emitHoverPathCost: (cost: number) => void;
  emitEntranceHover: (hovering: boolean) => void;
}

export interface MazeOverlaySignalsController {
  buildHoverResourceHint: (axial: Point2 | null) => MazeResourceHoverHint | null;
  buildHoverResourceHintsByKey: (resourceKey: MazeResourceKey | null) => MazeResourceHoverHint[];
  emitHoverResourceHint: (axial?: Point2 | null) => void;
  emitHoverResourceHintBatch: () => void;
  emitHoverPathCost: (axial?: Point2 | null) => void;
  emitHoverPathCostValue: (cost: number) => void;
  emitEntranceHover: (axial?: Point2 | null) => void;
  emitAllForCurrentHover: () => void;
  clearAll: () => void;
}

function toCellKey(cell: Point2): string {
  return `${cell.x},${cell.y}`;
}

export function useMazeOverlaySignals(options: MazeOverlaySignalsOptions): MazeOverlaySignalsController {
  function buildHoverResourceHint(axial: Point2 | null): MazeResourceHoverHint | null {
    const gs = options.getGameState();
    const dragPreview = options.getDragPreview();
    if (dragPreview.valid && dragPreview.axial && dragPreview.itemId) {
      const previewSpawn = getMazeNexusPlacementPreviewResourceSpawn(gs, dragPreview.itemId, dragPreview.axial);
      if (previewSpawn) {
        const world = axialToPixel(previewSpawn.cell, options.hexSize, options.origin.value);
        const z = options.zoom.value;
        const off = options.offset.value;

        return {
          resourceKey: previewSpawn.resourceKey,
          amount: previewSpawn.amount,
          screenX: world.x * z + off.x,
          screenY: world.y * z + off.y,
        };
      }
    }

    if (!axial) return null;

    const spawn = gs.mazeResourceSpawns.find(
      s => s.cell.x === axial.x && s.cell.y === axial.y,
    );
    if (!spawn) return null;

    const taken = gs.maze.takenCells.some(c => c.x === axial.x && c.y === axial.y);
    if (taken) return null;

    const world = axialToPixel(spawn.cell, options.hexSize, options.origin.value);
    const z = options.zoom.value;
    const off = options.offset.value;

    return {
      resourceKey: spawn.resourceKey,
      amount: spawn.amount,
      screenX: world.x * z + off.x,
      screenY: world.y * z + off.y,
    };
  }

  function emitHoverResourceHint(axial: Point2 | null = options.hoverAxial.value): void {
    options.emitResourceHover(buildHoverResourceHint(axial));
  }

  function buildHoverResourceHintsByKey(resourceKey: MazeResourceKey | null): MazeResourceHoverHint[] {
    if (!resourceKey) return [];

    const gs = options.getGameState();
    const takenKeys = new Set(gs.maze.takenCells.map(toCellKey));
    const z = options.zoom.value;
    const off = options.offset.value;

    return gs.mazeResourceSpawns
      .filter((spawn) => spawn.resourceKey === resourceKey && !takenKeys.has(toCellKey(spawn.cell)))
      .map((spawn) => {
        const world = axialToPixel(spawn.cell, options.hexSize, options.origin.value);
        return {
          resourceKey: spawn.resourceKey,
          amount: spawn.amount,
          screenX: world.x * z + off.x,
          screenY: world.y * z + off.y,
        };
      });
  }

  function emitHoverResourceHintBatch(): void {
    options.emitResourceHoverBatch(buildHoverResourceHintsByKey(options.getHighlightResourceKey()));
  }

  function computeHoverPathCost(axial: Point2 | null): number {
    if (!axial) return 0;

    const gs = options.getGameState();
    const from = options.getQueuedAvatarCell();
    const result = bfsMazePath(gs, from, axial);
    return result.reachable ? result.cost : 0;
  }

  function emitHoverPathCost(axial: Point2 | null = options.hoverAxial.value): void {
    options.emitHoverPathCost(computeHoverPathCost(axial));
  }

  function emitHoverPathCostValue(cost: number): void {
    options.emitHoverPathCost(cost);
  }

  function emitEntranceHover(axial: Point2 | null = options.hoverAxial.value): void {
    options.emitEntranceHover(!!axial && isMazeEntranceCell(options.getGameState(), axial));
  }

  function emitAllForCurrentHover(): void {
    emitHoverResourceHint();
    emitHoverResourceHintBatch();
    emitHoverPathCost();
    emitEntranceHover();
  }

  function clearAll(): void {
    options.emitResourceHover(null);
    options.emitResourceHoverBatch([]);
    options.emitHoverPathCost(0);
    options.emitEntranceHover(false);
  }

  return {
    buildHoverResourceHint,
    buildHoverResourceHintsByKey,
    emitHoverResourceHint,
    emitHoverResourceHintBatch,
    emitHoverPathCost,
    emitHoverPathCostValue,
    emitEntranceHover,
    emitAllForCurrentHover,
    clearAll,
  };
}
