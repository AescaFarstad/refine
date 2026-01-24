<template>
  <div>
    <div class="stat-line">
      <div class="stat"><span class="label">Health</span> <span class="value">{{ hp }} ❤︎</span></div>
      <div class="stat"><span class="label">Damage</span> <span class="value">{{ damage }} ✴</span></div>
      <div class="stat"><span class="label">Bags</span> <span class="value">{{ bagsCapacity }} ⌞ ⌝</span></div>
    </div>

  <!-- Monsters reveal button -->
  <template v-if="!hasDiscoveredMonsters && selectedRaid">
    <div class="discover-container">
      <button class="discover-btn" @click="discoverMonsters">Review raid monsters</button>
    </div>
  </template>

  <!-- Monsters section (revealed) -->
  <template v-if="hasDiscoveredMonsters">
    <!-- Caption before encounter tables -->
    <div v-if="monsterRows.length || lootCount > 0" class="section-title enc-caption">In this raid you will encounter:</div>

    <div v-if="monsterRows.length" class="enc-table">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Count</th>
            <th>Health</th>
            <th>Damage</th>
            <th>Chance to hit them</th>
            <th>Chance to block them</th>
            <th>Ability</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in monsterRows" :key="row.id">
            <td>{{ row.name }}</td>
            <td>{{ row.count }}</td>
            <td>{{ row.hp }}</td>
            <td>{{ row.damage }}</td>
            <td>{{ row.hitPct }}%</td>
            <td>{{ row.blockPct }}%</td>
            <td>
              <template v-for="(ability, idx) in getAbilities(row)" :key="ability.name">
                <span v-if="idx > 0">, </span>
                <span class="ability-label" :data-tooltip="ability.tooltip">{{ ability.name }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Loot reveal button (requires monsters revealed) -->
    <template v-if="!hasDiscoveredLoot && lootCount > 0">
      <div class="discover-container">
        <button class="discover-btn" @click="discoverLoot">Review raid looting opportunities</button>
      </div>
    </template>

    <!-- Loot section (revealed) -->
    <div v-if="hasDiscoveredLoot && lootCount > 0" class="enc-table">
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Count</th>
            <th>Find item chance</th>
            <th>Rarity %</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="scavenge-cell">
              <span class="scavenge-label">Scavenge sites</span>
              <div class="scavenge-hint">
                <div v-for="prob in lootRarityProbabilities" :key="prob.rarity" class="hint-row">
                  <div class="hint-header" :class="prob.rarity">{{ prob.rarity }} {{ prob.pct }}%</div>
                  <div v-if="getKnownItemsForRarity(prob.rarity).length > 0" class="hint-items">
                    <ItemDisplay v-for="item in getKnownItemsForRarity(prob.rarity)" :key="item.id" :id="item.id" :minor="true" />
                  </div>
                </div>
              </div>
            </td>
            <td>{{ lootCount }}</td>
            <td>{{ lootChanceBasePct }}%<template v-if="lootChanceBuffPct"> + {{ lootChanceBuffPct }}%</template></td>
            <td class="rarity-probs">
              <template v-for="(prob, idx) in lootRarityProbabilities" :key="prob.rarity">
                <span v-if="idx > 0" class="rarity-sep">-</span>
                <span class="rarity-val" :class="prob.rarity">{{ formatRarityPct(prob.pct) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Speed reveal button (requires monsters revealed) -->
    <template v-if="!hasDiscoveredSpeed && selectedRaid">
      <div class="discover-container">
        <button class="discover-btn" @click="discoverSpeed">Review travel distance and speed</button>
      </div>
    </template>

    <!-- Speed/distance section (revealed) -->
    <template v-if="hasDiscoveredSpeed && selectedRaid">
      <div class="walk-line">
          <div class="dist">Distance: {{ distanceKm }} km</div>
          <div class="weight-bar">
            <div class="bar">
              <div class="fill" :class="{ over: overweight }" :style="{ width: weightPct + '%' }" />
              <div class="wlabel">{{ weight }}/{{ maxWeight }} weight</div>
            </div>
          </div>
          <div class="speed">{{ speedKmH.toFixed(2) }} km/h</div>
          <div class="time">Walking time: {{ walkingTime }}</div>
        </div>
        <div v-if="overweight" class="overweight-warning">
          <span class="ow-label">Overweight</span>
          <div class="ow-hint" role="tooltip" aria-hidden="true">
            <GearStatsHint :gear="overweightGear" v-if="overweightGear" />
          </div>
        </div>
    </template>
  </template>
  </div>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdDiscover } from '../logic/input/InputCommands';
import { DISCOVERY } from '../logic/DiscoveryLib';
import ItemDisplay from './ItemDisplay.vue';
import { MIN_WALK_SPEED } from '../logic/GameState';
import type { RaidDefinition } from '../logic/RaidLib';
import GearStatsHint from './GearStatsHint.vue';
import { FEATURE_SUMMON, FEATURE_SUMMON2, FEATURE_SELF_DESTRUCT, FEATURE_RETALIATES, SUMMON_CHANCE_PER_ROUND, SUMMON_CHANCE_PER_ROUND2 } from '../logic/MonsterFeatures';
import { Perks } from '../logic/Perks';
import { computeLootRarityWeights } from '../logic/LootEncounter';

const hasDiscoveredMonsters = computed(() => uiState.hasDiscoveredRaidMonsters);
const hasDiscoveredLoot = computed(() => uiState.hasDiscoveredRaidLoot);
const hasDiscoveredSpeed = computed(() => uiState.hasDiscoveredRaidSpeed);

function discoverMonsters(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_RAID_MONSTERS }));
}

