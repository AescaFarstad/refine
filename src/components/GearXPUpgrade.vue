<template>
  <section class="xp-pane">
    <div class="xp-pane-header">Upgrade or downgrade items in exchange for skill points {{ skillPointsSpec.glyph }}</div>
    <div class="xp-gear-list">
      <div
        v-for="entry in entriesWithUpgrades"
        :key="entry.id"
        :class="['xp-gear-card', { 'xp-gear-card-upgrade-ready': entry.upgradeReady }]"
        :style="entry.readyAnimationStyle"
        @mouseenter="showHint($event, entry)"
        @mouseleave="hideHint()"
      >
        <div v-if="entry.hasUpgrades" :class="['xp-gear-hint', { visible: entry.id === hoveredGearId }]" :ref="el => { if (entry.id === hoveredGearId && el) positionHint(el as HTMLElement) }">
          <GearStatsHint :gear="entry.gear" />
        </div>

        <div class="xp-gear-top">
          <div class="xp-gear-icon">
            <div class="xp-gear-sprite" :style="entry.spriteStyle" />
          </div>
          <div v-if="entry.hasUpgrades && !entry.allPurchased && entry.hasMoreLevels" class="xp-gear-meta">
            <div class="xp-gear-progress">{{ entry.currentXp }} / {{ entry.targetXp }} XP</div>
          </div>
        </div>

        <div v-if="entry.upgrades.length > 0" class="xp-upgrade-list">
          <button
            v-for="upgrade in entry.upgrades"
            :key="upgrade.id"
            type="button"
            :class="['xp-upgrade-panel', {
              purchased: upgrade.purchased,
              actionable: upgrade.available && upgrade.affordable,
              disabled: !upgrade.purchased && !upgrade.available,
              exhausted: !upgrade.purchased && !upgrade.available && !entry.hasMoreLevels,
              masked: entry.maskLevel !== 'none',
              unaffordable: !upgrade.purchased && upgrade.available && !upgrade.affordable,
              free: !upgrade.purchased && upgrade.skillPoints === 0,
            }]"
            @click="upgradeGear(entry.id, upgrade.id)"
            @mouseenter="hoverUpgrade(upgrade, entry.maskLevel)"
            @mouseleave="unhoverUpgrade()"
          >
            <div v-if="entry.maskLevel !== 'none' && !upgrade.purchased" :class="['xp-upgrade-mask', { 'has-title': upgrade.title && entry.maskLevel !== 'full' }]">?</div>
            <div v-if="(upgrade.title && entry.maskLevel !== 'full') || (!upgrade.purchased && upgrade.skillPoints !== 0)" :class="['xp-upgrade-title', { 'xp-upgrade-title-cost': !upgrade.purchased && upgrade.skillPoints < 0, 'xp-upgrade-title-grant': !upgrade.purchased && upgrade.skillPoints > 0 }]">
              <span v-if="upgrade.title && entry.maskLevel !== 'full'">{{ upgrade.title }}</span>
              <span v-if="!upgrade.purchased && upgrade.skillPoints < 0" class="xp-upgrade-title-sp">- {{ skillPointsSpec.glyph }}</span>
              <span v-else-if="!upgrade.purchased && upgrade.skillPoints > 0" class="xp-upgrade-title-sp">+ {{ skillPointsSpec.glyph }}</span>
            </div>
            <div :class="['xp-upgrade-content', { 'xp-upgrade-content-hidden': entry.maskLevel !== 'none' && !upgrade.purchased }]">
              <div v-if="upgrade.rows.length > 0" class="xp-upgrade-stats">
                <div v-for="(row, rowIndex) in upgrade.rows" :key="rowIndex" class="xp-upgrade-row">
                  <span class="xp-upgrade-label">{{ row.label }}</span>
                  <span class="xp-upgrade-value">
                    <span
                      v-for="(span, spanIndex) in row.spans"
                      :key="spanIndex"
                      :class="['xp-upgrade-value-part', { 'with-weight-icon': span.weightIcon }]"
                      :style="span.color ? { color: span.color } : undefined"
                    >
                      <span>{{ span.text }}</span>
                      <span v-if="span.weightIcon" class="xp-upgrade-weight-icon" :style="weightIconStyle" aria-hidden="true" />
                    </span>
                  </span>
                </div>
              </div>
              <div v-if="upgrade.description" class="xp-upgrade-description">{{ upgrade.description }}</div>
              <div v-else-if="upgrade.rows.length === 0" class="xp-upgrade-forgo">forgo upgrade</div>
            </div>
            <div v-if="entry.isLastUpgrade && !upgrade.purchased && hoveredUpgradeId && hoveredUpgradeId !== upgrade.id" class="xp-upgrade-cross" :ref="el => setCrossAngle(el as HTMLElement)" />
          </button>
        </div>
      </div>

      <div v-if="entriesWithoutUpgrades.length > 0" class="xp-no-upgrade-row">
        <div v-for="entry in entriesWithoutUpgrades" :key="entry.id" class="xp-no-upgrade-icon">
          <div class="xp-gear-sprite" :style="entry.spriteStyle" />
        </div>
        <span class="xp-no-upgrade-label">Don't have upgrades</span>
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import type { GearDefinition, GearUpgradeDefinition } from '../logic/GearLib';
import { getGameState, uiState } from '../logic/UIState';
import { canApplyGearUpgrade, getAppliedGearUpgradeIds, getCachedActiveRaidGear, getGearUpgradeThresholds, getPendingGearUpgradeCount } from '../logic/GearUpgrades';
import { getResourceSpec } from '../logic/Resources';
import { globalInputQueue } from '../logic/Model';
import { CmdUpgradeGearItem } from '../logic/input/InputCommands';
import GearStatsHint from './GearStatsHint.vue';

