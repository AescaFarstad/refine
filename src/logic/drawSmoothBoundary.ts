import type { Point2 } from './ItemLib';

const BOUNDARY_SMOOTHNESS = 0.8;
const BOUNDARY_CONCAVE_BLEND = 0.7;
const BOUNDARY_CONCAVE_BLEND_NU = 0.45;

function hashCoord01(x: number, y: number): number {
  const xi = Math.round(x * 1024);
  const yi = Math.round(y * 1024);
  let h = Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function preprocessConcaveLoop(loop: readonly Point2[], blendK: number, blendNu: number): Point2[] {
  const pointCount = loop.length - 1;
  if (pointCount < 3 || blendK <= 0) return loop.slice(0, pointCount);

  const source = loop.slice(0, pointCount);
  const adjusted = source.map((p) => ({ x: p.x, y: p.y }));

  let area2 = 0;
  for (let i = 0; i < pointCount; i++) {
    const a = source[i]!;
    const b = source[(i + 1) % pointCount]!;
    area2 += a.x * b.y - a.y * b.x;
  }
  const areaSign = Math.sign(area2);
  if (areaSign === 0) return adjusted;

  for (let i = 0; i < pointCount; i++) {
    const prev = source[(i - 1 + pointCount) % pointCount]!;
    const pos = source[i]!;
    const next = source[(i + 1) % pointCount]!;
    const inX = pos.x - prev.x;
    const inY = pos.y - prev.y;
    const outX = next.x - pos.x;
    const outY = next.y - pos.y;
    const turn = inX * outY - inY * outX;
    const isConcave = turn * areaSign < 0;
    if (!isConcave) continue;

    const rnd = hashCoord01(pos.x, pos.y);
    const localBlendK = blendK + (rnd * 2 - 1) * blendNu;
    const avgX = (prev.x + next.x) * 0.5;
    const avgY = (prev.y + next.y) * 0.5;
    adjusted[i] = {
      x: pos.x * (1 - localBlendK) + avgX * localBlendK,
      y: pos.y * (1 - localBlendK) + avgY * localBlendK,
    };
  }

  return adjusted;
}

export function traceSmoothHexBoundary(
  ctx: CanvasRenderingContext2D,
  loops: readonly (readonly Point2[])[],
  origin: Point2,
  scale: number,
  offset: Point2 = { x: 0, y: 0 },
): void {
  ctx.beginPath();
  for (const loop of loops) {
    const points = preprocessConcaveLoop(
      loop,
      BOUNDARY_CONCAVE_BLEND,
      BOUNDARY_CONCAVE_BLEND_NU,
    );
    const pointCount = points.length;
    const first = points[0]!;
    ctx.moveTo(origin.x + offset.x + first.x * scale, origin.y + offset.y + first.y * scale);
    for (let i = 0; i < pointCount; i++) {
      const p0 = points[(i - 1 + pointCount) % pointCount]!;
      const p1 = points[i]!;
      const p2 = points[(i + 1) % pointCount]!;
      const p3 = points[(i + 2) % pointCount]!;

      const c1x = p1.x + ((p2.x - p0.x) * BOUNDARY_SMOOTHNESS) / 6;
      const c1y = p1.y + ((p2.y - p0.y) * BOUNDARY_SMOOTHNESS) / 6;
      const c2x = p2.x - ((p3.x - p1.x) * BOUNDARY_SMOOTHNESS) / 6;
      const c2y = p2.y - ((p3.y - p1.y) * BOUNDARY_SMOOTHNESS) / 6;

      ctx.bezierCurveTo(
        origin.x + offset.x + c1x * scale,
        origin.y + offset.y + c1y * scale,
        origin.x + offset.x + c2x * scale,
        origin.y + offset.y + c2y * scale,
        origin.x + offset.x + p2.x * scale,
        origin.y + offset.y + p2.y * scale,
      );
    }
    ctx.closePath();
  }
}