function discoverLoot(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_RAID_LOOT }));
}

function discoverSpeed(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_RAID_SPEED }));
}


const selectedRaid = computed<RaidDefinition | null>(() => {
  // Touch reactive key for updates
  uiState.raidKey;
  if (!uiState.activeRaidId) return null;
  return uiState.raids.find(r => r.id === uiState.activeRaidId) || null;
});

// Reactive raid values (already include all gear bonuses)
const hp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return (gs.raid.hp || gs.health) | 0;
});
const maxHp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return (gs.raid.maxHp || gs.health) | 0;
});
const baseSpeed = computed(() => { uiState.raidKey; const gs = getGameState(); return Math.max(MIN_WALK_SPEED, gs.raid.baseSpeed); });
const speedBonusPct = computed(() => { uiState.raidKey; return getGameState().raid.speedBonusPct; });
const speedBonusFlat = computed(() => { uiState.raidKey; return getGameState().raid.speedBonusFlat; });
const regenPerKm = computed(() => { uiState.raidKey; return getGameState().raid.regenPerKm; });
const weight = computed(() => { uiState.raidKey; return getGameState().raid.weight; });
const maxWeight = computed(() => { uiState.raidKey; return Math.max(1, getGameState().raid.maxWeight); });
const damage = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.damage || 0;
});
// Bags volume (capacity = base volume + gear-provided bags volume)
const bagsCapacity = computed(() => {
  // Depend on raidKey for gear changes and on uiState.volume for base stat changes
  uiState.raidKey; uiState.volume;
  const gs = getGameState();
  // gs.raid.bagsVolume already includes gs.volume (set in Raid.ts) plus gear bonuses
  return Math.max(0, gs.raid.bagsVolume);
});

