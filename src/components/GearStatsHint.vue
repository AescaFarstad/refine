<template>
  <div>
    <div v-if="blocked" class="blocked-warning">No spare slots in this category</div>
    <div v-if="blocked" class="blocked-warning">(Use ◌ skill points to unlock more slots)</div>
    <div :class="['hint-row', row.className]" v-for="(row, i) in hintRows" :key="i">
      <span v-if="row.label" class="hint-label">{{ row.label }}</span>
      <span class="hint-value" :style="!row.label ? { gridColumn: '1 / -1' } : undefined">
        <span v-for="(s, j) in row.spans" :key="j" :class="{ dim: s.dim }" :style="s.color ? { color: s.color } : undefined">{{ s.text }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GearDefinition } from '../logic/GearLib';
import { formatDurationHM } from '../logic/StringUtils';
import { getResourceSpec } from '../logic/Resources';
import { getGameState, uiState } from '../logic/UIState';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { getAppliedGearUpgradeIds, getCachedActiveRaidGear, getGearUpgradeThresholds } from '../logic/GearUpgrades';

const creditsSpec = getResourceSpec('credits');

const props = withDefaults(defineProps<{
  gear: GearDefinition;
  blocked?: boolean;
  showResourceContext?: boolean;
  noRaidContext?: boolean;
}>(), {
  showResourceContext: true,
  noRaidContext: false,
});

function fmtSigned(n: number, suffix = ''): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

type HintSpan = { text: string; color?: string; dim?: boolean };
type HintRow = { label: string; spans: HintSpan[]; className?: string };

function bright(text: string): HintSpan { return { text }; }
function dim(text: string): HintSpan { return { text, dim: true }; }
function colored(text: string, color: string): HintSpan { return { text, color }; }

const displayGear = computed((): GearDefinition => {
  if (props.noRaidContext) return props.gear;
  uiState.raidKey;
  const gs = getGameState();
  if (!gs || !gs.raid.id) return props.gear;
  return getCachedActiveRaidGear(gs, props.gear.id);
});

