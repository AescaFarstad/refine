import type { Point2 } from './ItemLib';
import { UNIT_HEX_POINTS } from './DrawHex';
import { computeHexBoundary } from './hexBoundary';
import {
  axialToHexVisionIndex,
  clearHexVisionVisibleMask,
  collectHexVisionSweepAngles,
  createHexVisionRaycastHit,
  isHexVisionWalkableByIndex,
  raycastHexVisionNearestSegment,
  sortHexVisionAnglesInPlace,
  type HexVisionAux,
  type HexVisionRaycastHit,
} from './HexVisionAux';

const SWEEP_ANGLE_EPSILON = 1e-4;
const ANGLE_DEDUP_EPSILON = 5e-4;
const POINT_DEDUP_EPSILON = 1e-6;
const POINT_DEDUP_EPSILON_SQ = POINT_DEDUP_EPSILON * POINT_DEDUP_EPSILON;
const POINT_ON_SEGMENT_EPSILON = 1e-6;
const RAYCAST_MAX_T = 1e6;
const VISIBILITY_TEST_VERTEX_SCALE = 1;
const ORIGIN_VERTEX_POLYGON_SCALE = 0.93;

const HEX_VERTEX_COUNT = 6;
const HEX_TEST_VERTEX_X = new Float32Array(HEX_VERTEX_COUNT);
const HEX_TEST_VERTEX_Y = new Float32Array(HEX_VERTEX_COUNT);
const ORIGIN_VERTEX_OFFSET_X = new Float32Array(HEX_VERTEX_COUNT);
const ORIGIN_VERTEX_OFFSET_Y = new Float32Array(HEX_VERTEX_COUNT);
let HEX_TEST_MAX_ABS_X = 0;
let HEX_TEST_MAX_ABS_Y = 0;
const HEX_INSCRIBED_RADIUS_SQ = 0.75 * VISIBILITY_TEST_VERTEX_SCALE * VISIBILITY_TEST_VERTEX_SCALE; // (sqrt(3)/2)^2 scaled inward
const HEX_CIRCUMSCRIBED_RADIUS_SQ = VISIBILITY_TEST_VERTEX_SCALE * VISIBILITY_TEST_VERTEX_SCALE;
const HEX_CIRCUMSCRIBED_RADIUS = Math.sqrt(HEX_CIRCUMSCRIBED_RADIUS_SQ);

for (let i = 0; i < HEX_VERTEX_COUNT; i++) {
  const p = UNIT_HEX_POINTS[i]!;
  const vx = p.x * VISIBILITY_TEST_VERTEX_SCALE;
  const vy = p.y * VISIBILITY_TEST_VERTEX_SCALE;
  ORIGIN_VERTEX_OFFSET_X[i] = p.x * ORIGIN_VERTEX_POLYGON_SCALE;
  ORIGIN_VERTEX_OFFSET_Y[i] = p.y * ORIGIN_VERTEX_POLYGON_SCALE;
  HEX_TEST_VERTEX_X[i] = vx;
  HEX_TEST_VERTEX_Y[i] = vy;
  const absX = Math.abs(vx);
  const absY = Math.abs(vy);
  if (absX > HEX_TEST_MAX_ABS_X) HEX_TEST_MAX_ABS_X = absX;
  if (absY > HEX_TEST_MAX_ABS_Y) HEX_TEST_MAX_ABS_Y = absY;
}

export interface MazeVisibilityPolygon {
  pointCount: number;
  pointX: Float32Array;
  pointY: Float32Array;
}

export interface MazeVisibleHexes {
  count: number;
  indices: Int32Array;
  mask: Uint8Array;
}

export interface MazeVisibilityDebugPolygons {
  polygonCount: number;
  pointStride: number;
  pointCountByPolygon: Int32Array;
  pointX: Float32Array;
  pointY: Float32Array;
}

export interface MazeVisibilityResult {
  polygon: MazeVisibilityPolygon;
  visibleHexes: MazeVisibleHexes;
  debugPolygons: MazeVisibilityDebugPolygons;
}

