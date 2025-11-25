import type { Point2, Molecule } from './ItemLib';
import { axialNeighbors } from './HexMath';
import { getMoleculeEssences } from './MoleculeUtils';
import { WAFER_HEIGHT, WAFER_WIDTH, WAFER_UPGRADE_BASE_COST } from './Const';

export interface WaferCell {
  x: number; // axial q
  y: number; // axial r
  enabled: boolean; // Is this cell part of the active grid?
  itemIdx: number | null;
  essence: string | null;
  // Effective essence after color-changing atoms are applied; derived each time preview is computed.
  effectiveEssence?: string | null;
  canBeUpgraded: boolean; // Cached: can this cell be enabled?
  signatures: number[];
}

export interface PlacedItem {
  id: string;
  molecule: Molecule;
  rotation: number;
}

export interface Signature {
  cells: Point2[];
  yieldBonus: number;
  speedBonus: number;
  name: string;
  color: string;
}

export interface Wafer {
  // Fixed-size grid centered at ORIGIN
  cells: Map<string, WaferCell>; // Key: "q,r"

  items: PlacedItem[];

  // Derived values
  essenceTotals: Record<string, number>;
  emptyCount: number;
  enabledCount: number;
  signatures: Signature[];
}

const WAFER_ORIGIN_HEIGHT = Math.floor(WAFER_HEIGHT / 2);
const WAFER_ORIGIN_WIDTH = Math.floor(WAFER_WIDTH / 2);

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseKey(key: string): Point2 {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function createWafer(initialRadius: number = 3): Wafer {
  const cells = new Map<string, WaferCell>();

  // Initialize all possible cells (disabled by default)
  for (let q = -WAFER_ORIGIN_WIDTH; q <= WAFER_ORIGIN_WIDTH; q++) {
    for (let r = -WAFER_ORIGIN_HEIGHT; r <= WAFER_ORIGIN_HEIGHT; r++) {
      // Skip cells outside hex bounds
      const s = -q - r;
      if (Math.abs(s) > Math.max(WAFER_ORIGIN_WIDTH, WAFER_ORIGIN_HEIGHT)) continue;

      const enabled = (Math.abs(q) <= initialRadius && Math.abs(r) <= initialRadius && Math.abs(s) <= initialRadius);

      cells.set(cellKey(q, r), {
        x: q,
        y: r,
        enabled,
        itemIdx: null,
        essence: null,
        effectiveEssence: null,
        canBeUpgraded: false,
        signatures: [],
      });
    }
  }

  const wafer: Wafer = {
    cells,
    items: [],
    essenceTotals: {},
    emptyCount: 0,
    enabledCount: 0,
    signatures: [],
  };

  updateDerivedValues(wafer);
  return wafer;
}

export function getCell(wafer: Wafer, pos: Point2): WaferCell | undefined {
  return wafer.cells.get(cellKey(pos.x, pos.y));
}

export function isInBounds(pos: Point2): boolean {
  const s = -pos.x - pos.y;
  return (
    Math.abs(pos.x) <= WAFER_ORIGIN_WIDTH &&
    Math.abs(pos.y) <= WAFER_ORIGIN_HEIGHT &&
    Math.abs(s) <= Math.max(WAFER_ORIGIN_WIDTH, WAFER_ORIGIN_HEIGHT)
  );
}

export function canPlaceMolecule(wafer: Wafer, molecule: Molecule, validOnly: boolean = true): boolean {
  const positions = molecule.atoms.map(a => ({ x: a.x, y: a.y }));

  for (const pos of positions) {
    if (!isInBounds(pos)) return false;

    const cell = getCell(wafer, pos);
    if (!cell) return false;

    if (validOnly && !cell.enabled) return false;

    if (cell.itemIdx !== null) return false;
  }

  return true;
}

export function placeMolecule(
  wafer: Wafer,
  itemId: string,
  molecule: Molecule,
  rotation: number = 0
): boolean {
  if (!canPlaceMolecule(wafer, molecule)) {
    return false;
  }

  const itemIdx = wafer.items.length;
  wafer.items.push({
    id: itemId,
    molecule,
    rotation,
  });

  for (const atom of molecule.atoms) {
    const cell = getCell(wafer, { x: atom.x, y: atom.y });
    if (cell) {
      cell.itemIdx = itemIdx;
      cell.essence = atom.color;
    }
  }

  updateDerivedValues(wafer);
  return true;
}

export function removeMolecule(wafer: Wafer, itemIdx: number): void {
  if (itemIdx < 0 || itemIdx >= wafer.items.length) return;

  const item = wafer.items[itemIdx];

  for (const atom of item.molecule.atoms) {
    const cell = getCell(wafer, { x: atom.x, y: atom.y });
    if (cell && cell.itemIdx === itemIdx) {
      cell.itemIdx = null;
      cell.essence = null;
    }
  }

  // Remove from items array (set to null, don't splice to preserve indices)
  wafer.items[itemIdx] = null as any;

  updateDerivedValues(wafer);
}

export function moveMolecule(wafer: Wafer, itemIdx: number, offset: Point2): boolean {
  if (itemIdx < 0 || itemIdx >= wafer.items.length) return false;

  const item = wafer.items[itemIdx];
  if (!item) return false;

  removeMolecule(wafer, itemIdx);

  const newMolecule: Molecule = {
    atoms: item.molecule.atoms.map(a => ({ ...a, x: a.x + offset.x, y: a.y + offset.y })),
    connections: item.molecule.connections.map(c => ({
      from: { x: c.from.x + offset.x, y: c.from.y + offset.y },
      to: { x: c.to.x + offset.x, y: c.to.y + offset.y },
    })),
  };
  const success = placeMolecule(wafer, item.id, newMolecule, item.rotation);

  if (!success) {
    placeMolecule(wafer, item.id, item.molecule, item.rotation);
    return false;
  }

  return true;
}

export function getEnabledCells(wafer: Wafer): WaferCell[] {
  const enabled: WaferCell[] = [];
  for (const cell of wafer.cells.values()) {
    if (cell.enabled) {
      enabled.push(cell);
    }
  }
  return enabled;
}

export function clearWafer(wafer: Wafer): void {
  wafer.items.length = 0;

  for (const cell of wafer.cells.values()) {
    cell.itemIdx = null;
    cell.essence = null;
    cell.effectiveEssence = null;
    cell.signatures = [];
  }

  wafer.signatures = [];

  updateDerivedValues(wafer);
}

function updateDerivedValues(wafer: Wafer): void {
  const essences: Record<string, number> = {};
  let emptyCount = 0;
  let enabledCount = 0;

  for (const cell of wafer.cells.values()) {
    if (cell.enabled) {
      enabledCount++;

      if (cell.essence) {
        essences[cell.essence] = (essences[cell.essence] || 0) + 1;
      } else {
        emptyCount++;
      }

      cell.canBeUpgraded = false;
    } else {
      // Check if this disabled cell can be upgraded
      const neighbors = axialNeighbors({ x: cell.x, y: cell.y });
      let enabledNeighborCount = 0;
      for (const n of neighbors) {
        const neighborCell = getCell(wafer, n);
        if (neighborCell?.enabled) {
          enabledNeighborCount++;
        }
      }
      cell.canBeUpgraded = enabledNeighborCount >= 2;
    }
  }

  wafer.essenceTotals = essences;
  wafer.emptyCount = emptyCount;
  wafer.enabledCount = enabledCount;
}

export function computeUpgradeableRegion(wafer: Wafer, pos: Point2): Point2[] {
  const startCell = getCell(wafer, pos);
  if (!startCell || startCell.enabled || !startCell.canBeUpgraded) return [];

  const region: Point2[] = [];
  const queue: Point2[] = [pos];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = cellKey(current.x, current.y);

    if (visited.has(key)) continue;
    visited.add(key);

    const currentCell = getCell(wafer, current);
    if (!currentCell || currentCell.enabled || !currentCell.canBeUpgraded) continue;

    region.push({ x: currentCell.x, y: currentCell.y });

    const neighbors = axialNeighbors(current);
    for (const n of neighbors) {
      const nCell = getCell(wafer, n);
      if (nCell && !nCell.enabled && nCell.canBeUpgraded) {
        const nKey = cellKey(n.x, n.y);
        if (!visited.has(nKey)) {
          queue.push(n);
        }
      }
    }
  }

  return region;
}

export function enableCellWithFloodfill(wafer: Wafer, pos: Point2): number {
  const region = computeUpgradeableRegion(wafer, pos);
  if (region.length === 0) return 0;

  for (const p of region) {
    const cell = getCell(wafer, p);
    if (cell && !cell.enabled) {
      cell.enabled = true;
    }
  }

  updateDerivedValues(wafer);
  return region.length;
}

export function computeWaferUpgradePrice(upgradesPurchased: number): number {
  const count = Math.max(0, upgradesPurchased | 0);
  return WAFER_UPGRADE_BASE_COST * (count + 1);
}
