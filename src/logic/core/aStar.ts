class PriorityQueue<T> {
  private elements: { element: T; priority: number }[] = [];

  enqueue(element: T, priority: number): void {
    this.elements.push({ element, priority });
    this.elements.sort((a, b) => a.priority - b.priority);
  }

  dequeue(): T | undefined {
    return this.elements.shift()?.element;
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  clear(): void {
    this.elements.length = 0;
  }
}

// Global debug state - reused across A* calls for performance and debugging
const globalOpenSet = new PriorityQueue<any>();
const globalCameFrom = new Map<any, any>();
const globalGScore = new Map<any, number>();
const globalFScore = new Map<any, number>();
const globalExplored = new Set<any>();

// Export debug state for external inspection
export const aStarDebugState = {
  explored: globalExplored,
  gScores: globalGScore,
  fScores: globalFScore,
  cameFrom: globalCameFrom
};

export function aStar<T>(
  start: T,
  goal: T,
  getNeighbors: (node: T) => T[],
  getCost: (a: T, b: T) => number,
  heuristic: (node: T) => number
): T[] | null {
  // Clear global state at start of each call
  globalOpenSet.clear();
  globalCameFrom.clear();
  globalGScore.clear();
  globalFScore.clear();
  globalExplored.clear();

  globalOpenSet.enqueue(start, 0);
  globalGScore.set(start, 0);
  globalFScore.set(start, heuristic(start));

  while (!globalOpenSet.isEmpty()) {
    const current = globalOpenSet.dequeue();

    if (current === undefined) {
      break;
    }

    globalExplored.add(current);

    if (current === goal) {
      const path: T[] = [current];
      let temp = current;
      while (globalCameFrom.has(temp)) {
        temp = globalCameFrom.get(temp)!;
        path.unshift(temp);
      }
      return path;
    }

    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      const tentativeGScore = globalGScore.get(current)! + getCost(current, neighbor);

      if (!globalGScore.has(neighbor) || tentativeGScore < globalGScore.get(neighbor)!) {
        globalCameFrom.set(neighbor, current);
        globalGScore.set(neighbor, tentativeGScore);
        globalFScore.set(neighbor, tentativeGScore + heuristic(neighbor));
        globalOpenSet.enqueue(neighbor, globalFScore.get(neighbor)!);
      }
    }
  }

  return null;
} 