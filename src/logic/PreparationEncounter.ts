import type { ActiveRaid } from './GameState';
import type { PreparationEncounterDef } from './RaidLib';
import type { PreparationEncounterLogEntry } from './RaidLog';

function truncFinite(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export interface GearPreparationPlan {
  gearId: string;
  gearName: string;
  gearImage: string;
  prepTimeSec: number;
  damageBonus: number;
  hpBonus: number;
  blockChanceBonus: number;
}

export function createPreparationEncounter(plan: GearPreparationPlan): PreparationEncounterDef | null {
  const timeSpentSec = Math.max(0, truncFinite(plan.prepTimeSec));
  const damageBonus = truncFinite(plan.damageBonus);
  const hpBonus = truncFinite(plan.hpBonus);
  const blockChanceBonus = truncFinite(plan.blockChanceBonus);
  const hasAnything = timeSpentSec > 0 || damageBonus !== 0 || hpBonus !== 0 || blockChanceBonus !== 0;
  if (!hasAnything) return null;
  return {
    type: 'PreparationEncounter',
    timeSpentSec,
    damageBonus,
    hpBonus,
    blockChanceBonus,
    tacticNames: [plan.gearName],
    gearId: plan.gearId,
    gearImage: plan.gearImage,
  };
}

export function handlePreparationEncounter(_r: ActiveRaid, enc: PreparationEncounterDef): PreparationEncounterLogEntry {
  const timeSpentSec = Math.max(0, truncFinite(enc.timeSpentSec));
  const damageBonus = truncFinite(enc.damageBonus);
  const hpBonus = truncFinite(enc.hpBonus);
  const blockChanceBonus = truncFinite(enc.blockChanceBonus);

  // Note: We don't modify raid state here - stats are pre-computed in recomputeActiveRaidParams.
  // The log entry just records the bonus values for display.
  return {
    kind: 'PreparationEncounter',
    timeSpentSec,
    elapsedTotalSec: 0,
    currentHp: 0,
    currentMaxHp: 0,
    bagsUsed: 0,
    bagsCapacity: 0,
    tacticNames: Array.isArray(enc.tacticNames) ? [...enc.tacticNames] : [],
    damageBefore: 0,
    damageAfter: damageBonus,
    hpBefore: 0,
    hpAfter: hpBonus,
    maxHpBefore: 0,
    maxHpAfter: hpBonus,
    blockChanceBefore: 0,
    blockChanceAfter: blockChanceBonus,
    gearId: enc.gearId || '',
    gearImage: enc.gearImage || '',
  };
}