export interface MazeVisibilityRuntime {
  aux: HexVisionAux;
  sweepAngles: Float32Array;
  polygonX: Float32Array;
  polygonY: Float32Array;
  centerPolygonX: Float32Array;
  centerPolygonY: Float32Array;
  debugPointCountByPolygon: Int32Array;
  debugPointX: Float32Array;
  debugPointY: Float32Array;
  polygonSphereCenterX: number;
  polygonSphereCenterY: number;
  polygonSphereRadiusSq: number;
  visibleHexIndices: Int32Array;
  raycastHit: HexVisionRaycastHit;
  result: MazeVisibilityResult;
}

function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  epsilon: number,
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const cross = abx * apy - aby * apx;
  if (Math.abs(cross) > epsilon) return false;

  const dot = apx * abx + apy * aby;
  if (dot < -epsilon) return false;

  const lenSq = abx * abx + aby * aby;
  if (dot > lenSq + epsilon) return false;

  return true;
}

function isPointStrictlyInsidePolygon(
  px: number,
  py: number,
  polygonX: Float32Array,
  polygonY: Float32Array,
  polygonCount: number,
): boolean {
  let inside = false;
  let prevX = polygonX[polygonCount - 1]!;
  let prevY = polygonY[polygonCount - 1]!;

  for (let i = 0; i < polygonCount; i++) {
    const x = polygonX[i]!;
    const y = polygonY[i]!;

    if (pointOnSegment(px, py, prevX, prevY, x, y, POINT_ON_SEGMENT_EPSILON)) {
      return false;
    }

    if ((y > py) !== (prevY > py)) {
      const xAtY = prevX + ((x - prevX) * (py - prevY)) / (y - prevY);
      if (px < xAtY) {
        inside = !inside;
      }
    }

    prevX = x;
    prevY = y;
  }

  return inside;
}

function segmentIntersectsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  circleX: number,
  circleY: number,
  radiusSq: number,
): boolean {
  const abX = bx - ax;
  const abY = by - ay;
  const abLenSq = abX * abX + abY * abY;

  if (abLenSq <= POINT_ON_SEGMENT_EPSILON) {
    return distanceSq(ax, ay, circleX, circleY) <= radiusSq + POINT_ON_SEGMENT_EPSILON;
  }

  const acX = circleX - ax;
  const acY = circleY - ay;
  let t = (acX * abX + acY * abY) / abLenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const nearestX = ax + abX * t;
  const nearestY = ay + abY * t;
  return distanceSq(nearestX, nearestY, circleX, circleY) <= radiusSq + POINT_ON_SEGMENT_EPSILON;
}

function lineSplitsHexVertices(
  lineAx: number,
  lineAy: number,
  lineBx: number,
  lineBy: number,
  centerX: number,
  centerY: number,
): boolean {
  const lineDx = lineBx - lineAx;
  const lineDy = lineBy - lineAy;
  if (lineDx === 0 && lineDy === 0) {
    return false;
  }

  let hasLeft = false;
  let hasRight = false;
  for (let i = 0; i < HEX_VERTEX_COUNT; i++) {
    const vx = centerX + HEX_TEST_VERTEX_X[i]!;
    const vy = centerY + HEX_TEST_VERTEX_Y[i]!;
    const side = lineDx * (vy - lineAy) - lineDy * (vx - lineAx);
    if (side > POINT_ON_SEGMENT_EPSILON) {
      hasLeft = true;
    } else if (side < -POINT_ON_SEGMENT_EPSILON) {
      hasRight = true;
    }
    if (hasLeft && hasRight) {
      return true;
    }
  }
  return false;
}

function isHexVisibleByPolygonEdges(
  centerX: number,
  centerY: number,
  polygonX: Float32Array,
  polygonY: Float32Array,
  polygonCount: number,
): boolean {
  let prevPolyX = polygonX[polygonCount - 1]!;
  let prevPolyY = polygonY[polygonCount - 1]!;

  for (let i = 0; i < polygonCount; i++) {
    const polyX = polygonX[i]!;
    const polyY = polygonY[i]!;

    if (segmentIntersectsCircle(prevPolyX, prevPolyY, polyX, polyY, centerX, centerY, HEX_INSCRIBED_RADIUS_SQ)) {
      return true;
    }

    if (segmentIntersectsCircle(prevPolyX, prevPolyY, polyX, polyY, centerX, centerY, HEX_CIRCUMSCRIBED_RADIUS_SQ)) {
      if (lineSplitsHexVertices(prevPolyX, prevPolyY, polyX, polyY, centerX, centerY)) {
        return true;
      }
    }

    prevPolyX = polyX;
    prevPolyY = polyY;
  }

  return false;
}

