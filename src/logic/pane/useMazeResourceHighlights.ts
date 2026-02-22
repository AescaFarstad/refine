import type { Ref } from 'vue';
import { axialToPixel } from '../HexMath';
import { getMazeNexusPlacementCentroidUnit } from '../Maze';
import { axialToIndex, indexToAxial } from '../Research';
import type { Point2 } from '../ItemLib';
import type { ReadonlyGameState } from '../UIState';
import type { MazeResourceKey } from './MazeOverlayState';

const UNIT_ORIGIN: Point2 = { x: 0, y: 0 };

export interface MazeResourceHighlightsOptions {
  getGameState: () => ReadonlyGameState;
  hoverAxial: Ref<Point2 | null>;
  getHighlightResourceKey: () => MazeResourceKey | null;
}

export interface MazeResourceHighlightsController {
  buildHighlightedResourceCellKeys: () => Set<string>;
}

function toCellKey(cell: Point2): string {
  return `${cell.x},${cell.y}`;
}

function buildPlacementCells(gs: ReadonlyGameState, placementId: number, nexusId: string): Point2[] {
  const placementCells: Point2[] = [];
  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i]!;
    if (!cell.nexusId) continue;
    if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
      throw new Error(`Invalid nexus placement id at cell index ${i}`);
    }
    if (cell.nexusPlacementId !== placementId) continue;
    if (cell.nexusId !== nexusId) {
      throw new Error(`Mixed nexus ids for placement id ${placementId}`);
    }
    placementCells.push(indexToAxial(i));
  }
  return placementCells;
}

export function useMazeResourceHighlights(
  options: MazeResourceHighlightsOptions,
): MazeResourceHighlightsController {
  function buildHighlightedResourceCellKeys(): Set<string> {
    const gs = options.getGameState();
    const highlighted = new Set<string>();
    const hoverCell = options.hoverAxial.value;

    const takenSet = new Set(gs.maze.takenCells.map(toCellKey));
    const highlightedResourceKey = options.getHighlightResourceKey();
    if (highlightedResourceKey) {
      for (const spawn of gs.mazeResourceSpawns) {
        if (spawn.resourceKey !== highlightedResourceKey) continue;
        if (takenSet.has(toCellKey(spawn.cell))) continue;
        highlighted.add(toCellKey(spawn.cell));
      }
    }

    if (!hoverCell) {
      return highlighted;
    }

    const hoveredSpawn = gs.mazeResourceSpawns.find(
      spawn => spawn.cell.x === hoverCell.x && spawn.cell.y === hoverCell.y,
    );
    if (hoveredSpawn && !takenSet.has(toCellKey(hoveredSpawn.cell))) {
      highlighted.add(toCellKey(hoveredSpawn.cell));
    }

    const hoveredIdx = axialToIndex(hoverCell.x, hoverCell.y);
    if (hoveredIdx === -1) {
      return highlighted;
    }

    const hoveredResearchCell = gs.researchCells[hoveredIdx]!;
    if (!hoveredResearchCell.nexusId) {
      return highlighted;
    }
    if (!Number.isInteger(hoveredResearchCell.nexusPlacementId) || hoveredResearchCell.nexusPlacementId <= 0) {
      throw new Error(`Invalid nexus placement id at cell index ${hoveredIdx}`);
    }

    const def = gs.lib.nexusItems.get(hoveredResearchCell.nexusId)!;
    if (def.effectRadius <= 0) {
      return highlighted;
    }

    const placementCells = buildPlacementCells(gs, hoveredResearchCell.nexusPlacementId, hoveredResearchCell.nexusId);
    const centerUnit = getMazeNexusPlacementCentroidUnit(placementCells);
    const effectRadiusUnit = def.effectRadius * Math.sqrt(3);
    const effectRadiusUnitSq = effectRadiusUnit * effectRadiusUnit;

    for (const spawn of gs.mazeResourceSpawns) {
      if (takenSet.has(toCellKey(spawn.cell))) continue;
      const spawnUnit = axialToPixel(spawn.cell, 1, UNIT_ORIGIN);
      const dx = spawnUnit.x - centerUnit.x;
      const dy = spawnUnit.y - centerUnit.y;
      if (dx * dx + dy * dy > effectRadiusUnitSq) continue;
      highlighted.add(toCellKey(spawn.cell));
    }

    return highlighted;
  }

  return {
    buildHighlightedResourceCellKeys,
  };
}
