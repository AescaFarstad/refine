import type { Point2 } from './ItemLib';

/**
 * HexMath: Axial hex coordinate system utilities
 * Basis vectors: right (q) and left+up (r)
 * Using pointy-top orientation
 */

// Six hex neighbors in axial coordinates (clockwise from right)
const AXIAL_NEIGHBORS: Point2[] = [
    { x: 1, y: 0 },   // right
    { x: 1, y: -1 },  // top-right
    { x: 0, y: -1 },  // top-left
    { x: -1, y: 0 },  // left
    { x: -1, y: 1 },  // bottom-left
    { x: 0, y: 1 },   // bottom-right
];

export function axialAdd(a: Point2, b: Point2): Point2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function axialSubtract(a: Point2, b: Point2): Point2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function axialScale(a: Point2, k: number): Point2 {
    return { x: a.x * k, y: a.y * k };
}

export function axialEqual(a: Point2, b: Point2): boolean {
    return a.x === b.x && a.y === b.y;
}

export function axialNeighbors(center: Point2): Point2[] {
    return AXIAL_NEIGHBORS.map(dir => axialAdd(center, dir));
}

export function axialNeighbor(center: Point2, direction: number): Point2 {
    const dir = AXIAL_NEIGHBORS[((direction % 6) + 6) % 6];
    return axialAdd(center, dir);
}

export function axialDistance(a: Point2, b: Point2): number {
    const vec = axialSubtract(b, a);
    // Convert to cube coordinates for distance calculation
    const z = -vec.x - vec.y;
    return (Math.abs(vec.x) + Math.abs(vec.y) + Math.abs(z)) / 2;
}

export function axialRotateCW(point: Point2, n: number = 1): Point2 {
    let { x, y } = point;
    const steps = ((n % 6) + 6) % 6; // Normalize to 0-5

    for (let i = 0; i < steps; i++) {
        // 60° CW rotation in axial: (q, r) -> (-r, q+r)
        const newX = -y;
        const newY = x + y;
        x = newX;
        y = newY;
    }

    return { x, y };
}

export function axialRotateCCW(point: Point2, n: number = 1): Point2 {
    return axialRotateCW(point, -n);
}

export function axialReflectQ(point: Point2): Point2 {
    return { x: point.x, y: -point.x - point.y };
}

export function axialReflectR(point: Point2): Point2 {
    return { x: -point.x - point.y, y: point.y };
}

export function axialReflectDiag(point: Point2): Point2 {
    return { x: point.y, y: point.x };
}

export function axialToPixel(point: Point2, hexSize: number, origin: Point2 = { x: 0, y: 0 }): Point2 {
    const x = hexSize * (Math.sqrt(3) * point.x + Math.sqrt(3) / 2 * point.y);
    const y = hexSize * (3 / 2 * point.y);
    return { x: x + origin.x, y: y + origin.y };
}

export function pixelToAxialFloat(pixel: Point2, hexSize: number, origin: Point2 = { x: 0, y: 0 }): Point2 {
    const relX = (pixel.x - origin.x) / hexSize;
    const relY = (pixel.y - origin.y) / hexSize;

    const q = (Math.sqrt(3) / 3 * relX - 1 / 3 * relY);
    const r = (2 / 3 * relY);

    return { x: q, y: r };
}

export function pixelToAxial(pixel: Point2, hexSize: number, origin: Point2 = { x: 0, y: 0 }): Point2 {
    const relX = (pixel.x - origin.x) / hexSize;
    const relY = (pixel.y - origin.y) / hexSize;

    const q = (Math.sqrt(3) / 3 * relX - 1 / 3 * relY);
    const r = (2 / 3 * relY);

    return axialRound({ x: q, y: r });
}

export function axialRound(point: Point2): Point2 {
    // Convert to cube coordinates for rounding
    const q = point.x;
    const r = point.y;
    const s = -q - r;

    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    // Reset the component with largest rounding error
    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    } else if (rDiff > sDiff) {
        rr = -rq - rs;
    }

    return { x: rq, y: rr };
}

export function axialRing(center: Point2, radius: number): Point2[] {
    if (radius === 0) return [center];

    const results: Point2[] = [];
    let hex = axialAdd(center, axialScale(AXIAL_NEIGHBORS[4], radius));

    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < radius; j++) {
            results.push(hex);
            hex = axialNeighbor(hex, i);
        }
    }

    return results;
}

export function axialRange(center: Point2, radius: number): Point2[] {
    const results: Point2[] = [];

    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            results.push(axialAdd(center, { x: q, y: r }));
        }
    }

    return results;
}

export function axialBounds(points: Point2[]): { min: Point2; max: Point2 } {
    if (points.length === 0) {
        return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    }

    let minQ = points[0].x;
    let maxQ = points[0].x;
    let minR = points[0].y;
    let maxR = points[0].y;

    for (const p of points) {
        minQ = Math.min(minQ, p.x);
        maxQ = Math.max(maxQ, p.x);
        minR = Math.min(minR, p.y);
        maxR = Math.max(maxR, p.y);
    }

    return {
        min: { x: minQ, y: minR },
        max: { x: maxQ, y: maxR },
    };
}