function buildVisibilityPolygon(
  runtime: MazeVisibilityRuntime,
  originX: number,
  originY: number,
): number {
  const aux = runtime.aux;
  const angleCount = collectHexVisionSweepAngles(
    aux,
    originX,
    originY,
    SWEEP_ANGLE_EPSILON,
    runtime.sweepAngles,
  );
  sortHexVisionAnglesInPlace(runtime.sweepAngles, angleCount);

  let polygonCount = 0;
  let prevAngle = Number.NaN;

  for (let i = 0; i < angleCount; i++) {
    const angle = runtime.sweepAngles[i]!;
    if (i > 0 && Math.abs(angle - prevAngle) <= ANGLE_DEDUP_EPSILON) {
      continue;
    }
    prevAngle = angle;

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const hit = raycastHexVisionNearestSegment(
      aux,
      originX,
      originY,
      dirX,
      dirY,
      RAYCAST_MAX_T,
      runtime.raycastHit,
    );
    if (!hit) {
      throw new Error('buildVisibilityPolygon: ray missed all boundary segments');
    }

    const hitX = runtime.raycastHit.x;
    const hitY = runtime.raycastHit.y;

    if (polygonCount > 0) {
      const prevX = runtime.polygonX[polygonCount - 1]!;
      const prevY = runtime.polygonY[polygonCount - 1]!;
      if (distanceSq(hitX, hitY, prevX, prevY) <= POINT_DEDUP_EPSILON_SQ) {
        continue;
      }
    }

    runtime.polygonX[polygonCount] = hitX;
    runtime.polygonY[polygonCount] = hitY;
    polygonCount++;
  }

  if (polygonCount >= 2) {
    const firstX = runtime.polygonX[0]!;
    const firstY = runtime.polygonY[0]!;
    const lastX = runtime.polygonX[polygonCount - 1]!;
    const lastY = runtime.polygonY[polygonCount - 1]!;
    if (distanceSq(firstX, firstY, lastX, lastY) <= POINT_DEDUP_EPSILON_SQ) {
      polygonCount--;
    }
  }

  if (polygonCount < 3) {
    throw new Error(`buildVisibilityPolygon: invalid polygon with ${polygonCount} point(s)`);
  }

  return polygonCount;
}

function copyCurrentPolygonToDebugSlot(
  runtime: MazeVisibilityRuntime,
  slotIndex: number,
  polygonCount: number,
): void {
  runtime.debugPointCountByPolygon[slotIndex] = polygonCount;
  const start = slotIndex * runtime.result.debugPolygons.pointStride;
  runtime.debugPointX.set(runtime.polygonX.subarray(0, polygonCount), start);
  runtime.debugPointY.set(runtime.polygonY.subarray(0, polygonCount), start);
}

function computeCurrentPolygonBoundingSphere(
  runtime: MazeVisibilityRuntime,
  polygonCount: number,
): void {
  let polygonMinX = Infinity;
  let polygonMaxX = -Infinity;
  let polygonMinY = Infinity;
  let polygonMaxY = -Infinity;

  for (let i = 0; i < polygonCount; i++) {
    const px = runtime.polygonX[i]!;
    const py = runtime.polygonY[i]!;
    if (px < polygonMinX) polygonMinX = px;
    if (px > polygonMaxX) polygonMaxX = px;
    if (py < polygonMinY) polygonMinY = py;
    if (py > polygonMaxY) polygonMaxY = py;
  }

  const sphereCenterX = (polygonMinX + polygonMaxX) * 0.5;
  const sphereCenterY = (polygonMinY + polygonMaxY) * 0.5;
  let sphereRadiusSq = 0;
  for (let i = 0; i < polygonCount; i++) {
    const px = runtime.polygonX[i]!;
    const py = runtime.polygonY[i]!;
    const dSq = distanceSq(px, py, sphereCenterX, sphereCenterY);
    if (dSq > sphereRadiusSq) sphereRadiusSq = dSq;
  }

  runtime.polygonSphereCenterX = sphereCenterX;
  runtime.polygonSphereCenterY = sphereCenterY;
  runtime.polygonSphereRadiusSq = sphereRadiusSq;
}

