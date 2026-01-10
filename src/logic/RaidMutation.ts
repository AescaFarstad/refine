import type { EncounterDef, FightEncounterDef, LootEncounterDef, MonsterLootEncounterDef, PreparationEncounterDef, QuestEncounterDef, RaidDefinition, WalkEncounterDef } from './RaidLib';
import type { GameState } from './GameState';
import type { QuestDefinition } from './QuestLib';
import { ENABLE_QUEST_PREREQS } from './Const';

// Mutation types supported here. The sign of `count` controls add/remove.
export interface LootMutation {
  kind: 'LootMutation';
  count: number;
}

export interface WalkMutation {
  kind: 'WalkMutation';
  count: number;
}

export interface AddMonsterMutation {
  kind: 'AddMonsterMutation';
  monsterId: string;
  count: number;
}

export interface LootDifficultyMutation {
  kind: 'LootDifficultyMutation';
  amount: number; // additive percent (e.g., -5)
}

export interface UpgradeMonsterMutation {
  kind: 'UpgradeMonsterMutation';
  fromMonsterId: string;
  toMonsterId: string;
  count: number;
}

export interface QuestMutation {
  kind: 'QuestMutation';
  questId: string;
  count: number;
}

export interface ZoneCollapseTimeMutation {
  kind: 'ZoneCollapseTimeMutation';
  amount: number; // negative to reduce time, positive to increase (in seconds)
}

export type RaidMutation = LootMutation | WalkMutation | AddMonsterMutation | LootDifficultyMutation | UpgradeMonsterMutation | QuestMutation | ZoneCollapseTimeMutation;

function encountersEqual(a: EncounterDef, b: EncounterDef): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'PreparationEncounter':
      return true; // all prep encounters are considered equal
    case 'WalkEncounter':
      return true; // no additional fields
    case 'LootEncounter':
      return true; // identical by type only
    case 'MonsterLootEncounter':
      return (a as MonsterLootEncounterDef).monsterId === (b as MonsterLootEncounterDef).monsterId;
    case 'FightEncounter':
      return (a as FightEncounterDef).monsterId === (b as FightEncounterDef).monsterId;
    case 'QuestEncounter':
      return (a as QuestEncounterDef).questId === (b as QuestEncounterDef).questId;
  }
}

function findEncounterIndex(raid: RaidDefinition, enc: EncounterDef): number {
  for (let i = 0; i < raid.encounters.length; i++) {
    if (encountersEqual(raid.encounters[i].encounter, enc)) return i;
  }
  return -1;
}