const distanceKm = computed(() => {
  const r = selectedRaid.value;
  if (!r) return 0;
  let km = 0;
  for (const e of r.encounters || []) {
    if (e.encounter.type === 'WalkEncounter') km += Math.max(0, Math.floor(e.count || 0));
  }
  return km;
});

	function speedKmHFor(hpNow: number): number {
	  const gs = getGameState();
	  const hasPainkiller = (gs.raid.perks || []).includes(Perks.PAINKILLER);
	  const hpM = hasPainkiller ? 1 : Math.max(0, hpNow) / Math.max(1e-9, maxHp.value);
	  const wM = Math.max(0, maxWeight.value - (weight.value || 0)) / Math.max(1e-9, maxWeight.value);
	  // Treat MIN_WALK_SPEED as an unscaled baseline: only the portion above MIN scales with weight.
	  const baseExcess = Math.max(0, Math.max(MIN_WALK_SPEED, baseSpeed.value) - MIN_WALK_SPEED);
	  const scaledExcess = baseExcess * hpM * wM * (1 + speedBonusPct.value / 100);
	  return Math.max(MIN_WALK_SPEED, MIN_WALK_SPEED + scaledExcess + speedBonusFlat.value + MIN_WALK_SPEED * speedBonusPct.value / 100);
	}

const speedKmH = computed(() => speedKmHFor(hp.value));
const weightPct = computed(() => Math.max(0, Math.min(100, Math.round(((weight.value || 0) / Math.max(1, maxWeight.value)) * 100))));
const overweight = computed(() => (weight.value || 0) > (maxWeight.value || 0));
const overweightGear = computed(() => {
  const lib = getGameLib();
  return lib.gear.get('overweight') || null;
});

