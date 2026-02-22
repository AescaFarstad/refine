import { axialToPixel } from './HexMath';
import type { MazeResourceSpawn, GameState } from './GameState';
import type { Point2 } from './core/math';
import { axialToIndex, indexToAxial } from './Research';
import type { ReadonlyGameState } from './UIState';

const DOUBLER_PANEL_ID = 'doubler_panel';
const CREDITS_DOUBLER_PANEL_ID = 'credits_doubler_panel';
const CHRONOTRACES_DOUBLER_PANEL_ID = 'chronotraces_doubler_panel';
const PLUS_ONE_PANEL_ID = 'plus_one_panel';
const REFRESHER_PANEL_ID = 'refresher_panel';

type MazeNexusPlacement = {
  itemId: string;
  placementId: number;
  cells: Point2[];
};

export type MazeNexusLimitDisk = {
  itemId: string;
  placementId: number;
  centerUnit: Point2;
  radiusUnit: number;
};

export type MazeRefresherRefresh = {
  spawnCell: Point2;
  distanceUnit: number;
};

const UNIT_ORIGIN: Point2 = { x: 0, y: 0 };

function sameCell(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function containsCell(cells: readonly Point2[], target: Point2): boolean {
  for (const cell of cells) {
    if (sameCell(cell, target)) return true;
  }
  return false;
}

function getMazeNexusPlacements(gs: ReadonlyGameState): Map<number, MazeNexusPlacement> {
  const placementsById = new Map<number, MazeNexusPlacement>();
  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i]!;
    if (!cell.nexusId) continue;
    if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
      throw new Error(`Invalid nexus placement id at cell index ${i}`);
    }

    const placementCell = indexToAxial(i);
    const existing = placementsById.get(cell.nexusPlacementId);
    if (existing) {
      if (existing.itemId !== cell.nexusId) {
        throw new Error(`Mixed nexus ids for placement id ${cell.nexusPlacementId}`);
      }
      existing.cells.push(placementCell);
      continue;
    }

    placementsById.set(cell.nexusPlacementId, {
      itemId: cell.nexusId,
      placementId: cell.nexusPlacementId,
      cells: [placementCell],
    });
  }
  return placementsById;
}

export function getMazeNexusItemPlacementCells(gs: ReadonlyGameState, itemId: string, center: Point2): Point2[] {
  const def = gs.lib.nexusItems.get(itemId)!;
  return def.placableInstanceDescription.cells.map(cell => ({ x: center.x + cell.x, y: center.y + cell.y }));
}

export function getMazeNexusPlacementCentroidUnit(cells: readonly Point2[]): Point2 {
  if (cells.length === 0) {
    throw new Error('Nexus placement has no cells');
  }

  let cx = 0;
  let cy = 0;
  for (const cell of cells) {
    const pixel = axialToPixel(cell, 1, { x: 0, y: 0 });
    cx += pixel.x;
    cy += pixel.y;
  }
  return { x: cx / cells.length, y: cy / cells.length };
}

function getPlacementAffectedSpawnIndexes(
  spawns: readonly MazeResourceSpawn[],
  placementCells: readonly Point2[],
  effectRadius: number,
): number[] {
  if (effectRadius <= 0) return [];

  const centroid = getMazeNexusPlacementCentroidUnit(placementCells);
  const radiusPx = effectRadius * Math.sqrt(3);
  const radiusPxSq = radiusPx * radiusPx;

  const affected: number[] = [];
  for (let i = 0; i < spawns.length; i++) {
    const spawn = spawns[i]!;
    const pixel = axialToPixel(spawn.cell, 1, { x: 0, y: 0 });
    const dx = pixel.x - centroid.x;
    const dy = pixel.y - centroid.y;
    if (dx * dx + dy * dy <= radiusPxSq) {
      affected.push(i);
    }
  }
  return affected;
}

export function getMazeNexusPlacementAffectedSpawnIndexes(
  gs: ReadonlyGameState,
  itemId: string,
  center: Point2,
): number[] {
  const def = gs.lib.nexusItems.get(itemId)!;
  const placementCells = getMazeNexusItemPlacementCells(gs, itemId, center);
  return getPlacementAffectedSpawnIndexes(gs.mazeResourceSpawns, placementCells, def.effectRadius);
}

