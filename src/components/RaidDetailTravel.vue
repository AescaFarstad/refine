<template>
  <div v-if="hasDiscoveredMonsters">
    <template v-if="!hasDiscoveredSpeed">
      <div class="discover-container">
        <button class="discover-btn" @click="discoverSpeed">Review travel distance and speed</button>
      </div>
    </template>

    <template v-if="hasDiscoveredSpeed">
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
          <GearStatsHint :gear="overweightGear" />
        </div>
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
import GearStatsHint from './GearStatsHint.vue';
import { MIN_WALK_SPEED } from '../logic/GameState';
import { Perks } from '../logic/Perks';

const props = defineProps<{
  raid: RaidDefinition;
}>();

const raid = computed(() => props.raid);

const hasDiscoveredMonsters = computed(() => uiState.hasDiscoveredRaidMonsters);
const hasDiscoveredSpeed = computed(() => uiState.hasDiscoveredRaidSpeed);

function discoverSpeed(): void {
  globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_RAID_SPEED }));
}

const baseSpeed = computed(() => { uiState.raidKey; const gs = getGameState(); return Math.max(MIN_WALK_SPEED, gs.raid.baseSpeed); });
const speedBonusPct = computed(() => { uiState.raidKey; return getGameState().raid.speedBonusPct; });
const speedBonusFlat = computed(() => { uiState.raidKey; return getGameState().raid.speedBonusFlat; });
const regenPerKm = computed(() => { uiState.raidKey; return getGameState().raid.regenPerKm; });
const weight = computed(() => { uiState.raidKey; return getGameState().raid.weight; });
const maxWeight = computed(() => { uiState.raidKey; return Math.max(1, getGameState().raid.maxWeight); });
const hp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.hp | 0;
});
const maxHp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.maxHp | 0;
});

const distanceKm = computed(() => {
  uiState.raidKey;
  const raidValue = raid.value;
  let km = 0;
  for (const e of raidValue.encounters) {
    if (e.encounter.type === 'WalkEncounter') km += Math.max(0, Math.floor(e.count));
  }
  return km;
});

function speedKmHFor(hpNow: number): number {
  const gs = getGameState();
  const hasPainkiller = gs.raid.perks.includes(Perks.PAINKILLER);
  const hpM = hasPainkiller ? 1 : Math.max(0, hpNow) / Math.max(1e-9, maxHp.value);
  const wM = Math.max(0, maxWeight.value - weight.value) / Math.max(1e-9, maxWeight.value);
  const baseExcess = Math.max(0, Math.max(MIN_WALK_SPEED, baseSpeed.value) - MIN_WALK_SPEED);
  const scaledExcess = baseExcess * hpM * wM * (1 + speedBonusPct.value / 100);
  return Math.max(MIN_WALK_SPEED, MIN_WALK_SPEED + scaledExcess + speedBonusFlat.value + MIN_WALK_SPEED * speedBonusPct.value / 100);
}

const speedKmH = computed(() => speedKmHFor(hp.value));
const weightPct = computed(() => Math.max(0, Math.min(100, Math.round((weight.value / Math.max(1, maxWeight.value)) * 100))));
const overweight = computed(() => weight.value > maxWeight.value);
const overweightGear = computed(() => {
  const lib = getGameLib();
  return lib.gear.get('overweight')!;
});

const walkingTime = computed(() => {
  const km = distanceKm.value;
  if (km <= 0) return '0m';
  let timeSec = 0;
  let curHp = hp.value;
  for (let i = 0; i < km; i++) {
    const kmh = speedKmHFor(curHp);
    const sec = Math.round(3600 / Math.max(MIN_WALK_SPEED, kmh));
    timeSec += sec;
    const regen = Math.max(0, regenPerKm.value);
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
</script>

<style scoped>
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
  -webkit-text-stroke: 0.9px rgba(0, 0, 0, 0.85);
  text-shadow:
    -1px -1px 0 rgba(0, 0, 0, 0.85),
    1px -1px 0 rgba(0, 0, 0, 0.85),
    -1px 1px 0 rgba(0, 0, 0, 0.85),
    1px 1px 0 rgba(0, 0, 0, 0.85),
    0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
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
