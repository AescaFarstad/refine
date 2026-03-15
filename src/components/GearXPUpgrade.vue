<template>
  <section class="xp-pane">
    <div class="xp-pane-header">Upgrade or downgrade items in exchange for skill points {{ skillPointsSpec.glyph }}</div>
    <div class="xp-gear-list">
      <div v-for="entry in gearEntries" :key="entry.id" :class="['xp-gear-card', { 'no-upgrades': !entry.hasUpgrades }]">
        <div v-if="entry.hasUpgrades" class="xp-gear-hint">
          <GearStatsHint :gear="entry.gear" />
        </div>

        <div class="xp-gear-top">
          <div class="xp-gear-icon">
            <div class="xp-gear-sprite" :style="entry.spriteStyle" />
          </div>
          <div v-if="entry.hasUpgrades && !entry.allPurchased" class="xp-gear-meta">
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
              actionable: upgrade.enabled,
              disabled: !upgrade.purchased && !upgrade.enabled,
              masked: entry.maskedUpgrades,
              unaffordable: !upgrade.purchased && noSkillPoints,
            }]"
            @click="upgradeGear(entry.id, upgrade.id)"
          >
            <div v-if="entry.maskedUpgrades" class="xp-upgrade-mask">?</div>
            <div class="xp-upgrade-body">
              <div class="xp-upgrade-stats">
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
              <div v-if="!upgrade.purchased" :class="['xp-upgrade-cost', { invisible: entry.maskedUpgrades }]">{{ skillPointsSpec.glyph }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import type { GearDefinition, GearUpgradeDefinition } from '../logic/GearLib';
import { getGameState, uiState } from '../logic/UIState';
import { getAppliedGearUpgradeIds, getCachedActiveRaidGear, getGearUpgradeThresholds, getPendingGearUpgradeCount } from '../logic/GearUpgrades';
import { getResourceSpec } from '../logic/Resources';
import { globalInputQueue } from '../logic/Model';
import { CmdUpgradeGearItem } from '../logic/input/InputCommands';
import GearStatsHint from './GearStatsHint.vue';

type UpgradeSpan = { text: string; color?: string; weightIcon?: boolean };
type UpgradeRow = { label: string; spans: UpgradeSpan[] };
type UpgradeEntry = { id: string; rows: UpgradeRow[]; purchased: boolean; enabled: boolean };
type GearEntry = {
  id: string;
  gear: GearDefinition;
  currentXp: number;
  targetXp: number;
  spriteStyle: Record<string, string>;
  hasUpgrades: boolean;
  allPurchased: boolean;
  maskedUpgrades: boolean;
  upgrades: UpgradeEntry[];
};

const noSkillPoints = computed(() => (uiState.skillPoints ?? 0) < 1);
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

function describeUpgrade(upgrade: GearUpgradeDefinition): UpgradeRow[] {
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
  if (rows.length === 0) rows.push({ label: 'Effect', spans: [textSpan('No stat change')] });
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

    entries.push({
      id: gear.id,
      gear,
      currentXp: xp - prevThreshold,
      targetXp: targetXp - prevThreshold,
      spriteStyle: atlasSpriteStyle(source, frame, { size: 40, mode: 'fit', allowUpscale: false }),
      hasUpgrades: upgrades.length > 0,
      allPurchased: upgrades.length > 0 && appliedUpgradeIds.length >= upgrades.length,
      maskedUpgrades: firstThreshold > 0 && xp < firstThreshold,
      upgrades: upgrades.map((upgrade) => ({
        id: upgrade.id,
        rows: describeUpgrade(upgrade),
        purchased: appliedUpgradeIds.includes(upgrade.id),
        enabled: hasPendingUpgrade && !appliedUpgradeIds.includes(upgrade.id),
      })),
    });
  });

  return entries.sort((a, b) => {
    const priceA = getGearPrice(gs, a.gear);
    const priceB = getGearPrice(gs, b.gear);
    if (priceA !== priceB) return priceA - priceB;
    return a.gear.name < b.gear.name ? -1 : 1;
  });
});

function upgradeGear(gearId: string, upgradeId: string): void {
  const gs = getGameState();
  if (getAppliedGearUpgradeIds(gs, gearId).includes(upgradeId)) return;
  if (getPendingGearUpgradeCount(gs, gearId) <= 0) return;
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
  grid-template-columns: 140px 1fr;
  min-width: 650px;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: transparent;
  border-radius: 4px;
  overflow: visible;
}

.xp-gear-hint {
  position: absolute;
  right: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  display: none;
  z-index: 10060;
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

.xp-gear-card:hover .xp-gear-hint {
  display: block;
}

.xp-gear-card.no-upgrades:hover .xp-gear-hint {
  display: none;
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
  flex-wrap: nowrap;
  gap: 8px;
  align-items: stretch;
}

.xp-upgrade-panel {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 8px 10px;
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
  padding-right: 16px;
  background: rgba(74, 222, 128, 0.25);
  cursor: default;
  pointer-events: none;
}

.xp-upgrade-panel.unaffordable {
  background: rgba(239, 83, 80, 0.18);
  cursor: default;
  pointer-events: none;
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

.xp-upgrade-panel.masked {
  user-select: none;
}

.xp-upgrade-panel.masked .xp-upgrade-row {
  opacity: 0;
  user-select: none;
  pointer-events: none;
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
}

.xp-upgrade-body {
  display: flex;
  gap: 12px;
  align-items: stretch;
  flex: 1 1 auto;
}

.xp-upgrade-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
}

.xp-upgrade-cost {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  padding: 0 8px;
  margin: -8px 0;
  background: rgba(239, 83, 80, 0.25);
  font-size: 14px;
  font-weight: 900;
  color: var(--text-primary);
  white-space: nowrap;
  letter-spacing: 0.04em;
  border-radius: 0 4px 4px 0;
}

.xp-upgrade-cost.invisible {
  visibility: hidden;
}

.xp-upgrade-row {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 8px;
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

</style>
