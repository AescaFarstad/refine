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
    default:
      return { symbol: '?', color: '#fff' };
  }
}

export function calculateShardFontSize(amount: number): number {
  return Math.round(((amount + 11) / 2) * 3);
}
