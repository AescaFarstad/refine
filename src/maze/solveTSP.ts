/**
 * DP solver for shortest Hamiltonian path starting at node 0.
 * - Input: square distance matrix `dist` of size N x N
 * - Constraints: up to N = 13 (start + 12 keys)
 * - Node 0 is the fixed start; distances to node 0 are ignored (never revisited)
 * - If any needed distance is -1 (unreachable), returns null
 * - Returns minimal cost and the visiting order (including 0 at start)
 */

export interface TSPResult {
  cost: number;
  path: number[]; // sequence of node indices, starts at 0, visits all others once
}

/**
 * Computes the optimal path cost to visit all nodes starting from 0 exactly once (no return to 0).
 * Returns null if any required distance is unreachable or if the matrix is invalid.
 */
export function solveTSP(dist: ReadonlyArray<ReadonlyArray<number>>): TSPResult | null {
  const n = dist.length;
  if (n === 0) return null;
  for (let i = 0; i < n; i++) {
    if (dist[i].length !== n) return null; // must be square
  }

  if (n === 1) {
    return { cost: 0, path: [0] };
  }

  // Validate reachability: any distance to non-zero target must be >= 0
  // Distances to 0 are irrelevant because we never revisit 0.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (j === 0) continue; // ignore distances to 0
      const d = dist[i][j];
      if (d < 0 || !isFinite(d)) return null;
    }
  }

  // Keys are nodes 1..n-1. We compute the shortest path starting at 0
  // and visiting all keys exactly once (path ends at any key).
  const m = n - 1; // number of keys
  const fullMask = (1 << m) - 1;

  // dp[mask][kLocal] => minimal cost to reach key (global kLocal+1) having visited keys in `mask` (over 0..m-1)
  // prev[mask][kLocal] => previous node index in global indexing (0..n-1). 0 means start.
  const DP_SIZE = (1 << m) * m;
  const dp = new Float64Array(DP_SIZE);
  const prev = new Int16Array(DP_SIZE);
  for (let i = 0; i < DP_SIZE; i++) {
    dp[i] = Number.POSITIVE_INFINITY;
    prev[i] = -1;
  }

  const idx = (mask: number, kLocal: number) => (mask << 0) * m + kLocal; // linear index

  // Base: from start (0) to each single key
  for (let kLocal = 0; kLocal < m; kLocal++) {
    const g = kLocal + 1; // global index
    const d = dist[0][g];
    if (!(d < 0) && isFinite(d)) {
      const mask = 1 << kLocal;
      dp[idx(mask, kLocal)] = d;
      prev[idx(mask, kLocal)] = 0; // came from start
    }
  }

  // Transitions
  for (let mask = 1; mask <= fullMask; mask++) {
    for (let lastLocal = 0; lastLocal < m; lastLocal++) {
      if (((mask >> lastLocal) & 1) === 0) continue; // last not in mask
      const lastIndex = idx(mask, lastLocal);
      const curCost = dp[lastIndex];
      if (!isFinite(curCost)) continue;

      // Try to extend to any next key not in mask
      for (let nextLocal = 0; nextLocal < m; nextLocal++) {
        if (((mask >> nextLocal) & 1) !== 0) continue; // already visited
        const fromG = lastLocal + 1; // global index of 'last'
        const toG = nextLocal + 1;  // global index of 'next'
        const w = dist[fromG][toG];
        if (w < 0 || !isFinite(w)) continue; // unreachable edge
        const nMask = mask | (1 << nextLocal);
        const nIndex = idx(nMask, nextLocal);
        const cand = curCost + w;
        if (cand < dp[nIndex]) {
          dp[nIndex] = cand;
          prev[nIndex] = fromG;
        }
      }
    }
  }

  // Select best ending key (no return to start)
  let bestCost = Number.POSITIVE_INFINITY;
  let bestLastLocal = -1;
  for (let kLocal = 0; kLocal < m; kLocal++) {
    const cost = dp[idx(fullMask, kLocal)];
    if (cost < bestCost) {
      bestCost = cost;
      bestLastLocal = kLocal;
    }
  }
  if (!isFinite(bestCost) || bestLastLocal < 0) return null;

  // Reconstruct path: start (0) -> ...keys...
  const path: number[] = [];
  let mask = fullMask;
  let curLocal = bestLastLocal;
  // collect keys in reverse order (end -> start)
  while (true) {
    const p = prev[idx(mask, curLocal)];
    const curGlobal = curLocal + 1;
    path.push(curGlobal);
    if (p === 0) break; // reached start
    // step back
    mask &= ~(1 << curLocal);
    curLocal = (p - 1) as number; // previous key local index
  }
  path.reverse();
  path.unshift(0);

  return { cost: bestCost, path };
}

export default solveTSP;