type UpgradeSpan = { text: string; color?: string; weightIcon?: boolean };
type UpgradeRow = { label: string; spans: UpgradeSpan[] };
type UpgradeEntry = {
  id: string;
  title: string;
  description: string;
  rows: UpgradeRow[];
  purchased: boolean;
  available: boolean;
  affordable: boolean;
  skillPoints: number;
};
type GearEntry = {
  id: string;
  gear: GearDefinition;
  currentXp: number;
  targetXp: number;
  spriteStyle: Record<string, string>;
  hasUpgrades: boolean;
  allPurchased: boolean;
  maskLevel: 'full' | 'partial' | 'none';
  hasMoreLevels: boolean;
  upgradeReady: boolean;
  readyAnimationStyle: Record<string, string>;
  isLastUpgrade: boolean;
  upgrades: UpgradeEntry[];
};

const hoveredGearId = ref<string | null>(null);
const hoveredUpgradeId = ref<string | null>(null);

function showHint(_event: MouseEvent, entry: GearEntry): void {
  hoveredGearId.value = entry.id;
}

function hideHint(): void {
  hoveredGearId.value = null;
}

function positionHint(el: HTMLElement): void {
  const card = el.parentElement;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  el.style.top = `${rect.top + rect.height / 2}px`;
  el.style.right = `${window.innerWidth - rect.left + 12}px`;
  el.style.transform = 'translateY(-50%)';
}

const source = atlasStorage.getItemsSource();
const creditsSpec = getResourceSpec('credits');
const skillPointsSpec = getResourceSpec('skillPoints');
const weightFrame = atlasStorage.getItemsFrame('weight')!;

const weightIconStyle = atlasSpriteStyle(source, weightFrame, { size: 12, mode: 'fit', allowUpscale: false });

function fmtSigned(n: number, suffix = ''): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

