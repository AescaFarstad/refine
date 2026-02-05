import type { ActiveRaid } from './GameState';
import { MIN_WALK_SPEED } from './GameState';
import type { WalkEncounterLogEntry } from './RaidLog';
import { Perks } from './Perks';

function speedKmH(hp: number, maxHp: number, baseSpeed: number, speedBonusPct: number, speedBonusFlat: number, weight: number, maxWeight: number, hasPainkiller: boolean): number {
  const hpM = hasPainkiller ? 1 : Math.max(0, hp) / maxHp;
  const wM = Math.max(0, maxWeight - weight) / maxWeight;
  // Treat MIN_WALK_SPEED as an unscaled baseline: only the portion above MIN scales with weight.
  const baseExcess = Math.max(0, baseSpeed - MIN_WALK_SPEED);
  const scaledExcess = baseExcess * hpM * wM * (1 + speedBonusPct / 100);
  return Math.max(MIN_WALK_SPEED, MIN_WALK_SPEED + scaledExcess + speedBonusFlat + MIN_WALK_SPEED * speedBonusPct / 100);
}

export function handleWalkEncounter(r: ActiveRaid): WalkEncounterLogEntry {
  const hpBefore = r.hp;
  const hasPainkiller = r.perks.includes(Perks.PAINKILLER);
  const kmh = speedKmH(r.hp, r.maxHp, r.baseSpeed, r.speedBonusPct, r.speedBonusFlat, r.weight, r.maxWeight, hasPainkiller);
  // Calculate max speed (at full health) for comparison
  const maxKmh = speedKmH(r.maxHp, r.maxHp, r.baseSpeed, r.speedBonusPct, r.speedBonusFlat, r.weight, r.maxWeight, true);
  const sec = Math.round(3600 / kmh);
  // Regenerate only if missing HP and never exceed max
  const missing = Math.max(0, r.maxHp - r.hp);
  const regen = Math.max(0, r.regenPerKm);
  const healed = Math.min(regen, missing);
  r.hp = r.hp + healed;
  return { kind: 'WalkEncounter', hpBefore, hpAfter: r.hp, timeSpentSec: sec, elapsedTotalSec: 0, currentHp: 0, currentMaxHp: 0, bagsUsed: 0, bagsCapacity: 0, injected: false, timeRegenHpBefore: 0, timeRegenHpAfter: 0, timeRegenDurationSec: 0, speedKmH: kmh, maxSpeedKmH: maxKmh, maxHp: r.maxHp, hasPainkiller, hpHealed: healed };
}
