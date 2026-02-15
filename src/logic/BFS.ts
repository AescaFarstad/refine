import type { Point2 } from './core/math';
import { axialNeighbors } from './HexMath';
import { axialToIndex, indexToAxial } from './Research';
import type { ReadonlyGameState } from './UIState';

export interface BFSResult {
  path: Point2[];
  cost: number;
  reachable: boolean;
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
  if (!startCell?.owned || !endCell?.owned) {
    return { path: [], cost: 0, reachable: false };
  }

  const visited = new Map<number, number>(); // idx -> parent idx
  visited.set(startIdx, -1);

  const queue: Point2[] = [from];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++]!;
    const currentIdx = axialToIndex(current.x, current.y);

    if (currentIdx === endIdx) {
      // Reconstruct path (excluding start, including end)
      const path: Point2[] = [];
      let traceIdx = endIdx;
      while (traceIdx !== startIdx) {
        const axial = indexToAxial(traceIdx);
        path.push({ x: axial.x, y: axial.y });
        traceIdx = visited.get(traceIdx)!;
      }
      path.reverse();
      return { path, cost: path.length, reachable: true };
    }

    for (const neighbor of axialNeighbors(current)) {
      const nIdx = axialToIndex(neighbor.x, neighbor.y);
      if (nIdx === -1) continue;
      if (visited.has(nIdx)) continue;
      const nCell = gs.researchCells[nIdx];
      if (!nCell?.owned) continue;
      visited.set(nIdx, currentIdx);
      queue.push(neighbor);
    }
  }

  return { path: [], cost: 0, reachable: false };
}
