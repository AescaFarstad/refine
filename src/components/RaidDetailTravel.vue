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
            <div class="wlabel"><span :class="{ 'val-flash': weightChanged }">{{ weight }}</span>/<span :class="{ 'val-flash': maxWeightChanged }">{{ maxWeight }}</span> weight</div>
          </div>
        </div>
        <div class="speed speed-cell">
          <span class="speed-label">{{ speedKmH.toFixed(2) }} km/h</span>
          <div class="speed-hint" role="tooltip" aria-hidden="true">
            <div class="hint-row">
              <span class="hint-label">Base speed:</span>
              <span class="hint-value">{{ baseSpeed.toFixed(2) }} km/h</span>
            </div>
            <div v-if="hasSpeedBonusPct" class="hint-row">
              <span class="hint-label">Bonus:</span>
              <span class="hint-value">{{ speedBonusPct.toFixed(0) }}%</span>
            </div>
            <div v-if="hasSpeedBonusFlat" class="hint-row">
              <span class="hint-label">Flat bonus:</span>
              <span class="hint-value">{{ speedBonusFlat.toFixed(2) }} km/h</span>
            </div>
            <div class="hint-row">
              <span class="hint-label">Remaining free weight:</span>
              <span class="hint-value">{{ freeWeightPct }}%</span>
            </div>
            <div class="hint-section speed-rules">
              <div class="section-heading">Rules</div>
              <div class="hint-item">
                <span class="item-text">Speed can't fall below {{ MIN_WALK_SPEED.toFixed(2) }} km/h</span>
              </div>
              <div class="hint-item" v-if="hasPainkiller">
                <span class="item-text">Painkiller active: health does not reduce speed</span>
              </div>
              <div class="hint-item" v-else>
                <span class="item-text">Losing health decreases speed proportionally</span>
              </div>
              <div class="hint-item">
                <span class="item-text">Volume - occupied or not - doesn't affect speed</span>
              </div>
            </div>
          </div>
        </div>
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
import { computed, ref, watch } from 'vue';
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
const weightChanged = ref(false);
watch(weight, () => {
  weightChanged.value = true;
  setTimeout(() => { weightChanged.value = false; }, 300);
});
const maxWeight = computed(() => { uiState.raidKey; return Math.max(1, getGameState().raid.maxWeight); });
const maxWeightChanged = ref(false);
watch(maxWeight, () => {
  maxWeightChanged.value = true;
  setTimeout(() => { maxWeightChanged.value = false; }, 300);
});
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
const hasPainkiller = computed(() => {
  uiState.raidKey;
  return getGameState().raid.perks.includes(Perks.PAINKILLER);
});
const hasSpeedBonusPct = computed(() => Math.abs(speedBonusPct.value) > 1e-9);
const hasSpeedBonusFlat = computed(() => Math.abs(speedBonusFlat.value) > 1e-9);
const wM = computed(() => Math.max(0, maxWeight.value - weight.value) / Math.max(1e-9, maxWeight.value));
const freeWeightPct = computed(() => Math.round(wM.value * 100));
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
.speed-cell { position: relative; cursor: default; }
.speed-label { text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 3px; }
.speed-hint {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  visibility: hidden;
  opacity: 0;
  z-index: 3000;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  padding: 10px 12px;
  min-width: 300px;
  width: max-content;
  max-width: min(90vw, 560px);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.35;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  white-space: normal;
  transition: opacity 120ms ease;
}
.speed-hint::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-right: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-bottom: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  transform: translate(-50%, -50%) rotate(45deg);
}
.speed-cell:hover .speed-hint { visibility: visible; opacity: 1; }
.hint-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.hint-label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  letter-spacing: 0.06em;
  font-weight: 600;
  text-transform: uppercase;
}
.hint-value {
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
  font-weight: 700;
}
.hint-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.speed-rules {
  margin-top: 2px;
}
.section-heading {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
}
.item-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-weight: 600;
}
.weight-bar { display: flex; align-items: center; flex: 1 1 320px; }
.weight-bar .bar { position: relative; width: 100%; height: 14px; border: 1px solid var(--panel-border); border-radius: 3px; background: var(--raid-item-bg, rgba(255,255,255,0.08)); overflow: hidden; }
.weight-bar .fill { height: 100%; background: var(--accent-warm); transition: width 0.3s ease-out; }
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
.val-flash {
  display: inline-block;
  animation: val-pulse 0.3s ease-out;
}
@keyframes val-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); color: #fbbf24; }
  100% { transform: scale(1); }
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
