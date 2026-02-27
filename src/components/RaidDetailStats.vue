<template>
  <div class="stat-line">
    <div class="stat-shell">
      <div :class="['stat', hpFlashClass]">
        <span :class="['label', 'stat-caption', { 'stat-caption--hintable': healthHintRows.length > 0 }]">Health</span>
        <span class="value value-health">
          <span :class="hpValueFlashClass">{{ hp }} ❤︎</span>
          <span v-if="armor > 0" :class="['armor-inline', armorValueFlashClass]">
            <span>{{ armor }}</span>
            <span class="armor-icon" :style="armorIconStyle" />
          </span>
        </span>
      </div>
      <div v-if="healthHintRows.length > 0" class="stat-hint" role="tooltip" aria-hidden="true">
        <div v-for="(row, i) in healthHintRows" :key="`health-${i}`" class="hint-row">
          <span class="hint-label">{{ row.label }}</span>
          <span class="hint-value">{{ row.value }}</span>
        </div>
      </div>
    </div>
    <div class="stat-shell">
      <div :class="['stat', damageFlashClass]">
        <span :class="['label', 'stat-caption', { 'stat-caption--hintable': damageHintRows.length > 0 }]">Damage</span>
        <span class="value">{{ damage }} ✴</span>
      </div>
      <div v-if="damageHintRows.length > 0" class="stat-hint" role="tooltip" aria-hidden="true">
        <div v-for="(row, i) in damageHintRows" :key="`damage-${i}`" class="hint-row">
          <span class="hint-label">{{ row.label }}</span>
          <span class="hint-value">{{ row.value }}</span>
        </div>
      </div>
    </div>
    <div class="stat-shell">
      <div :class="['stat', bagsFlashClass]">
        <span :class="['label', 'stat-caption', { 'stat-caption--hintable': bagsHintRows.length > 0 }]">Bags</span>
        <span class="value">{{ bagsCapacity }} ⌞ ⌝</span>
      </div>
      <div v-if="bagsHintRows.length > 0" class="stat-hint" role="tooltip" aria-hidden="true">
        <div v-for="(row, i) in bagsHintRows" :key="`bags-${i}`" class="hint-row">
          <span class="hint-label">{{ row.label }}</span>
          <span class="hint-value">{{ row.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';

const ARMOR_ICON_IMAGE = 'shield_solid';

type HintRow = { label: string; value: string };

interface RaidHintStats {
  regenPerKm: number;
  regenAfterCombat: number;
  regenPer10Minutes: number;
  hitChanceBonus: number;
  blockChanceBonus: number;
  armor: number;
  attackSkipCount: number;
  reflectOnHitPct: number;
  reflectOnBlockPct: number;
  stunChance: number;
  lootChance: number;
  rarityBuff: number;
}

const hp = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.hp | 0;
});

const damage = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.damage;
});

const armor = computed(() => {
  uiState.raidKey;
  const gs = getGameState();
  return gs.raid.armor;
});

const itemsAtlasSource = atlasStorage.getItemsSource();
const armorIconStyle = atlasSpriteStyle(
  itemsAtlasSource,
  atlasStorage.getItemsFrame(ARMOR_ICON_IMAGE)!,
  { size: 14, mode: 'fit', allowUpscale: false },
);

const bagsCapacity = computed(() => {
  uiState.raidKey;
  uiState.volume;
  const gs = getGameState();
  return Math.max(0, gs.raid.bagsVolume);
});

const raidHintStats = computed<RaidHintStats>(() => {
  uiState.raidKey;
  const gs = getGameState();
  return {
    regenPerKm: gs.raid.regenPerKm,
    regenAfterCombat: gs.raid.regenAfterCombat,
    regenPer10Minutes: gs.raid.regenPer10Minutes,
    hitChanceBonus: gs.raid.hitChance - gs.chanceToHit,
    blockChanceBonus: gs.raid.blockChance - gs.chanceToBlock,
    armor: gs.raid.armor,
    attackSkipCount: gs.raid.attackSkipCount,
    reflectOnHitPct: gs.raid.reflectOnHitPct,
    reflectOnBlockPct: gs.raid.reflectOnBlockPct,
    stunChance: gs.raid.stunChance,
    lootChance: gs.raid.lootChanceBonus,
    rarityBuff: gs.raid.rarityBuff,
  };
});

function fmtSigned(n: number, suffix = ''): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

