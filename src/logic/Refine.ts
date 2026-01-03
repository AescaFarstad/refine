import type { Lib } from './Lib';
import type { Essence } from './ItemLib';

export function computeLoadedEssencesFromItems(lib: Lib, items: Array<{ id: string; quantity: number }>): Essence {
  const totals: Essence = {};
  for (const it of items) {
    const def = lib.getItem(it.id);
    for (const k of Object.keys(def.essence)) {
      totals[k] = (totals[k] || 0) + def.essence[k]! * it.quantity;
    }
  }
  return totals;
}
