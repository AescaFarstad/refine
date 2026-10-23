import type { ActiveRaid } from './GameState';
import { MIN_WALK_SPEED } from './GameState';
import type { WalkEncounterLogEntry } from './RaidLog';
import { Perks } from './Perks';
import { applySignedHpRegen } from './Regen';

export const AGONY_SPUR_MAX_MULT = 3;

export function hpSpeedMultiplier(hp: number, maxHp: number, perks: readonly string[]): number {
  const hpFrac = Math.max(0, hp) / maxHp;
  if (perks.includes(Perks.AGONY_SPUR)) return 1 + (AGONY_SPUR_MAX_MULT - 1) * (1 - hpFrac);
  if (perks.includes(Perks.PAINKILLER)) return 1;
  return hpFrac;
}

function speedKmH(hpM: number, baseSpeed: number, speedBonusPct: number, speedBonusFlat: number, weight: number, maxWeight: number): number {
  const wM = Math.max(0, maxWeight - weight) / maxWeight;
  // Treat MIN_WALK_SPEED as an unscaled baseline: only the portion above MIN scales with weight.
  const baseExcess = Math.max(0, baseSpeed - MIN_WALK_SPEED);
  const scaledExcess = baseExcess * hpM * wM * (1 + speedBonusPct / 100);
  return Math.max(MIN_WALK_SPEED, MIN_WALK_SPEED + scaledExcess + speedBonusFlat + MIN_WALK_SPEED * speedBonusPct / 100);
}

export function handleWalkEncounter(r: ActiveRaid): WalkEncounterLogEntry {
  const hpBefore = r.hp;
  const hasPainkiller = r.perks.includes(Perks.PAINKILLER) || r.perks.includes(Perks.AGONY_SPUR);
  const kmh = speedKmH(hpSpeedMultiplier(r.hp, r.maxHp, r.perks), r.baseSpeed, r.speedBonusPct, r.speedBonusFlat, r.weight, r.maxWeight);
  // Calculate max speed (at full health) for comparison
  const maxKmh = speedKmH(1, r.baseSpeed, r.speedBonusPct, r.speedBonusFlat, r.weight, r.maxWeight);
  const sec = Math.round(3600 / kmh);
  r.hp = applySignedHpRegen(r.hp, r.maxHp, r.regenPerKm);
  return { kind: 'WalkEncounter', hpBefore, hpAfter: r.hp, timeSpentSec: sec, elapsedTotalSec: 0, currentHp: 0, currentMaxHp: 0, bagsUsed: 0, bagsCapacity: 0, injected: false, timeRegenHpBefore: 0, timeRegenHpAfter: 0, timeRegenDurationSec: 0, speedKmH: kmh, maxSpeedKmH: maxKmh, maxHp: r.maxHp, hasPainkiller, hpHealed: r.hp - hpBefore };
}
