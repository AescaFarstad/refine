import Perks from './Perks';

export function getEffectiveLootVolume(perks: readonly string[], volume: number): number {
  if (perks.includes(Perks.TETRIS_LEGACY)) {
    return Math.max(1, volume - 1);
  }
  return volume;
}
