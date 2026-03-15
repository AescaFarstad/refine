<template>
  <div>
    <template v-if="!hasDiscoveredMonsters">
      <div class="discover-container">
        <button class="discover-btn" @click="discoverMonsters">Review raid monsters</button>
      </div>
    </template>

    <template v-if="hasDiscoveredMonsters">
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
              <td>{{ row.blockPct }}%<span v-if="row.blockPctRaw !== row.blockPct" class="raw-pct"> ({{ row.blockPctRaw }}% more)</span></td>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdDiscover } from '../logic/input/InputCommands';
import { DISCOVERY } from '../logic/DiscoveryLib';
import type { RaidDefinition } from '../logic/RaidLib';
import { FEATURE_SUMMON, FEATURE_SUMMON2, FEATURE_SELF_DESTRUCT, SUMMON_CHANCE_PER_ROUND, SUMMON_CHANCE_PER_ROUND2 } from '../logic/MonsterFeatures';
import Perks from '../logic/Perks';

const props = defineProps<{
  raid: RaidDefinition;
  lootCount: number;
}>();

const raid = computed(() => props.raid);
const lootCount = computed(() => props.lootCount);

const hasDiscoveredMonsters = computed(() => uiState.hasDiscoveredRaidMonsters);

function discoverMonsters(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_RAID_MONSTERS }));
}

interface MonsterRow {
  id: string;
  name: string;
  hp: number;
  damage: number;
  hitPct: number;
  blockPct: number;
  count: number;
  canSummon: boolean;
  canSummon2: boolean;
  canSelfDestruct: boolean;
  armor: number;
  damageCap: number;
  blockPctRaw: number;
}

function clamp01(v: number): number { return Math.max(0, Math.min(100, Math.round(v))); }

const monsterRows = computed<MonsterRow[]>(() => {
  uiState.raidKey;
  const raidValue = raid.value;
  const gs = getGameState();
  const lib = getGameLib();
  const counts: Record<string, number> = {};
  for (const step of raidValue.encounters) {
    if (step.encounter.type !== 'FightEncounter') continue;
    const id = step.encounter.monsterId;
    const c = Math.max(0, step.count | 0);
    counts[id] = (counts[id] || 0) + c;
  }
  const hitBase = gs.raid.hitChance;
  const blockBase = gs.raid.blockChance;
  const rows: MonsterRow[] = [];
  for (const id of Object.keys(counts)) {
    const m = lib.monsters.get(id)!;
    const hit = clamp01(hitBase - Math.max(0, Math.min(100, m.dodge)));
    const blockRaw = Math.round(blockBase - Math.max(0, Math.min(100, m.accuracy)));
    const block = clamp01(blockRaw);
    const canSummon = m.features.includes(FEATURE_SUMMON);
    const canSummon2 = m.features.includes(FEATURE_SUMMON2);
    const canSelfDestruct = m.features.includes(FEATURE_SELF_DESTRUCT);
    const hasArmorPiercing = gs.raid.perks.includes(Perks.ARMOR_CRUSHING);
    const armor = hasArmorPiercing ? Math.floor(m.armor / 2) : m.armor;
    const damageCap = m.damageCap;
    rows.push({
      id,
      name: m.name,
      hp: Math.max(0, m.hp),
      damage: Math.max(0, m.damage),
      hitPct: hit,
      blockPct: block,
      count: counts[id],
      canSummon,
      canSummon2,
      canSelfDestruct,
      armor,
      damageCap,
      blockPctRaw: blockRaw,
    });
  }
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
  if (row.armor > 0) {
    abilities.push({ name: `Armor\u00A0${row.armor}`, tooltip: `All incoming damage is decreased by ${row.armor}` });
  }
  if (row.damageCap > 0) {
    abilities.push({ name: `Damage\u00A0cap\u00A0${row.damageCap}`, tooltip: `Maximum damage per hit is ${row.damageCap}` });
  }
  return abilities;
}
</script>

<style scoped>
.enc-table { margin-top: 8px; }
.enc-table + .enc-table { margin-top: 16px; }
.section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
.table { border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 6px 16px; padding-left: 40px; }
.table th:first-child, .table td:first-child { border-right: 1px solid rgba(255,255,255,0.28); width: var(--raid-table-first-col); padding-right: 8px; padding-left: 0; }
.table th:nth-child(2), .table td:nth-child(2) { width: 80px; padding-left: 40px; }
.table thead th:not(:first-child) { border-bottom: 1px solid rgba(255,255,255,0.28); }
.table thead th { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
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

.raw-pct {
  opacity: 0.45;
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
</style>
