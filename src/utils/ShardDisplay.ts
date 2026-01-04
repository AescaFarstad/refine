import { getResourceSpecByAnyKey } from '../logic/Resources';

export interface ShardDisplayInfo {
  symbol: string;
  color: string;
}

export function getShardDisplay(resource: string): ShardDisplayInfo {
  const spec = getResourceSpecByAnyKey(resource);
  return { symbol: spec.glyph, color: spec.color };
}

export function calculateShardFontSize(amount: number): number {
  if (amount <= 0) return 0;

  const clamped = Math.min(20, Math.max(1, Math.floor(amount)));

  let size: number;
  if (clamped <= 7) {
    size = 3 * clamped + 8;
  } else {
    size = 27 + (clamped - 7) * (20 / 13); // 7 -> 27, 20 -> 47
  }

  return Math.round(size);
}
