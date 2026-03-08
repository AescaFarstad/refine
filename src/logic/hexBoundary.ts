import type { Point2 } from './ItemLib';
import { axialNeighbor, axialToPixel } from './HexMath';
import { indexToAxial } from './Research';
import { UNIT_HEX_POINTS } from './DrawHex';

type LatticeVertex = {
  u: number;
  v: number;
};

type BoundaryEdge = {
  a: number;
  b: number;
};

export interface HexBoundaryLoop {
  points: Point2[];
  edgeOwnerCells: Point2[];
  isHole: boolean;
}

// Hex corners for pointy-top orientation, mapped onto an integer lattice:
// u = (2 / sqrt(3)) * x
// v = 2 * y
const LATTICE_U_SCALE = 2 / Math.sqrt(3);
const CORNER_U: readonly number[] = UNIT_HEX_POINTS.map((p) => {
  const u = p.x * LATTICE_U_SCALE;
  const rounded = Math.round(u);
  if (Math.abs(u - rounded) > 1e-8) {
    throw new Error('UNIT_HEX_POINTS are not compatible with boundary lattice u coordinates.');
  }
  return rounded;
});
const CORNER_V: readonly number[] = UNIT_HEX_POINTS.map((p) => {
  const v = p.y * 2;
  const rounded = Math.round(v);
  if (Math.abs(v - rounded) > 1e-8) {
    throw new Error('UNIT_HEX_POINTS are not compatible with boundary lattice v coordinates.');
  }
  return rounded;
});

const KEY_STRIDE = 1000;
const TAU = Math.PI * 2;

// HexMath neighbor order is:
// 0 right, 1 top-right, 2 top-left, 3 left, 4 bottom-left, 5 bottom-right
// With UNIT_HEX_POINTS corner order (30, 90, 150, 210, 270, 330),
// side i is between these corners:
const SIDE_FROM_CORNER: readonly number[] = [5, 4, 3, 2, 1, 0];
const SIDE_TO_CORNER: readonly number[] = [0, 5, 4, 3, 2, 1];

function pairInt2(x: number, y: number): number {
  return x + KEY_STRIDE * y;
}

function normalizeAngle(angle: number): number {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
}

function signedArea(loop: readonly LatticeVertex[]): number {
  let area2 = 0;
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i]!;
    const b = loop[i + 1]!;
    area2 += a.u * b.v - a.v * b.u;
  }
  return area2 * 0.5;
}

function latticeCellCenter(cell: Point2): LatticeVertex {
  return {
    u: 2 * cell.x + cell.y,
    v: 3 * cell.y,
  };
}

function loopOwnersAreOnLeft(loop: readonly LatticeVertex[], edgeOwners: readonly Point2[]): boolean {
  const segmentCount = loop.length - 1;
  if (segmentCount !== edgeOwners.length) {
    throw new Error(
      `loopOwnersAreOnLeft: segment-owner mismatch, segments=${segmentCount}, owners=${edgeOwners.length}.`
    );
  }

  let signedOwnerSide = 0;
  for (let i = 0; i < segmentCount; i++) {
    const a = loop[i]!;
    const b = loop[i + 1]!;
    const ownerCenter = latticeCellCenter(edgeOwners[i]!);
    const midU = (a.u + b.u) * 0.5;
    const midV = (a.v + b.v) * 0.5;
    const relU = ownerCenter.u - midU;
    const relV = ownerCenter.v - midV;
    signedOwnerSide += (b.u - a.u) * relV - (b.v - a.v) * relU;
  }

  if (signedOwnerSide === 0) {
    throw new Error('loopOwnersAreOnLeft: could not determine loop owner side.');
  }
  return signedOwnerSide > 0;
}

function reverseLoopWithOwners(loop: readonly LatticeVertex[], edgeOwners: readonly Point2[]): {
  loop: LatticeVertex[];
  edgeOwners: Point2[];
} {
  const segmentCount = loop.length - 1;
  const reversedLoop = new Array<LatticeVertex>(segmentCount + 1);
  const reversedOwners = new Array<Point2>(segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    reversedLoop[i] = loop[segmentCount - i]!;
    reversedOwners[i] = edgeOwners[(segmentCount - 2 - i + segmentCount) % segmentCount]!;
  }
  reversedLoop[segmentCount] = reversedLoop[0]!;

  return {
    loop: reversedLoop,
    edgeOwners: reversedOwners,
  };
}

