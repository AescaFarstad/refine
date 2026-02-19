Ice Maze Level Generation — clarified and finalized

Goal: deterministically generate a level layout that consists of a spawn point, key points, and an explicit obstacle layout, then score it via the shortest visit of all keys under ice-sliding movement.

Implementation lives in a new module IceMazeGen.ts, with a DP solver in solveTSP.ts. Logging goes to console only (exact items listed below). Loggins should be text based.

Search space and attempts
- Two-level search per level:
  1) Regenerate entire obstacle layout ("level attempt").
  2) For the chosen layout, try different starting cells ("start attempt").
- Minimum attempts: at least 10 level attempts; for the best layout, at least 5 start attempts.
- Success criteria: a successful attempt is one where a full route that visits all keys exists (TSP cost is finite).
- Hard upper bound: 100 level attempts. Hitting this bound without meeting success criteria is a fatal error.

Determinism and seeding
- The generator must be fully seedable. Use the provided seed as the base; derive per-attempt seeds deterministically (e.g., baseSeed + attemptIndex * 1000) so runs are repeatable.

Resulting configuration
- The resulting level configuration is exactly:
  - spawn: starting cell (Point2)
  - keys: array of key cells (Point2[])
  - fill: full obstacle layout (Point2[]), excluding the implicit border walls
- These three are authoritative; runtime must not introduce additional random obstacles.

MazeDefinition and settings (no backwards compatibility)
- MazeDefinition is updated to support generation inputs and store the resulting layout:
  interface MazeDefinition {
    id: string;
    name: string;
    x: number; y: number;
    // Generator inputs
    keyNum: number;           // 1..12 (max keys is 12)
    minReachable: number;     // minimum reachable cells from the best corner
    optimumScore: number;     // desired optimal total moves for scoring
    // Enemy/artefact settings still supported
    spawnProbability?: number;
    maxDemons?: number;
    artefacts?: Array<{ type: 'BOMB'|'EYE'|'FREEZE'; x: number; y: number }>;
    // Generator output (authoritative layout used for play)
    spawn: Point2;
    keys: Array<Point2>;
    fill: Array<Point2>;
  }

- ChaseSettings is refactored to consume the generated layout directly (no random obstacles):
  interface ChaseSettings {
    seed: number;
    x: number; y: number;
    spawn: Point2;
    keys: Array<Point2>;
    spawnProbability: number;
    maxDemons: number;
    artefacts: Array<{ type: number; x: number; y: number }>; // numeric enum for runtime
    fill: Array<Point2>;                     // all interior obstacles
  }

Corner cells and reachability
- Corner cell definition: a non-obstacle cell whose 4-neighborhood has exactly two obstacle neighbors that are not opposite directions (e.g., (-1,0) and (0,1) are allowed; (-1,0) and (1,0) are opposite and not allowed).
- We are guaranteed such cells exist on any non-degenerate level with interior obstacles and border walls.
- For each corner cell, run flood fill (multi-source BFS over ice-slide moves) to compute the number of reachable cells and their distances (in moves).
- Log: total corner cell count; for each corner, the number of reachable cells.
- Pick the corner with the greatest number of reachable cells; require this to be ≥ minReachable; otherwise discard the layout and regenerate (new level attempt).

Flood fill (sliding BFS)
- Movement model: each move is a full ice slide to the last free cell before an obstacle, identical to the in-game step. Distance is the number of slides, not traversed tiles.
- Inputs: array of starting cells. Output: a grid of distances in moves (number ≥ 0) or -1 for unreachable.
- Procedure:
  1) Allocate a single 2D distance grid initialized to -1; set all starting cells to 0 and push them into the frontier.
  2) While the frontier is not empty, expand by one move in all four directions: next cells are determined by sliding to the terminal cell; if a cell’s distance is -1, set it to currentDepth + 1 and push to the next frontier.
  3) Advance to the next frontier; repeat until empty.
- Multi-source property: Starting from {start} gives distances from start. Starting from {start, key1, key2, ...} yields per-cell distance = min(distance to any of those sources), which we use for “furthest from start and all keys”. This naturally follows from the implementation.

Picking the starting cell and placing keys
- Starting cell selection (start attempts): pick a random reachable cell from the chosen corner’s reachable set.
- Place keys greedily:
  1) Run flood fill from {start}. Place Key 1 at a random cell among those with the maximum distance.
  2) For Key i>1, run flood fill from the multi-source set {start, keysPlaced...}. Place Key i at a random cell among those with the maximum distance under that fill.
- If any key would overlap an existing key or cannot be placed (e.g., no reachable candidates), the start attempt fails; try a different starting cell. If start attempts are exhausted, regenerate the level.

Distance matrix and TSP
- After placing all keys, build a distance matrix over nodes [start, key1, key2, ...] using the flood fill routine (run once per node as the source).
- Use a DP solver solveTSP.ts that computes the shortest path that starts at index 0 (start) and visits all keys exactly once. Index 0 is considered visited at the start, so it will not be revisited; distances to 0 are irrelevant.
- If any node is unreachable from another (distance = -1), the attempt fails.

Scoring and selection
- Total distance = TSP optimal cost in moves.
- Error score = |total distance - optimumScore| (difference between optimum score and total distance).
- For each level attempt, choose the best start attempt by the least error score (ties can be broken by smaller total distance then random).
- Continue level attempts until both are satisfied: (1) at least 2 successful level attempts exist and (2) at least 10 level attempts have been made. Stop earlier only on fatal error (see bound below).
- Hard upper bound: 100 level attempts. Reaching 100 without meeting success criteria is a fatal error; throw/abort and log an error.

Logging (console only)
- Corner summary: number of corner cells; for each corner, its reachable count.
- Selection: the chosen corner index and its reachable count; for each start attempt, whether it succeeded or failed (and high-level reason on failure: unreachable/TSP fail/placement conflict).
- Final: selected layout’s total distance and error score; overall attempts and successes.
- Do not log anything else except errors where relevant.

Performance guidelines (minimize dynamic allocations)
- Hot paths (flood fills, neighbor generation, scoring) should avoid per-iteration allocations. Reuse buffers and scratch arrays.
- For each function that needs scratch state, declare its reusable arrays/points immediately above the function (module-scoped), give them descriptive names, and ensure they are only used by that function.
- Use preallocated typed arrays for distance grids where appropriate (e.g., Int16Array/Int32Array sized x*y). Reinitialize in-place.

Notes and constraints
- Max keys is 12. The DP TSP solver must handle up to 13 nodes (start + 12 keys).
- The generator output (spawn, keys, fill) is the source of truth for runtime. ChaseSettings consumes these directly; do not add random obstacles at runtime.
- Artefacts, demons, and other gameplay parameters are orthogonal to generation and are preserved.

Example (TSP input shape)
- With two keys, distances matrix provided to solveTSP.ts is:
  [[0, d(start,key1), d(start,key2)],
   [0, 0,            d(key1,key2)],
   [0, d(key2,key1), 0           ]]
- Starting index is 0; the solver never returns to index 0 once started.

Failure handling
- If keys cannot all be placed or any node is unreachable, the attempt fails gracefully and the search proceeds to the next start attempt or the next level attempt, per the rules above.


Progress:
solveTSP.ts done, not tested