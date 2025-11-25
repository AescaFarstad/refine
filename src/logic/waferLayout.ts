// Wafer layout configuration for built-in cell buffs.
// Buffs are defined per axial coordinate (x = q, y = r) and only affect
// standard essences (red/green/blue) when computing effective totals.

export interface WaferBuffCell {
  x: number;
  y: number;
  add?: number;
  mul?: number;
}

export const waferBuffCells: WaferBuffCell[] = [
  // Center ring — mild additive buffs
  { x: 0, y: 0, add: 1 }, // +1

  // Horizontal neighbors — stronger additive buffs
  { x: 1, y: 0, add: 2 }, // +2
  { x: -1, y: 0, add: 2 }, // +2

  // Vertical neighbors — strongest additive buffs
  { x: 0, y: 1, add: 3 }, // +3
  { x: 0, y: -1, add: 3 }, // +3

  // Diagonal cells — multiplicative buffs
  { x: 1, y: -1, mul: 2 }, // x2
  { x: -1, y: 1, mul: 2 }, // x2
];

interface InternalBuff {
  add: number;
  mul: number;
}

const buffMap: Record<string, InternalBuff> = {};

for (const cell of waferBuffCells) {
  const key = `${cell.x},${cell.y}`;
  buffMap[key] = {
    add: cell.add ?? 0,
    mul: cell.mul ?? 1,
  };
}

export interface WaferBuff {
  additive: number;
  multiplier: number;
}

export function getWaferBuffAt(x: number, y: number): WaferBuff {
  const key = `${x},${y}`;
  const buff = buffMap[key];
  if (!buff) {
    return { additive: 0, multiplier: 1 };
  }
  return {
    additive: buff.add,
    multiplier: buff.mul,
  };
}
