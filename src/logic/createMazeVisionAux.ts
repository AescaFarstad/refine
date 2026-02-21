import { RESEARCH_PANE_SIZE } from './Const';
import type { ReadonlyGameState } from './UIState';
import {
  HEX_VISION_NEIGHBOR_COUNT,
  type HexVisionAux,
} from './HexVisionAux';

const SQRT3 = Math.sqrt(3);
const LATTICE_TO_PIXEL_X = SQRT3 * 0.5;
const LATTICE_TO_PIXEL_Y = 0.5;

const NEIGHBOR_DCOL: readonly number[] = [1, 1, 0, -1, -1, 0];
const NEIGHBOR_DROW: readonly number[] = [0, -1, -1, 0, 1, 1];

const CORNER_U: readonly number[] = [1, 0, -1, -1, 0, 1];
const CORNER_V: readonly number[] = [1, 2, 1, -1, -2, -1];
const SIDE_FROM_CORNER: readonly number[] = [5, 4, 3, 2, 1, 0];
const SIDE_TO_CORNER: readonly number[] = [0, 5, 4, 3, 2, 1];

function encodeSignedInt(n: number): number {
  return n >= 0 ? (n << 1) : ((-n << 1) - 1);
}

function pairLatticeKey(u: number, v: number): number {
  const eu = encodeSignedInt(u) & 0xffff;
  const ev = encodeSignedInt(v) & 0xffff;
  return (eu << 16) | ev;
}

function createNeighborIndexByCellDir(paneSize: number): Int32Array {
  const totalCells = paneSize * paneSize;
  const neighbors = new Int32Array(totalCells * HEX_VISION_NEIGHBOR_COUNT);

  for (let idx = 0; idx < totalCells; idx++) {
    const row = (idx / paneSize) | 0;
    const col = idx - row * paneSize;
    const base = idx * HEX_VISION_NEIGHBOR_COUNT;

    for (let dir = 0; dir < HEX_VISION_NEIGHBOR_COUNT; dir++) {
      const nCol = col + NEIGHBOR_DCOL[dir]!;
      const nRow = row + NEIGHBOR_DROW[dir]!;
      if (nCol < 0 || nCol >= paneSize || nRow < 0 || nRow >= paneSize) {
        neighbors[base + dir] = -1;
      } else {
        neighbors[base + dir] = nRow * paneSize + nCol;
      }
    }
  }

  return neighbors;
}

function createAxialAndCenterTables(
  paneSize: number,
  gridOffset: number,
): {
  axialXByIndex: Int16Array;
  axialYByIndex: Int16Array;
  centerXByIndex: Float32Array;
  centerYByIndex: Float32Array;
} {
  const totalCells = paneSize * paneSize;

  const axialXByIndex = new Int16Array(totalCells);
  const axialYByIndex = new Int16Array(totalCells);
  const centerXByIndex = new Float32Array(totalCells);
  const centerYByIndex = new Float32Array(totalCells);

  for (let idx = 0; idx < totalCells; idx++) {
    const row = (idx / paneSize) | 0;
    const col = idx - row * paneSize;
    const q = col - gridOffset;
    const r = row - gridOffset;

    axialXByIndex[idx] = q;
    axialYByIndex[idx] = r;

    centerXByIndex[idx] = SQRT3 * q + (SQRT3 * 0.5) * r;
    centerYByIndex[idx] = 1.5 * r;
  }

  return {
    axialXByIndex,
    axialYByIndex,
    centerXByIndex,
    centerYByIndex,
  };
}

function buildWalkableMask(
  gs: ReadonlyGameState,
  totalCells: number,
): {
  walkableMask: Uint8Array;
  walkableIndex: Int32Array;
  walkableCount: number;
} {
  const walkableMask = new Uint8Array(totalCells);
  let walkableCount = 0;

  for (let idx = 0; idx < totalCells; idx++) {
    const cell = gs.researchCells[idx]!;
    const walkable = cell.owned && cell.passable ? 1 : 0;
    walkableMask[idx] = walkable;
    walkableCount += walkable;
  }

  const walkableIndex = new Int32Array(walkableCount);
  let write = 0;
  for (let idx = 0; idx < totalCells; idx++) {
    if (walkableMask[idx] === 1) {
      walkableIndex[write++] = idx;
    }
  }

  return { walkableMask, walkableIndex, walkableCount };
}