function markVisibleHexesFromCurrentPolygon(
  runtime: MazeVisibilityRuntime,
  polygonCount: number,
): void {
  const aux = runtime.aux;
  computeCurrentPolygonBoundingSphere(runtime, polygonCount);

  let polygonMinX = Infinity;
  let polygonMaxX = -Infinity;
  let polygonMinY = Infinity;
  let polygonMaxY = -Infinity;
  for (let i = 0; i < polygonCount; i++) {
    const px = runtime.polygonX[i]!;
    const py = runtime.polygonY[i]!;
    if (px < polygonMinX) polygonMinX = px;
    if (px > polygonMaxX) polygonMaxX = px;
    if (py < polygonMinY) polygonMinY = py;
    if (py > polygonMaxY) polygonMaxY = py;
  }

  const sphereReach = Math.sqrt(runtime.polygonSphereRadiusSq) + HEX_CIRCUMSCRIBED_RADIUS;
  const sphereReachSq = sphereReach * sphereReach;

  for (let i = 0; i < aux.walkableCount; i++) {
    const cellIndex = aux.walkableIndex[i]!;
    if (aux.visibleMask[cellIndex] === 1) continue;

    const cx = aux.centerXByIndex[cellIndex]!;
    const cy = aux.centerYByIndex[cellIndex]!;
    if (distanceSq(cx, cy, runtime.polygonSphereCenterX, runtime.polygonSphereCenterY) > sphereReachSq) {
      continue;
    }
    if (
      cx + HEX_TEST_MAX_ABS_X < polygonMinX
      || cx - HEX_TEST_MAX_ABS_X > polygonMaxX
      || cy + HEX_TEST_MAX_ABS_Y < polygonMinY
      || cy - HEX_TEST_MAX_ABS_Y > polygonMaxY
    ) {
      continue;
    }

    let visible = isPointStrictlyInsidePolygon(cx, cy, runtime.polygonX, runtime.polygonY, polygonCount);
    if (!visible) {
      visible = isHexVisibleByPolygonEdges(cx, cy, runtime.polygonX, runtime.polygonY, polygonCount);
    }
    if (!visible) continue;

    aux.visibleMask[cellIndex] = 1;
  }
}

function collectVisibleHexesFromPolygons(
  runtime: MazeVisibilityRuntime,
  centerPolygonCount: number,
  originCellIndex: number,
  originX: number,
  originY: number,
): number {
  const aux = runtime.aux;
  clearHexVisionVisibleMask(aux);
  runtime.debugPointCountByPolygon.fill(0);

  // Center-origin polygon is already in runtime.polygonX/Y.
  copyCurrentPolygonToDebugSlot(runtime, 0, centerPolygonCount);
  markVisibleHexesFromCurrentPolygon(runtime, centerPolygonCount);

  // Add polygons from shrunken origin vertices.
  for (let i = 0; i < HEX_VERTEX_COUNT; i++) {
    const vx = originX + ORIGIN_VERTEX_OFFSET_X[i]!;
    const vy = originY + ORIGIN_VERTEX_OFFSET_Y[i]!;
    const polygonCount = buildVisibilityPolygon(runtime, vx, vy);
    copyCurrentPolygonToDebugSlot(runtime, i + 1, polygonCount);
    markVisibleHexesFromCurrentPolygon(runtime, polygonCount);
  }

  let visibleCount = 0;
  for (let i = 0; i < aux.walkableCount; i++) {
    const cellIndex = aux.walkableIndex[i]!;
    if (aux.visibleMask[cellIndex] !== 1) continue;
    runtime.visibleHexIndices[visibleCount++] = cellIndex;
  }

  if (aux.visibleMask[originCellIndex] !== 1) {
    throw new Error('collectVisibleHexesFromPolygons: origin cell is not visible by staged tests');
  }

  return visibleCount;
}

