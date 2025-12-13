import type { Lib } from './Lib';
import type { Essence } from './ItemLib';

export function computeLoadedEssencesFromItems(lib: Lib, items: Array<{ id: string; quantity: number }>): Essence {
  const totals: Essence = {};
  for (const it of items || []) {
    const def = lib.items.get(it.id);
    if (!def) continue;
    const ess = def.essence || {};
    const q = Math.max(1, it.quantity || 1);
    for (const k of Object.keys(ess)) {
      const v = (ess as any)[k] || 0;
      (totals as any)[k] = ((totals as any)[k] || 0) + v * q;
    }
  }
  return totals;
}