function textSpan(text: string, color?: string): UpgradeSpan {
  return color ? { text, color } : { text };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnitInterval(value: string): number {
  return hashString(value) / 4294967295;
}

function getReadyAnimationStyle(gearId: string): Record<string, string> {
  const cycleSec = 3.7 + hashUnitInterval(`${gearId}:cycle`) * 0.9;
  const delaySec = -hashUnitInterval(`${gearId}:phase`) * cycleSec;
  return {
    '--xp-gear-ready-duration': `${cycleSec.toFixed(3)}s`,
    '--xp-gear-ready-delay': `${delaySec.toFixed(3)}s`,
  };
}

function describeUpgrade(upgrade: GearUpgradeDefinition, gear: GearDefinition): UpgradeRow[] {
  const rows: UpgradeRow[] = [];
  if (upgrade.damage) rows.push({ label: 'Damage', spans: [textSpan(fmtSigned(upgrade.damage))] });
  if (upgrade.speedPercent) rows.push({ label: 'Walking speed', spans: [textSpan(fmtSigned(upgrade.speedPercent, '%'))] });
  if (upgrade.speedFlat) rows.push({ label: 'Flat speed bonus', spans: [textSpan(fmtSigned(upgrade.speedFlat, ' km/h'))] });
  if (upgrade.chanceToHit) rows.push({ label: 'Hit chance', spans: [textSpan(fmtSigned(upgrade.chanceToHit, '%'))] });
  if (upgrade.hp) rows.push({ label: 'HP', spans: [textSpan(fmtSigned(upgrade.hp))] });
  if (upgrade.regenPerKm) rows.push({ label: 'Regen', spans: [textSpan(fmtSigned(upgrade.regenPerKm, ' hp/km'))] });
  if (upgrade.regenAfterCombat) rows.push({ label: 'Regen after combat', spans: [textSpan(fmtSigned(upgrade.regenAfterCombat, ' hp'))] });
  if (upgrade.regenPer10Minutes) rows.push({ label: 'Regen per 10 min', spans: [textSpan(fmtSigned(upgrade.regenPer10Minutes, ' hp'))] });
  if (upgrade.chanceToBlock) rows.push({ label: 'Block chance', spans: [textSpan(fmtSigned(upgrade.chanceToBlock, '%'))] });
  if (upgrade.armor) rows.push({ label: 'Armor', spans: [textSpan(fmtSigned(upgrade.armor))] });
  if (upgrade.attackSkipCount) rows.push({ label: 'Attack skips', spans: [textSpan(fmtSigned(upgrade.attackSkipCount))] });
  if (upgrade.reflectOnHitPct) rows.push({ label: 'Reflect on hit', spans: [textSpan(fmtSigned(upgrade.reflectOnHitPct, '%'))] });
  if (upgrade.reflectOnBlockPct) rows.push({ label: 'Reflect on block', spans: [textSpan(fmtSigned(upgrade.reflectOnBlockPct, '%'))] });
  if (upgrade.stunChance) rows.push({ label: 'Stun chance', spans: [textSpan(fmtSigned(upgrade.stunChance, '%'))] });
  if (upgrade.lootChance) rows.push({ label: 'Loot chance', spans: [textSpan(fmtSigned(upgrade.lootChance, '%'))] });
  if (upgrade.rarityBuff) rows.push({ label: 'Loot rarity', spans: [textSpan(fmtSigned(upgrade.rarityBuff))] });
  if (upgrade.biopsyChance) rows.push({ label: 'Remains harvest chance', spans: [textSpan(fmtSigned(upgrade.biopsyChance, '%'))] });
  if (upgrade.maxWeight) rows.push({ label: 'Max weight', spans: [{ text: fmtSigned(upgrade.maxWeight), weightIcon: true }] });
  if (upgrade.weight) rows.push({ label: 'Weight', spans: [{ text: fmtSigned(upgrade.weight), weightIcon: true }] });
  if (upgrade.volume) rows.push({ label: 'Volume', spans: [textSpan(fmtSigned(upgrade.volume))] });
  if (upgrade.price) rows.push({ label: 'Price', spans: [textSpan(`${fmtSigned(upgrade.price)}${creditsSpec.glyph}`, creditsSpec.color)] });
  if (upgrade.raidPassiveCreditsPerHour) rows.push({ label: 'Raid credits gen', spans: [textSpan(fmtSigned(upgrade.raidPassiveCreditsPerHour, '/h'))] });
  if (upgrade.raidResourceStorageBonus) rows.push({ label: 'Raid credits cap', spans: [textSpan(fmtSigned(upgrade.raidResourceStorageBonus))] });
  if (upgrade.zoneBoost) rows.push({ label: 'Zone stability', spans: [textSpan(fmtSigned(upgrade.zoneBoost, 's'))] });
  if (upgrade.priceChange) rows.push({ label: 'Price change', spans: [textSpan(`${fmtSigned(upgrade.priceChange)}${creditsSpec.glyph}`, creditsSpec.color)] });
  if (upgrade.reimbursed) rows.push({ label: 'Reimbursement', spans: [textSpan(fmtSigned(upgrade.reimbursed, '%'))] });
  if (upgrade.removePerk) rows.push({ label: 'Remove', spans: [textSpan(gear.perk || 'perk', '#ef5350')] });
  if (upgrade.replacePerk) rows.push({ label: gear.perk ? 'Swap perk:' : 'Add perk:', spans: [textSpan(upgrade.replacePerk, '#4ade80')] });
  if (rows.length === 0) return rows; // forgo upgrade — handled separately in template
  return rows;
}

function getGearPrice(gs: ReturnType<typeof getGameState>, gear: GearDefinition): number {
  const activeRaidId = uiState.activeRaidId || uiState.raidOrder[0] || '';
  const raidEntry = gs.unlockedRaids.find(r => r.id === activeRaidId);
  const adjustment = raidEntry?.gearPriceAdjustments?.[gear.id] ?? 0;
  const effectiveGear = getCachedActiveRaidGear(gs, gear.id);
  return Math.max(0, (effectiveGear.price || 0) + adjustment);
}

const gearEntries = computed<GearEntry[]>(() => {
  const gs = getGameState();
  const categoryId = uiState.gearUpgradeFocusCategory;
  if (!categoryId) return [];

  const unlocked = new Set(uiState.unlockedGear.length > 0 ? uiState.unlockedGear : gs.unlockedGear);
  const entries: GearEntry[] = [];

  gs.lib.gear.forEach((gear) => {
    if (gear.category !== categoryId) return;
    if (!unlocked.has(gear.id)) return;
    if (gear.countable && (uiState.countableGear[gear.id] || 0) <= 0) return;

    const xp = gs.gearXpById[gear.id] ?? 0;
    const thresholds = getGearUpgradeThresholds(gear);
    const appliedUpgradeIds = getAppliedGearUpgradeIds(gs, gear.id);
    const appliedCount = appliedUpgradeIds.length;
    const hasPendingUpgrade = getPendingGearUpgradeCount(gs, gear.id) > 0;
    const firstThreshold = thresholds[0] ?? 0;
    const prevThreshold = appliedCount > 0 ? (thresholds[appliedCount - 1] ?? 0) : 0;
    const targetXp = thresholds[appliedCount] ?? thresholds[thresholds.length - 1] ?? 0;
    const frame = atlasStorage.getItemsFrame(gear.image)!;
    const upgrades = Object.values(gear.ups);
    const remainingUpgradeSlots = thresholds.length - appliedCount;
    const remainingUpgradeChoices = upgrades.length - appliedCount;

    entries.push({
      id: gear.id,
      gear,
      currentXp: xp - prevThreshold,
      targetXp: targetXp - prevThreshold,
      spriteStyle: atlasSpriteStyle(source, frame, { size: 40, mode: 'fit', allowUpscale: false }),
      hasUpgrades: upgrades.length > 0,
      allPurchased: upgrades.length > 0 && appliedUpgradeIds.length >= upgrades.length,
      maskLevel: xp === 0 ? 'full' : (firstThreshold > 0 && xp < firstThreshold ? 'partial' : 'none'),
      hasMoreLevels: hasPendingUpgrade || appliedCount < thresholds.length,
      upgradeReady: hasPendingUpgrade,
      readyAnimationStyle: getReadyAnimationStyle(gear.id),
      isLastUpgrade: remainingUpgradeSlots === 1 && remainingUpgradeChoices > 1,
      upgrades: upgrades.map((upgrade) => {
        const purchased = appliedUpgradeIds.includes(upgrade.id);
        const available = hasPendingUpgrade && !purchased;
        const affordable = upgrade.skillPoints >= 0 || (uiState.skillPoints ?? 0) >= -upgrade.skillPoints;
        return {
          id: upgrade.id,
          title: upgrade.title,
          description: upgrade.changeDescription,
          rows: describeUpgrade(upgrade, gear),
          purchased,
          available,
          affordable,
          skillPoints: upgrade.skillPoints,
        };
      }),
    });
  });

  return entries.sort((a, b) => {
    const priceA = getGearPrice(gs, a.gear);
    const priceB = getGearPrice(gs, b.gear);
    if (priceA !== priceB) return priceA - priceB;
    return a.gear.name < b.gear.name ? -1 : 1;
  });
});

const entriesWithUpgrades = computed(() => gearEntries.value.filter(e => e.hasUpgrades));
const entriesWithoutUpgrades = computed(() => gearEntries.value.filter(e => !e.hasUpgrades));

function setCrossAngle(el: HTMLElement | null): void {
  if (!el) return;
  const parent = el.parentElement;
  if (!parent) return;
  const angle = Math.atan2(parent.offsetHeight, parent.offsetWidth) * (180 / Math.PI);
  el.style.setProperty('--cross-angle', `${angle}deg`);
}

function hoverUpgrade(upgrade: UpgradeEntry, maskLevel: GearEntry['maskLevel']): void {
  if (upgrade.purchased) return;
  if (maskLevel !== 'none') return;
  if (!upgrade.available) return;
  hoveredUpgradeId.value = upgrade.id;
  uiState.gearUpgradeHoveredSkillPoints = upgrade.skillPoints;
}

function unhoverUpgrade(): void {
  hoveredUpgradeId.value = null;
  uiState.gearUpgradeHoveredSkillPoints = 0;
}

function upgradeGear(gearId: string, upgradeId: string): void {
  const gs = getGameState();
  if (!canApplyGearUpgrade(gs, gearId, upgradeId)) return;
  hoveredUpgradeId.value = null;
  globalInputQueue.push(new CmdUpgradeGearItem({ gearId, upgradeId }));
}

</script>

<style scoped>
.xp-pane-header {
  font-size: 15px;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: 0.04em;
  padding: 0 12px;
  margin-bottom: 10px;
}

.xp-gear-list {
  display: grid;
  gap: 10px;
  overflow: visible;
}

.xp-gear-card {
  position: relative;
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: transparent;
  border-radius: 4px;
  overflow: visible;
}

.xp-gear-card-upgrade-ready {
  animation: xp-gear-card-ready var(--xp-gear-ready-duration) ease-in-out infinite;
  animation-delay: var(--xp-gear-ready-delay);
}

.xp-gear-card-upgrade-ready .xp-gear-icon,
.xp-gear-card-upgrade-ready .xp-gear-progress {
  animation: xp-gear-card-ready-accent var(--xp-gear-ready-duration) ease-in-out infinite;
  animation-delay: var(--xp-gear-ready-delay);
}

.xp-gear-hint {
  position: fixed;
  z-index: 10060;
  display: none;
  padding: 4px 10px;
  background: var(--hint-bg);
  border: 1px solid var(--hint-border);
  border-radius: 4px;
  pointer-events: none;
  min-width: 120px;
  width: max-content;
  max-width: 75vw;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.xp-gear-hint::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -6px;
  width: 10px;
  height: 10px;
  background: var(--hint-bg);
  border-right: 1px solid var(--hint-border);
  border-top: 1px solid var(--hint-border);
  transform: translateY(-50%) rotate(45deg);
}

.xp-gear-hint.visible {
  display: block;
}

.xp-gear-top {
  display: grid;
  grid-template-columns: 40px max-content;
  gap: 10px;
  align-items: center;
}

.xp-gear-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.xp-gear-sprite {
  image-rendering: auto;
}

.xp-gear-card.no-upgrades .xp-gear-sprite {
  opacity: 0.45;
}

.xp-gear-meta {
  display: grid;
  gap: 2px;
}

.xp-gear-progress {
  font-size: 15px;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.xp-upgrade-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;
  min-width: 0;
}

.xp-upgrade-panel {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr;
  flex: 0 0 240px;
  width: 240px;
  padding: 0;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  border-radius: 4px;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
  overflow: hidden;
}

.xp-upgrade-panel.actionable:hover {
  background: var(--raid-item-bg-hover, rgba(255,255,255,0.14));
}

.xp-upgrade-panel.purchased {
  background: rgba(74, 222, 128, 0.25);
  cursor: default;
  pointer-events: none;
}

.xp-upgrade-panel.unaffordable {
  background: rgba(239, 83, 80, 0.14);
  opacity: 0.5;
  cursor: default;
}

.xp-upgrade-panel.unaffordable .xp-upgrade-label,
.xp-upgrade-panel.unaffordable .xp-upgrade-value,
.xp-upgrade-panel.unaffordable .xp-upgrade-description,
.xp-upgrade-panel.unaffordable .xp-upgrade-forgo {
  opacity: 0.75;
}


.xp-upgrade-panel.disabled {
  background: rgba(255,255,255,0.05);
  color: var(--text-secondary);
  cursor: default;
}

.xp-upgrade-panel.disabled .xp-upgrade-label,
.xp-upgrade-panel.disabled .xp-upgrade-value {
  color: var(--text-secondary);
  opacity: 0.7;
}

.xp-upgrade-panel.exhausted {
  opacity: 0.3;
  pointer-events: none;
}

.xp-upgrade-panel.masked {
  user-select: none;
  cursor: default;
}

.xp-upgrade-content-hidden {
  visibility: hidden;
}

.xp-upgrade-mask {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: 0.02em;
  pointer-events: none;
  z-index: 1;
}

.xp-upgrade-mask.has-title {
  top: 25px;
}

.xp-upgrade-title {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  text-align: center;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.06);
}

