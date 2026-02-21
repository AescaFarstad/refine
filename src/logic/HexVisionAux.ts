import type { Point2 } from './core/math';

export const HEX_VISION_NEIGHBOR_COUNT = 6;

const RAY_EPSILON = 1e-9;

const SORT_STACK_LIMIT = 256;
const SORT_STACK_LEFT = new Int32Array(SORT_STACK_LIMIT);
const SORT_STACK_RIGHT = new Int32Array(SORT_STACK_LIMIT);

export interface HexVisionAux {
  paneSize: number;
  gridOffset: number;
  totalCells: number;
  topologyVersion: number;

  neighborIndexByCellDir: Int32Array;

  axialXByIndex: Int16Array;
  axialYByIndex: Int16Array;
  centerXByIndex: Float32Array;
  centerYByIndex: Float32Array;

  walkableMask: Uint8Array;
  visibleMask: Uint8Array;
  walkableIndex: Int32Array;
  walkableCount: number;

  segmentVertexA: Int32Array;
  segmentVertexB: Int32Array;
  segmentOwnerCellIndex: Int32Array;
  segmentSide: Uint8Array;
  segmentCount: number;

  vertexX: Float32Array;
  vertexY: Float32Array;
  vertexLatticeU: Int16Array;
  vertexLatticeV: Int16Array;
  vertexCount: number;

  vertexDegree: Uint16Array;
  segmentByVertexOffset: Int32Array;
  segmentByVertexIndex: Int32Array;
}

export interface HexVisionRaycastHit {
  hit: boolean;
  segmentIndex: number;
  segmentOwnerCellIndex: number;
  t: number;
  x: number;
  y: number;
}

export function createHexVisionRaycastHit(): HexVisionRaycastHit {
  return {
    hit: false,
    segmentIndex: -1,
    segmentOwnerCellIndex: -1,
    t: 0,
    x: 0,
    y: 0,
  };
}

export function clearHexVisionVisibleMask(aux: HexVisionAux): void {
  aux.visibleMask.fill(0);
}

export function markHexVisionVisibleByIndex(aux: HexVisionAux, cellIndex: number): void {
  aux.visibleMask[cellIndex] = 1;
}

export function isHexVisionVisibleByIndex(aux: HexVisionAux, cellIndex: number): boolean {
  return aux.visibleMask[cellIndex] === 1;
}

export function isHexVisionWalkableByIndex(aux: HexVisionAux, cellIndex: number): boolean {
  return aux.walkableMask[cellIndex] === 1;
}

export function axialToHexVisionIndex(aux: HexVisionAux, x: number, y: number): number {
  const col = x + aux.gridOffset;
  const row = y + aux.gridOffset;
  if (col < 0 || col >= aux.paneSize || row < 0 || row >= aux.paneSize) {
    return -1;
  }
  return row * aux.paneSize + col;
}

export function getHexVisionCenterByIndex(aux: HexVisionAux, cellIndex: number, out: Point2): void {
  out.x = aux.centerXByIndex[cellIndex]!;
  out.y = aux.centerYByIndex[cellIndex]!;
}

export function getHexVisionVertexByIndex(aux: HexVisionAux, vertexIndex: number, out: Point2): void {
  out.x = aux.vertexX[vertexIndex]!;
  out.y = aux.vertexY[vertexIndex]!;
}

export function getHexVisionIncidentSegmentCount(aux: HexVisionAux, vertexIndex: number): number {
  return aux.segmentByVertexOffset[vertexIndex + 1]! - aux.segmentByVertexOffset[vertexIndex]!;
}

export function getHexVisionIncidentSegmentAt(aux: HexVisionAux, vertexIndex: number, incidentOffset: number): number {
  const start = aux.segmentByVertexOffset[vertexIndex]!;
  return aux.segmentByVertexIndex[start + incidentOffset]!;
}