// Preview total walk time like the runner (regen at end of each km)
const walkingTime = computed(() => {
  const km = distanceKm.value;
  if (km <= 0) return '0m';
  let timeSec = 0;
  let curHp = hp.value;
  for (let i = 0; i < km; i++) {
    const kmh = speedKmHFor(curHp);
    const sec = Math.round(3600 / Math.max(MIN_WALK_SPEED, kmh));
    timeSec += sec;
    const regen = Math.max(0, regenPerKm.value || 0);
    const missing = Math.max(0, maxHp.value - curHp);
    const healed = Math.min(regen, missing);
    curHp += healed;
  }
  const h = Math.floor(timeSec / 3600);
  const m = Math.floor((timeSec % 3600) / 60);
  const s = Math.floor(timeSec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
});


const encCounts = computed(() => {
  const r = selectedRaid.value;
  const res = { walk: 0, loot: 0, fight: 0 } as { walk: number; loot: number; fight: number };
  if (!r) return res;
  for (const e of r.encounters || []) {
    const c = Math.max(0, Math.floor(e.count || 0));
    switch (e.encounter.type) {
      case 'WalkEncounter': res.walk += c; break;
      case 'LootEncounter': res.loot += c; break;
      case 'FightEncounter': res.fight += c; break;
    }
  }
  return res;
});

// Monster encounter table
interface MonsterRow { id: string; name: string; hp: number; damage: number; hitPct: number; blockPct: number; count: number; canSummon: boolean; canSummon2: boolean; canSelfDestruct: boolean; canRetaliate: boolean; armor: number; damageCap: number }
function clamp01(v: number): number { return Math.max(0, Math.min(100, Math.round(v))); }
const monsterRows = computed<MonsterRow[]>(() => {
  const raid = selectedRaid.value;
  const gs = getGameState();
  const lib = getGameLib();
  if (!raid || !gs || !lib) return [];
  const counts: Record<string, number> = {};
  for (const step of raid.encounters || []) {
    if (step.encounter.type !== 'FightEncounter') continue;
    const id = (step.encounter as any).monsterId as string;
    const c = Math.max(0, step.count | 0);
    counts[id] = (counts[id] || 0) + c;
  }
  const hitBase = gs.raid.hitChance ?? gs.chanceToHit ?? 0;
  const blockBase = gs.raid.blockChance ?? gs.chanceToBlock ?? 0;
  const rows: MonsterRow[] = [];
  for (const id of Object.keys(counts)) {
    const m = lib.monsters.get(id);
    if (!m) continue;
    const hit = clamp01((hitBase) - Math.max(0, Math.min(100, m.dodge || 0)));
    const block = clamp01((blockBase) - Math.max(0, Math.min(100, m.accuracy || 0)));
    const canSummon = m.features.includes(FEATURE_SUMMON);
    const canSummon2 = m.features.includes(FEATURE_SUMMON2);
    const canSelfDestruct = m.features.includes(FEATURE_SELF_DESTRUCT);
    const canRetaliate = m.features.includes(FEATURE_RETALIATES);
    const armor = m.armor || 0;
    const damageCap = m.damageCap || 0;
    rows.push({ id, name: m.name, hp: Math.max(0, m.hp || 0), damage: Math.max(0, m.damage || 0), hitPct: hit, blockPct: block, count: counts[id] || 0, canSummon, canSummon2, canSelfDestruct, canRetaliate, armor, damageCap });
  }
  // Stable name sort
  rows.sort((a, b) => (a.name < b.name ? -1 : 1));
  return rows;
});


interface Ability { name: string; tooltip: string }
function getAbilities(row: MonsterRow): Ability[] {
  const abilities: Ability[] = [];
  if (row.canSummon) {
    abilities.push({ name: 'Summons\u00A0friends', tooltip: `Each round you fight this monster, there is a ${SUMMON_CHANCE_PER_ROUND}% chance that another one will appear` });
  }
  if (row.canSummon2) {
    abilities.push({ name: 'Summons\u00A0the\u00A0pack', tooltip: `Each round you fight this monster, there is a ${SUMMON_CHANCE_PER_ROUND2}% chance that another one will appear` });
  }
  if (row.canSelfDestruct) {
    abilities.push({ name: 'Explodes', tooltip: 'When this monster successfully attacks, it explodes' });
  }
  if (row.canRetaliate) {
    abilities.push({ name: 'Retaliates', tooltip: 'Counterattacks even when hit' });
  }
  if (row.armor > 0) {
    abilities.push({ name: `Armor\u00A0${row.armor}`, tooltip: `All incoming damage is decreased by ${row.armor}` });
  }
  if (row.damageCap > 0) {
    abilities.push({ name: `Damage\u00A0cap\u00A0${row.damageCap}`, tooltip: `Maximum damage per hit is ${row.damageCap}` });
  }
  return abilities;
}

// Loot table (single row)
const lootCount = computed(() => encCounts.value.loot | 0);
const lootChanceBasePct = computed(() => {
  uiState.raidKey;
  const r = selectedRaid.value;
  const gs = getGameState();
  if (!r || !gs) return 0;
  const v = Math.max(0, Math.min(100, Math.round(r.baseLootChance + gs.raid.lootChanceBonus)));
  return v;
});
const lootChanceBuffPct = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  if (!gs) return 0;
  return Math.max(0, Math.round(gs.raid.tmpLootBuffAppliedPct));
});

interface RarityProbability {
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  weight: number;
  pct: number;
}
const lootRarityProbabilities = computed<RarityProbability[]>(() => {
  uiState.raidKey;
  const raid = selectedRaid.value;
  const gs = getGameState();
  if (!raid || !gs) return [];

  const raidEntry = gs.unlockedRaids.find(rr => rr.id === raid.id);
  const effLootChance = (gs.raid.lootChanceBonus || 0)
    + (raidEntry?.lootingRarityBuff || 0)
    + (gs.raid.rarityBuff || 0);

  const bannedSet = raidEntry?.bannedItemIds?.length
    ? new Set(raidEntry.bannedItemIds)
    : null;
  const poolSizes = {
    common: bannedSet
      ? raid.itemPoolsByRarity.common.filter(id => !bannedSet.has(id)).length
      : raid.itemPoolsByRarity.common.length,
    uncommon: bannedSet
      ? raid.itemPoolsByRarity.uncommon.filter(id => !bannedSet.has(id)).length
      : raid.itemPoolsByRarity.uncommon.length,
    rare: bannedSet
      ? raid.itemPoolsByRarity.rare.filter(id => !bannedSet.has(id)).length
      : raid.itemPoolsByRarity.rare.length,
    legendary: bannedSet
      ? raid.itemPoolsByRarity.legendary.filter(id => !bannedSet.has(id)).length
      : raid.itemPoolsByRarity.legendary.length,
  };

  const weights = computeLootRarityWeights(poolSizes, effLootChance);

  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  if (total <= 0) return [];

  const result: RarityProbability[] = [];
  for (const r of ['common', 'uncommon', 'rare', 'legendary'] as const) {
    if (weights[r] > 0) {
      result.push({
        rarity: r,
        weight: weights[r],
        pct: Math.round((weights[r] / total) * 1000) / 10,
      });
    }
  }
  return result;
});

