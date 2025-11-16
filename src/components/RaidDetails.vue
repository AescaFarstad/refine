<template>
  <div>
    <div class="stat-line">
      <div class="stat"><span class="label">Health</span> <span class="value">{{ hp }} ❤︎</span></div>
      <div class="stat"><span class="label">Damage</span> <span class="value">{{ damage }} ✴</span></div>
      <div class="stat"><span class="label">Bags</span> <span class="value">{{ bagsCapacity }} ⌞ ⌝</span></div>
    </div>

  <!-- Caption before encounter tables -->
  <div v-if="monsterRows.length || lootCount > 0" class="section-title enc-caption">In this raid you will encounter:</div>

  <div v-if="monsterRows.length" class="enc-table">
    <table class="table">
      <thead>
        <tr>
          <th></th>
          <th>Count</th>
          <th>Health</th>
          <th>Chance to hit them</th>
          <th>Chance to block their attack</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in monsterRows" :key="row.id">
          <td>{{ row.name }}</td>
          <td>{{ row.count }}</td>
          <td>{{ row.hp }}</td>
          <td>{{ row.hitPct }}%</td>
          <td>{{ row.blockPct }}%</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="lootCount > 0" class="enc-table">
    <table class="table">
      <thead>
        <tr>
          <th></th>
          <th>Count</th>
          <th>Find item chance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Scavenge sites</td>
          <td>{{ lootCount }}</td>
          <td>{{ lootChancePct }}%</td>
        </tr>
      </tbody>
    </table>
  </div>


  <div class="walk-line">
      <div class="dist">Distance: {{ distanceKm }} km</div>
      <div class="weight-bar">
        <div class="bar">
          <div class="fill" :class="{ over: overweight }" :style="{ width: weightPct + '%' }" />
          <div class="wlabel">{{ weight }}/{{ maxWeight }} weight</div>
        </div>
      </div>
      <div class="speed">Speed: {{ speedKmH.toFixed(2) }} km/h</div>
      <div class="time">Walking time: {{ walkingTime }}</div>
    </div>
    <div v-if="overweight" class="overweight-warning">Overweight</div>
  </div>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { MIN_WALK_SPEED } from '../logic/GameState';
import type { RaidDefinition } from '../logic/RaidLib';

const selectedRaid = computed<RaidDefinition | null>(() => uiState.raids.find(r => r.id === (uiState.activeRaidId || (uiState.raidOrder[0] || ''))) || null);

