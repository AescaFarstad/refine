import { copy, type Point2 } from './core/math';
import type { GameState, MazeResourceSpawn } from './GameState';
import { createMazeTransient } from './GameState';
import type { ResearchLib } from './ResearchLib';
import { axialDistance } from './HexMath';
import { axialToIndex } from './Research';
import { bfsMazePath } from './BFS';
import type { ReadonlyGameState } from './UIState';

const MAZE_ENTRANCE_ARCHETYPE_ID = 'disc_maze_navigation';
const MAZE_NEXUS_ARCHETYPE_ID = 'disc_maze_nexus';
const MAZE_RESET_ENTRANCE_UNSET: Point2 = { x: 0, y: 0 };

export function isMazeEntranceCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  return node.archetypeId === MAZE_ENTRANCE_ARCHETYPE_ID;
}

export function getOwnedMazeEntrances(gs: ReadonlyGameState): Array<Point2> {
  const entrances: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    const idx = axialToIndex(node.centerCell.x, node.centerCell.y);
    if (gs.researchCells[idx]?.owned)
      if (node.archetypeId == MAZE_ENTRANCE_ARCHETYPE_ID)
        entrances.push(copy(node.centerCell));
  }
  return entrances;
}

export function isMazeNexusCell(gs: ReadonlyGameState, cell: Point2): boolean {
  const idx = axialToIndex(cell.x, cell.y);
  if (idx === -1) return false;
  const researchCell = gs.researchCells[idx]!;
  if (!researchCell.owned) return false;
  if (researchCell.nodeId < 0) return false;
  const node = gs.lib.research.nodes.get(researchCell.nodeId)!;
  return node.archetypeId === MAZE_NEXUS_ARCHETYPE_ID;
}

export function getOwnedMazeNexuses(gs: ReadonlyGameState): Array<Point2> {
  const nexuses: Array<Point2> = [];
  for (const node of gs.lib.research.nodes.values()) {
    const idx = axialToIndex(node.centerCell.x, node.centerCell.y);
    if (gs.researchCells[idx]?.owned)
      if (node.archetypeId == MAZE_NEXUS_ARCHETYPE_ID)
        nexuses.push(copy(node.centerCell));
  }
  return nexuses;
}

export function syncMazeResetEntranceCell(gs: GameState) {
  if (gs.mazeResetEntranceCell.x === MAZE_RESET_ENTRANCE_UNSET.x && gs.mazeResetEntranceCell.y === MAZE_RESET_ENTRANCE_UNSET.y)
    for (const node of gs.lib.research.nodes.values())
      if (node.archetypeId == MAZE_ENTRANCE_ARCHETYPE_ID)
        if (gs.researchCells[axialToIndex(node.centerCell.x, node.centerCell.y)]!.owned)
          gs.mazeResetEntranceCell = copy(node.centerCell);
}

export function computeMazeResourceSpawns(gs: GameState, lib: ResearchLib): void {
  const spawns: MazeResourceSpawn[] = [];
  const origin: Point2 = { x: 0, y: 0 };

  for (const node of lib.nodes.values()) {
    const center = node.centerCell;
    const idx = axialToIndex(center.x, center.y);
    if (idx === -1) continue;
    const cell = gs.researchCells[idx];
    if (!cell?.owned) continue;

    const archetype = lib.archetypes.get(node.archetypeId);
    if (!archetype) continue;

    let resourceKey: 'credits' | 'chronotraces' | 'shardDust' | null = null;

    if (archetype.type === 'gear') {
      resourceKey = 'chronotraces';
    } else if (archetype.type === 'stat') {
      resourceKey = 'credits';
    } else if (archetype.type === 'resource') {
      const isShardResource = archetype.rewards.some(
        r => r.kind === 'resource' && (r as { resource?: string }).resource === 'shardDust'
      );
      resourceKey = isShardResource ? 'shardDust' : 'credits';
    }

    if (!resourceKey) continue;

    const dist = axialDistance(center, origin);
    const amount = Math.max(1, dist);

    spawns.push({ cell: { x: center.x, y: center.y }, resourceKey, amount });
  }

  gs.mazeResourceSpawns = spawns;
}

