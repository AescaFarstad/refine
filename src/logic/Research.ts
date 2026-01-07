import type { GameState, ResearchCell } from './GameState';
import type { ResearchLib, ResearchNodeInstance } from './ResearchLib';
import { applyReward } from './Reward';
import { calculateResearchDistances, calculateResearchPath, type ResearchPathResult } from './ResearchPath';
import { RESEARCH_PANE_SIZE, RESEARCH_OBSTACLE_PRICE, RESEARCH_OBSTACLE_PRICE_GROWTH } from './Const';

// Offset to convert axial coordinates to array indices
// Center of the grid (0,0 in axial) maps to (OFFSET, OFFSET) in the array
const GRID_OFFSET = Math.floor(RESEARCH_PANE_SIZE / 2);

export function axialToIndex(x: number, y: number): number {
  const col = x + GRID_OFFSET;
  const row = y + GRID_OFFSET;
  if (col < 0 || col >= RESEARCH_PANE_SIZE || row < 0 || row >= RESEARCH_PANE_SIZE) {
    return -1;
  }
  return row * RESEARCH_PANE_SIZE + col;
}

export function indexToAxial(idx: number): { x: number; y: number } {
  const row = Math.floor(idx / RESEARCH_PANE_SIZE);
  const col = idx % RESEARCH_PANE_SIZE;
  return {
    x: col - GRID_OFFSET,
    y: row - GRID_OFFSET
  };
}

export function getCell(gs: GameState, x: number, y: number): ResearchCell | null {
  const idx = axialToIndex(x, y);
  if (idx === -1) return null;
  return gs.researchCells[idx];
}

export function setCell(gs: GameState, x: number, y: number, cell: ResearchCell): boolean {
  const idx = axialToIndex(x, y);
  if (idx === -1) return false;
  gs.researchCells[idx] = cell;
  return true;
}

export function initResearchCells(gs: GameState, lib: ResearchLib): void {
  const totalCells = RESEARCH_PANE_SIZE * RESEARCH_PANE_SIZE;

  if (!gs.researchCells || gs.researchCells.length !== totalCells) {
    gs.researchCells = new Array<ResearchCell>(totalCells);
  }

  for (let i = 0; i < totalCells; i++) {
    gs.researchCells[i] = {
      nodeId: -1,
      // Default to the generic obstacle archetype so unspecified cells
      // behave and render as single-cell obstacles.
      archetypeId: 'obs',
      revealed: false,
      owned: false,
      cost: 1,
      blocked: false
    };
  }

  gs.researchOwnedCount = 0;

  lib.nodes.forEach((node: ResearchNodeInstance) => {
    const archetype = lib.archetypes.get(node.archetypeId);

    let cellCost = 1;
    let cellBlocked = false;
    if (archetype) {
      if (archetype.type === 'void') {
        // Void cells are never ownable or traversable.
        cellCost = 0;
        cellBlocked = true;
      } else if (archetype.type === 'obstacle' || archetype.covert) {
        cellCost = 1;
      } else {
        cellCost = 0;
      }
    }

    for (const cell of node.cells) {
      const idx = axialToIndex(cell.x, cell.y);
      if (idx === -1) {
        console.error(`Research node ${node.nodeId} has cell out of bounds: (${cell.x}, ${cell.y})`);
        continue;
      }

      const isOwned = !cellBlocked && !!node.initiallyOwned;
      if (cellBlocked && node.initiallyOwned) {
        console.warn(`Void research node ${node.nodeId} cannot be initially owned; ignoring initiallyOwned flag.`);
      }

      gs.researchCells[idx] = {
        nodeId: node.nodeId,
        archetypeId: node.archetypeId,
        revealed: false,
        owned: isOwned,
        cost: cellCost,
        blocked: cellBlocked
      };

      // Track how many paid (obstacle/covert) cells are already owned
      if (isOwned && cellCost > 0) {
        gs.researchOwnedCount++;
      }
    }
  });

  calculateVisibility(gs, lib);
}

