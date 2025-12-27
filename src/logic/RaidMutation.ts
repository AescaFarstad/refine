import type { EncounterDef, FightEncounterDef, LootEncounterDef, MonsterLootEncounterDef, QuestEncounterDef, RaidDefinition, WalkEncounterDef } from './RaidLib';
import type { GameState } from './GameState';
import type { QuestDefinition } from './QuestLib';

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

export type RaidMutation = LootMutation | WalkMutation | AddMonsterMutation | LootDifficultyMutation | UpgradeMonsterMutation | QuestMutation;

function encountersEqual(a: EncounterDef, b: EncounterDef): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
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
    default:
      return false;
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

// Modifies the raid encounters in-place, merging counts when present.
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

function cloneEncounter(enc: EncounterDef): EncounterDef {
  switch (enc.type) {
    case 'WalkEncounter':
      return { type: 'WalkEncounter' };
    case 'LootEncounter':
      return { type: 'LootEncounter' };
    case 'MonsterLootEncounter':
      return { type: 'MonsterLootEncounter', monsterId: (enc as MonsterLootEncounterDef).monsterId };
    case 'FightEncounter':
      return { type: 'FightEncounter', monsterId: (enc as FightEncounterDef).monsterId };
    case 'QuestEncounter':
      return { type: 'QuestEncounter', questId: (enc as QuestEncounterDef).questId };
  }
}

export function cloneRaid(def: RaidDefinition): RaidDefinition {
  return {
    id: def.id,
    name: def.name,
    reachRequired: def.reachRequired,
    baseLootChance: def.baseLootChance,
    items: Array.isArray(def.items) ? [...def.items] : undefined,
    encounters: (def.encounters || []).map(step => ({ count: Math.max(0, step.count | 0), encounter: cloneEncounter(step.encounter) })),
    order: def.order,
  };
}

function questIsActive(gs: GameState, q: QuestDefinition, raidId: string): boolean {
  const applies = !q.raidRestriction || q.raidRestriction.includes(raidId);
  if (!applies) return false;
  const done = (gs.completedQuests || []).includes(q.id);
  if (done) return false;
  if (q.autoaccept) return true;
  // manual quests: must be explicitly active
  return (gs.activeQuests || []).includes(q.id);
}

// Build an effective raid definition for this UI/render or execution:
// start from the current modded raid, then overlay active quest encounter mutations.
export function getEffectiveRaidDefinition(gs: GameState, raidId: string): RaidDefinition | null {
  const base = gs.lib.raids.get(raidId);
  if (!base) return null;
  const def = cloneRaid(base);
  // Apply active quests that declare encounter mutations
  gs.lib.quests.forEach((q) => {
    const muts = (q as any).encounters as RaidMutation[] | undefined;
    if (!Array.isArray(muts) || muts.length === 0) return;
    const applies = (!q.raidRestriction || q.raidRestriction.includes(raidId));
    if (!applies) return;
    if (!questIsActive(gs, q, raidId)) return;
    for (const m of muts) applyRaidMutation(def, m);
  });
  return def;
}

// Apply a permanent mutation to the modded raid definition, detaching from source if needed
export function applyPermanentRaidMutation(gs: GameState, raidId: string, m: RaidMutation): void {
  const lib = gs.lib;
  const target = lib.raids.get(raidId);
  if (!target) return;
  applyRaidMutation(target, m);
}

// -------- Success-mutation selection logic --------

export interface WeightedMutation { mutation: RaidMutation; weight: number; }

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

function countType(raid: RaidDefinition, ty: EncounterDef['type']): number {
  let n = 0;
  for (const s of raid.encounters || []) {
    if (s.encounter.type === ty) n += Math.max(0, s.count | 0);
  }
  return n;
}

function countFights(raid: RaidDefinition): number { return countType(raid, 'FightEncounter'); }
function countLoots(raid: RaidDefinition): number { return countType(raid, 'LootEncounter'); }
function countWalks(raid: RaidDefinition): number { return countType(raid, 'WalkEncounter'); }

function listFightMonsters(raid: RaidDefinition): Array<{ id: string; count: number }> {
  const acc = new Map<string, number>();
  for (const s of raid.encounters || []) {
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
    const w = curFights > 0 ? clamp01(origFights / Math.max(1, curFights)) : 1;
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
      const fromI = idx.get(pick.id) ?? 0;
      const toI = Math.min(idsSorted.length - 1, fromI + 1);
      const toId = idsSorted[toI];
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
      return `${sign(n)}${abs} ${label}`;
    }
    case 'WalkMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      return `${sign(n)}${abs} km distance`;
    }
    case 'AddMonsterMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      const m = gs.lib.monsters.get(mutation.monsterId);
      const name = m?.name || mutation.monsterId;
      return `${sign(n)}${abs} ${name}`;
    }
    case 'LootDifficultyMutation': {
      const amt = (mutation as LootDifficultyMutation).amount || 0;
      const prefix = amt >= 0 ? '+' : '';
      return `Loot chance ${prefix}${amt}%`;
    }
    case 'UpgradeMonsterMutation': {
      const u = mutation as UpgradeMonsterMutation;
      const from = gs.lib.monsters.get(u.fromMonsterId)?.name || u.fromMonsterId;
      const to = gs.lib.monsters.get(u.toMonsterId)?.name || u.toMonsterId;
      const cnt = Math.max(1, Math.trunc(u.count || 1));
      if (cnt === 1) return `a ${to} came in place of the ${from}`;
      return `${cnt} ${to} replaced ${cnt} ${from}`;
    }
    case 'QuestMutation': {
      const n = Math.trunc(mutation.count);
      const abs = Math.abs(n);
      const questName = mutation.questId;
      return `${sign(n)}${abs} ${questName} quest${abs === 1 ? '' : 's'}`;
    }
  }
}
