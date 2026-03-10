import { axialDistance, axialRotateCW, axialRound, axialToPixel, pixelToAxialFloat } from './HexMath';
import type { MazeResourceSpawn, GameState } from './GameState';
import type { Point2 } from './core/math';
import { axialToIndex, indexToAxial } from './Research';
import type { ReadonlyGameState } from './UIState';
import { computeHexBoundary } from './hexBoundary';
import {
  ANTIVOID_PANEL_ID,
  CHRONOTRACES_DOUBLER_PANEL_ID,
  CHRONOTRACES_PANEL_ID,
  CRYSTAL_PANEL_ID,
  CREDITS_DOUBLER_PANEL_ID,
  CREDITS_PANEL_ID,
  DOUBLER_PANEL_ID,
  FRACTAL_PANEL_ID,
  INCREMENTAL_PANEL_ID,
  PLUS_ONE_PANEL_ID,
  PLUS_ONE_RADIUS_PANEL_ID,
  REFRESHER_PANEL_ID,
  SHARDS_REFRESHER_PANEL_ID,
  SPICE_PANEL_ID,
} from './NexusLib';

export const REFRESHER_PANEL_PAUSE_MS = 200;

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
const HEX_ROTATION_STEP_COUNT = 6;
const GEAR_RESOURCE_PANEL_IDS = new Set([CRYSTAL_PANEL_ID, FRACTAL_PANEL_ID, SPICE_PANEL_ID]);
const GEAR_RESOURCE_KEYS = new Set<MazeResourceSpawn['resourceKey']>(['zone_crystal', 'fractal', 'spice']);