export function createMazeVisibilityRuntime(aux: HexVisionAux): MazeVisibilityRuntime {
  const debugPolygonCount = HEX_VERTEX_COUNT + 1;
  const maxPointCount = aux.vertexCount * 3;
  const sweepAngles = new Float32Array(maxPointCount);
  const polygonX = new Float32Array(maxPointCount);
  const polygonY = new Float32Array(maxPointCount);
  const centerPolygonX = new Float32Array(maxPointCount);
  const centerPolygonY = new Float32Array(maxPointCount);
  const debugPointCountByPolygon = new Int32Array(debugPolygonCount);
  const debugPointX = new Float32Array(debugPolygonCount * maxPointCount);
  const debugPointY = new Float32Array(debugPolygonCount * maxPointCount);
  const visibleHexIndices = new Int32Array(aux.walkableCount);

  const polygon: MazeVisibilityPolygon = {
    pointCount: 0,
    pointX: polygonX,
    pointY: polygonY,
  };

  const visibleHexes: MazeVisibleHexes = {
    count: 0,
    indices: visibleHexIndices,
    mask: aux.visibleMask,
  };

  const debugPolygons: MazeVisibilityDebugPolygons = {
    polygonCount: debugPolygonCount,
    pointStride: maxPointCount,
    pointCountByPolygon: debugPointCountByPolygon,
    pointX: debugPointX,
    pointY: debugPointY,
  };

  return {
    aux,
    sweepAngles,
    polygonX,
    polygonY,
    centerPolygonX,
    centerPolygonY,
    debugPointCountByPolygon,
    debugPointX,
    debugPointY,
    polygonSphereCenterX: 0,
    polygonSphereCenterY: 0,
    polygonSphereRadiusSq: 0,
    visibleHexIndices,
    raycastHit: createHexVisionRaycastHit(),
    result: {
      polygon,
      visibleHexes,
      debugPolygons,
    },
  };
}

export function computeMazeVisibilityFromIndex(
  runtime: MazeVisibilityRuntime,
  originCellIndex: number,
): MazeVisibilityResult {
  const aux = runtime.aux;
  if (!isHexVisionWalkableByIndex(aux, originCellIndex)) {
    throw new Error(`computeMazeVisibilityFromIndex: origin cell ${originCellIndex} is not walkable`);
  }

  const originX = aux.centerXByIndex[originCellIndex]!;
  const originY = aux.centerYByIndex[originCellIndex]!;

  const centerPolygonCount = buildVisibilityPolygon(runtime, originX, originY);
  runtime.centerPolygonX.set(runtime.polygonX.subarray(0, centerPolygonCount), 0);
  runtime.centerPolygonY.set(runtime.polygonY.subarray(0, centerPolygonCount), 0);

  const visibleCount = collectVisibleHexesFromPolygons(
    runtime,
    centerPolygonCount,
    originCellIndex,
    originX,
    originY,
  );

  runtime.polygonX.set(runtime.centerPolygonX.subarray(0, centerPolygonCount), 0);
  runtime.polygonY.set(runtime.centerPolygonY.subarray(0, centerPolygonCount), 0);

  runtime.result.polygon.pointCount = centerPolygonCount;
  runtime.result.visibleHexes.count = visibleCount;
  return runtime.result;
}

export function computeMazeVisibilityFromAxial(
  runtime: MazeVisibilityRuntime,
  originAxialX: number,
  originAxialY: number,
): MazeVisibilityResult {
  const cellIndex = axialToHexVisionIndex(runtime.aux, originAxialX, originAxialY);
  if (cellIndex === -1) {
    throw new Error(`computeMazeVisibilityFromAxial: origin axial (${originAxialX}, ${originAxialY}) is out of bounds`);
  }
  return computeMazeVisibilityFromIndex(runtime, cellIndex);
}

export function getMazeVisibilityVisibleHexAxialAt(
  aux: HexVisionAux,
  result: MazeVisibilityResult,
  visibleOffset: number,
  out: Point2,
): void {
  if (visibleOffset < 0 || visibleOffset >= result.visibleHexes.count) {
    throw new Error(`getMazeVisibilityVisibleHexAxialAt: offset ${visibleOffset} out of range`);
  }
  const cellIndex = result.visibleHexes.indices[visibleOffset]!;
  out.x = aux.axialXByIndex[cellIndex]!;
  out.y = aux.axialYByIndex[cellIndex]!;
}

export function buildMazeVisibilityHexBoundaryLoops(
  aux: HexVisionAux,
  result: MazeVisibilityResult,
): Point2[][] {
  const visibleCount = result.visibleHexes.count;
  const visibleCells = new Array<Point2>(visibleCount);
  for (let i = 0; i < visibleCount; i++) {
    const cellIndex = result.visibleHexes.indices[i]!;
    visibleCells[i] = {
      x: aux.axialXByIndex[cellIndex]!,
      y: aux.axialYByIndex[cellIndex]!,
    };
  }
  return computeHexBoundary(visibleCells);
}
