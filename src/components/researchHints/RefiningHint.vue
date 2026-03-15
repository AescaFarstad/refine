<template>
  <div class="hint-root">
    <div class="hint-body">
      <div class="unlock-text">
        <template v-if="!cell.owned">Unlock: </template>
        <span class="disc-name">{{ title }}</span>
      </div>
      <div v-if="basicDescription" class="basic-desc"><RichHintText :text="basicDescription" /></div>
      <div v-for="(entry, idx) in entries" :key="idx" class="entry">
        <div class="entry-desc">
          <span v-if="entry.iconKey" class="entry-icon" :style="essenceIconStyle(entry.iconKey)" />
          <span>{{ entry.description }}</span>
          <span
            v-if="entry.resourceAmountText"
            class="resource-amount"
            :style="{ color: entry.resourceColor || 'inherit' }"
          >{{ entry.resourceAmountText }}</span>
        </div>
        <div class="entry-values">
          {{ entry.before }} -> <span class="new-value">{{ entry.after }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import RichHintText from './RichHintText.vue';
import { getGameState, uiState } from '../../logic/UIState';
import { ESSENCE_CREDITS, ESSENCE_CHRONOTRACES, ESSENCE_TEMPORAL_FLUX } from '../../logic/Const';
import { getResourceSpec } from '../../logic/Resources';
import atlasStorage from '../../logic/AtlasStorage';
import { atlasSpriteStyle } from '../../logic/AtlasSpriteStyle';
import { isResearchArchetypeRevealedByDiscovery } from '../../logic/ResearchLib';
import type { ReadonlyResearchArchetype, ReadonlyResearchCell, ReadonlyResearchNodeInstance } from '../../logic/UIState';

const props = defineProps<{
  cell: ReadonlyResearchCell;
  node: ReadonlyResearchNodeInstance | null;
  archetype: ReadonlyResearchArchetype | null;
}>();

interface RefiningHintEntry {
  description: string;
  before: string;
  after: string;
  iconKey?: string;
  resourceAmountText?: string;
  resourceColor?: string;
}

const atlasSource = atlasStorage.getItemsSource();

function essenceIconStyle(iconKey: string): Record<string, string> {
  const frame = atlasStorage.getItemsFrame(iconKey)!;
  return atlasSpriteStyle(atlasSource, frame, { size: 16, mode: 'fixed' });
}

const basicDescription = computed<string | null>(() => {
  const arch = props.archetype;
  if (!arch) return null;

  if (props.cell.owned) {
    return arch.ownedDescription || null;
  }

  if (isRevealedByDiscovery.value) {
    return arch.revealedDescription || null;
  }

  if (!arch.revealingDiscovery) {
    return null;
  }

  return arch.description || null;
});

const title = computed(() => {
  const arch = props.archetype;
  if (!arch) return '';
  if (props.cell.owned && arch.ownedTitle) return arch.ownedTitle;
  if (isRevealedByDiscovery.value) return arch.revealedTitle;
  return arch.title;
});

const isRevealedByDiscovery = computed(() => {
  uiState.discoveryCounter;
  const arch = props.archetype;
  if (!arch) return false;
  return isResearchArchetypeRevealedByDiscovery(arch, getGameState().discoveries);
});

const entries = computed<RefiningHintEntry[]>(() => {
  if (!props.cell.owned && !isRevealedByDiscovery.value) {
    return [];
  }
  const gs = getGameState();
  const rewards = props.archetype?.rewards ?? [];
  const out: RefiningHintEntry[] = [];

  for (const reward of rewards) {
    switch (reward.kind) {
      case 'refining_red_essence_resource_bonus': {
        const before = ESSENCE_CREDITS + gs.refiningRedEssenceResourceBonus;
        const after = before + reward.amount;
        const spec = getResourceSpec('credits');
        out.push({
          description: 'essence gives',
          before: `${before}`,
          after: `${after}`,
          iconKey: 'red',
          resourceAmountText: `+${reward.amount}${spec.glyph}`,
          resourceColor: spec.color,
        });
        break;
      }
      case 'refining_green_essence_resource_bonus': {
        const before = ESSENCE_TEMPORAL_FLUX + gs.refiningGreenEssenceResourceBonus;
        const after = before + reward.amount;
        const spec = getResourceSpec('timeFlux');
        out.push({
          description: 'essence gives',
          before: `${before}`,
          after: `${after}`,
          iconKey: 'green',
          resourceAmountText: `+${reward.amount}${spec.glyph}`,
          resourceColor: spec.color,
        });
        break;
      }
      case 'refining_blue_essence_resource_bonus': {
        const before = ESSENCE_CHRONOTRACES + gs.refiningBlueEssenceResourceBonus;
        const after = before + reward.amount;
        const spec = getResourceSpec('chronotraces');
        out.push({
          description: 'essence gives',
          before: `${before}`,
          after: `${after}`,
          iconKey: 'blue',
          resourceAmountText: `+${reward.amount}${spec.glyph}`,
          resourceColor: spec.color,
        });
        break;
      }
      case 'refining_yellow_neighbor_bonus': {
        const before = 1 + gs.refiningYellowNeighborBonus;
        const after = before + reward.amount;
        out.push({
          description: `adjacent bonus: +${reward.amount}`,
          before: `${before}`,
          after: `${after}`,
          iconKey: 'yellow',
        });
        break;
      }
      case 'refining_yield_pct_bonus': {
        const before = gs.refiningYieldPctBonus;
        const after = before + reward.amount;
        out.push({
          description: `Refining yield bonus +${reward.amount}%`,
          before: `+${before}%`,
          after: `+${after}%`,
        });
        break;
      }
      case 'refining_success_chance_bonus': {
        const before = gs.refiningSuccessChanceBonus;
        const after = before + reward.amount;
        out.push({
          description: `Refining success chance bonus +${reward.amount}%`,
          before: `+${before}%`,
          after: `+${after}%`,
        });
        break;
      }
      case 'refining_speed_pct_bonus': {
        const before = gs.refiningSpeedPctBonus;
        const after = before + reward.amount;
        out.push({
          description: `Refining speed bonus +${reward.amount}%`,
          before: `+${before}%`,
          after: `+${after}%`,
        });
        break;
      }
    }
  }

  return out;
});
</script>

<style scoped>
.hint-root {
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  min-width: 240px;
}

.hint-body {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
}

.unlock-text {
  white-space: nowrap;
}

.disc-name {
  color: rgba(34, 197, 94, 0.95);
  font-weight: 700;
}

.basic-desc {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.85;
  white-space: normal;
}

.entry {
  margin-top: 6px;
}

.entry:first-child {
  margin-top: 0;
}

.entry-desc {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.entry-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.entry-values {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}

.resource-amount {
  font-weight: 800;
}

.new-value {
  color: rgba(34, 197, 94, 0.95);
}
</style>