function sameCell(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function containsCell(cells: readonly Point2[], target: Point2): boolean {
  for (const cell of cells) {
    if (sameCell(cell, target)) return true;
  }
  return false;
}

function getSpawnAtCell(gs: ReadonlyGameState, cell: Point2): MazeResourceSpawn | null {
  const spawn = gs.mazeResourceSpawns.find(s => sameCell(s.cell, cell));
  return spawn ?? null;
}

export function isMazeShardRefresherStep(gs: ReadonlyGameState, steppedCell: Point2): boolean {
  if (!gs.mazeHasShardsRefresherPanel) return false;
  const steppedSpawn = getSpawnAtCell(gs, steppedCell);
  if (steppedSpawn === null) return false;
  return steppedSpawn.resourceKey === 'shardDust';
}

function isMazeRefresherPanelStep(gs: ReadonlyGameState, steppedCell: Point2): boolean {
  const idx = axialToIndex(steppedCell.x, steppedCell.y);
  if (idx === -1) return false;
  const steppedResearchCell = gs.researchCells[idx]!;
  return steppedResearchCell.nexusId === REFRESHER_PANEL_ID;
}

export function isMazeRefresherStep(gs: ReadonlyGameState, steppedCell: Point2): boolean {
  return isMazeRefresherPanelStep(gs, steppedCell) || isMazeShardRefresherStep(gs, steppedCell);
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

export function getMazeNexusPlacementCountsByItem(gs: ReadonlyGameState): Map<string, number> {
  const countsByItem = new Map<string, number>();
  const placementsById = getMazeNexusPlacements(gs);
  for (const placement of placementsById.values()) {
    const currentCount = countsByItem.get(placement.itemId) ?? 0;
    countsByItem.set(placement.itemId, currentCount + 1);
  }
  return countsByItem;
}

export function getMazeNexusItemPlacementCells(gs: ReadonlyGameState, itemId: string, center: Point2): Point2[] {
  const def = gs.lib.nexusItems.get(itemId)!;
  const rotationStep = getMazeNexusItemPlacementRotationStep(gs, itemId);
  if (rotationStep === 0) {
    return def.placableInstanceDescription.cells.map(cell => ({ x: center.x + cell.x, y: center.y + cell.y }));
  }

  return def.placableInstanceDescription.cells.map(cell => {
    const rotatedCell = axialRotateCW(cell, rotationStep);
    return { x: center.x + rotatedCell.x, y: center.y + rotatedCell.y };
  });
}

function getMazeNexusItemPlacementVisualCenterUnit(gs: ReadonlyGameState, itemId: string): Point2 {
  const localCells = getMazeNexusItemPlacementCells(gs, itemId, UNIT_ORIGIN);
  const loops = computeHexBoundary(localCells);
  if (loops.length === 0) {
    throw new Error(`Nexus item ${itemId} has no placement boundary.`);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    for (const point of loop.points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

export function getMazeNexusPlacementAnchorFromHoverCenter(
  gs: ReadonlyGameState,
  itemId: string,
  hoverCell: Point2,
): Point2 {
  const visualCenterUnit = getMazeNexusItemPlacementVisualCenterUnit(gs, itemId);
  const hoverCenterUnit = axialToPixel(hoverCell, 1, UNIT_ORIGIN);
  const anchorUnit = {
    x: hoverCenterUnit.x - visualCenterUnit.x,
    y: hoverCenterUnit.y - visualCenterUnit.y,
  };

  return axialRound(pixelToAxialFloat(anchorUnit, 1, UNIT_ORIGIN));
}

export function getMazeNexusItemPlacementRotationStep(gs: ReadonlyGameState, itemId: string): number {
  const def = gs.lib.nexusItems.get(itemId)!;
  if (!def.placableInstanceDescription.rotating) return 0;
  return normalizeHexRotationStep(gs.mazeNexusPlacementRotationSteps[itemId] ?? 0);
}

function normalizeHexRotationStep(step: number): number {
  const normalized = step % HEX_ROTATION_STEP_COUNT;
  return normalized >= 0 ? normalized : normalized + HEX_ROTATION_STEP_COUNT;
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

function getRefreshersAndMultipliersRadiusBonusFromPlacements(
  placementsById: ReadonlyMap<number, MazeNexusPlacement>,
): number {
  let bonus = 0;
  for (const placement of placementsById.values()) {
    if (placement.itemId !== PLUS_ONE_RADIUS_PANEL_ID) continue;
    bonus += 1;
  }
  return bonus;
}

function getRefreshersAndMultipliersRadiusBonus(gs: ReadonlyGameState): number {
  const placementsById = getMazeNexusPlacements(gs);
  return getRefreshersAndMultipliersRadiusBonusFromPlacements(placementsById);
}

function getEffectiveRefresherOrMultiplierRadius(itemId: string, baseRadius: number, bonus: number): number {
  if (baseRadius <= 0) return baseRadius;
  if (itemId !== REFRESHER_PANEL_ID && itemId !== DOUBLER_PANEL_ID) return baseRadius;
  return baseRadius + bonus;
}

export function getMazeNexusItemEffectiveRadius(gs: ReadonlyGameState, itemId: string): number {
  const def = gs.lib.nexusItems.get(itemId)!;
  const radiusBonus = getRefreshersAndMultipliersRadiusBonus(gs);
  return getEffectiveRefresherOrMultiplierRadius(itemId, def.effectRadius, radiusBonus);
}

export function getMazeNexusPlacementAffectedSpawnIndexes(
  gs: ReadonlyGameState,
  itemId: string,
  center: Point2,
): number[] {
  const placementCells = getMazeNexusItemPlacementCells(gs, itemId, center);
  const effectiveRadius = getMazeNexusItemEffectiveRadius(gs, itemId);
  return getPlacementAffectedSpawnIndexes(gs.mazeResourceSpawns, placementCells, effectiveRadius);
}

function circlesOverlap(a: Point2, ar: number, b: Point2, br: number): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

function getLimitResourceKeysForItem(itemId: string): Set<MazeResourceSpawn['resourceKey']> | null {
  if (itemId === CREDITS_PANEL_ID) return new Set(['credits']);
  if (itemId === CHRONOTRACES_PANEL_ID) return new Set(['chronotraces']);
  if (GEAR_RESOURCE_PANEL_IDS.has(itemId)) return GEAR_RESOURCE_KEYS;
  return null;
}

export function getMazeNexusLimitDisks(gs: ReadonlyGameState, itemId: string): MazeNexusLimitDisk[] {
  const def = gs.lib.nexusItems.get(itemId)!;
  if (def.limitRadius <= 0) return [];

  const limitResourceKeys = getLimitResourceKeysForItem(itemId);
  if (limitResourceKeys !== null) {
    const disks: MazeNexusLimitDisk[] = [];
    for (let i = 0; i < gs.mazeResourceSpawns.length; i++) {
      const spawn = gs.mazeResourceSpawns[i]!;
      if (!limitResourceKeys.has(spawn.resourceKey)) continue;
      disks.push({
        itemId,
        placementId: i + 1,
        centerUnit: axialToPixel(spawn.cell, 1, UNIT_ORIGIN),
        radiusUnit: 0,
      });
    }
    return disks;
  }

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
  const radiusBonus = getRefreshersAndMultipliersRadiusBonusFromPlacements(placementsById);

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
    const effectiveRadius = getEffectiveRefresherOrMultiplierRadius(placement.itemId, def.effectRadius, radiusBonus);
    const affectedSpawnIndexes = getPlacementAffectedSpawnIndexes(spawns, placement.cells, effectiveRadius);
    for (const spawnIndex of affectedSpawnIndexes) {
      spawns[spawnIndex]!.amount *= 2;
    }
  }
}

export function getMazeNexusResourcePanelSpawnAtCell(
  itemId: string,
  center: Point2,
): MazeResourceSpawn | null {
  if (itemId === CREDITS_PANEL_ID) {
    return {
      cell: { x: center.x, y: center.y },
      resourceKey: 'credits',
      amount: Math.max(1, axialDistance(center, UNIT_ORIGIN)),
    };
  }
  if (itemId === CHRONOTRACES_PANEL_ID) {
    return {
      cell: { x: center.x, y: center.y },
      resourceKey: 'chronotraces',
      amount: Math.max(1, axialDistance(center, UNIT_ORIGIN)),
    };
  }
  if (itemId === CRYSTAL_PANEL_ID) {
    return {
      cell: { x: center.x, y: center.y },
      resourceKey: 'zone_crystal',
      amount: 1,
    };
  }
  if (itemId === FRACTAL_PANEL_ID) {
    return {
      cell: { x: center.x, y: center.y },
      resourceKey: 'fractal',
      amount: 1,
    };
  }
  if (itemId === SPICE_PANEL_ID) {
    return {
      cell: { x: center.x, y: center.y },
      resourceKey: 'spice',
      amount: 1,
    };
  }
  return null;
}

export function getMazeNexusPlacementPreviewResourceSpawn(
  gs: ReadonlyGameState,
  itemId: string,
  center: Point2,
): MazeResourceSpawn | null {
  const previewSpawn = getMazeNexusResourcePanelSpawnAtCell(itemId, center);
  if (previewSpawn === null) return null;

  applyMazeDoublerBonusesToSpawns(gs, [previewSpawn]);
  return previewSpawn;
}

export function resolveMazeRefresherStep(
  gs: ReadonlyGameState,
  steppedCell: Point2,
  takenCells: readonly Point2[],
): MazeRefresherRefresh[] {
  const isRefresherPanelStep = isMazeRefresherPanelStep(gs, steppedCell);
  const isShardRefresherStep = isMazeShardRefresherStep(gs, steppedCell);
  if (!isRefresherPanelStep && !isShardRefresherStep) return [];

  const effectiveRadius = getMazeNexusItemEffectiveRadius(gs, REFRESHER_PANEL_ID);
  if (effectiveRadius <= 0) return [];

  const centerUnit = axialToPixel(steppedCell, 1, UNIT_ORIGIN);
  const effectRadiusUnit = effectiveRadius * Math.sqrt(3);
  const effectRadiusUnitSq = effectRadiusUnit * effectRadiusUnit;

  const refreshed: MazeRefresherRefresh[] = [];
  for (const spawn of gs.mazeResourceSpawns) {
    if (!containsCell(takenCells, spawn.cell)) continue;
    if (isShardRefresherStep && sameCell(spawn.cell, steppedCell)) continue;
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

export function applyMazeAntiVoidBonuses(gs: GameState): boolean {
  const placementsById = getMazeNexusPlacements(gs);
  let topologyChanged = false;

  for (const placement of placementsById.values()) {
    if (placement.itemId !== ANTIVOID_PANEL_ID) continue;

    const def = gs.lib.nexusItems.get(placement.itemId)!;
    if (def.effectRadius <= 0) continue;

    const centroid = getMazeNexusPlacementCentroidUnit(placement.cells);
    const radiusPx = def.effectRadius * Math.sqrt(3);
    const radiusPxSq = radiusPx * radiusPx;

    for (let i = 0; i < gs.researchCells.length; i++) {
      const cell = gs.researchCells[i]!;
      if (!cell.blocked) continue;

      const axial = indexToAxial(i);
      const pixel = axialToPixel(axial, 1, UNIT_ORIGIN);
      const dx = pixel.x - centroid.x;
      const dy = pixel.y - centroid.y;
      if (dx * dx + dy * dy > radiusPxSq) continue;

      cell.nodeId = -1;
      cell.archetypeId = 'obs';
      cell.blocked = false;
      cell.cost = 1;
      cell.passable = true;
      cell.filledByAntiVoid = true;
      topologyChanged = true;
    }
  }

  return topologyChanged;
}

export function applyMazeNexusPanelPurchase(gs: GameState, itemId: string): void {
  if (itemId === INCREMENTAL_PANEL_ID) {
    gs.mazeIncrementalBonusPerPickup += 1;
  }
  if (itemId === SHARDS_REFRESHER_PANEL_ID) {
    gs.mazeHasShardsRefresherPanel = true;
  }
}

export function refundMazeNexusPanelPurchase(gs: GameState, itemId: string, count: number): void {
  if (count <= 0) return;

  if (itemId === INCREMENTAL_PANEL_ID) {
    gs.mazeIncrementalBonusPerPickup -= count;
    if (gs.mazeIncrementalBonusPerPickup < 0) {
      throw new Error(`Negative incremental pickup bonus while refunding "${itemId}"`);
    }
    if (gs.mazeIncrementalBonusPerPickup === 0) {
      gs.maze.incrementalBonusCounter = 0;
    }
    return;
  }

  if (itemId === SHARDS_REFRESHER_PANEL_ID) {
    gs.mazeHasShardsRefresherPanel = false;
  }
}

export function getMazeNextIncrementalPickupBonus(gs: ReadonlyGameState): number {
  if (gs.mazeIncrementalBonusPerPickup <= 0) return 0;
  return gs.maze.incrementalBonusCounter;
}

export function grantMazeIncrementalPickupBonus(gs: GameState, resourceKey: MazeResourceSpawn['resourceKey']): number {
  if (gs.mazeIncrementalBonusPerPickup <= 0) return 0;

  const bonusAmount = gs.maze.incrementalBonusCounter;

  switch (resourceKey) {
    case 'credits':
      gs.maze.collectedCredits += bonusAmount;
      break;
    case 'chronotraces':
      gs.maze.collectedChronotraces += bonusAmount;
      break;
    case 'shardDust':
      gs.maze.collectedShardDust += bonusAmount;
      break;
    case 'zone_crystal':
      gs.maze.collectedZoneCrystal += bonusAmount;
      break;
    case 'fractal':
      gs.maze.collectedFractal += bonusAmount;
      break;
    case 'spice':
      gs.maze.collectedSpice += bonusAmount;
      break;
  }

  gs.maze.incrementalBonusCounter += gs.mazeIncrementalBonusPerPickup;
  return bonusAmount;
}
