export interface ShardDisplayInfo {
  symbol: string;
  color: string;
}

export function getShardDisplay(resource: string): ShardDisplayInfo {
  switch (resource) {
    case 'credits':
      return { symbol: '✦', color: '#f56565' }; // red-ish
    case 'chronotraces':
      return { symbol: '⧖', color: '#4299e1' }; // blue-ish
    case 'timeFlux':
      return { symbol: '∿', color: '#48bb78' }; // green-ish
    case 'shards':
      return { symbol: '⌁', color: '#fbbf24' }; // golden-ish
    default:
      return { symbol: '?', color: '#fff' };
  }
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