function rotateLoopToSmallestVertex(loop: readonly LatticeVertex[], edgeOwners: readonly Point2[]): {
  loop: LatticeVertex[];
  edgeOwners: Point2[];
} {
  const segmentCount = loop.length - 1;
  let minIdx = 0;
  for (let ri = 1; ri < segmentCount; ri++) {
    const cur = loop[ri]!;
    const best = loop[minIdx]!;
    if (cur.u < best.u || (cur.u === best.u && cur.v < best.v)) {
      minIdx = ri;
    }
  }

  if (minIdx === 0) {
    return {
      loop: loop.slice(),
      edgeOwners: edgeOwners.slice(),
    };
  }

  const rotatedLoop = loop.slice(minIdx, segmentCount).concat(loop.slice(0, minIdx));
  rotatedLoop.push({ u: rotatedLoop[0]!.u, v: rotatedLoop[0]!.v });
  const rotatedOwners = edgeOwners.slice(minIdx).concat(edgeOwners.slice(0, minIdx));
  return {
    loop: rotatedLoop,
    edgeOwners: rotatedOwners,
  };
}

function toPixelVertex(v: LatticeVertex): Point2 {
  const r = v.v / 3;
  const q = (v.u - r) * 0.5;
  return axialToPixel({ x: q, y: r }, 1);
}

