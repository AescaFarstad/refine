import type { MazeDefinition } from "../logic/MazeLib";
import type { Point2 } from "../logic/core/math";
import SeededRandom from "../logic/core/SeededRandom";
import { solveTSP, type TSPResult } from "./solveTSP";
import { slidingBFS } from "./IceMazeBFS";

export interface GeneratedLayout {
  spawn: Point2;
  keys: Array<Point2>;
  fill: Array<Point2>;
  tsp?: TSPResult | null;
}

// Scratch buffers reused across functions (avoid hot path allocations)
const scratchCoords: Array<Point2> = [];

function idx(x: number, y: number, w: number) { return y * w + x; }

// Local helper: compute tile distance along the minimal-moves path between two points
// Uses a BFS over sliding moves (same rules as slidingBFS) while storing parents
// Then sums Manhattan distances between consecutive slide endpoints to get tile distance.
function slideDestIndexLocal(k: number, dx: number, dy: number, w: number, mask: Uint8Array): number {
  let x = k % w;
  let y = (k / w) | 0;
  let nx = x + dx;
  let ny = y + dy;
  if (mask[idx(nx, ny, w)]) return -1; // blocked immediately
  while (!mask[idx(nx, ny, w)]) {
    nx += dx;
    ny += dy;
  }
  nx -= dx;
  ny -= dy;
  return idx(nx, ny, w);
}

function tileEdgeLength(i: number, j: number, w: number): number {
  const x1 = i % w; const y1 = (i / w) | 0;
  const x2 = j % w; const y2 = (j / w) | 0;
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

function computeTileDistanceAlongMinMovesPath(
  w: number,
  h: number,
  mask: Uint8Array,
  from: Point2,
  to: Point2,
): number {
  const n = w * h;
  const dist = new Int32Array(n);
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) { dist[i] = -1; parent[i] = -1; }

  const q = new Int32Array(n);
  let head = 0, tail = 0;

  const si = idx(from.x | 0, from.y | 0, w);
  const ti = idx(to.x | 0, to.y | 0, w);
  if (mask[si] || mask[ti]) return -1; // invalid endpoints

  dist[si] = 0;
  q[tail++] = si;

  const dirs = [0, -1, -1, 0, 0, 1, 1, 0];
  while (head < tail) {
    const cur = q[head++];
    if (cur === ti) break;
    const base = dist[cur] + 1;
    for (let d = 0; d < 8; d += 2) {
      const toIdx = slideDestIndexLocal(cur, dirs[d], dirs[d + 1], w, mask);
      if (toIdx < 0) continue;
      if (dist[toIdx] !== -1) continue;
      dist[toIdx] = base;
      parent[toIdx] = cur;
      q[tail++] = toIdx;
    }
  }

  if (dist[ti] < 0) return -1; // unreachable

  // Sum tile distance along reconstructed path (terminal cells only)
  let sum = 0;
  let v = ti;
  while (v !== si) {
    const u = parent[v];
    if (u < 0) break; // safety
    sum += tileEdgeLength(u, v, w);
    v = u;
  }
  return sum;
}

function makeObstacleMask(w: number, h: number, fill: Array<Point2>): Uint8Array {
  const mask = new Uint8Array(w * h);
  // implicit borders
  for (let x = 0; x < w; x++) { mask[idx(x, 0, w)] = 1; mask[idx(x, h - 1, w)] = 1; }
  for (let y = 0; y < h; y++) { mask[idx(0, y, w)] = 1; mask[idx(w - 1, y, w)] = 1; }
  for (const p of fill) {
    if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h) mask[idx(p.x, p.y, w)] = 1;
  }
  return mask;
}

function isCornerCell(x: number, y: number, w: number, h: number, mask: Uint8Array): boolean {
  const i = idx(x, y, w);
  if (mask[i]) return false; // must be free
  // neighbors: up, left, down, right
  const n = [idx(x, y - 1, w), idx(x - 1, y, w), idx(x, y + 1, w), idx(x + 1, y, w)];
  let count = 0;
  let hasUp = false, hasLeft = false, hasDown = false, hasRight = false;
  if (mask[n[0]]) { count++; hasUp = true; }
  if (mask[n[1]]) { count++; hasLeft = true; }
  if (mask[n[2]]) { count++; hasDown = true; }
  if (mask[n[3]]) { count++; hasRight = true; }
  if (count !== 2) return false;
  // not opposite
  const opposite = (hasUp && hasDown) || (hasLeft && hasRight);
  return !opposite;
}

function collectReachable(w: number, h: number, dist: Int32Array): Array<Point2> {
  scratchCoords.length = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dist[idx(x, y, w)] >= 0) scratchCoords.push({ x, y });
    }
  }
  return scratchCoords.slice();
}

function maxDistanceCells(w: number, h: number, dist: Int32Array): Array<Point2> {
  let maxD = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = dist[idx(x, y, w)];
      if (d > maxD) maxD = d;
    }
  }
  scratchCoords.length = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = dist[idx(x, y, w)];
      if (d === maxD) scratchCoords.push({ x, y });
    }
  }
  return scratchCoords.slice();
}

function randomChoice<T>(rng: SeededRandom, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng.get_in_range(0, arr.length))];
}

function generateObstacleLayout(w: number, h: number, rng: SeededRandom): Array<Point2> {
  // Simple deterministic random fill: ~12% of interior cells
  const fill: Array<Point2> = [];
  const density = 0.12;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // avoid clustering borders too much
      if (rng.get() < density) fill.push({ x, y });
    }
  }
  return fill;
}

