import type { Point2 } from './core/math';
import type { GameState, MazeResourceSpawn } from './GameState';
import { createMazeTransient } from './GameState';
import type { ResearchLib } from './ResearchLib';
import { axialDistance } from './HexMath';
import { axialToIndex } from './Research';
import { bfsMazePath } from './BFS';

export const MAZE_ENTRANCE: Point2 = { x: -5, y: -1 };

export function computeMazeResourceSpawns(gs: GameState, lib: ResearchLib): void {
  const spawns: MazeResourceSpawn[] = [];
  const origin: Point2 = { x: 0, y: 0 };

  for (const node of lib.nodes.values()) {
    const archetype = lib.archetypes.get(node.archetypeId);
    if (!archetype) continue;

    let resourceKey: 'credits' | 'chronotraces' | 'shardDust' | null = null;

    if (archetype.type === 'gear') {
      resourceKey = 'chronotraces';
    } else if (archetype.type === 'stat') {
      resourceKey = 'credits';
    } else if (archetype.type === 'resource') {
      // Check if this is a shardDust resource
      const isShardResource = archetype.rewards.some(
        r => r.kind === 'resource' && (r as { resource?: string }).resource === 'shardDust'
      );
      resourceKey = isShardResource ? 'shardDust' : 'credits';
    }

    if (!resourceKey) continue;

    // Determine center cell
    let center: Point2;
    if (node.centerCell) {
      center = node.centerCell;
    } else if (node.cells.length === 1) {
      center = node.cells[0]!;
    } else {
      // Compute geometric center and pick closest cell
      let sumX = 0, sumY = 0;
      for (const c of node.cells) {
        sumX += c.x;
        sumY += c.y;
      }
      const avgX = sumX / node.cells.length;
      const avgY = sumY / node.cells.length;
      let bestCell = node.cells[0]!;
      let bestDist = Infinity;
      for (const c of node.cells) {
        const dx = c.x - avgX;
        const dy = c.y - avgY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestCell = c;
        }
      }
      center = bestCell;
    }

    // Only include if center cell is owned
    const idx = axialToIndex(center.x, center.y);
    if (idx === -1) continue;
    const cell = gs.researchCells[idx];
    if (!cell?.owned) continue;

    const dist = axialDistance(center, origin);
    const amount = Math.max(1, dist);

    spawns.push({ cell: { x: center.x, y: center.y }, resourceKey, amount });
  }

  gs.mazeResourceSpawns = spawns;
}

export function resetMazeTransient(gs: GameState): void {
  const m = createMazeTransient();
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
}

export function handleMazeMoveTo(gs: GameState, target: Point2): MazeMoveResult {
  const result = bfsMazePath(gs, gs.maze.avatarCell, target);

  if (!result.reachable) {
    return { success: false, path: [], forcedReset: false, payout: false };
  }

  if (result.cost === 0) {
    return { success: true, path: [], forcedReset: false, payout: false };
  }

  const remainingPool = gs.timeFlux - gs.maze.movementUsed;

  if (result.cost > remainingPool) {
    resetMazeTransient(gs);
    return { success: true, path: result.path, forcedReset: true, payout: false };
  }

  gs.maze.movementUsed += result.cost;

  for (const cell of result.path) {
    collectResourceAtCell(gs, cell);
  }

  gs.maze.avatarCell = { x: target.x, y: target.y };

  const isEntrance = target.x === MAZE_ENTRANCE.x && target.y === MAZE_ENTRANCE.y;
  if (isEntrance) {
    applyMazePayout(gs);
    resetMazeTransient(gs);
    return { success: true, path: result.path, forcedReset: false, payout: true };
  }

  return { success: true, path: result.path, forcedReset: false, payout: false };
}
