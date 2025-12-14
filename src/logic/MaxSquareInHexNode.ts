import type { Point2 } from './ItemLib';
import { axialToPixel, pixelToAxial } from './HexMath';

export interface MaxSquareResult {
  center: Point2;
  side: number;
}

function makeKey(p: Point2): string {
  return `${p.x},${p.y}`;
}

/**
 * Compute the largest axis-aligned square that fits entirely inside
 * the union of hex cells making up a node.
 *
 * - Input: axial coordinates of all cells that belong to the node.
 * - Output: square center and side length, in a normalized pixel space
 *   where hexSize = 1 and origin = { x: 0, y: 0 }.
 *
 * Callers can scale the result by the actual hexSize and add an origin
 * offset to map into canvas space.
 */
export function computeMaxSquareForHexNode(cells: Point2[]): MaxSquareResult | null {
  if (!cells || cells.length === 0) return null;

  const HEX_SIZE_UNIT = 1;
  const origin: Point2 = { x: 0, y: 0 };

  const cellSet = new Set<string>();
  for (const c of cells) {
    cellSet.add(makeKey(c));
  }

  // Compute a loose bounding box around the union of hexes.
  // We treat each hex as having radius == HEX_SIZE_UNIT.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const c of cells) {
    const center = axialToPixel(c, HEX_SIZE_UNIT, origin);
    const radius = HEX_SIZE_UNIT;
    if (center.x - radius < minX) minX = center.x - radius;
    if (center.x + radius > maxX) maxX = center.x + radius;
    if (center.y - radius < minY) minY = center.y - radius;
    if (center.y + radius > maxY) maxY = center.y + radius;
  }

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return null;
  }

  const widthSpan = maxX - minX;
  const heightSpan = maxY - minY;
  if (widthSpan <= 0 || heightSpan <= 0) {
    return null;
  }

  // Choose a sampling step so we get a reasonable resolution across a hex.
  // Target ~8 samples across a hex diameter, but clamp overall grid size.
  const targetSamplesPerDiameter = 8;
  const approxDiameter = HEX_SIZE_UNIT * 2;
  let step = approxDiameter / targetSamplesPerDiameter; // ~0.25 for hexSize=1

  // Clamp grid dimensions to avoid excessive work on very large nodes.
  const maxGridSize = 96;
  const approxWidth = widthSpan / step;
  const approxHeight = heightSpan / step;
  const scale =
    Math.max(approxWidth / maxGridSize, approxHeight / maxGridSize, 1);
  step *= scale;

  const gridWidth = Math.max(1, Math.ceil(widthSpan / step));
  const gridHeight = Math.max(1, Math.ceil(heightSpan / step));

  const grid = new Uint8Array(gridWidth * gridHeight);

  // Fill occupancy grid: 1 if the sample point lies inside any node cell,
  // 0 otherwise. We do this by mapping the sample point back to axial
  // coordinates and checking membership in the node's cell set.
  for (let row = 0; row < gridHeight; row++) {
    const sampleY = minY + (row + 0.5) * step;
    for (let col = 0; col < gridWidth; col++) {
      const sampleX = minX + (col + 0.5) * step;
      const axial = pixelToAxial({ x: sampleX, y: sampleY }, HEX_SIZE_UNIT, origin);
      if (cellSet.has(makeKey(axial))) {
        grid[row * gridWidth + col] = 1;
      }
    }
  }

  // Dynamic programming to find the largest all-1 square in the occupancy grid.
  const dp = new Uint16Array(gridWidth * gridHeight);
  let bestSize = 0;
  let bestRow = 0;
  let bestCol = 0;

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const idx = row * gridWidth + col;
      if (grid[idx] === 0) {
        dp[idx] = 0;
        continue;
      }

      if (row === 0 || col === 0) {
        dp[idx] = 1;
      } else {
        const up = dp[(row - 1) * gridWidth + col];
        const left = dp[row * gridWidth + (col - 1)];
        const upLeft = dp[(row - 1) * gridWidth + (col - 1)];
        const value = 1 + Math.min(up, left, upLeft);
        dp[idx] = value;
      }

      if (dp[idx] > bestSize) {
        bestSize = dp[idx];
        bestRow = row;
        bestCol = col;
      }
    }
  }

  if (bestSize === 0) {
    return null;
  }

  const squareSide = bestSize * step;
  const topRow = bestRow - bestSize + 1;
  const leftCol = bestCol - bestSize + 1;

  const centerX = minX + (leftCol + bestSize / 2) * step;
  const centerY = minY + (topRow + bestSize / 2) * step;

  return {
    center: { x: centerX, y: centerY },
    side: squareSide,
  };
}