function normalizeCount(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

export function modifyEncounterCount(raid: RaidDefinition, enc: EncounterDef, delta: number): void {
  const d = Math.trunc(delta);
  if (d === 0) return;

  const idx = findEncounterIndex(raid, enc);
  if (idx !== -1) {
    const current = normalizeCount(raid.encounters[idx].count);
    const next = current + d;
    if (next <= 0) {
      raid.encounters.splice(idx, 1);
    } else {
      raid.encounters[idx].count = next;
    }
    return;
  }

  if (d > 0) {
    raid.encounters.push({ count: d, encounter: enc });
  }
  // If d < 0 and not found, nothing to remove; ignore.
}

export function applyRaidMutation(raid: RaidDefinition, m: RaidMutation): void {
  switch (m.kind) {
    case 'LootMutation': {
      const enc: LootEncounterDef = { type: 'LootEncounter' };
      modifyEncounterCount(raid, enc, Math.trunc(m.count));
      break;
    }
    case 'WalkMutation': {
      const enc: WalkEncounterDef = { type: 'WalkEncounter' };
      modifyEncounterCount(raid, enc, Math.trunc(m.count));
      break;
    }
    case 'AddMonsterMutation': {
      const enc: FightEncounterDef = { type: 'FightEncounter', monsterId: m.monsterId };
      modifyEncounterCount(raid, enc, Math.trunc(m.count));
      break;
    }
    case 'LootDifficultyMutation': {
      const amt = (m as LootDifficultyMutation).amount || 0;
      const next = Math.max(0, Math.min(100, (raid.baseLootChance || 0) + amt));
      raid.baseLootChance = next;
      break;
    }
    case 'UpgradeMonsterMutation': {
      const u = (m as UpgradeMonsterMutation);
      const from: FightEncounterDef = { type: 'FightEncounter', monsterId: u.fromMonsterId };
      const to: FightEncounterDef = { type: 'FightEncounter', monsterId: u.toMonsterId };
      const cnt = Math.max(1, Math.trunc(u.count || 1));
      // decrement 'from', increment 'to'
      modifyEncounterCount(raid, from, -cnt);
      modifyEncounterCount(raid, to, cnt);
      break;
    }
    case 'QuestMutation': {
      const q = (m as QuestMutation);
      const enc: QuestEncounterDef = { type: 'QuestEncounter', questId: q.questId };
      modifyEncounterCount(raid, enc, Math.trunc(q.count));
      break;
    }
    case 'ZoneCollapseTimeMutation': {
      raid.zoneCollapseSec = Math.max(0, raid.zoneCollapseSec + (m as ZoneCollapseTimeMutation).amount);
      break;
    }
  }
}

// Convenience helpers if direct functions are preferred
export function applyLootMutation(raid: RaidDefinition, count: number): void {
  applyRaidMutation(raid, { kind: 'LootMutation', count });
}

export function applyWalkMutation(raid: RaidDefinition, count: number): void {
  applyRaidMutation(raid, { kind: 'WalkMutation', count });
}

export function applyMonsterMutation(raid: RaidDefinition, monsterId: string, count: number): void {
  applyRaidMutation(raid, { kind: 'AddMonsterMutation', monsterId, count });
}

export function cloneEncounter(enc: EncounterDef): EncounterDef {
  switch (enc.type) {
    case 'PreparationEncounter': {
      const p = enc as PreparationEncounterDef;
      return {
        type: 'PreparationEncounter',
        timeSpentSec: p.timeSpentSec,
        damageBonus: p.damageBonus,
        hpBonus: p.hpBonus,
        blockChanceBonus: p.blockChanceBonus,
        tacticNames: [...p.tacticNames],
      };
    }
    case 'WalkEncounter':
      return { type: 'WalkEncounter' };
    case 'LootEncounter':
      return { type: 'LootEncounter' };
    case 'MonsterLootEncounter':
      return { type: 'MonsterLootEncounter', monsterId: (enc as MonsterLootEncounterDef).monsterId };
    case 'FightEncounter': {
      const f = enc as FightEncounterDef;
      const cloned: FightEncounterDef = { type: 'FightEncounter', monsterId: f.monsterId };
      if (f.summoned) cloned.summoned = true;
      return cloned;
    }
    case 'QuestEncounter':
      return { type: 'QuestEncounter', questId: (enc as QuestEncounterDef).questId };
  }
}

export function cloneRaid(def: RaidDefinition): RaidDefinition {
  return {
    id: def.id,
    name: def.name,
    baseLootChance: def.baseLootChance,
    items: [...def.items],
    itemPoolsByRarity: def.itemPoolsByRarity,
    encounters: def.encounters.map(step => ({ count: step.count | 0, encounter: cloneEncounter(step.encounter) })),
    order: def.order,
    zoneCollapseSec: def.zoneCollapseSec,
    zoneCollapseStepPerMutation: def.zoneCollapseStepPerMutation,
  };
}

export function questIsActive(gs: GameState, q: QuestDefinition, raidId: string): boolean {
  if (!questIsAvailable(gs, q, raidId)) return false;
  if (q.autoaccept) return true;
  return gs.activeQuests.includes(q.id);
}

export function questMeetsRaidRequirements(gs: GameState, q: QuestDefinition, raidId: string): boolean {
  // If quest prerequisites are disabled, skip all checks
  if (!ENABLE_QUEST_PREREQS) return true;

  const restricted = q.raidRestriction.length > 0 ? new Set(q.raidRestriction) : null;

  let successesSum = 0;
  let questCompletionsSum = 0;
  for (const raid of gs.unlockedRaids) {
    if (restricted && !restricted.has(raid.id)) continue;
    successesSum += raid.successes;
    questCompletionsSum += raid.questCompletions;
  }

  if (successesSum < q.requiresRaidSuccesses) return false;
  if (questCompletionsSum < q.requiresRaidQuestCompletions) return false;

  for (const requiredQuestId of q.requiresQuestIds) {
    if (!gs.completedQuests.includes(requiredQuestId)) return false;
  }

  return true;
}

export function questIsAvailable(gs: GameState, q: QuestDefinition, raidId: string): boolean {
  const applies = q.raidRestriction.length === 0 || q.raidRestriction.includes(raidId);
  if (!applies) return false;
  if (gs.completedQuests.includes(q.id)) return false;
  return questMeetsRaidRequirements(gs, q, raidId);
}

export function applyPermanentRaidMutation(gs: GameState, raidId: string, m: RaidMutation): void {
  applyRaidMutation(gs.lib.raids.get(raidId)!, m);
}

// -------- Success-mutation selection logic --------

export interface WeightedMutation { mutation: RaidMutation; weight: number; }

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

function countType(raid: RaidDefinition, ty: EncounterDef['type']): number {
  let n = 0;
  for (const s of raid.encounters) {
    if (s.encounter.type === ty) n += Math.max(0, s.count | 0);
  }
  return n;
}

function countFights(raid: RaidDefinition): number { return countType(raid, 'FightEncounter'); }
function countLoots(raid: RaidDefinition): number { return countType(raid, 'LootEncounter'); }
function countWalks(raid: RaidDefinition): number { return countType(raid, 'WalkEncounter'); }

function listFightMonsters(raid: RaidDefinition): Array<{ id: string; count: number }> {
  const acc = new Map<string, number>();
  for (const s of raid.encounters) {
    if (s.encounter.type !== 'FightEncounter') continue;
    const id = (s.encounter as FightEncounterDef).monsterId;
    acc.set(id, (acc.get(id) || 0) + Math.max(0, s.count | 0));
  }
  return Array.from(acc.entries()).map(([id, count]) => ({ id, count }));
}

function monsterStrength(lib: GameState['lib'], monsterId: string): number {
  const m = lib.monsters.get(monsterId);
  if (!m) return 0;
  return Math.max(0, (m.hp || 0)) * Math.max(0, (m.dodge || 0)) * Math.max(0, (m.accuracy || 0)) * Math.max(0, (m.damage || 0));
}

function sortedMonsterIdsByStrength(lib: GameState['lib']): string[] {
  const arr: Array<{ id: string; s: number }> = [];
  lib.monsters.forEach((m, id) => {
    arr.push({ id, s: monsterStrength(lib, id) });
  });
  arr.sort((a, b) => (a.s === b.s ? (a.id < b.id ? -1 : 1) : a.s - b.s));
  return arr.map(x => x.id);
}

function strengthIndexMap(lib: GameState['lib']): Map<string, number> {
  const ids = sortedMonsterIdsByStrength(lib);
  const map = new Map<string, number>();
  ids.forEach((id, i) => map.set(id, i));
  return map;
}

function strengthSum(lib: GameState['lib'], raid: RaidDefinition): number {
  const idx = strengthIndexMap(lib);
  let sum = 0;
  for (const { id, count } of listFightMonsters(raid)) {
    const i = idx.get(id) ?? 0;
    sum += i * Math.max(0, count | 0);
  }
  return sum;
}

export function buildSuccessMutationCandidates(gs: GameState, raidId: string): WeightedMutation[] {
  const lib = gs.lib;
  const original = lib.raidSources.get(raidId);
  const current = lib.raids.get(raidId);
  if (!original || !current) return [];

  const out: WeightedMutation[] = [];

  // LootDifficultyMutation: lower baseLootChance by 5 (flat)
  const origLC = Math.max(0, original.baseLootChance || 0);
  const curLC = Math.max(0, current.baseLootChance || 0);
  if (origLC > 0) {
    const w = clamp01(curLC / origLC);
    if (w > 0) out.push({ mutation: { kind: 'LootDifficultyMutation', amount: -5 }, weight: w });
  }

  // LootMutation: remove one loot encounter
  const origLoot = countLoots(original);
  const curLoot = countLoots(current);
  if (origLoot > 0) {
    let w = clamp01(curLoot / Math.max(1, origLoot));
    if (curLoot <= 1) w = 0; // cannot remove if only 1 remains
    if (w > 0) out.push({ mutation: { kind: 'LootMutation', count: -1 }, weight: w });
  }

  // WalkMutation: add one walk encounter
  const origWalk = countWalks(original);
  const curWalk = countWalks(current);
  if (curWalk > 0) {
    const w = clamp01(origWalk / Math.max(1, curWalk));
    if (w > 0) out.push({ mutation: { kind: 'WalkMutation', count: +1 }, weight: w });
  } else if (origWalk > 0) {
    // If no walks remain, make this highly probable
    out.push({ mutation: { kind: 'WalkMutation', count: +1 }, weight: 1 });
  }

  // AddMonsterMutation: add one copy of the weakest current/original fight
  const origFights = countFights(original);
  const curFights = countFights(current);
  if (origFights > 0) {
    let w = curFights > 0 ? clamp01(origFights / Math.max(1, curFights)) : 1;
    // Exponentially decay when we exceed original count to phase out adding weak monsters
    const excessRatio = Math.max(0, curFights - origFights) / origFights;
    w *= Math.pow(0.5, excessRatio);
    // pick weakest reference monster (prefer current list; fallback to original)
    let pool = listFightMonsters(current);
    if (!pool.length) pool = listFightMonsters(original);
    if (pool.length) {
      const ids = pool.map(p => p.id);
      const sorted = ids.sort((a, b) => monsterStrength(lib, a) - monsterStrength(lib, b));
      const weakest = sorted[0];
      if (w > 0) out.push({ mutation: { kind: 'AddMonsterMutation', monsterId: weakest, count: +1 }, weight: w });
    }
  }

  // UpgradeMonsterMutation: replace a random non-strongest with next stronger
  if (curFights > 0 && origFights > 0) {
    const idx = strengthIndexMap(lib);
    const idsSorted = sortedMonsterIdsByStrength(lib);
    const monsters = listFightMonsters(current);
    if (monsters.length) {
      const maxIdx = Math.max(...monsters.map(m => idx.get(m.id) ?? 0));
      const upgradable = monsters.filter(m => (idx.get(m.id) ?? 0) < maxIdx);
      const pick = upgradable.length ? upgradable[Math.floor(gs.random.get() * upgradable.length)] : monsters[0];

      const monsterDef = lib.monsters.get(pick.id);
      let toId: string | undefined;

      if (monsterDef?.upgrade && monsterDef.upgrade.trim() !== '') {
        toId = monsterDef.upgrade;
      } else {
        // Fall back to the strength-based upgrade system
        const fromI = idx.get(pick.id) ?? 0;
        const toI = Math.min(idsSorted.length - 1, fromI + 1);
        toId = idsSorted[toI];
      }

      // Weight based on strength sum rule
      const origSum = strengthSum(lib, original);
      const curSum = strengthSum(lib, current);
      let w = 0;
      if (curSum <= 0) w = 0; // nothing to upgrade effectively
      else if (curSum < origSum) w = 1; else w = clamp01(origSum / Math.max(1, curSum));
      if (w > 0 && toId && toId !== pick.id) {
        out.push({ mutation: { kind: 'UpgradeMonsterMutation', fromMonsterId: pick.id, toMonsterId: toId, count: 1 }, weight: w });
      }
    }
  }

  // ZoneCollapseTimeMutation: reduce zone collapse time
  const origZoneTime = original.zoneCollapseSec || 0;
  const curZoneTime = current.zoneCollapseSec || 0;
  const step = current.zoneCollapseStepPerMutation || 0;
  if (origZoneTime > 0 && step > 0) {
    const w = clamp01(curZoneTime / origZoneTime);
    // Only add mutation if current time is still positive and above a reasonable minimum
    if (w > 0 && curZoneTime > step) {
      out.push({ mutation: { kind: 'ZoneCollapseTimeMutation', amount: -step }, weight: w });
    }
  }

  return out.filter(c => c.weight > 0);
}

export function pickAndApplyRaidSuccessMutation(gs: GameState, raidId: string): WeightedMutation | null {
  const candidates = buildSuccessMutationCandidates(gs, raidId);
  if (!candidates.length) return null;
  const total = candidates.reduce((a, c) => a + c.weight, 0);
  if (total <= 0) return null;
  let r = gs.random.get() * total;
  let chosen = candidates[0];
  for (const c of candidates) {
    if (r < c.weight) { chosen = c; break; }
    r -= c.weight;
  }
  applyPermanentRaidMutation(gs, raidId, chosen.mutation);
  return chosen;
}

export function describeMutation(gs: GameState, mutation: RaidMutation): string {
  const sign = (n: number) => (n >= 0 ? '+' : '-');
  switch (mutation.kind) {
    case 'LootMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      const label = `Scavenge site${abs === 1 ? '' : 's'}`;
      return `${label} ${sign(n)}${abs}`;
    }
    case 'WalkMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      return `Distance ${sign(n)}${abs} km`;
    }
    case 'AddMonsterMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      const name = gs.lib.monsters.get(mutation.monsterId)!.name;
      return `${name} ${sign(n)}${abs}`;
    }
    case 'LootDifficultyMutation': {
      const amt = mutation.amount;
      const prefix = amt >= 0 ? '+' : '';
      return `Loot chance ${prefix}${amt}%`;
    }
    case 'UpgradeMonsterMutation': {
      const from = gs.lib.monsters.get(mutation.fromMonsterId)!.name;
      const to = gs.lib.monsters.get(mutation.toMonsterId)!.name;
      const cnt = Math.max(1, Math.trunc(mutation.count));
      if (cnt === 1) return `a ${to} replaced one of the ${from}`;
      return `${cnt} ${to} replaced ${cnt} ${from}`;
    }
    case 'QuestMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      const questName = mutation.questId;
      return `${questName} quest${abs === 1 ? '' : 's'} ${sign(n)}${abs}`;
    }
    case 'ZoneCollapseTimeMutation': {
      const amt = mutation.amount;
      const absMin = Math.abs(Math.round(amt / 60));
      const prefix = amt >= 0 ? '+' : '-';
      return `Zone collapse ${prefix}${absMin}m`;
    }
  }
}