function circlesOverlap(a: Point2, ar: number, b: Point2, br: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

export function getMazeNexusLimitDisks(gs: ReadonlyGameState, itemId: string): MazeNexusLimitDisk[] {
  const def = gs.lib.nexusItems.get(itemId)!;
  if (def.limitRadius <= 0) return [];

  const radiusUnit = def.limitRadius * Math.sqrt(3);
  const disks: MazeNexusLimitDisk[] = [];
  const placementsById = getMazeNexusPlacements(gs);
  for (const placement of placementsById.values()) {
    if (placement.itemId !== itemId) continue;
    disks.push({
      itemId,
      placementId: placement.placementId,
      centerUnit: getMazeNexusPlacementCentroidUnit(placement.cells),
      radiusUnit,
    });
  }
  return disks;
}

export function getMazeNexusLimitBlockingDisks(
  gs: ReadonlyGameState,
  itemId: string,
  center: Point2,
): MazeNexusLimitDisk[] {
  const def = gs.lib.nexusItems.get(itemId)!;
  if (def.limitRadius <= 0) return [];

  const placementCells = getMazeNexusItemPlacementCells(gs, itemId, center);
  const candidateCenter = getMazeNexusPlacementCentroidUnit(placementCells);
  const candidateRadiusUnit = def.limitRadius * Math.sqrt(3);
  const existingDisks = getMazeNexusLimitDisks(gs, itemId);
  const blockingDisks: MazeNexusLimitDisk[] = [];
  for (const disk of existingDisks) {
    if (circlesOverlap(candidateCenter, candidateRadiusUnit, disk.centerUnit, disk.radiusUnit)) {
      blockingDisks.push(disk);
    }
  }
  return blockingDisks;
}

export function hasMazeNexusLimitRadiusConflict(
  gs: ReadonlyGameState,
  itemId: string,
  center: Point2,
): boolean {
  return getMazeNexusLimitBlockingDisks(gs, itemId, center).length > 0;
}

export function applyMazeDoublerBonusesToSpawns(gs: ReadonlyGameState, spawns: MazeResourceSpawn[]): void {
  const placementsById = getMazeNexusPlacements(gs);

  for (const placement of placementsById.values()) {
    if (placement.itemId !== PLUS_ONE_PANEL_ID) continue;
    for (let i = 0; i < spawns.length; i++) {
      spawns[i]!.amount += 1;
    }
  }

  for (const placement of placementsById.values()) {
    if (placement.itemId !== CREDITS_DOUBLER_PANEL_ID) continue;
    for (let i = 0; i < spawns.length; i++) {
      const spawn = spawns[i]!;
      if (spawn.resourceKey !== 'credits') continue;
      spawn.amount *= 2;
    }
  }

  for (const placement of placementsById.values()) {
    if (placement.itemId !== CHRONOTRACES_DOUBLER_PANEL_ID) continue;
    for (let i = 0; i < spawns.length; i++) {
      const spawn = spawns[i]!;
      if (spawn.resourceKey !== 'chronotraces') continue;
      spawn.amount *= 2;
    }
  }

  for (const placement of placementsById.values()) {
    if (placement.itemId !== DOUBLER_PANEL_ID) continue;
    const def = gs.lib.nexusItems.get(placement.itemId)!;
    const affectedSpawnIndexes = getPlacementAffectedSpawnIndexes(spawns, placement.cells, def.effectRadius);
    for (const spawnIndex of affectedSpawnIndexes) {
      spawns[spawnIndex]!.amount *= 2;
    }
  }
}

export function resolveMazeRefresherStep(
  gs: ReadonlyGameState,
  steppedCell: Point2,
  takenCells: readonly Point2[],
): MazeRefresherRefresh[] {
  const idx = axialToIndex(steppedCell.x, steppedCell.y);
  if (idx === -1) return [];

  const steppedResearchCell = gs.researchCells[idx]!;
  if (steppedResearchCell.nexusId !== REFRESHER_PANEL_ID) return [];

  const def = gs.lib.nexusItems.get(REFRESHER_PANEL_ID)!;
  if (def.effectRadius <= 0) return [];

  const centerUnit = axialToPixel(steppedCell, 1, UNIT_ORIGIN);
  const effectRadiusUnit = def.effectRadius * Math.sqrt(3);
  const effectRadiusUnitSq = effectRadiusUnit * effectRadiusUnit;

  const refreshed: MazeRefresherRefresh[] = [];
  for (const spawn of gs.mazeResourceSpawns) {
    if (!containsCell(takenCells, spawn.cell)) continue;
    const spawnUnit = axialToPixel(spawn.cell, 1, UNIT_ORIGIN);
    const dx = spawnUnit.x - centerUnit.x;
    const dy = spawnUnit.y - centerUnit.y;
    const distanceUnitSq = dx * dx + dy * dy;
    if (distanceUnitSq > effectRadiusUnitSq) continue;
    refreshed.push({
      spawnCell: spawn.cell,
      distanceUnit: Math.sqrt(distanceUnitSq),
    });
  }

  return refreshed;
}

export function applyMazeRefresherBonusOnStep(gs: GameState, steppedCell: Point2): void {
  const refreshedSpawns = resolveMazeRefresherStep(gs, steppedCell, gs.maze.takenCells);
  if (refreshedSpawns.length === 0) return;

  gs.maze.takenCells = gs.maze.takenCells.filter(
    takenCell => !refreshedSpawns.some(refreshed => sameCell(refreshed.spawnCell, takenCell)),
  );
}