// Reactive raid values
const hp = computed(() => { uiState.raidKey; return (getGameState()?.raid.hp ?? 100) | 0; });
const maxHp = computed(() => { uiState.raidKey; return (getGameState()?.raid.maxHp ?? hp.value) | 0; });
const baseSpeed = computed(() => { uiState.raidKey; const gs = getGameState(); return Math.max(MIN_WALK_SPEED, gs.raid.baseSpeed); });
const speedBonusPct = computed(() => { uiState.raidKey; return getGameState().raid.speedBonusPct; });
const speedBonusFlat = computed(() => { uiState.raidKey; return getGameState().raid.speedBonusFlat; });
const regenPerKm = computed(() => { uiState.raidKey; return getGameState().raid.regenPerKm; });
const weight = computed(() => { uiState.raidKey; return getGameState().raid.weight; });
const maxWeight = computed(() => { uiState.raidKey; return Math.max(1, getGameState().raid.maxWeight); });
const damage = computed(() => { uiState.raidKey; const gs = getGameState(); return gs.raid.damage; });
// Bags volume (capacity = base volume + gear-provided bags volume)
const bagsCapacity = computed(() => {
  // Depend on raidKey for gear changes and on uiState.volume for base stat changes
  uiState.raidKey; uiState.volume;
  const gs = getGameState();
  const base = Math.max(0, gs.volume);
  const gear = Math.max(0, gs.raid.bagsVolume);
  return base + gear;
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

function speedKmHFor(hpNow: number): number {
  const hpM = Math.max(0, hpNow) / Math.max(1e-9, maxHp.value);
  const wM = Math.max(0, maxWeight.value - (weight.value || 0)) / Math.max(1e-9, maxWeight.value);
  const withPct = Math.max(MIN_WALK_SPEED, baseSpeed.value) * hpM * wM * (1 + speedBonusPct.value / 100);
  return Math.max(MIN_WALK_SPEED, withPct + speedBonusFlat.value);
}

const speedKmH = computed(() => speedKmHFor(hp.value));
const weightPct = computed(() => Math.max(0, Math.min(100, Math.round(((weight.value || 0) / Math.max(1, maxWeight.value)) * 100))));
const overweight = computed(() => (weight.value || 0) > (maxWeight.value || 0));

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

// Monster encounter table
interface MonsterRow { id: string; name: string; hp: number; hitPct: number; blockPct: number; count: number }
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
  const hitBase = Math.max(0, Math.min(100, gs.raid.hitChance ?? gs.chanceToHit ?? 0));
  const blockBase = Math.max(0, Math.min(100, gs.raid.blockChance ?? gs.chanceToBlock ?? 0));
  const rows: MonsterRow[] = [];
  for (const id of Object.keys(counts)) {
    const m = lib.monsters.get(id);
    if (!m) continue;
    const hit = clamp01((hitBase) - Math.max(0, Math.min(100, m.dodge || 0)));
    const block = clamp01((blockBase) - Math.max(0, Math.min(100, m.accuracy || 0)));
    rows.push({ id, name: m.name, hp: Math.max(0, m.hp || 0), hitPct: hit, blockPct: block, count: counts[id] || 0 });
  }
  // Stable name sort
  rows.sort((a, b) => (a.name < b.name ? -1 : 1));
  return rows;
});

// Loot table (single row)
const lootCount = computed(() => encCounts.value.loot | 0);
const lootChancePct = computed(() => {
  const r = selectedRaid.value;
  const gs = getGameState();
  if (!r || !gs) return 0;
  const base = Math.max(0, Math.min(100, r.baseLootChance || 0));
  const bonus = Math.max(0, Math.min(100, gs.raid.lootChanceBonus || 0));
  const v = Math.max(0, Math.min(100, Math.round(base + bonus)));
  return v;
});
</script>

<style scoped>
/* Stats row: 3 equal panels */
.stat-line { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 12px; }
.stat { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; justify-content: center; gap: 8px; text-align: center; }
.stat .label { color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0; }
.stat .value { font-weight: 800; }
.walk-line { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; margin-top: 24px; }
.dist, .speed, .time { font-weight: 700; white-space: nowrap; }
.weight-bar { display: flex; align-items: center; flex: 1 1 320px; }
.weight-bar .bar { position: relative; width: 100%; height: 14px; border: 1px solid var(--panel-border); border-radius: 3px; background: rgba(255,255,255,0.04); overflow: hidden; }
.weight-bar .fill { height: 100%; background: var(--accent-warm); }
.weight-bar .fill.over { background: #ef4444; }
.overweight-warning { color: #ef4444; font-weight: 800; margin-top: 6px; }
.weight-bar .wlabel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-weight: 800; font-size: 12px; color: var(--text-primary); text-shadow: 0 1px 2px rgba(0,0,0,0.6); pointer-events: none; }
/* removed encounters summary block */

.enc-table { margin-top: 8px; }
/* Extra spacing specifically between the two encounter tables */
.enc-table + .enc-table { margin-top: 16px; }
.section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 6px 8px; padding-left: 32px; }
.table th:first-child, .table td:first-child { border-right: 1px solid rgba(255,255,255,0.28); width: 130px; padding-right: 8px; padding-left: 0; }
.table th:nth-child(2), .table td:nth-child(2) { width: 80px; padding-left: 32px; }
.table thead th:not(:first-child) { border-bottom: 1px solid rgba(255,255,255,0.28); }
.table thead th { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
.count { color: var(--text-secondary); margin-left: 4px; }
/* Encounter caption: no caps + extra top space */
.section-title.enc-caption { text-transform: none; margin-top: 16px; }
</style>
