import type { Ref, ComputedRef } from 'vue';
import { axialToPixel } from '../HexMath';
import { getMazeNexusPlacementCentroidUnit } from '../Maze';
import { axialToIndex, indexToAxial } from '../Research';
import type { Point2 } from '../ItemLib';
import type { ReadonlyGameState } from '../UIState';
import { useMazePickupAnimation } from './useMazePickupAnimation';
import { useMazeRefresherAnimation } from './useMazeRefresherAnimation';

const REFRESHER_PANEL_ID = 'refresher_panel';
const REFRESHER_DELAY_MS_PER_UNIT = 50; // 0.5 sec / 10 units
const UNIT_ORIGIN: Point2 = { x: 0, y: 0 };

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
  onSegmentComplete: (targetCell: Point2, takenBefore: Set<string>, segmentPath: Point2[]) => void;
  getVisuallyTakenCellKeys: () => ReadonlySet<string>;
  clearVisualRefreshMask: () => void;
  dispose: () => void;
}

function toCellKey(cell: Point2): string {
  return `${cell.x},${cell.y}`;
}

function buildRefresherPlacementsById(gs: ReadonlyGameState): Map<number, Point2[]> {
  const placementsById = new Map<number, Point2[]>();

  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i]!;
    if (cell.nexusId !== REFRESHER_PANEL_ID) continue;
    if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
      throw new Error(`Invalid refresher placement id at cell index ${i}`);
    }

    const placementCells = placementsById.get(cell.nexusPlacementId);
    const placementCell = indexToAxial(i);
    if (placementCells) {
      placementCells.push(placementCell);
      continue;
    }
    placementsById.set(cell.nexusPlacementId, [placementCell]);
  }

  return placementsById;
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

  function animateRefresherBonuses(segmentPath: Point2[], takenBefore: Set<string>): void {
    if (segmentPath.length === 0) return;

    const gs = options.getGameState();
    const refresherDef = gs.lib.nexusItems.get(REFRESHER_PANEL_ID)!;
    if (refresherDef.effectRadius <= 0) return;

    const effectRadiusUnit = refresherDef.effectRadius * Math.sqrt(3);
    const effectRadiusUnitSq = effectRadiusUnit * effectRadiusUnit;
    const placementsById = buildRefresherPlacementsById(gs);
    const simulatedTaken = new Set(takenBefore);
    const spawnsByCellKey = new Map(gs.mazeResourceSpawns.map((spawn) => [toCellKey(spawn.cell), spawn]));

    for (const steppedCell of segmentPath) {
      const steppedKey = toCellKey(steppedCell);
      if (simulatedTaken.has(steppedKey)) {
        continue;
      }

      const spawnAtCell = spawnsByCellKey.get(steppedKey);
      if (spawnAtCell) {
        simulatedTaken.add(steppedKey);
        continue;
      }

      const steppedIdx = axialToIndex(steppedCell.x, steppedCell.y);
      if (steppedIdx === -1) {
        continue;
      }

      const steppedResearchCell = gs.researchCells[steppedIdx]!;
      if (steppedResearchCell.nexusId === REFRESHER_PANEL_ID) {
        if (!Number.isInteger(steppedResearchCell.nexusPlacementId) || steppedResearchCell.nexusPlacementId <= 0) {
          throw new Error(`Invalid refresher placement id at cell index ${steppedIdx}`);
        }

        const placementCells = placementsById.get(steppedResearchCell.nexusPlacementId)!;
        let canTrigger = true;
        for (const placementCell of placementCells) {
          if (simulatedTaken.has(toCellKey(placementCell))) {
            canTrigger = false;
            break;
          }
        }

        if (canTrigger) {
          const placementCenterUnit = getMazeNexusPlacementCentroidUnit(placementCells);
          for (const spawn of gs.mazeResourceSpawns) {
            const spawnKey = toCellKey(spawn.cell);
            if (!simulatedTaken.has(spawnKey)) continue;

            const spawnUnit = axialToPixel(spawn.cell, 1, UNIT_ORIGIN);
            const dx = spawnUnit.x - placementCenterUnit.x;
            const dy = spawnUnit.y - placementCenterUnit.y;
            const distanceUnitSq = dx * dx + dy * dy;
            if (distanceUnitSq > effectRadiusUnitSq) continue;

            const delayMs = Math.sqrt(distanceUnitSq) * REFRESHER_DELAY_MS_PER_UNIT;
            refresherAnimation.spawnAt(spawn.cell, delayMs);
            setVisualRefreshMask(spawnKey, delayMs);
            simulatedTaken.delete(spawnKey);
          }
        }
      }

      if (steppedResearchCell.nexusId) {
        simulatedTaken.add(steppedKey);
      }
    }
  }

  function onSegmentComplete(targetCell: Point2, takenBefore: Set<string>, segmentPath: Point2[]): void {
    animateRefresherBonuses(segmentPath, takenBefore);

    const gs = options.getGameState();
    const key = toCellKey(targetCell);
    if (takenBefore.has(key)) return;
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
