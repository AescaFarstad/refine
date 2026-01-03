import type { ActiveRaid } from './GameState';
import type { PreparationEncounterDef } from './RaidLib';
import type { PreparationEncounterLogEntry } from './RaidLog';

function truncFinite(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function createPreparationEncounter(plan: {
  prepTimeSec: number;
  prepTacticNames?: string[];
  damageBonus: number;
  hpBonus: number;
  blockChanceBonus: number;
}): PreparationEncounterDef | null {
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
    tacticNames: Array.isArray(plan.prepTacticNames) ? [...plan.prepTacticNames] : [],
  };
}

export function handlePreparationEncounter(r: ActiveRaid, enc: PreparationEncounterDef): PreparationEncounterLogEntry {
  const timeSpentSec = Math.max(0, truncFinite(enc.timeSpentSec));

  const damageBefore = Math.max(0, truncFinite(r.damage));
  const hpBefore = Math.max(0, truncFinite(r.hp));
  const maxHpBefore = Math.max(1, truncFinite(r.maxHp));
  const blockChanceBefore = truncFinite(r.blockChance);

  const damageBonus = truncFinite(enc.damageBonus);
  const hpBonus = truncFinite(enc.hpBonus);
  const blockChanceBonus = truncFinite(enc.blockChanceBonus);

  r.damage = Math.max(0, damageBefore + damageBonus);

  r.maxHp = Math.max(1, maxHpBefore + hpBonus);
  r.hp = Math.max(0, Math.min(r.maxHp, hpBefore + hpBonus));

  r.blockChance = blockChanceBefore + blockChanceBonus;

  return {
    kind: 'PreparationEncounter',
    timeSpentSec,
    elapsedTotalSec: 0,
    tacticNames: Array.isArray(enc.tacticNames) ? [...enc.tacticNames] : [],
    damageBefore,
    damageAfter: truncFinite(r.damage),
    hpBefore,
    hpAfter: truncFinite(r.hp),
    maxHpBefore,
    maxHpAfter: truncFinite(r.maxHp),
    blockChanceBefore,
    blockChanceAfter: truncFinite(r.blockChance),
  };
}
