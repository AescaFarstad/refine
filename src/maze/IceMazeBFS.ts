import type { Point2 } from "../logic/core/math";

// Reusable scratch buffers to minimize allocations on hot paths
let distGrid: Int32Array = new Int32Array(0);
let queue: Int32Array = new Int32Array(0);
let gridW = 0;
let gridH = 0;

function ensureCapacity(w: number, h: number) {
  const n = w * h;
  if (distGrid.length !== n) distGrid = new Int32Array(n);
  if (queue.length !== n) queue = new Int32Array(n);
  gridW = w;
  gridH = h;
}

function idx(x: number, y: number, w: number): number { return y * w + x; }

// Compute the terminal cell index when sliding from k in direction (dx,dy).
// Returns -1 if no movement is possible (immediate obstacle)
function slideDestIndex(k: number, dx: number, dy: number, w: number, mask: Uint8Array): number {
  let x = k % w;
  let y = (k / w) | 0;
  let nx = x + dx;
  let ny = y + dy;
  // If immediate neighbor is obstacle, no move
  if (mask[idx(nx, ny, w)]) return -1;
  // Advance until hitting an obstacle, then step back once
  while (!mask[idx(nx, ny, w)]) {
    nx += dx;
    ny += dy;
  }
  nx -= dx;
  ny -= dy;
  return idx(nx, ny, w);
}

/**
 * Multi-source BFS over ice-sliding moves.
 * - Movement: from a cell, each action slides to the terminal free cell in one of 4 directions.
 * - Inputs: width/height, obstacle mask (1 = obstacle, includes border), and sources.
 * - Output: Int32Array distances grid sized w*h with distances in moves; -1 for unreachable.
 */
export function slidingBFS(
  w: number,
  h: number,
  mask: Uint8Array,
  sources: ReadonlyArray<Point2>,
): Int32Array {
  ensureCapacity(w, h);

  // Initialize distances to -1
  const dist = distGrid;
  for (let i = 0, n = w * h; i < n; i++) dist[i] = -1;

  // Seed frontier with valid, non-obstacle sources
  let head = 0;
  let tail = 0;
  for (let s = 0; s < sources.length; s++) {
    const sx = sources[s].x | 0;
    const sy = sources[s].y | 0;
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
    const si = idx(sx, sy, w);
    if (mask[si]) continue; // source is obstacle, skip
    if (dist[si] !== -1) continue; // already queued (dedupe)
    dist[si] = 0;
    queue[tail++] = si;
  }

  // Directions: up, left, down, right
  const dirs = [0, -1, -1, 0, 0, 1, 1, 0]; // pairs (dx,dy)

  // BFS over sliding neighbors
  while (head < tail) {
    const cur = queue[head++];
    const base = dist[cur] + 1;
    for (let d = 0; d < 8; d += 2) {
      const dx = dirs[d];
      const dy = dirs[d + 1];
      const to = slideDestIndex(cur, dx, dy, w, mask);
      if (to < 0) continue; // no move in this direction
      if (dist[to] !== -1) continue; // visited
      dist[to] = base;
      queue[tail++] = to;
    }
  }

  return dist;
}

export default slidingBFS;