// Known items by rarity (items in foundItemIds, excluding banned)
interface KnownItemsByRarity {
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  items: Array<{ id: string; name: string }>;
}
const knownItemsByRarity = computed<KnownItemsByRarity[]>(() => {
  uiState.raidKey;
  const raid = selectedRaid.value;
  const gs = getGameState();
  const lib = getGameLib();
  if (!raid || !gs || !lib) return [];

  const raidEntry = gs.unlockedRaids.find(rr => rr.id === raid.id);
  if (!raidEntry) return [];

  const foundSet = new Set(raidEntry.foundItemIds || []);
  const bannedSet = new Set(raidEntry.bannedItemIds || []);

  const result: KnownItemsByRarity[] = [];
  for (const r of ['common', 'uncommon', 'rare', 'legendary'] as const) {
    const pool = raid.itemPoolsByRarity[r];
    const knownItems: Array<{ id: string; name: string }> = [];
    for (const id of pool) {
      if (bannedSet.has(id)) continue;
      if (foundSet.has(id)) {
        const def = lib.items.get(id);
        if (def) {
          knownItems.push({ id, name: def.name });
        }
      }
    }
    if (knownItems.length > 0 || pool.filter(id => !bannedSet.has(id)).length > 0) {
      result.push({ rarity: r, items: knownItems });
    }
  }
  return result;
});

function getKnownItemsForRarity(rarity: string): Array<{ id: string; name: string }> {
  const group = knownItemsByRarity.value.find(g => g.rarity === rarity);
  return group?.items || [];
}

function formatRarityPct(pct: number): string {
  if (pct === 0) return '0';
  if (pct >= 10) return Math.round(pct).toString();
  return pct.toFixed(1);
}

</script>