export function hexDistance(x1: number, y1: number, x2: number, y2: number): number {
  const z1 = -x1 - y1;
  const z2 = -x2 - y2;
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

export function calculateVisibility(gs: GameState, lib: ResearchLib): void {
  const distances = calculateResearchDistances(gs);

  for (let idx = 0; idx < distances.length; idx++) {
    const cell = gs.researchCells[idx];
    // Void/blocked cells are never revealed or drawn.
    if (cell.blocked) {
      cell.revealed = false;
      continue;
    }
    cell.revealed = distances[idx] !== 2147483647;
  }
}

export function calculateResearchNodePrice(gs: GameState, pathCost: number): number {
  if (pathCost <= 0) return 0;

  const base = RESEARCH_OBSTACLE_PRICE;
  const growth = RESEARCH_OBSTACLE_PRICE_GROWTH;
  const ownedBefore = gs.researchOwnedCount;

  // Each new paid obstacle/covert costs:
  //   base + (ownedBefore + i) * growth, for i = 0..pathCost-1
  // Sum of arithmetic series:
  //   total = pathCost * (first + last) / 2
  const first = base + ownedBefore * growth;
  const last = base + (ownedBefore + pathCost - 1) * growth;

  return Math.floor((pathCost * (first + last)) / 2);
}


export function findCheapestPath(gs: GameState, targetX: number, targetY: number): ResearchPathResult {
  const idx = axialToIndex(targetX, targetY);
  if (idx === -1) {
    return {
      cost: 0,
      pathLength: 0,
      reachable: false,
      pathCells: new Int32Array(0)
    };
  }

  const row = Math.floor(idx / RESEARCH_PANE_SIZE);
  const col = idx % RESEARCH_PANE_SIZE;

  return calculateResearchPath(gs, row, col);
}

export interface ResearchPurchaseResult {
  success: boolean;
  pathCost: number;
  price: number;
}

function applyResearchNodeEffect(gs: GameState, lib: ResearchLib, nodeId: number): void {
  const node = lib.nodes.get(nodeId);
  if (!node) return;
  const archetype = lib.archetypes.get(node.archetypeId);
  if (!archetype) return;

  for (const reward of archetype.rewards) {
    applyReward(gs, reward);
  }
}

export function applyResearchPurchase(gs: GameState, lib: ResearchLib, targetX: number, targetY: number): ResearchPurchaseResult {
  const idx = axialToIndex(targetX, targetY);
  if (idx === -1) {
    return { success: false, pathCost: 0, price: 0 };
  }

  const targetCell = gs.researchCells[idx];
  if (!targetCell || !targetCell.revealed || targetCell.owned) {
    return { success: false, pathCost: 0, price: 0 };
  }

  const pathResult = findCheapestPath(gs, targetX, targetY);
  if (!pathResult.reachable) {
    return { success: false, pathCost: 0, price: 0 };
  }

  const pathCost = pathResult.cost;
  const price = calculateResearchNodePrice(gs, pathCost);

  if (pathCost > 0 && gs.chronotraces < price) {
    return { success: false, pathCost, price };
  }

  const previouslyOwnedNodes = new Set<number>();
  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i];
    if (cell.owned && cell.nodeId >= 0) {
      previouslyOwnedNodes.add(cell.nodeId);
    }
  }

  const pathCells = pathResult.pathCells;
  const len = pathResult.pathLength;

  let newlyPaidCells = 0;
  const convertedNodeIds = new Set<number>();

  for (let i = 0; i < len; i++) {
    const cellIdx = pathCells[i];
    if (cellIdx < 0 || cellIdx >= gs.researchCells.length) continue;
    const cell = gs.researchCells[cellIdx];
    if (!cell || cell.blocked) continue;

    if (!cell.owned) {
      if (cell.cost > 0) {
        newlyPaidCells++;
      }
      cell.owned = true;

      if (cell.nodeId >= 0 && !previouslyOwnedNodes.has(cell.nodeId)) {
        convertedNodeIds.add(cell.nodeId);
        previouslyOwnedNodes.add(cell.nodeId);
      }
    }
  }

  if (pathCost > 0) {
    gs.chronotraces = Math.max(0, gs.chronotraces - price);
  }
  if (newlyPaidCells > 0) {
    gs.researchOwnedCount += newlyPaidCells;
  }

  convertedNodeIds.forEach((nodeId) => applyResearchNodeEffect(gs, lib, nodeId));

  calculateVisibility(gs, lib);

  return { success: true, pathCost, price };
}