export function generateIceMaze(def: MazeDefinition, baseSeed: number): GeneratedLayout {
  const w = Math.max(3, def.x | 0);
  const h = Math.max(3, def.y | 0);
  const maxLevelAttempts = 100;
  const minLevelAttempts = 10;
  const minStartAttempts = 5;

  let successes = 0;
  let attempts = 0;
  let bestByError: { layout: GeneratedLayout; err: number; cost: number } | null = null;

  while (attempts < maxLevelAttempts) {
    const levelSeed = (baseSeed | 0) + attempts * 1000;
    const rng = new SeededRandom(levelSeed);
    attempts++;

    // Regenerate obstacle layout
    const fill = generateObstacleLayout(w, h, rng);
    const mask = makeObstacleMask(w, h, fill);

    // Find corner cells
    const corners: Array<Point2> = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (isCornerCell(x, y, w, h, mask)) corners.push({ x, y });
      }
    }
    // console.log(`Corners: ${corners.length}`);
    const cornerReach: number[] = [];
    let bestCornerIndex = -1;
    let bestReach = -1;
  for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      const dist = slidingBFS(w, h, mask, [c]);
      let count = 0;
      for (let k = 0; k < dist.length; k++) if (dist[k] >= 0) count++;
      cornerReach.push(count);
      if (count > bestReach) { bestReach = count; bestCornerIndex = i; }
    }

    if (bestCornerIndex < 0 || bestReach < Math.max(0, def.minReachable | 0)) {
      // Discard layout and retry
      continue;
    }
    console.log(`Chosen corner=${bestCornerIndex}, reachable=${bestReach}`);

    // Try several starting positions from chosen corner reachable set
    let bestStartThisLayout: { layout: GeneratedLayout; err: number; cost: number } | null = null;
    let startAttempts = 0;
    const corner = corners[bestCornerIndex];
    const cornerDist = slidingBFS(w, h, mask, [corner]);
    const reachable = collectReachable(w, h, cornerDist);
    while (startAttempts < Math.max(minStartAttempts, 5)) {
      startAttempts++;
      if (!reachable.length) {
        //  console.log(`Start attempt ${startAttempts}: failed (unreachable)`); 
        continue;
      }
      const start = randomChoice(rng, reachable);

      // Place keys greedily
      const keys: Array<Point2> = [];
      let ok = true;
      for (let i = 0; i < Math.max(1, Math.min(12, def.keyNum | 0)); i++) {
        const sources = i === 0 ? [start] : [start, ...keys];
        const dist = slidingBFS(w, h, mask, sources);
        const farCells = maxDistanceCells(w, h, dist).filter(p => !(p.x === start.x && p.y === start.y) && keys.findIndex(k => k.x === p.x && k.y === p.y) < 0);
        if (!farCells.length) { ok = false; break; }
        keys.push(randomChoice(rng, farCells));
      }

      if (!ok) {
        // console.log(`Start attempt ${startAttempts}: failed (placement conflict)`);
        continue;
      }

      // Distance matrix for [start, ...keys]
      const nodes = [start, ...keys];
      const distMat: number[][] = nodes.map(() => nodes.map(() => 0));
      let unreachable = false;
      for (let i = 0; i < nodes.length; i++) {
        const di = slidingBFS(w, h, mask, [nodes[i]]);
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const d = di[idx(nodes[j].x, nodes[j].y, w)];
          distMat[i][j] = d;
          if (j !== 0 && (d < 0 || !isFinite(d))) unreachable = true; // distances to 0 ignored by solver
        }
      }
      if (unreachable) {
        // console.log(`Start attempt ${startAttempts}: failed (TSP unreachable)`);
        continue;
      }

      const tsp = solveTSP(distMat);
      if (!tsp) {
        // console.log(`Start attempt ${startAttempts}: failed (TSP fail)`);
        continue;
      }

      const cost = tsp.cost | 0;
      const err = Math.abs(cost - (def.optimumScore | 0));
      // console.log(`Start attempt ${startAttempts}: success (cost=${cost}, err=${err})`);
      const layout: GeneratedLayout = { spawn: start, keys, fill, tsp };
      if (!bestStartThisLayout || err < bestStartThisLayout.err || (err === bestStartThisLayout.err && cost < bestStartThisLayout.cost)) {
        bestStartThisLayout = { layout, err, cost };
      }
    }

    if (bestStartThisLayout) {
      successes++;
      if (!bestByError || bestStartThisLayout.err < bestByError.err || (bestStartThisLayout.err === bestByError.err && bestStartThisLayout.cost < bestByError.cost)) {
        bestByError = bestStartThisLayout;
      }
    }

    if (attempts >= minLevelAttempts && successes >= 2) break;
  }

  if (!bestByError) {
    throw new Error(`IceMazeGen: failed to generate level after ${attempts} attempts`);
  }

  const sel = bestByError.layout;
  // Additionally compute and log tile-distance of the chosen optimal-moves path
  let tileCost = -1;
  if (sel.tsp && sel.tsp.path && sel.tsp.path.length > 1) {
    const mask = makeObstacleMask(w, h, sel.fill);
    const nodes = [sel.spawn, ...sel.keys];
    let acc = 0;
    for (let i = 0; i < sel.tsp.path.length - 1; i++) {
      const a = nodes[sel.tsp.path[i]];
      const b = nodes[sel.tsp.path[i + 1]];
      const d = computeTileDistanceAlongMinMovesPath(w, h, mask, a, b);
      if (d < 0) { acc = -1; break; }
      acc += d;
    }
    tileCost = acc;
  }
  console.log(`Selected layout: cost=${bestByError.cost}, err=${bestByError.err}, tiles=${tileCost}, attempts=${attempts}, successes=${successes}`);
  return sel;
}

export default generateIceMaze;
