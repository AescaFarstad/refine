import type { GameState, ResearchCell } from './GameState';
import { RESEARCH_PANE_SIZE } from './Const';

const SIZE = RESEARCH_PANE_SIZE;
const TOTAL_CELLS = SIZE * SIZE;
const MAX_INT32 = 2147483647;

const DISTANCES = new Int32Array(TOTAL_CELLS);
const CURRENT_FRONTIER = new Int32Array(TOTAL_CELLS);
const NEXT_FRONTIER = new Int32Array(TOTAL_CELLS);

const NEIGHBOR_OFFSETS = [
  { c: 1, r: 0 },
  { c: 1, r: -1 },
  { c: 0, r: -1 },
  { c: -1, r: 0 },
  { c: -1, r: 1 },
  { c: 0, r: 1 }
];

function bfsFromOwned(
  cells: ResearchCell[],
  maxRadius: number
): Int32Array {
  DISTANCES.fill(MAX_INT32);

  let currentFrontier = CURRENT_FRONTIER;
  let nextFrontier = NEXT_FRONTIER;
  let currentSize = 0;
  let nextSize = 0;

  // Add all owned cells as starting points
  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    if (cells[idx].owned && !cells[idx].blocked) {
      DISTANCES[idx] = 0;
      currentFrontier[currentSize++] = idx;
    }
  }

  while (currentSize > 0) {
    nextSize = 0;

    for (let i = 0; i < currentSize; i++) {
      const currIdx = currentFrontier[i];
      const currRow = Math.floor(currIdx / SIZE);
      const currCol = currIdx % SIZE;
      const currDist = DISTANCES[currIdx];
      const currCell = cells[currIdx];

      for (let j = 0; j < 6; j++) {
        const off = NEIGHBOR_OFFSETS[j];
        const nCol = currCol + off.c;
        const nRow = currRow + off.r;

        if (nCol < 0 || nCol >= SIZE || nRow < 0 || nRow >= SIZE) continue;

        const nIdx = nRow * SIZE + nCol;
        const nCell = cells[nIdx];


        if (nCell.blocked) continue;

        // For visibility we use uniform cost (1 per step),
        // but allow full reveal of a node if any of its cells
        // are within the radius.
        const newDist = nCell.owned ? 0 : (currDist + 1);

        const sameNode = currCell.nodeId !== -1 && nCell.nodeId === currCell.nodeId;
        const shouldVisit = newDist <= maxRadius || sameNode;

        if (shouldVisit && newDist < DISTANCES[nIdx]) {
          DISTANCES[nIdx] = newDist;
          nextFrontier[nextSize++] = nIdx;
        }
      }
    }

    const temp = currentFrontier;
    currentFrontier = nextFrontier;
    nextFrontier = temp;
    currentSize = nextSize;
  }

  return DISTANCES;
}

export function calculateResearchDistances(gs: GameState): Int32Array {
  const radius = (gs as any).researchRevealRadius;
  const maxRadius = typeof radius === 'number' ? radius : 0;
  return bfsFromOwned(gs.researchCells, maxRadius);
}

export interface ResearchPathResult {
  cost: number;
  pathLength: number;
  reachable: boolean;
  pathCells: Int32Array; // Flat indices, valid from 0 to pathLength-1
}

const PATH_CELLS = new Int32Array(TOTAL_CELLS);

const PATH_RESULT: ResearchPathResult = {
  cost: 0,
  pathLength: 0,
  reachable: false,
  pathCells: PATH_CELLS
};
// PREV: predecessor index for shortest-path reconstruction
const PREV = new Int32Array(TOTAL_CELLS);
// VISITED: generic marker for path + floodfill
const VISITED = new Uint8Array(TOTAL_CELLS);
// SETTLED: nodes finalized by Dijkstra
const SETTLED = new Uint8Array(TOTAL_CELLS);

