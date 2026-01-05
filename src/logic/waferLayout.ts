// Wafer layout configuration for built-in cell buffs.
// Buffs are defined per axial coordinate (x = q, y = r) and apply to the same
// essence-count mechanic as yellow/orange adjacency buffs.

export interface WaferBuffCell {
  x: number;
  y: number;
  add?: number;
  mul?: number;
}

export const waferBuffCells: WaferBuffCell[] = [
  { x: 0, y: 3, add: 1 },
  { x: 0, y: -3, add: 1 },

  { x: 3, y: -2, add: 1 },
  { x: -3, y: 2, add: 1 },
  { x: 2, y: 2, add: 2 },
  { x: -2, y: -2, add: 2 },

  { x: 1, y: -4, mul: 2 },
  { x: 4, y: -4, mul: 2 },
  { x: 4, y: 0, mul: 2 },
  { x: -4, y: 0, mul: 2 },
  { x: -1, y: 4, mul: 2 },
  { x: -4, y: 4, mul: 2 },

  { x: 5, y: -2, add: 3 },
  { x: -5, y: 2, add: 3 },
  { x: 1, y: 4, add: 3 },
  { x: -1, y: -4, add: 3 },
  { x: -3, y: 5, add: 2 },
  { x: 3, y: -5, add: 2 },
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
