export type Point2 = {
  x: number;
  y: number;
};

export interface Line {
  point: Point2;
  direction: Point2;
}

export function Point2(x: number, y: number): Point2 {
  return { x, y };
}

export function set(p: Point2, x: number, y: number): void {
  p.x = x;
  p.y = y;
}
export function set_(p: Point2, p1: Point2): void {
  p.x = p1.x;
  p.y = p1.y;
}

export function copy(p: Point2): Point2 {
  return { x: p.x, y: p.y };
}

export function subtract(p2: Point2, p1: Point2): Point2 {
  return { x: p2.x - p1.x, y: p2.y - p1.y };
}

export function subtract_(p: Point2, p1: Point2): void {
  p.x -= p1.x;
  p.y -= p1.y;
}

export function add(p1: Point2, p2: Point2): Point2 {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

export function add_(p: Point2, p2: Point2): void {
  p.x += p2.x;
  p.y += p2.y;
}

export function scale(p: Point2, s: number): Point2 {
  return { x: p.x * s, y: p.y * s };
}

export function scale_(p: Point2, s: number): void {
  p.x *= s;
  p.y *= s;
}

export function normalize(p: Point2): Point2 {
  const len = length(p);
  if (len > 0) {
    return { x: p.x / len, y: p.y / len };
  }
  return { x: 0, y: 0 };
}

export function normalize_(p: Point2): void {
  const len = length(p);
  if (len > 0) {
    p.x /= len;
    p.y /= len;
  } else {
    p.x = 0;
    p.y = 0;
  }
}

export function length_sq(p: Point2): number {
  return p.x * p.x + p.y * p.y;
}

export function length(p: Point2): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

export function distance(p1: Point2, p2: Point2): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distance_sq(p1: Point2, p2: Point2): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function cvt(value: number, inMin: number, inMax: number, outMin: number, outMax: number, clamp_v: boolean = false): number {
  let v = clamp_v ? clamp(value, inMin, inMax) : value;
  return ((v - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

export function cvtExp(value: number, inMin: number, inMax: number, outMin: number, outMax: number, clamp_v: boolean = false): number {
  const v = clamp_v ? clamp(value, inMin, inMax) : value;
  const t = (v - inMin) / (inMax - inMin);
  if (outMin <= 0 || outMax <= 0) {
    console.error("cvtExp requires outMin and outMax to be positive for exponential scaling.");
    return cvt(value, inMin, inMax, outMin, outMax, clamp_v);
  }
  return outMin * Math.pow(outMax / outMin, t);
}

export function distancePointToSegment(p: Point2, a: Point2, b: Point2): number {
  const ab = subtract(b, a);
  const ap = subtract(p, a);
  const lenSq = ab.x * ab.x + ab.y * ab.y;

  if (lenSq === 0.0) {
  return distance(p, a); // a and b are the same point
  }

  // Projection of ap onto ab, normalized by length of ab
  const t = Math.max(0, Math.min(1, dot(ap, ab) / lenSq));  // The closest point on the line segment
  const closestPoint = {
  x: a.x + t * ab.x,
  y: a.y + t * ab.y,
  };  return distance(p, closestPoint);
}

export function dot(p1: Point2, p2: Point2): number {
  return p1.x * p2.x + p1.y * p2.y;
}

export function cross(p1: Point2, p2: Point2): number {
  return p1.x * p2.y - p1.y * p2.x;
}

export function isToRight(p1: Point2, p2: Point2, p3: Point2): boolean {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x) < 0;
}

export function isPointInAABB(point: Point2, min: Point2, max: Point2): boolean {
  return point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y;
}

export function lineSegmentIntersectionTest(p1: Point2, p2: Point2, p3: Point2, p4: Point2): boolean {
  const EPSILON = 1e-10;  const r = subtract(p2, p1);
  const s = subtract(p4, p3);
  const r_cross_s = cross(r, s);
  const q_minus_p = subtract(p3, p1);  // Lines are parallel (or nearly so)
  if (Math.abs(r_cross_s) < EPSILON) {
    const q_minus_p_cross_r = cross(q_minus_p, r);    // Lines are collinear
    if (Math.abs(q_minus_p_cross_r) < EPSILON) {
      // Check if segments overlap on the collinear line
      const t0 = dot(q_minus_p, r) / dot(r, r);
      const t1 = t0 + dot(s, r) / dot(r, r);      const tMin = Math.min(t0, t1);
      const tMax = Math.max(t0, t1);      // Segments overlap if they intersect the range [0, 1]
      return tMax >= -EPSILON && tMin <= 1 + EPSILON;
    }    // Lines are parallel but not collinear, so no intersection
    return false;
  }  const t = cross(q_minus_p, s) / r_cross_s;
  const u = cross(q_minus_p, r) / r_cross_s;

  // Check if intersection point lies within both line segments
  return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON;
}

// Fast broad-phase AABB vs AABB intersection test
export function aabbIntersection(min1: Point2, max1: Point2, min2: Point2, max2: Point2): boolean {
  return !(max1.x < min2.x || min1.x > max2.x || max1.y < min2.y || min1.y > max2.y);
}



export function lineLineIntersection(line1: Line, line2: Line): Point2 | null {
  const p1 = line1.point;
  const v1 = line1.direction;
  const p2 = line2.point;
  const v2 = line2.direction;

  const cross_product = cross(v1, v2);  // Lines are parallel or collinear
  if (Math.abs(cross_product) < 1e-9) {
  return null;
  }

  const dp = subtract(p2, p1);
  const t = cross(dp, v2) / cross_product;

  return {
  x: p1.x + t * v1.x,
  y: p1.y + t * v1.y,
  };
}

export function lineLineIntersect(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number
): Point2 | null {
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) {
  return null;
  }

  const c1 = x1 * y2 - y1 * x2;
  const c2 = x3 * y4 - y3 * x4;

  const x = (c1 * (x3 - x4) - (x1 - x2) * c2) / den;
  const y = (c1 * (y3 - y4) - (y1 - y2) * c2) / den;

  return { x, y };
}

export function getLineSegmentIntersectionPoint(p1: Point2, p2: Point2, p3: Point2, p4: Point2): Point2 | null {
  const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (den === 0) {
    return null; // Lines are parallel
  }
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }

  return null;
}

export function pointLineSignedDistance(point: Point2, lineP1: Point2, lineDir: Point2): number {
  const normal = { x: -lineDir.y, y: lineDir.x };
  const pointVec = subtract(point, lineP1);
  const dist = dot(pointVec, normal) / length(normal);
  return dist;
}

export function rotateTo(out: Point2, p: Point2, angle: number): void {
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = p.x, y = p.y;
  out.x = x * c - y * s;
  out.y = x * s + y * c;
}

export function rotate_(p: Point2, angle: number): void {
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = p.x, y = p.y;
  p.x = x * c - y * s;
  p.y = x * s + y * c;
}

export function rotate(p: Point2, angle: number): Point2 {
  return { x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) };
}

// Re-export triangle math functions
export * from './triMath';