function countBoundarySegments(
  walkableIndex: Int32Array,
  walkableCount: number,
  walkableMask: Uint8Array,
  neighborIndexByCellDir: Int32Array,
): number {
  let segmentCount = 0;

  for (let i = 0; i < walkableCount; i++) {
    const cellIndex = walkableIndex[i]!;
    const base = cellIndex * HEX_VISION_NEIGHBOR_COUNT;

    for (let dir = 0; dir < HEX_VISION_NEIGHBOR_COUNT; dir++) {
      const neighborIndex = neighborIndexByCellDir[base + dir]!;
      if (neighborIndex === -1 || walkableMask[neighborIndex] === 0) {
        segmentCount++;
      }
    }
  }

  return segmentCount;
}

function createBoundaryGeometry(
  walkableIndex: Int32Array,
  walkableCount: number,
  walkableMask: Uint8Array,
  neighborIndexByCellDir: Int32Array,
  axialXByIndex: Int16Array,
  axialYByIndex: Int16Array,
  segmentCount: number,
): {
  segmentVertexA: Int32Array;
  segmentVertexB: Int32Array;
  segmentOwnerCellIndex: Int32Array;
  segmentSide: Uint8Array;
  vertexX: Float32Array;
  vertexY: Float32Array;
  vertexLatticeU: Int16Array;
  vertexLatticeV: Int16Array;
  vertexCount: number;
} {
  const segmentVertexA = new Int32Array(segmentCount);
  const segmentVertexB = new Int32Array(segmentCount);
  const segmentOwnerCellIndex = new Int32Array(segmentCount);
  const segmentSide = new Uint8Array(segmentCount);

  const maxVertexCount = segmentCount * 2;
  const vertexXBuf = new Float32Array(maxVertexCount);
  const vertexYBuf = new Float32Array(maxVertexCount);
  const vertexUBuf = new Int16Array(maxVertexCount);
  const vertexVBuf = new Int16Array(maxVertexCount);

  const vertexMap = new Map<number, number>();
  let vertexCount = 0;

  function getOrCreateVertex(u: number, v: number): number {
    const key = pairLatticeKey(u, v);
    const existing = vertexMap.get(key);
    if (existing != null) return existing;

    const idx = vertexCount++;
    vertexMap.set(key, idx);
    vertexUBuf[idx] = u;
    vertexVBuf[idx] = v;
    vertexXBuf[idx] = LATTICE_TO_PIXEL_X * u;
    vertexYBuf[idx] = LATTICE_TO_PIXEL_Y * v;
    return idx;
  }

  let segWrite = 0;
  for (let i = 0; i < walkableCount; i++) {
    const cellIndex = walkableIndex[i]!;
    const q = axialXByIndex[cellIndex]!;
    const r = axialYByIndex[cellIndex]!;
    const base = cellIndex * HEX_VISION_NEIGHBOR_COUNT;

    const baseU = 2 * q + r;
    const baseV = 3 * r;

    for (let side = 0; side < HEX_VISION_NEIGHBOR_COUNT; side++) {
      const neighborIndex = neighborIndexByCellDir[base + side]!;
      if (neighborIndex !== -1 && walkableMask[neighborIndex] === 1) continue;

      const fromCorner = SIDE_FROM_CORNER[side]!;
      const toCorner = SIDE_TO_CORNER[side]!;

      const fromU = baseU + CORNER_U[fromCorner]!;
      const fromV = baseV + CORNER_V[fromCorner]!;
      const toU = baseU + CORNER_U[toCorner]!;
      const toV = baseV + CORNER_V[toCorner]!;

      const va = getOrCreateVertex(fromU, fromV);
      const vb = getOrCreateVertex(toU, toV);

      segmentVertexA[segWrite] = va;
      segmentVertexB[segWrite] = vb;
      segmentOwnerCellIndex[segWrite] = cellIndex;
      segmentSide[segWrite] = side;
      segWrite++;
    }
  }

  if (segWrite !== segmentCount) {
    throw new Error(`createBoundaryGeometry: segment fill mismatch (${segWrite} !== ${segmentCount})`);
  }

  const vertexX = vertexXBuf.subarray(0, vertexCount);
  const vertexY = vertexYBuf.subarray(0, vertexCount);
  const vertexLatticeU = vertexUBuf.subarray(0, vertexCount);
  const vertexLatticeV = vertexVBuf.subarray(0, vertexCount);

  return {
    segmentVertexA,
    segmentVertexB,
    segmentOwnerCellIndex,
    segmentSide,
    vertexX,
    vertexY,
    vertexLatticeU,
    vertexLatticeV,
    vertexCount,
  };
}

