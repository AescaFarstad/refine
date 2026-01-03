import type { ActiveRaid } from './GameState';
import { MIN_WALK_SPEED } from './GameState';
import type { WalkEncounterLogEntry } from './RaidLog';

function speedKmH(hp: number, maxHp: number, baseSpeed: number, speedBonusPct: number, speedBonusFlat: number, weight: number, maxWeight: number): number {
  const hpM = Math.max(0, hp) / Math.max(1e-9, maxHp);
  const wM = Math.max(0, maxWeight - weight) / Math.max(1e-9, maxWeight);
  // Treat MIN_WALK_SPEED as an unscaled baseline: only the portion above MIN scales with weight.
  const baseExcess = Math.max(0, Math.max(MIN_WALK_SPEED, baseSpeed) - MIN_WALK_SPEED);
  const scaledExcess = baseExcess * hpM * wM * (1 + speedBonusPct / 100);
  return Math.max(MIN_WALK_SPEED, MIN_WALK_SPEED + scaledExcess + speedBonusFlat + MIN_WALK_SPEED * speedBonusPct / 100);
}

export function handleWalkEncounter(r: ActiveRaid): WalkEncounterLogEntry {
  const hpBefore = r.hp;
  const kmh = speedKmH(r.hp, r.maxHp, r.baseSpeed, r.speedBonusPct, r.speedBonusFlat, r.weight, r.maxWeight);
  const sec = Math.round(3600 / Math.max(MIN_WALK_SPEED, kmh));
  // Regenerate only if missing HP and never exceed max
  const missing = Math.max(0, (r.maxHp || 0) - (r.hp || 0));
  const regen = Math.max(0, r.regenPerKm || 0);
  const healed = Math.min(regen, missing);
  r.hp = r.hp + healed;
  return { kind: 'WalkEncounter', hpBefore, hpAfter: r.hp, timeSpentSec: sec, elapsedTotalSec: 0, speedKmH: kmh };
}