.xp-upgrade-title-cost {
  background: rgba(239, 83, 80, 0.2);
}

.xp-upgrade-title-grant {
  background: rgba(74, 222, 128, 0.2);
}

.xp-upgrade-title-sp {
  margin-left: auto;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.xp-upgrade-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 10px;
}

.xp-upgrade-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
}

.xp-upgrade-description {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  line-height: 1.3;
}


.xp-upgrade-row {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 10px;
  align-items: baseline;
}

.xp-upgrade-label {
  color: var(--text-secondary);
  font-size: 12px;
  letter-spacing: 0.06em;
  font-weight: 800;
}

.xp-upgrade-value {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.xp-upgrade-value-part {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.xp-upgrade-weight-icon {
  width: 12px;
  height: 12px;
  display: inline-block;
}

.xp-upgrade-cross {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  overflow: hidden;
}

.xp-upgrade-cross::before,
.xp-upgrade-cross::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 141%;
  height: 6px;
  background: rgba(0, 0, 0, 0.7);
  transform-origin: center;
}

.xp-upgrade-cross::before {
  transform: translate(-50%, -50%) rotate(var(--cross-angle));
}

.xp-upgrade-cross::after {
  transform: translate(-50%, -50%) rotate(calc(-1 * var(--cross-angle)));
}

.xp-no-upgrade-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  opacity: 0.45;
}

.xp-no-upgrade-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.xp-no-upgrade-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  white-space: nowrap;
}

.xp-upgrade-forgo {
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  line-height: 1.3;
  padding: 4px 8px;
}

@keyframes xp-gear-card-ready {
  0%, 21.0526%, 100% {
    background: rgba(34, 197, 94, 0.04);
  }
  10.5263% {
    background: rgba(34, 197, 94, 0.08);
  }
}

@keyframes xp-gear-card-ready-accent {
  0%, 21.0526%, 100% {
    filter: brightness(1);
  }
  10.5263% {
    filter: brightness(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .xp-gear-card-upgrade-ready,
  .xp-gear-card-upgrade-ready .xp-gear-icon,
  .xp-gear-card-upgrade-ready .xp-gear-progress {
    animation: none;
  }
}

</style>
