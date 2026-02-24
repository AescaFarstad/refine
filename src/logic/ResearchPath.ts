import type { GameState, ResearchCell } from './GameState';
import { RESEARCH_PANE_SIZE } from './Const';
import { ReadonlyGameState } from './UIState';

const SIZE = RESEARCH_PANE_SIZE;
const TOTAL_CELLS = SIZE * SIZE;
const MAX_INT32 = 2147483647;

const DISTANCES = new Int32Array(TOTAL_CELLS);
const CURRENT_FRONTIER = new Int32Array(TOTAL_CELLS);
const NEXT_FRONTIER = new Int32Array(TOTAL_CELLS);

const NEIGHBOR_COUNT = 6;
const NEIGHBOR_OFFSETS = [
  { c: 1, r: 0 },
  { c: 1, r: -1 },
  { c: 0, r: -1 },
  { c: -1, r: 0 },
  { c: -1, r: 1 },
  { c: 0, r: 1 }
];

const NEIGHBORS = new Int32Array(TOTAL_CELLS * NEIGHBOR_COUNT);
for (let idx = 0; idx < TOTAL_CELLS; idx++) {
  const row = (idx / SIZE) | 0;
  const col = idx - row * SIZE;
  const base = idx * NEIGHBOR_COUNT;

  for (let j = 0; j < NEIGHBOR_COUNT; j++) {
    const off = NEIGHBOR_OFFSETS[j];
    const nCol = col + off.c;
    const nRow = row + off.r;

    if (nCol < 0 || nCol >= SIZE || nRow < 0 || nRow >= SIZE) {
      NEIGHBORS[base + j] = -1;
      continue;
    }

    NEIGHBORS[base + j] = nRow * SIZE + nCol;
  }
}

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
      const currDist = DISTANCES[currIdx];
      const currCell = cells[currIdx];
      const base = currIdx * NEIGHBOR_COUNT;

      for (let j = 0; j < NEIGHBOR_COUNT; j++) {
        const nIdx = NEIGHBORS[base + j];
        if (nIdx === -1) continue;
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

// Min-heap for Dijkstra (stores cell indices; priority is `DISTANCES[idx]`).
const HEAP = new Int32Array(TOTAL_CELLS);
const HEAP_POS = new Int32Array(TOTAL_CELLS);
let HEAP_SIZE = 0;

function heapReset(): void {
  HEAP_SIZE = 0;
  HEAP_POS.fill(-1);
}

function heapSwap(i: number, j: number): void {
  const a = HEAP[i];
  const b = HEAP[j];
  HEAP[i] = b;
  HEAP[j] = a;
  HEAP_POS[a] = j;
  HEAP_POS[b] = i;
}

function heapSiftUp(pos: number): void {
  while (pos > 0) {
    const parent = (pos - 1) >> 1;
    if (DISTANCES[HEAP[pos]] >= DISTANCES[HEAP[parent]]) break;
    heapSwap(pos, parent);
    pos = parent;
  }
}

function heapSiftDown(pos: number): void {
  while (true) {
    const left = pos * 2 + 1;
    if (left >= HEAP_SIZE) return;
    const right = left + 1;

    let smallest = left;
    if (right < HEAP_SIZE && DISTANCES[HEAP[right]] < DISTANCES[HEAP[left]]) {
      smallest = right;
    }

    if (DISTANCES[HEAP[pos]] <= DISTANCES[HEAP[smallest]]) return;
    heapSwap(pos, smallest);
    pos = smallest;
  }
}

function heapPushOrDecrease(idx: number): void {
  const pos = HEAP_POS[idx];
  if (pos === -1) {
    const insertPos = HEAP_SIZE++;
    HEAP[insertPos] = idx;
    HEAP_POS[idx] = insertPos;
    heapSiftUp(insertPos);
    return;
  }
  heapSiftUp(pos);
}

function heapPopMin(): number {
  const minIdx = HEAP[0];
  HEAP_POS[minIdx] = -1;
  HEAP_SIZE--;
  if (HEAP_SIZE > 0) {
    const last = HEAP[HEAP_SIZE];
    HEAP[0] = last;
    HEAP_POS[last] = 0;
    heapSiftDown(0);
  }
  return minIdx;
}

export function calculateResearchPath(
  gs: ReadonlyGameState,
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
  //   - cell.cost (0 for free, 1 for obstacle) otherwise
  DISTANCES.fill(MAX_INT32);
  PREV.fill(-1);
  SETTLED.fill(0);
  heapReset();

  let sources = 0;
  for (let idx = 0; idx < TOTAL_CELLS; idx++) {
    const cell = cells[idx];
    if (cell && cell.owned && !cell.blocked) {
      DISTANCES[idx] = 0;
      heapPushOrDecrease(idx);
      sources++;
    }
  }

  if (sources === 0) {
    return PATH_RESULT;
  }

  while (HEAP_SIZE > 0) {
    const bestIdx = heapPopMin();
    if (SETTLED[bestIdx]) continue;

    const bestDist = DISTANCES[bestIdx];
    if (bestDist === MAX_INT32) break;

    SETTLED[bestIdx] = 1;
    if (bestIdx === targetIdx) {
      break; // we found the cheapest path to target
    }

    const currCell = cells[bestIdx];
    const base = bestIdx * NEIGHBOR_COUNT;

    for (let j = 0; j < NEIGHBOR_COUNT; j++) {
      const nIdx = NEIGHBORS[base + j];
      if (nIdx === -1) continue;
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

      const newDist = bestDist + edgeCost;
      if (newDist < DISTANCES[nIdx]) {
        DISTANCES[nIdx] = newDist;
        PREV[nIdx] = bestIdx;
        heapPushOrDecrease(nIdx);
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
    const base = currIdx * NEIGHBOR_COUNT;

    for (let j = 0; j < NEIGHBOR_COUNT; j++) {
      const nIdx = NEIGHBORS[base + j];
      if (nIdx === -1) continue;
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
  const row = (idx / SIZE) | 0;
  return {
    row,
    col: idx - row * SIZE
  };
}