export function collectHexVisionSweepAngles(
  aux: HexVisionAux,
  originX: number,
  originY: number,
  epsilon: number,
  outAngles: Float32Array,
): number {
  const needed = aux.vertexCount * 3;
  if (outAngles.length < needed) {
    throw new Error(`collectHexVisionSweepAngles: outAngles too small (${outAngles.length} < ${needed})`);
  }

  let write = 0;
  for (let i = 0; i < aux.vertexCount; i++) {
    const vx = aux.vertexX[i]!;
    const vy = aux.vertexY[i]!;
    const angle = Math.atan2(vy - originY, vx - originX);
    outAngles[write++] = angle - epsilon;
    outAngles[write++] = angle;
    outAngles[write++] = angle + epsilon;
  }
  return write;
}

export function sortHexVisionAnglesInPlace(values: Float32Array, count: number): void {
  if (count <= 1) return;

  let top = 0;
  SORT_STACK_LEFT[top] = 0;
  SORT_STACK_RIGHT[top] = count - 1;
  top++;

  while (top > 0) {
    top--;
    let left = SORT_STACK_LEFT[top]!;
    let right = SORT_STACK_RIGHT[top]!;

    while (left < right) {
      const pivot = values[(left + right) >> 1]!;
      let i = left;
      let j = right;

      while (i <= j) {
        while (values[i]! < pivot) i++;
        while (values[j]! > pivot) j--;
        if (i <= j) {
          const t = values[i]!;
          values[i] = values[j]!;
          values[j] = t;
          i++;
          j--;
        }
      }

      const leftSize = j - left;
      const rightSize = right - i;

      if (leftSize > rightSize) {
        if (left < j) {
          if (top >= SORT_STACK_LIMIT) throw new Error('sortHexVisionAnglesInPlace: stack overflow');
          SORT_STACK_LEFT[top] = left;
          SORT_STACK_RIGHT[top] = j;
          top++;
        }
        left = i;
      } else {
        if (i < right) {
          if (top >= SORT_STACK_LIMIT) throw new Error('sortHexVisionAnglesInPlace: stack overflow');
          SORT_STACK_LEFT[top] = i;
          SORT_STACK_RIGHT[top] = right;
          top++;
        }
        right = j;
      }
    }
  }
}

export function raycastHexVisionNearestSegment(
  aux: HexVisionAux,
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxT: number,
  out: HexVisionRaycastHit,
): boolean {
  let bestT = maxT;
  let bestSegment = -1;
  let bestU = 0;

  const segmentCount = aux.segmentCount;
  for (let i = 0; i < segmentCount; i++) {
    const va = aux.segmentVertexA[i]!;
    const vb = aux.segmentVertexB[i]!;

    const ax = aux.vertexX[va]!;
    const ay = aux.vertexY[va]!;
    const bx = aux.vertexX[vb]!;
    const by = aux.vertexY[vb]!;

    const sx = bx - ax;
    const sy = by - ay;

    const den = dirX * sy - dirY * sx;
    if (Math.abs(den) < RAY_EPSILON) continue;

    const aox = ax - originX;
    const aoy = ay - originY;
    const t = (aox * sy - aoy * sx) / den;
    if (t <= 0 || t >= bestT) continue;

    const u = (aox * dirY - aoy * dirX) / den;
    if (u < 0 || u > 1) continue;

    bestT = t;
    bestU = u;
    bestSegment = i;
  }

  if (bestSegment === -1) {
    out.hit = false;
    out.segmentIndex = -1;
    out.segmentOwnerCellIndex = -1;
    out.t = maxT;
    out.x = originX + dirX * maxT;
    out.y = originY + dirY * maxT;
    return false;
  }

  const bestVa = aux.segmentVertexA[bestSegment]!;
  const bestVb = aux.segmentVertexB[bestSegment]!;
  const bax = aux.vertexX[bestVa]!;
  const bay = aux.vertexY[bestVa]!;
  const bbx = aux.vertexX[bestVb]!;
  const bby = aux.vertexY[bestVb]!;

  out.hit = true;
  out.segmentIndex = bestSegment;
  out.segmentOwnerCellIndex = aux.segmentOwnerCellIndex[bestSegment]!;
  out.t = bestT;
  out.x = bax + (bbx - bax) * bestU;
  out.y = bay + (bby - bay) * bestU;
  return true;
}