export function resetMazeTransient(gs: GameState): void {
  const m = createMazeTransient(gs.mazeResetEntranceCell);
  m.version = gs.maze.version + 1;
  gs.maze = m;
}


function isCellTaken(gs: GameState, cell: Point2): boolean {
  return gs.maze.takenCells.some(t => t.x === cell.x && t.y === cell.y);
}

function collectResourceAtCell(gs: GameState, cell: Point2): void {
  if (isCellTaken(gs, cell)) return;

  const spawn = gs.mazeResourceSpawns.find(s => s.cell.x === cell.x && s.cell.y === cell.y);
  if (!spawn) return;

  gs.maze.takenCells.push({ x: cell.x, y: cell.y });

  switch (spawn.resourceKey) {
    case 'credits':
      gs.maze.collectedCredits += spawn.amount;
      break;
    case 'chronotraces':
      gs.maze.collectedChronotraces += spawn.amount;
      break;
    case 'shardDust':
      gs.maze.collectedShardDust += spawn.amount;
      break;
  }
}

function applyMazePayout(gs: GameState): void {
  const m = gs.maze;
  // Calculate excess above previous highest
  const payoutCredits = Math.max(0, m.collectedCredits - gs.mazeHighCredits);
  const payoutChronotraces = Math.max(0, m.collectedChronotraces - gs.mazeHighChronotraces);
  const payoutShardDust = Math.max(0, m.collectedShardDust - gs.mazeHighShardDust);

  // Update persistent highs
  gs.mazeHighCredits = Math.max(gs.mazeHighCredits, m.collectedCredits);
  gs.mazeHighChronotraces = Math.max(gs.mazeHighChronotraces, m.collectedChronotraces);
  gs.mazeHighShardDust = Math.max(gs.mazeHighShardDust, m.collectedShardDust);

  // Apply payouts to actual resources
  gs.credits += payoutCredits;
  gs.chronotraces += payoutChronotraces;
  gs.shardDust += payoutShardDust;
}

export interface MazeMoveResult {
  success: boolean;
  path: Point2[];
  forcedReset: boolean;
  payout: boolean;
  nexusReached: boolean;
}

export function handleMazeMoveTo(gs: GameState, target: Point2): MazeMoveResult {
  syncMazeResetEntranceCell(gs);
  const result = bfsMazePath(gs, gs.maze.avatarCell, target);

  if (!result.reachable) {
    return { success: false, path: [], forcedReset: false, payout: false, nexusReached: false };
  }

  if (result.cost === 0) {
    return { success: true, path: [], forcedReset: false, payout: false, nexusReached: false };
  }

  const remainingPool = gs.timeFlux - gs.maze.movementUsed;

  if (result.cost > remainingPool) {
    resetMazeTransient(gs);
    return { success: true, path: result.path, forcedReset: true, payout: false, nexusReached: false };
  }

  gs.maze.movementUsed += result.cost;

  for (const cell of result.path) {
    collectResourceAtCell(gs, cell);
  }

  gs.maze.avatarCell = { x: target.x, y: target.y };

  const isEntrance = isMazeEntranceCell(gs, target);
  if (isEntrance) {
    gs.mazeResetEntranceCell = copy(target);
    syncMazeResetEntranceCell(gs);
    gs.mazeHighMovementUsed = Math.max(gs.mazeHighMovementUsed, gs.maze.movementUsed);
    applyMazePayout(gs);
    resetMazeTransient(gs);
    return { success: true, path: result.path, forcedReset: false, payout: true, nexusReached: false };
  }

  const isNexus = isMazeNexusCell(gs, target);
  return { success: true, path: result.path, forcedReset: false, payout: false, nexusReached: isNexus };
}