<style scoped>
/* Stats row: 3 equal panels */
.stat-line { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 12px; }
.stat { background: var(--raid-item-bg, rgba(255,255,255,0.08)); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; }
.stat .label { color: var(--text-secondary); font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0; }
.stat .value { font-weight: 800;  font-size: 18px;}
.walk-line { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; margin-top: 24px; }
.dist, .speed, .time { font-weight: 700; white-space: nowrap; }
.weight-bar { display: flex; align-items: center; flex: 1 1 320px; }
.weight-bar .bar { position: relative; width: 100%; height: 14px; border: 1px solid var(--panel-border); border-radius: 3px; background: var(--raid-item-bg, rgba(255,255,255,0.08)); overflow: hidden; }
.weight-bar .fill { height: 100%; background: var(--accent-warm); }
.weight-bar .fill.over { background: #ef4444; }
.overweight-warning { position: relative; color: #ef4444; font-weight: 800; margin-top: 6px; }
.overweight-warning:hover { z-index: 2000; }
.ow-label { text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 3px; }
.ow-hint {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  display: none;
  z-index: 3000;
  background: var(--hint-bg);
  border: 1px solid var(--hint-border);
  border-radius: 4px;
  padding: 4px 10px;
  min-width: 120px;
  width: max-content;
  max-width: 75vw;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  pointer-events: none;
}
.ow-hint::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 12px;
  width: 10px;
  height: 10px;
  background: var(--hint-bg);
  border-right: 1px solid var(--hint-border);
  border-bottom: 1px solid var(--hint-border);
  transform: translateY(-50%) rotate(45deg);
}
.overweight-warning:hover .ow-hint { display: block; }
.weight-bar .wlabel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-weight: 800;
  font-size: 14px;
  color: var(--text-primary);
  /* Strong outline for readability on bright fill colors. */
  -webkit-text-stroke: 0.9px rgba(0, 0, 0, 0.85);
  text-shadow:
    -1px -1px 0 rgba(0, 0, 0, 0.85),
    1px -1px 0 rgba(0, 0, 0, 0.85),
    -1px 1px 0 rgba(0, 0, 0, 0.85),
    1px 1px 0 rgba(0, 0, 0, 0.85),
    0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.enc-table { margin-top: 8px; }
/* Extra spacing specifically between the two encounter tables */
.enc-table + .enc-table { margin-top: 16px; }
.section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
.table { border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 6px 16px; padding-left: 40px; }
.table th:first-child, .table td:first-child { border-right: 1px solid rgba(255,255,255,0.28); width: 130px; padding-right: 8px; padding-left: 0; }
.table th:nth-child(2), .table td:nth-child(2) { width: 80px; padding-left: 40px; }
.table thead th:not(:first-child) { border-bottom: 1px solid rgba(255,255,255,0.28); }
.table thead th { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.count { color: var(--text-secondary); margin-left: 4px; }
/* Encounter caption: no caps + extra top space */
.section-title.enc-caption { text-transform: none; margin-top: 16px; }


.ability-label {
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  position: relative;
  cursor: default;
}
.ability-label::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.ability-label::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--hint-bg, rgba(10, 14, 20, 0.95));
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 101;
}
.ability-label:hover::after,
.ability-label:hover::before {
  opacity: 1;
}

.discover-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50px;
  margin: 8px 0;
}
.discover-btn {
  height: 32px;
  padding: 0 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.5);
  background: rgba(34,197,94,0.32);
  color: #86efac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.discover-btn:hover {
  background: rgba(34,197,94,0.45);
}

/* Scavenge sites hint */
.scavenge-cell {
  position: relative;
}
.scavenge-label {
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  cursor: default;
}
.scavenge-hint {
  position: absolute;
  top: 50%;
  left: calc(100% + 12px);
  transform: translateY(-50%);
  display: none;
  z-index: 3000;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  padding: 10px 14px;
  min-width: 200px;
  width: max-content;
  max-width: 360px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.scavenge-hint::before {
  content: '';
  position: absolute;
  top: 50%;
  right: 100%;
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-left: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-bottom: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  transform: translateY(-50%) rotate(45deg);
}
.scavenge-cell:hover .scavenge-hint {
  display: block;
}
.hint-row {
  margin-bottom: 8px;
}
.hint-row:last-child {
  margin-bottom: 0;
}
.hint-header {
  font-weight: 700;
  font-size: 12px;
  text-transform: capitalize;
  margin-bottom: 2px;
}
.hint-header.common { color: #9ca3af; }
.hint-header.uncommon { color: #22c55e; }
.hint-header.rare { color: #3b82f6; }
.hint-header.legendary { color: #f59e0b; }
.hint-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

/* Rarity probabilities column */
.rarity-probs {
  white-space: nowrap;
  padding-left: 12px !important;
}
.rarity-sep {
  color: var(--text-secondary);
  opacity: 0.5;
  margin: 0 1px;
}
.rarity-val {
  font-weight: 500;
}
.rarity-val.common { color: #9ca3af; }
.rarity-val.uncommon { color: #22c55e; }
.rarity-val.rare { color: #3b82f6; }
.rarity-val.legendary { color: #f59e0b; }
</style>
