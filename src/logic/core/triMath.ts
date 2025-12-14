import { Point2, subtract, isPointInAABB, lineSegmentIntersectionTest, aabbIntersection } from './math';

export function triangleArea(A: Point2, B: Point2, C: Point2): number {
  return Math.abs((A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) / 2);
}

// Slower, old version for counter-clockwise triangles
export function isPointInTriangle2(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  // For each edge, compute in canonical order

  // Edge AB
  const abFlip = (ax > bx || (ax === bx && ay > by)) ? 1 : 0;
  const oab = abFlip
  ? (ax - bx) * (py - by) - (ay - by) * (px - bx)  // b->a
  : (bx - ax) * (py - ay) - (by - ay) * (px - ax); // a->b

  // Edge BC
  const bcFlip = (bx > cx || (bx === cx && by > cy)) ? 1 : 0;
  const obc = bcFlip
  ? (bx - cx) * (py - cy) - (by - cy) * (px - cx)  // c->b
  : (cx - bx) * (py - by) - (cy - by) * (px - bx); // b->c

  // Edge CA
  const caFlip = (cx > ax || (cx === ax && cy > ay)) ? 1 : 0;
  const oca = caFlip
  ? (cx - ax) * (py - ay) - (cy - ay) * (px - ax)  // a->c
  : (ax - cx) * (py - cy) - (ay - cy) * (px - cx); // c->a

  // Check if point is on the correct side of each edge
  // For canonical edge direction, we expect positive orientation
  // If edge is flipped, we expect negative orientation
  const abOk = abFlip ? (oab < 0 || oab === 0) : (oab > 0 || oab === 0);
  const bcOk = bcFlip ? (obc < 0 || obc === 0) : (obc > 0 || obc === 0);
  const caOk = caFlip ? (oca < 0 || oca === 0) : (oca > 0 || oca === 0);

  return abOk && bcOk && caOk;
}

export function isPointInTriangle(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): boolean {
  // Barycentric 2x2 solve with a single division by the triangle area determinant.
  // Assumes consistent winding; includes boundary with a small epsilon.
  const v0x = bx - ax; const v0y = by - ay; // B - A
  const v1x = cx - ax; const v1y = cy - ay; // C - A
  const v2x = px - ax; const v2y = py - ay; // P - A

  const det = v0x * v1y - v0y * v1x; // 2 * area (signed)
  // const eps = 1e-12;
  // if (Math.abs(det) < eps) {
  //   return false; // Degenerate triangle
  // }

  // Inverse of [[v0x v1x],[v0y v1y]] times [v2x v2y]^T
  const invDet = 1.0 / det;
  const s = ( v1y * v2x - v1x * v2y) * invDet;
  const t = (-v0y * v2x + v0x * v2y) * invDet;

  // Allow points on edges; tighten/loosen epsilon as needed
  const inside = (s >= -1e-12) && (t >= -1e-12) && (s + t <= 1 + 1e-12);
  return inside;
}

// Overloaded version that accepts pre-calculated triangle bounds for performance
export function triangleAABBIntersectionWithBounds(
  triPoints: Point2[], 
  triMin: Point2, 
  triMax: Point2, 
  cellMin: Point2, 
  cellMax: Point2
): boolean {
  // Broad phase: Quick AABB vs AABB test using pre-calculated bounds
  if (!aabbIntersection(triMin, triMax, cellMin, cellMax)) {
    return false;
  }  // If bounding boxes overlap, we need detailed intersection tests
  return triangleAABBIntersectionDetailed(triPoints, cellMin, cellMax);
}

// Detailed intersection test (separated for reuse)
function triangleAABBIntersectionDetailed(triPoints: Point2[], cellMin: Point2, cellMax: Point2): boolean {
  // Check 1: Any triangle vertex inside the rectangle
  for (const p of triPoints) {
    if (isPointInAABB(p, cellMin, cellMax)) {
      return true;
    }
  }

  // Check 2: Any rectangle corner inside the triangle
  const cellCorners: Point2[] = [
    cellMin,
    { x: cellMax.x, y: cellMin.y },
    cellMax,
    { x: cellMin.x, y: cellMax.y },
  ];
  for (const corner of cellCorners) {
    if (isPointInTriangle(corner.x, corner.y, triPoints[0].x, triPoints[0].y, triPoints[1].x, triPoints[1].y, triPoints[2].x, triPoints[2].y)) {
      return true;
    }
  }

  // Check 3: Triangle edges intersecting rectangle edges
  const triEdges: [Point2, Point2][] = [
    [triPoints[0], triPoints[1]],
    [triPoints[1], triPoints[2]],
    [triPoints[2], triPoints[0]],
  ];
  const cellEdges: [Point2, Point2][] = [
    [cellCorners[0], cellCorners[1]], // bottom edge
    [cellCorners[1], cellCorners[2]], // right edge
    [cellCorners[2], cellCorners[3]], // top edge
    [cellCorners[3], cellCorners[0]], // left edge
  ];

  for (const triEdge of triEdges) {
    for (const cellEdge of cellEdges) {
      if (lineSegmentIntersectionTest(triEdge[0], triEdge[1], cellEdge[0], cellEdge[1])) {
        return true;
      }
    }
  }

  // Check 4: Additional Separating Axis Theorem (SAT) test
  // Test if triangle and rectangle are separated by triangle edge normals
  for (let i = 0; i < 3; i++) {
    const edge = subtract(triPoints[(i + 1) % 3], triPoints[i]);
    const normal = { x: -edge.y, y: edge.x }; // perpendicular to edge    // Project triangle onto this axis
    let triMin = Infinity, triMax = -Infinity;
    for (const p of triPoints) {
      const proj = p.x * normal.x + p.y * normal.y;
      triMin = Math.min(triMin, proj);
      triMax = Math.max(triMax, proj);
    }    // Project rectangle onto this axis
    let rectMin = Infinity, rectMax = -Infinity;
    for (const corner of cellCorners) {
      const proj = corner.x * normal.x + corner.y * normal.y;
      rectMin = Math.min(rectMin, proj);
      rectMax = Math.max(rectMax, proj);
    }    // Check for separation on this axis
    if (triMax < rectMin || rectMax < triMin) {
      return false; // Separated on this axis
    }
  }

  return true;
}

export function triangleAABBIntersection(triPoints: Point2[], cellMin: Point2, cellMax: Point2): boolean {
  // Broad phase: Quick AABB vs AABB test
  // Calculate triangle bounding box
  let triMinX = triPoints[0].x, triMinY = triPoints[0].y;
  let triMaxX = triPoints[0].x, triMaxY = triPoints[0].y;  for (let i = 1; i < 3; i++) {
    const p = triPoints[i];
    if (p.x < triMinX) triMinX = p.x;
    if (p.y < triMinY) triMinY = p.y;
    if (p.x > triMaxX) triMaxX = p.x;
    if (p.y > triMaxY) triMaxY = p.y;
  }  // Quick rejection: if bounding boxes don't overlap, triangle can't intersect cell
  if (!aabbIntersection({ x: triMinX, y: triMinY }, { x: triMaxX, y: triMaxY }, cellMin, cellMax)) {
    return false;
  }  // If bounding boxes overlap, we need detailed intersection tests
  return triangleAABBIntersectionDetailed(triPoints, cellMin, cellMax);
} 