import type { Point2 } from './core/math';
import { axialNeighbors } from './HexMath';
import { axialToIndex, indexToAxial } from './Research';
import type { ReadonlyGameState } from './UIState';

export interface BFSResult {
  path: Point2[];
  cost: number;
  reachable: boolean;
}

interface HeapEntry {
  idx: number;
  cost: number;
  steps: number;
  interest: number;
}

class MinHeap {
  private readonly data: HeapEntry[] = [];

  public push(entry: HeapEntry): void {
    this.data.push(entry);
    this.siftUp(this.data.length - 1);
  }

  public pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0]!;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  public get size(): number {
    return this.data.length;
  }

  private compare(a: HeapEntry, b: HeapEntry): number {
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.steps !== b.steps) return a.steps - b.steps;
    return b.interest - a.interest;
  }

  private siftUp(startIdx: number): void {
    let idx = startIdx;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.compare(this.data[parent]!, this.data[idx]!) <= 0) break;
      const temp = this.data[parent]!;
      this.data[parent] = this.data[idx]!;
      this.data[idx] = temp;
      idx = parent;
    }
  }

  private siftDown(startIdx: number): void {
    let idx = startIdx;
    const size = this.data.length;
    while (true) {
      const left = idx * 2 + 1;
      const right = left + 1;
      let best = idx;

      if (left < size && this.compare(this.data[left]!, this.data[best]!) < 0) {
        best = left;
      }
      if (right < size && this.compare(this.data[right]!, this.data[best]!) < 0) {
        best = right;
      }
      if (best === idx) break;

      const temp = this.data[idx]!;
      this.data[idx] = this.data[best]!;
      this.data[best] = temp;
      idx = best;
    }
  }
}

const MAZE_ENTRANCE_ARCHETYPE_ID = 'disc_maze_navigation';
const MAZE_NEXUS_ARCHETYPE_ID = 'disc_maze_nexus';
const MAZE_TRANSMUTATION_ROOM_ARCHETYPE_ID = 'transmutation_room';

function buildInterestingMazeCellMask(gs: ReadonlyGameState): Uint8Array {
  const mask = new Uint8Array(gs.researchCells.length);

  for (const spawn of gs.mazeResourceSpawns) {
    const idx = axialToIndex(spawn.cell.x, spawn.cell.y);
    if (idx !== -1) {
      mask[idx] = 1;
    }
  }

  for (let i = 0; i < gs.researchCells.length; i++) {
    const cell = gs.researchCells[i]!;
    if (cell.oracleId !== '') {
      mask[i] = 1;
      continue;
    }

    if (
      cell.archetypeId === MAZE_ENTRANCE_ARCHETYPE_ID
      || cell.archetypeId === MAZE_NEXUS_ARCHETYPE_ID
      || cell.archetypeId === MAZE_TRANSMUTATION_ROOM_ARCHETYPE_ID
    ) {
      mask[i] = 1;
      continue;
    }

    if (!cell.nexusId) continue;
    const def = gs.lib.nexusItems.get(cell.nexusId)!;
    if (def.placableInstanceDescription.button) {
      mask[i] = 1;
    }
  }

  return mask;
}

export function bfsMazePath(
  gs: ReadonlyGameState,
  from: Point2,
  to: Point2,
): BFSResult {
  if (from.x === to.x && from.y === to.y) {
    return { path: [], cost: 0, reachable: true };
  }

  const startIdx = axialToIndex(from.x, from.y);
  const endIdx = axialToIndex(to.x, to.y);
  if (startIdx === -1 || endIdx === -1) {
    return { path: [], cost: 0, reachable: false };
  }

  const startCell = gs.researchCells[startIdx];
  const endCell = gs.researchCells[endIdx];
  if (!startCell?.owned || !endCell?.owned || !startCell.passable || !endCell.passable) {
    return { path: [], cost: 0, reachable: false };
  }

  const cellCount = gs.researchCells.length;
  const INF = 2147483647;
  const bestCost = new Int32Array(cellCount);
  const bestSteps = new Int32Array(cellCount);
  const bestInterest = new Int32Array(cellCount);
  const parent = new Int32Array(cellCount);
  bestCost.fill(INF);
  bestSteps.fill(INF);
  bestInterest.fill(-INF);
  parent.fill(-1);
  const interestingCellMask = buildInterestingMazeCellMask(gs);

  const heap = new MinHeap();
  bestCost[startIdx] = 0;
  bestSteps[startIdx] = 0;
  bestInterest[startIdx] = interestingCellMask[startIdx]!;
  heap.push({ idx: startIdx, cost: 0, steps: 0, interest: bestInterest[startIdx]! });

  while (heap.size > 0) {
    const current = heap.pop()!;
    const currentIdx = current.idx;

    if (
      current.cost !== bestCost[currentIdx]
      || current.steps !== bestSteps[currentIdx]
      || current.interest !== bestInterest[currentIdx]
    ) {
      continue;
    }

    if (currentIdx === endIdx) {
      break;
    }

    const currentAxial = indexToAxial(currentIdx);
    for (const neighbor of axialNeighbors(currentAxial)) {
      const nIdx = axialToIndex(neighbor.x, neighbor.y);
      if (nIdx === -1) continue;

      const nCell = gs.researchCells[nIdx];
      if (!nCell?.owned || !nCell.passable) continue;

      const stepCost = nCell.mazeMoveCostMult;
      const nextCost = current.cost + stepCost;
      const nextSteps = current.steps + 1;
      const nextInterest = current.interest + interestingCellMask[nIdx]!;

      if (
        nextCost > bestCost[nIdx]
        || (nextCost === bestCost[nIdx] && nextSteps > bestSteps[nIdx])
        || (nextCost === bestCost[nIdx] && nextSteps === bestSteps[nIdx] && nextInterest <= bestInterest[nIdx])
      ) {
        continue;
      }

      bestCost[nIdx] = nextCost;
      bestSteps[nIdx] = nextSteps;
      bestInterest[nIdx] = nextInterest;
      parent[nIdx] = currentIdx;
      heap.push({ idx: nIdx, cost: nextCost, steps: nextSteps, interest: nextInterest });
    }
  }

  if (bestCost[endIdx] === INF) {
    return { path: [], cost: 0, reachable: false };
  }

  const path: Point2[] = [];
  let traceIdx = endIdx;
  while (traceIdx !== startIdx) {
    const axial = indexToAxial(traceIdx);
    path.push({ x: axial.x, y: axial.y });
    traceIdx = parent[traceIdx]!;
    if (traceIdx < 0) {
      throw new Error('bfsMazePath: failed to reconstruct path');
    }
  }
  path.reverse();
  return { path, cost: bestCost[endIdx]!, reachable: true };
}