function createVertexToSegmentAdjacency(
  segmentVertexA: Int32Array,
  segmentVertexB: Int32Array,
  segmentCount: number,
  vertexCount: number,
): {
  vertexDegree: Uint16Array;
  segmentByVertexOffset: Int32Array;
  segmentByVertexIndex: Int32Array;
} {
  const vertexDegree = new Uint16Array(vertexCount);
  for (let i = 0; i < segmentCount; i++) {
    vertexDegree[segmentVertexA[i]!] += 1;
    vertexDegree[segmentVertexB[i]!] += 1;
  }

  const segmentByVertexOffset = new Int32Array(vertexCount + 1);
  for (let i = 0; i < vertexCount; i++) {
    segmentByVertexOffset[i + 1] = segmentByVertexOffset[i]! + vertexDegree[i]!;
  }

  const segmentByVertexIndex = new Int32Array(segmentByVertexOffset[vertexCount]!);
  const cursor = new Int32Array(vertexCount);
  cursor.set(segmentByVertexOffset.subarray(0, vertexCount));

  for (let i = 0; i < segmentCount; i++) {
    const va = segmentVertexA[i]!;
    const vb = segmentVertexB[i]!;
    segmentByVertexIndex[cursor[va]!] = i;
    cursor[va] += 1;
    segmentByVertexIndex[cursor[vb]!] = i;
    cursor[vb] += 1;
  }

  return {
    vertexDegree,
    segmentByVertexOffset,
    segmentByVertexIndex,
  };
}

export function createMazeVisionAux(
  gs: ReadonlyGameState,
  topologyVersion: number,
): HexVisionAux {
  const paneSize = RESEARCH_PANE_SIZE;
  const gridOffset = Math.floor(paneSize / 2);
  const totalCells = paneSize * paneSize;

  const neighborIndexByCellDir = createNeighborIndexByCellDir(paneSize);
  const {
    axialXByIndex,
    axialYByIndex,
    centerXByIndex,
    centerYByIndex,
  } = createAxialAndCenterTables(paneSize, gridOffset);

  const {
    walkableMask,
    walkableIndex,
    walkableCount,
  } = buildWalkableMask(gs, totalCells);

  const visibleMask = new Uint8Array(totalCells);
  const segmentCount = countBoundarySegments(
    walkableIndex,
    walkableCount,
    walkableMask,
    neighborIndexByCellDir,
  );

  const {
    segmentVertexA,
    segmentVertexB,
    segmentOwnerCellIndex,
    segmentSide,
    vertexX,
    vertexY,
    vertexLatticeU,
    vertexLatticeV,
    vertexCount,
  } = createBoundaryGeometry(
    walkableIndex,
    walkableCount,
    walkableMask,
    neighborIndexByCellDir,
    axialXByIndex,
    axialYByIndex,
    segmentCount,
  );

  const {
    vertexDegree,
    segmentByVertexOffset,
    segmentByVertexIndex,
  } = createVertexToSegmentAdjacency(
    segmentVertexA,
    segmentVertexB,
    segmentCount,
    vertexCount,
  );

  return {
    paneSize,
    gridOffset,
    totalCells,
    topologyVersion,

    neighborIndexByCellDir,

    axialXByIndex,
    axialYByIndex,
    centerXByIndex,
    centerYByIndex,

    walkableMask,
    visibleMask,
    walkableIndex,
    walkableCount,

    segmentVertexA,
    segmentVertexB,
    segmentOwnerCellIndex,
    segmentSide,
    segmentCount,

    vertexX,
    vertexY,
    vertexLatticeU,
    vertexLatticeV,
    vertexCount,

    vertexDegree,
    segmentByVertexOffset,
    segmentByVertexIndex,
  };
}

export function rebuildMazeVisionAux(
  _prev: HexVisionAux,
  gs: ReadonlyGameState,
  topologyVersion: number,
): HexVisionAux {
  return createMazeVisionAux(gs, topologyVersion);
}