export function calculateResearchPath(
  gs: GameState,
  targetRow: number,
  targetCol: number
): ResearchPathResult {
  PATH_RESULT.cost = 0;
  PATH_RESULT.pathLength = 0;
  PATH_RESULT.reachable = false;

  if (targetRow < 0 || targetRow >= SIZE || targetCol < 0 || targetCol >= SIZE) {
    return PATH_RESULT;
  }

  const targetIdx = targetRow * SIZE + targetCol;
  const cells = gs.researchCells;
  const targetCell = cells[targetIdx];

  if (!targetCell) {
    return PATH_RESULT;
  }

  if (targetCell.blocked) {
    return PATH_RESULT;
  }

  if (targetCell.owned) {
    PATH_RESULT.reachable = true;
    PATH_RESULT.cost = 0;
    PATH_RESULT.pathLength = 0;
    return PATH_RESULT;
  }

  if (!targetCell.revealed) {
    return PATH_RESULT;
  }

  // Multi-source Dijkstra from all owned cells.
  // Edge cost:
  //   - 0 for owned cells
  //   - 0 when moving inside the same node
  //   - cell.cost (0 for free, 1 for obstacle/covert) otherwise
  DISTANCES.fill(MAX_INT32);
  PREV.fill(-1);
  SETTLED.fill(0);

  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    if (cells[idx].owned) {
      DISTANCES[idx] = 0;
    }
  }

  for (let iter = 0; iter < TOTAL_CELLS; iter++) {
    let bestIdx = -1;
    let bestDist = MAX_INT32;

    for (let idx = 0; idx < TOTAL_CELLS; idx++) {
      if (!SETTLED[idx] && DISTANCES[idx] < bestDist) {
        bestDist = DISTANCES[idx];
        bestIdx = idx;
      }
    }

    if (bestIdx === -1 || bestDist === MAX_INT32) {
      break; // remaining cells unreachable
    }

    SETTLED[bestIdx] = 1;
    if (bestIdx === targetIdx) {
      break; // we found the cheapest path to target
    }

    const currRow = Math.floor(bestIdx / SIZE);
    const currCol = bestIdx % SIZE;
    const currDist = DISTANCES[bestIdx];
    const currCell = cells[bestIdx];

    for (let j = 0; j < 6; j++) {
      const off = NEIGHBOR_OFFSETS[j];
      const nCol = currCol + off.c;
      const nRow = currRow + off.r;

      if (nCol < 0 || nCol >= SIZE || nRow < 0 || nRow >= SIZE) continue;

      const nIdx = nRow * SIZE + nCol;
      if (SETTLED[nIdx]) continue;

      const nCell = cells[nIdx];
      if (!nCell) continue;

      if (!nCell.revealed || nCell.blocked) continue;

      let edgeCost = 0;
      if (!nCell.owned) {
        if (currCell.nodeId !== -1 && nCell.nodeId === currCell.nodeId) {
          edgeCost = 0;
        } else {
          edgeCost = nCell.cost | 0;
        }
      }

      const newDist = currDist + edgeCost;
      if (newDist < DISTANCES[nIdx]) {
        DISTANCES[nIdx] = newDist;
        PREV[nIdx] = bestIdx;
      }
    }
  }

  // Check if target was reached
  if (DISTANCES[targetIdx] === MAX_INT32) {
    return PATH_RESULT;
  }

  const targetCost = DISTANCES[targetIdx];
  PATH_RESULT.reachable = true;
  PATH_RESULT.cost = targetCost;

  // Reconstruct the minimal-cost path from any owned cell to target.
  // Collect only non-owned cells on that path.
  VISITED.fill(0);
  let pathLen = 0;

  let cur = targetIdx;
  while (cur !== -1) {
    const cell = cells[cur];
    if (!cell.owned && !VISITED[cur]) {
      PATH_CELLS[pathLen++] = cur;
      VISITED[cur] = 1;
    }
    cur = PREV[cur];
  }

  let dequeHead = 0;
  let dequeTail = pathLen;

  for (let i = 0; i < pathLen; i++) {
    CURRENT_FRONTIER[i] = PATH_CELLS[i];
  }

  while (dequeHead < dequeTail) {
    const currIdx = CURRENT_FRONTIER[dequeHead++];
    const currRow = Math.floor(currIdx / SIZE);
    const currCol = currIdx % SIZE;

    for (let j = 0; j < 6; j++) {
      const off = NEIGHBOR_OFFSETS[j];
      const nCol = currCol + off.c;
      const nRow = currRow + off.r;

      if (nCol < 0 || nCol >= SIZE || nRow < 0 || nRow >= SIZE) continue;

      const nIdx = nRow * SIZE + nCol;
      if (VISITED[nIdx]) continue;

      const nCell = cells[nIdx];

      if (!nCell.revealed || nCell.owned || nCell.cost !== 0 || nCell.blocked) continue;

      VISITED[nIdx] = 1;
      PATH_CELLS[pathLen++] = nIdx;
      CURRENT_FRONTIER[dequeTail++] = nIdx;
    }
  }

  PATH_RESULT.pathLength = pathLen;
  return PATH_RESULT;
}

export function indexToRowCol(idx: number): { row: number; col: number } {
  return {
    row: Math.floor(idx / SIZE),
    col: idx % SIZE
  };
}