function fmtPercent(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(1)}%`;
}

const healthHintRows = computed<HintRow[]>(() => {
  const g = raidHintStats.value;
  const rows: HintRow[] = [];
  if (g.regenPerKm) rows.push({ label: 'Regen', value: `${fmtSigned(g.regenPerKm)} hp/km` });
  if (g.regenAfterCombat) rows.push({ label: 'Regen after combat', value: `${fmtSigned(g.regenAfterCombat)} hp` });
  if (g.regenPer10Minutes) rows.push({ label: 'Regen per 10 min', value: `${fmtSigned(g.regenPer10Minutes)} hp` });
  if (g.blockChanceBonus) rows.push({ label: 'Block chance bonus', value: fmtSigned(g.blockChanceBonus, '%') });
  if (g.armor) rows.push({ label: 'Armor', value: fmtSigned(g.armor) });
  if (g.attackSkipCount) rows.push({ label: 'Attack skips', value: fmtSigned(g.attackSkipCount) });
  return rows;
});

const damageHintRows = computed<HintRow[]>(() => {
  const g = raidHintStats.value;
  const rows: HintRow[] = [];
  if (g.hitChanceBonus) rows.push({ label: 'Hit chance bonus', value: fmtSigned(g.hitChanceBonus, '%') });
  if (g.reflectOnHitPct) rows.push({ label: 'Reflect on hit', value: fmtSigned(g.reflectOnHitPct, '%') });
  if (g.reflectOnBlockPct) rows.push({ label: 'Reflect on block', value: fmtSigned(g.reflectOnBlockPct, '%') });
  if (g.stunChance > 0) rows.push({ label: 'Stun chance', value: fmtPercent(g.stunChance) });
  return rows;
});

const bagsHintRows = computed<HintRow[]>(() => {
  const g = raidHintStats.value;
  const rows: HintRow[] = [];
  if (g.lootChance) rows.push({ label: 'Loot chance', value: fmtSigned(g.lootChance, '%') });
  if (g.rarityBuff) rows.push({ label: 'Loot rarity', value: fmtSigned(g.rarityBuff) });
  return rows;
});

const hpFlashClass = ref('');
const hpValueFlashClass = ref('');
const armorValueFlashClass = ref('');
const damageFlashClass = ref('');
const bagsFlashClass = ref('');

const hpFlashTimeout = ref<number | null>(null);
const hpValueFlashTimeout = ref<number | null>(null);
const armorValueFlashTimeout = ref<number | null>(null);
const damageFlashTimeout = ref<number | null>(null);
const bagsFlashTimeout = ref<number | null>(null);

function triggerFlash(flashClass: Ref<string>, direction: 'up' | 'down', timeoutRef: Ref<number | null>): void {
  flashClass.value = '';
  requestAnimationFrame(() => {
    flashClass.value = direction === 'up' ? 'flash-up' : 'flash-down';
    if (timeoutRef.value !== null) {
      clearTimeout(timeoutRef.value);
    }
    timeoutRef.value = window.setTimeout(() => {
      flashClass.value = '';
      timeoutRef.value = null;
    }, direction === 'up' ? 700 : 560);
  });
}

watch(hp, (next, prev) => {
  if (next === prev) return;
  const dir = next > prev ? 'up' : 'down';
  triggerFlash(hpFlashClass, dir, hpFlashTimeout);
  triggerFlash(hpValueFlashClass, dir, hpValueFlashTimeout);
});

watch(armor, (next, prev) => {
  if (next === prev) return;
  const dir = next > prev ? 'up' : 'down';
  triggerFlash(hpFlashClass, dir, hpFlashTimeout);
  triggerFlash(armorValueFlashClass, dir, armorValueFlashTimeout);
});

watch(damage, (next, prev) => {
  if (next === prev) return;
  triggerFlash(damageFlashClass, next > prev ? 'up' : 'down', damageFlashTimeout);
});

watch(bagsCapacity, (next, prev) => {
  if (next === prev) return;
  triggerFlash(bagsFlashClass, next > prev ? 'up' : 'down', bagsFlashTimeout);
});
</script>

<style scoped>
.stat-line { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 12px; }
.stat-shell { position: relative; }
.stat {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.stat::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40%;
  aspect-ratio: 1;
  border-radius: 999px;
  transform: translate(-50%, -50%) scale(0.08);
  opacity: 0;
  pointer-events: none;
}
.stat > * {
  position: relative;
  z-index: 1;
}
.value-health {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.armor-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.95;
}
.armor-icon {
  display: inline-block;
  margin-bottom: 2px;
}
.stat-caption {
  cursor: default;
}
.stat-caption--hintable {
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
}
.stat-hint {
  position: absolute;
  top: calc(100% + 10px);
  bottom: auto;
  left: 50%;
  transform: translateX(-50%);
  visibility: hidden;
  opacity: 0;
  z-index: 3000;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  padding: 10px 12px;
  min-width: 250px;
  width: max-content;
  max-width: min(90vw, 420px);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: opacity 120ms ease;
}
.stat-hint::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid var(--hint-bg, rgba(10, 14, 20, 0.95));
  filter: drop-shadow(0 -1px 0 var(--hint-border, rgba(255, 255, 255, 0.15)));
}
.stat-shell:has(.stat-hint):has(.stat-caption:hover) {
  z-index: 3100;
}
.stat-shell:has(.stat-hint):has(.stat-caption:hover) .stat-hint {
  visibility: visible;
  opacity: 1;
}
.stat.flash-up::after {
  background: radial-gradient(circle, rgba(156, 180, 208, 0.96) 0%, rgba(156, 180, 208, 0.72) 42%, rgba(156, 180, 208, 0) 74%);
  animation: stat-flash-up 700ms ease-out;
}
.stat.flash-down::after {
  background: radial-gradient(circle, rgba(186, 207, 230, 0.46) 0%, rgba(156, 180, 208, 0.35) 34%, rgba(116, 140, 166, 0.2) 52%, rgba(116, 140, 166, 0) 72%);
  animation: stat-flash-down 560ms ease-out;
}
.flash-up {
  animation: stat-value-pop 700ms ease-out;
}
.flash-down {
  animation: stat-value-soft 560ms ease-out;
}
.stat .label { color: var(--text-secondary); font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0; }
.stat .value { font-weight: 800;  font-size: 18px; }
.hint-row {
  white-space: nowrap;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 8px;
  align-items: baseline;
  margin: 2px 0;
}
.hint-label {
  color: var(--text-secondary);
  font-size: 13px;
  letter-spacing: 0.06em;
  font-weight: 800;
}
.hint-value {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 800;
}

@keyframes stat-flash-up {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.08); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(0.55); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(4.8); }
}
@keyframes stat-flash-down {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(2.6); }
  24% { opacity: 0.52; transform: translate(-50%, -50%) scale(1.35); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.08); }
}
@keyframes stat-value-pop {
  0% { transform: scale(1); }
  30% { transform: scale(1.13); }
  100% { transform: scale(1); }
}
@keyframes stat-value-soft {
  0% { transform: scale(1); opacity: 1; }
  45% { transform: scale(0.97); opacity: 0.88; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