export function computeHexBoundary(ownedCells: readonly Point2[]): HexBoundaryLoop[] {
  if (ownedCells.length === 0) return [];

  const ownedSet = new Set<number>();
  for (const cell of ownedCells) {
    ownedSet.add(pairInt2(cell.x, cell.y));
  }

  const edges: BoundaryEdge[] = [];
  const edgeOwnerCells: Point2[] = [];
  const byVertex = new Map<number, number[]>();
  const vertices = new Map<number, LatticeVertex>();

  for (const cell of ownedCells) {
    const baseU = 2 * cell.x + cell.y;
    const baseV = 3 * cell.y;

    for (let side = 0; side < 6; side++) {
      const neighbor = axialNeighbor(cell, side);
      const nx = neighbor.x;
      const ny = neighbor.y;
      if (ownedSet.has(pairInt2(nx, ny))) continue;

      const fromCorner = SIDE_FROM_CORNER[side]!;
      const toCorner = SIDE_TO_CORNER[side]!;
      const fromU = baseU + CORNER_U[fromCorner]!;
      const fromV = baseV + CORNER_V[fromCorner]!;
      const toU = baseU + CORNER_U[toCorner]!;
      const toV = baseV + CORNER_V[toCorner]!;

      const from = pairInt2(fromU, fromV);
      const to = pairInt2(toU, toV);
      vertices.set(from, { u: fromU, v: fromV });
      vertices.set(to, { u: toU, v: toV });

      const idx = edges.length;
      edges.push({ a: from, b: to });
      edgeOwnerCells.push({ x: cell.x, y: cell.y });

      const arrA = byVertex.get(from);
      if (arrA) arrA.push(idx);
      else byVertex.set(from, [idx]);

      const arrB = byVertex.get(to);
      if (arrB) arrB.push(idx);
      else byVertex.set(to, [idx]);
    }
  }

  const halfCount = edges.length * 2;
  const visitedHalf = new Uint8Array(halfCount);
  const loops: LatticeVertex[][] = [];
  const loopEdgeOwnerCells: Point2[][] = [];
  const seenLoopKeys = new Set<string>();

  function halfFrom(half: number): number {
    const e = edges[half >> 1]!;
    return (half & 1) === 0 ? e.a : e.b;
  }

  function halfTo(half: number): number {
    const e = edges[half >> 1]!;
    return (half & 1) === 0 ? e.b : e.a;
  }

  for (let start = 0; start < halfCount; start++) {
    if (visitedHalf[start] === 1) continue;

    const loop: LatticeVertex[] = [];
    const edgeOwners: Point2[] = [];
    const edgeKeys: string[] = [];
    let current = start;
    let steps = 0;

    while (true) {
      if (visitedHalf[current] === 1) {
        throw new Error('Boundary graph is invalid: revisited edge before closing loop.');
      }

      visitedHalf[current] = 1;

      const fromKey = halfFrom(current);
      const toKey = halfTo(current);
      const from = vertices.get(fromKey)!;
      const to = vertices.get(toKey)!;

      if (loop.length === 0) {
        loop.push({ u: from.u, v: from.v });
      }
      loop.push({ u: to.u, v: to.v });
      edgeOwners.push(edgeOwnerCells[current >> 1]!);

      const undirectedEdge = edges[current >> 1]!;
      const minKey = undirectedEdge.a < undirectedEdge.b ? undirectedEdge.a : undirectedEdge.b;
      const maxKey = undirectedEdge.a < undirectedEdge.b ? undirectedEdge.b : undirectedEdge.a;
      edgeKeys.push(`${minKey}:${maxKey}`);

      const incident = byVertex.get(toKey)!;
      if (incident.length <= 1) {
        const incidentEdges = incident.map((edgeIdx) => {
          const e = edges[edgeIdx]!;
          const va = vertices.get(e.a)!;
          const vb = vertices.get(e.b)!;
          return `(${va.u},${va.v})-(${vb.u},${vb.v})`;
        }).join(', ');
        throw new Error(
          `Boundary graph is invalid: vertex degree=${incident.length}, expected >= 2 at (${to.u},${to.v}), key=${toKey}, incident=[${incidentEdges}].`
        );
      }

      const backAngle = Math.atan2(from.v - to.v, from.u - to.u);
      const backHalf = current ^ 1;
      let bestHalf = -1;
      let bestCwDelta = Number.POSITIVE_INFINITY;
      for (const edgeIdx of incident) {
        const e = edges[edgeIdx]!;
        const candidateHalf = e.a === toKey ? edgeIdx * 2 : edgeIdx * 2 + 1;
        if (candidateHalf === backHalf) continue;

        const candToKey = halfTo(candidateHalf);
        const candTo = vertices.get(candToKey)!;
        const candAngle = Math.atan2(candTo.v - to.v, candTo.u - to.u);
        const cwDelta = normalizeAngle(backAngle - candAngle);
        if (cwDelta < bestCwDelta) {
          bestCwDelta = cwDelta;
          bestHalf = candidateHalf;
        }
      }

      if (bestHalf === -1) {
        throw new Error('Boundary graph is invalid: could not find continuation half-edge.');
      }

      current = bestHalf;
      if (current === start) break;
      if (visitedHalf[current] === 1) {
        throw new Error('Boundary graph is invalid: half-edge cycle collided with an already visited loop.');
      }

      if (steps > edges.length + 2) {
        throw new Error('Boundary graph is invalid: edge walk did not close.');
      }
      steps++;
    }

    edgeKeys.sort();
    const loopKey = edgeKeys.join('|');
    if (!seenLoopKeys.has(loopKey)) {
      if (edgeOwners.length !== loop.length - 1) {
        throw new Error(
          `Boundary graph is invalid: loop segment-owner mismatch, segments=${loop.length - 1}, owners=${edgeOwners.length}.`
        );
      }
      seenLoopKeys.add(loopKey);
      let normalizedLoop = loop;
      let normalizedOwners = edgeOwners;
      if (!loopOwnersAreOnLeft(normalizedLoop, normalizedOwners)) {
        const reversed = reverseLoopWithOwners(normalizedLoop, normalizedOwners);
        normalizedLoop = reversed.loop;
        normalizedOwners = reversed.edgeOwners;
      }

      const rotated = rotateLoopToSmallestVertex(normalizedLoop, normalizedOwners);
      loops.push(rotated.loop);
      loopEdgeOwnerCells.push(rotated.edgeOwners);
    }
  }

  if (loops.length === 1) {
    return [{
      points: loops[0]!.map(toPixelVertex),
      edgeOwnerCells: loopEdgeOwnerCells[0]!,
      isHole: signedArea(loops[0]!) < 0,
    }];
  }

  let outerIdx = 0;
  let maxAbsArea = Math.abs(signedArea(loops[0]!));
  for (let i = 1; i < loops.length; i++) {
    const areaAbs = Math.abs(signedArea(loops[i]!));
    if (areaAbs > maxAbsArea) {
      maxAbsArea = areaAbs;
      outerIdx = i;
    }
  }

  const ordered: HexBoundaryLoop[] = [{
    points: loops[outerIdx]!.map(toPixelVertex),
    edgeOwnerCells: loopEdgeOwnerCells[outerIdx]!,
    isHole: signedArea(loops[outerIdx]!) < 0,
  }];
  for (let i = 0; i < loops.length; i++) {
    if (i === outerIdx) continue;
    ordered.push({
      points: loops[i]!.map(toPixelVertex),
      edgeOwnerCells: loopEdgeOwnerCells[i]!,
      isHole: signedArea(loops[i]!) < 0,
    });
  }

  return ordered;
}

export function computeOwnedResearchBoundary(
  researchCells: readonly { readonly owned: boolean }[]
): HexBoundaryLoop[] {
  const owned: Point2[] = [];
  for (let i = 0; i < researchCells.length; i++) {
    if (!researchCells[i]!.owned) continue;
    const axial = indexToAxial(i);
    owned.push({ x: axial.x, y: axial.y });
  }
  return computeHexBoundary(owned);
}