const hintRows = computed((): HintRow[] => {
  const g = displayGear.value;
  const rawGear = props.gear;
  const rows: HintRow[] = [];
  const xpRows: HintRow[] = [];

  const skipRaid = props.noRaidContext;

  let gs: ReturnType<typeof getGameState> | null = null;
  let storedCredits = 0;
  let storageCap = 0;
  let currentGenerationPerHour = 0;
  let gatherPacks = 0;

  if (!skipRaid) {
    uiState.raidKey;
    gs = getGameState();
    const activeRaidId = gs.raid.id || gs.unlockedRaids[0]?.id || '';
    const activeRaidEntry = activeRaidId ? gs.unlockedRaids.find(r => r.id === activeRaidId) || null : null;
    storedCredits = Math.max(0, Math.floor(activeRaidEntry?.uncollectedCredits ?? 0));
    storageCap = Math.max(0, Math.floor(activeRaidEntry?.maxStoredCredits ?? 0));
    currentGenerationPerHour = Math.max(0, Math.floor(activeRaidEntry?.passiveCreditsPerHour ?? 0));
    const freeVolume = Math.max(0, Math.floor((gs.raid.bagsVolume || 0) - (gs.raid.usedVolume || 0)));
    gatherPacks = Math.max(0, Math.min(Math.floor(storedCredits / 100), freeVolume));
  }

  if (props.showResourceContext) {
    if (g.id === 'gather_resources') {
      if (g.description) rows.push({ label: '', spans: [dim(g.description)] });
      rows.push({ label: 'Collect', spans: [bright(`${gatherPacks} packs`), dim(' (currently stored: '), colored(`${storedCredits}/${storageCap}${creditsSpec.glyph}`, creditsSpec.color), dim(')')] });
      rows.push({ label: 'Each pack takes', spans: [bright('1'), dim(' volume and contains '), colored(`100${creditsSpec.glyph}`, creditsSpec.color)] });
    }
  }

  if (g.damage) rows.push({ label: 'Damage', spans: [bright(`${fmtSigned(g.damage)}`)] });
  if (g.speedPercent) rows.push({ label: 'Walking speed', spans: [bright(`${fmtSigned(g.speedPercent, '%')}`)] });
  if (g.speedFlat) rows.push({ label: 'Flat speed bonus', spans: [bright(`${fmtSigned(g.speedFlat, ' km/h')}`)] });
  if (g.walkMultiplier !== 1) rows.push({ label: 'Walk distance', spans: [bright(`×${g.walkMultiplier}`)] });
  if (g.walkDelta !== 0) rows.push({ label: 'Walk distance', spans: [bright(`${fmtSigned(g.walkDelta)} km`)] });
  if (g.chanceToHit) rows.push({ label: 'Hit chance', spans: [bright(`${fmtSigned(g.chanceToHit, '%')}`)] });

  if (g.hp) rows.push({ label: 'HP', spans: [bright(`${fmtSigned(g.hp)}${g.hp < 0 ? ' (loss)' : ''}`)] });
  if (g.hpMult !== 1) rows.push({ label: 'HP multiplier', spans: [bright(`×${g.hpMult}`)] });

  if (g.regenPerKm) rows.push({ label: 'Regen', spans: [bright(`${fmtSigned(g.regenPerKm)} hp/km${g.regenPerKm < 0 ? ' (loss)' : ''}`)] });
  if (g.regenAfterCombat) rows.push({ label: 'Regen after combat', spans: [bright(`${fmtSigned(g.regenAfterCombat)} hp${g.regenAfterCombat < 0 ? ' (loss)' : ''}`)] });
  if (g.regenPer10Minutes) rows.push({ label: 'Regen per 10 min', spans: [bright(`${fmtSigned(g.regenPer10Minutes)} hp${g.regenPer10Minutes < 0 ? ' (loss)' : ''}`)] });

  if (g.prepTimeMin) rows.push({ label: 'Prep time', spans: [bright(`${g.prepTimeMin} min`)] });
  if (g.chanceToBlock) rows.push({ label: 'Block chance', spans: [bright(`${fmtSigned(g.chanceToBlock, '%')}`)] });
  if (g.armor) rows.push({ label: 'Armor', spans: [bright(`${fmtSigned(g.armor)}`)] });
  if (g.attackSkipCount) rows.push({ label: 'Attack skips', spans: [bright(`${fmtSigned(g.attackSkipCount)}`)] });
  if (g.reflectOnHitPct) rows.push({ label: 'Reflect on hit', spans: [bright(`${fmtSigned(g.reflectOnHitPct, '%')}`)] });
  if (g.reflectOnBlockPct) rows.push({ label: 'Reflect on block', spans: [bright(`${fmtSigned(g.reflectOnBlockPct, '%')}`)] });
  if (g.stunChance) rows.push({ label: 'Stun chance', spans: [bright(`${fmtSigned(g.stunChance, '%')}`)] });

  if (g.lootChance) rows.push({ label: 'Loot chance', spans: [bright(`${fmtSigned(g.lootChance, '%')}`)] });
  if (g.rarityBuff) rows.push({ label: 'Loot rarity', spans: [bright(`${fmtSigned(g.rarityBuff, '')}`)] });
  if (g.raidPassiveCreditsPerHour) {
    if (!skipRaid) {
      const newGen = currentGenerationPerHour + Math.max(0, Math.floor(g.raidPassiveCreditsPerHour));
      if (currentGenerationPerHour > 0) {
        rows.push({ label: 'Raid credits generation', spans: [colored(`${currentGenerationPerHour}/h → ${newGen}/h${creditsSpec.glyph}`, creditsSpec.color), dim(' (permanent)')] });
      } else {
        rows.push({ label: 'Raid credits generation', spans: [colored(`${fmtSigned(g.raidPassiveCreditsPerHour, '')}${creditsSpec.glyph}`, creditsSpec.color), dim(' per hour (permanent)')] });
      }
    } else {
      rows.push({ label: 'Raid credits generation', spans: [colored(`${fmtSigned(g.raidPassiveCreditsPerHour, '')}${creditsSpec.glyph}`, creditsSpec.color), dim(' per hour (permanent)')] });
    }
  }
  if (g.raidResourceStorageBonus) {
    if (!skipRaid) {
      const newCap = storageCap + Math.max(0, Math.floor(g.raidResourceStorageBonus));
      if (storageCap > 0) {
        rows.push({ label: 'Raid credits storage capacity', spans: [colored(`${storageCap} → ${newCap}${creditsSpec.glyph}`, creditsSpec.color), dim(' (permanent)')] });
      } else {
        rows.push({ label: 'Raid credits storage capacity', spans: [colored(`+${g.raidResourceStorageBonus}${creditsSpec.glyph}`, creditsSpec.color), dim(' (permanent)')] });
      }
    } else {
      rows.push({ label: 'Raid credits storage capacity', spans: [colored(`+${g.raidResourceStorageBonus}${creditsSpec.glyph}`, creditsSpec.color), dim(' (permanent)')] });
    }
  }
  if (g.biopsyChance) rows.push({ label: 'Remains harvest chance', spans: [bright(`${fmtSigned(g.biopsyChance, '%')}`)] });
  if (g.maxWeight) rows.push({ label: 'Max weight', spans: [bright(`${fmtSigned(g.maxWeight)}`)] });
  if (g.volume) rows.push({ label: 'Volume', spans: [bright(`${fmtSigned(g.volume)}`)] });
  if (g.zoneBoost) rows.push({ label: 'Zone stability', spans: [bright(`+${formatDurationHM(g.zoneBoost)}`), dim(' (permanent)')] });
  if (g.priceChange) rows.push({ label: 'Price change', spans: [colored(`${fmtSigned(g.priceChange)}${creditsSpec.glyph}`, creditsSpec.color), dim(' for each usage in the raid')] });
  if (g.reimbursed) rows.push({ label: `Reimbursement: `, spans: [bright(`${g.reimbursed}%`)] });
  // Perk
  if (g.perk) rows.push({ label: 'Perk', spans: [bright(g.perk)] });

  if (g.stunChance && !skipRaid && gs) {
    const loadout = gs.loadouts[gs.raid.id] ?? [];
    const equipped = loadout.includes(g.id);
    const total = equipped
      ? gs.raid.stunChance
      : 100 - (100 - gs.raid.stunChance) * (100 - g.stunChance) / 100;
    if (total !== g.stunChance) {
      rows.push({ label: 'Total stun chance', spans: [bright(`${Math.round(total)}%`)] });
    }
  }

  // Description (skip for gather_resources, already shown above)
  if (g.description && g.id !== 'gather_resources') rows.push({ label: '', spans: [bright(g.description)] });

  if (!skipRaid) {
    uiState.gearXpById;
    uiState.gearUpgradeIdsById;
    uiState.skillPoints;
    uiState.discoveryCounter;
    const gs = getGameState();
    if (gs && rawGear.xp.length > 0 && (gs.discoveries[DISCOVERY.GEAR_XP] === true || (gs.gearXpById[rawGear.id] ?? 0) > 0 || (gs.gearUpgradeIdsById[rawGear.id]?.length ?? 0) > 0)) {
      const xp = gs.gearXpById[rawGear.id] ?? 0;
      const thresholds = getGearUpgradeThresholds(rawGear);
      const appliedCount = getAppliedGearUpgradeIds(gs, rawGear.id).length;
      if (appliedCount < thresholds.length) {
        const prevThreshold = appliedCount > 0 ? thresholds[appliedCount - 1] : 0;
        const nextThreshold = thresholds[appliedCount];
        const relativeXp = xp - prevThreshold;
        const relativeMax = nextThreshold - prevThreshold;
        xpRows.push({ label: 'XP', spans: [bright(`${relativeXp}`), dim(` / ${relativeMax}`)], className: 'xp-row' });
      }
    }
  }

  rows.push(...xpRows);
  return rows;
});
</script>

<style scoped>

.blocked-warning {
  color: #f87171;
  font-weight: 900;
  font-size: 14px;
  margin-bottom: 6px;
  white-space: nowrap;
}

.hint-row {
  white-space: nowrap;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 8px;
  align-items: baseline;
  margin: 2px 0;
}

.hint-row.xp-row {
  margin-top: 10px;
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
  white-space: pre-line;
}

.dim {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
</style>
