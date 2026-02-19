import type { Ref, ComputedRef } from 'vue';
import { resolveMazeRefresherStep } from '../MazeNexusBonuses';
import { axialToIndex } from '../Research';
import type { Point2 } from '../ItemLib';
import type { ReadonlyGameState } from '../UIState';
import { useMazePickupAnimation } from './useMazePickupAnimation';
import { useMazeRefresherAnimation } from './useMazeRefresherAnimation';

const REFRESHER_DELAY_MS_PER_UNIT = 50; // 0.5 sec / 10 units

export interface MazeResourceEffectsOptions {
  pickupCanvas: Ref<HTMLCanvasElement | null>;
  refresherCanvas: Ref<HTMLCanvasElement | null>;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  hexSize: number;
  origin: ComputedRef<Point2>;
  getGameState: () => ReadonlyGameState;
  scheduleBaseRender: () => void;
}

export interface MazeResourceEffectsController {
  onSegmentComplete: (targetCell: Point2, takenBefore: Point2[], segmentPath: Point2[]) => void;
  getVisuallyTakenCellKeys: () => ReadonlySet<string>;
  clearVisualRefreshMask: () => void;
  dispose: () => void;
}

function toCellKey(cell: Point2): string {
  return `${cell.x},${cell.y}`;
}

function sameCell(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function containsCell(cells: readonly Point2[], target: Point2): boolean {
  for (const cell of cells) {
    if (sameCell(cell, target)) return true;
  }
  return false;
}

function removeCell(cells: Point2[], target: Point2): void {
  for (let i = cells.length - 1; i >= 0; i--) {
    if (sameCell(cells[i]!, target)) {
      cells.splice(i, 1);
    }
  }
}

export function useMazeResourceEffects(
  options: MazeResourceEffectsOptions,
): MazeResourceEffectsController {
  const pendingVisualTakenCellKeys = new Set<string>();
  const pendingRevealTimeoutIds = new Map<string, number>();

  const pickupAnimation = useMazePickupAnimation({
    effectsCanvas: options.pickupCanvas,
    zoom: options.zoom,
    offset: options.offset,
    hexSize: options.hexSize,
    origin: options.origin,
  });

  const refresherAnimation = useMazeRefresherAnimation({
    effectsCanvas: options.refresherCanvas,
    zoom: options.zoom,
    offset: options.offset,
    hexSize: options.hexSize,
    origin: options.origin,
  });

  function clearPendingReveal(cellKey: string): void {
    const existingTimeoutId = pendingRevealTimeoutIds.get(cellKey);
    if (existingTimeoutId != null) {
      window.clearTimeout(existingTimeoutId);
      pendingRevealTimeoutIds.delete(cellKey);
    }
  }

  function setVisualRefreshMask(cellKey: string, delayMs: number): void {
    clearPendingReveal(cellKey);
    if (delayMs <= 0) {
      pendingVisualTakenCellKeys.delete(cellKey);
      options.scheduleBaseRender();
      return;
    }

    pendingVisualTakenCellKeys.add(cellKey);
    options.scheduleBaseRender();

    const timeoutId = window.setTimeout(() => {
      pendingRevealTimeoutIds.delete(cellKey);
      pendingVisualTakenCellKeys.delete(cellKey);
      options.scheduleBaseRender();
    }, delayMs);
    pendingRevealTimeoutIds.set(cellKey, timeoutId);
  }

  function animateRefresherBonuses(segmentPath: Point2[], takenBefore: Point2[]): void {
    if (segmentPath.length === 0) return;

    const gs = options.getGameState();
    const simulatedTaken = takenBefore.map(cell => ({ x: cell.x, y: cell.y }));

    for (const steppedCell of segmentPath) {
      if (containsCell(simulatedTaken, steppedCell)) continue;

      const spawnAtCell = gs.mazeResourceSpawns.find(
        spawn => sameCell(spawn.cell, steppedCell),
      );
      if (spawnAtCell) {
        simulatedTaken.push({ x: steppedCell.x, y: steppedCell.y });
        continue;
      }

      const refreshedSpawns = resolveMazeRefresherStep(gs, steppedCell, simulatedTaken);
      for (const refreshed of refreshedSpawns) {
        const delayMs = refreshed.distanceUnit * REFRESHER_DELAY_MS_PER_UNIT;
        refresherAnimation.spawnAt(refreshed.spawnCell, delayMs);
        setVisualRefreshMask(toCellKey(refreshed.spawnCell), delayMs);
        removeCell(simulatedTaken, refreshed.spawnCell);
      }

      const steppedIdx = axialToIndex(steppedCell.x, steppedCell.y);
      if (steppedIdx === -1) continue;

      const steppedResearchCell = gs.researchCells[steppedIdx]!;
      if (steppedResearchCell.nexusId) {
        simulatedTaken.push({ x: steppedCell.x, y: steppedCell.y });
      }
    }
  }

  function onSegmentComplete(targetCell: Point2, takenBefore: Point2[], segmentPath: Point2[]): void {
    animateRefresherBonuses(segmentPath, takenBefore);

    const gs = options.getGameState();
    if (containsCell(takenBefore, targetCell)) return;
    const spawn = gs.mazeResourceSpawns.find(
      s => s.cell.x === targetCell.x && s.cell.y === targetCell.y,
    );
    if (spawn) {
      pickupAnimation.spawnAt(targetCell, spawn);
    }
  }

  function clearVisualRefreshMask(): void {
    for (const timeoutId of pendingRevealTimeoutIds.values()) {
      window.clearTimeout(timeoutId);
    }
    pendingRevealTimeoutIds.clear();
    if (pendingVisualTakenCellKeys.size > 0) {
      pendingVisualTakenCellKeys.clear();
      options.scheduleBaseRender();
    }
  }

  function getVisuallyTakenCellKeys(): ReadonlySet<string> {
    return pendingVisualTakenCellKeys;
  }

  function dispose(): void {
    clearVisualRefreshMask();
    pickupAnimation.dispose();
    refresherAnimation.dispose();
  }

  return {
    onSegmentComplete,
    getVisuallyTakenCellKeys,
    clearVisualRefreshMask,
    dispose,
  };
}
