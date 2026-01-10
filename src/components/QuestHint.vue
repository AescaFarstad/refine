<template>
  <div class="quest-hint" role="tooltip">
    <template v-for="(section, i) in hintSections" :key="i">
      <div v-if="section.type === 'simple'" class="hint-row">
        <span class="hint-label">{{ section.label }}</span>
        <span class="hint-value">{{ section.value }}</span>
      </div>
      <div v-else-if="section.type === 'heading'" class="hint-section" :class="{ 'space-before': section.spaceBefore }">
        <div class="section-heading">{{ section.heading }}</div>
        <div v-for="(item, j) in section.items" :key="j" class="hint-item">
          <span class="bullet" :class="item.sentiment"></span>
          <span class="item-text" v-html="highlightNumbers(item.text)"></span>
        </div>
      </div>
      <div v-else-if="section.type === 'chips'" class="hint-row">
        <span class="hint-label">{{ section.label }}</span>
        <span class="hint-value">
          <span v-for="(chip, j) in section.chips" :key="j" class="chip" :class="chip.class" :style="chip.style">{{ chip.text }}</span>
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameLib, getGameState } from '../logic/UIState';
import type { QuestDefinition } from '../logic/QuestLib';
import { describeMutation } from '../logic/RaidMutation';
import { getResourceSpec, type ResourceKey } from '../logic/Resources';
import type { Reward } from '../logic/Reward';
import type { RaidMutation } from '../logic/RaidMutation';

const props = defineProps<{
  quest: QuestDefinition;
}>();

function highlightNumbers(text: string): string {
  // Match numbers with optional +/- prefix and % suffix
  return text.replace(/([+-]?\d+%?)/g, '<span class="highlight">$1</span>');
}

type ChipStyle = Record<string, string>;
type HintChip = { text: string; class: string; style?: ChipStyle };
type HintItem = { text: string; sentiment: 'positive' | 'negative' };
type HintSection =
  | { type: 'simple'; label: string; value: string }
  | { type: 'heading'; heading: string; items: HintItem[]; spaceBefore?: boolean }
  | { type: 'chips'; label: string; chips: HintChip[] };

function chipStyleForResource(key: ResourceKey): ChipStyle {
  const spec = getResourceSpec(key);
  return {
    color: spec.color,
    background: spec.bgColor,
  };
}

function determineSentiment(reward: Reward): 'positive' | 'negative' | undefined {
  // Check explicit sentiment override
  if ('sentiment' in reward && reward.sentiment) {
    return reward.sentiment;
  }

  // Infer sentiment based on reward type and values
  if (reward.kind === 'raid_loot_chance') {
    return reward.delta >= 0 ? 'positive' : 'negative';
  } else if (reward.kind === 'raid_rarity_buff') {
    return reward.delta >= 0 ? 'positive' : 'negative';
  } else if (reward.kind === 'raid_mutation') {
    return determineMutationSentiment(reward.mutation);
  } else if (reward.kind === 'raid_add_item') {
    return 'positive'; // New items are generally positive
  } else if (reward.kind === 'unlock_raid') {
    return 'positive'; // Unlocking locations is positive
  }
  return undefined;
}

function determineMutationSentiment(mutation: RaidMutation): 'positive' | 'negative' | undefined {
  switch (mutation.kind) {
    case 'LootMutation':
      return mutation.count >= 0 ? 'positive' : 'negative';
    case 'WalkMutation':
      return mutation.count >= 0 ? 'negative' : 'positive'; // More distance is negative
    case 'AddMonsterMutation':
      return mutation.count >= 0 ? 'negative' : 'positive'; // Adding monsters is negative
    case 'LootDifficultyMutation':
      return mutation.amount >= 0 ? 'positive' : 'negative';
    case 'UpgradeMonsterMutation':
      return 'negative'; // Upgrading monsters is generally negative
    case 'QuestMutation':
      return mutation.count >= 0 ? 'positive' : 'negative';
    case 'ZoneCollapseTimeMutation':
      return mutation.amount >= 0 ? 'positive' : 'negative'; // More time is positive
  }
}

function formatRewardsChips(q: QuestDefinition): HintChip[] {
  const rewards = q.rewards;
  const chips: HintChip[] = [];

  const resourceTotals: Record<string, number> = {};
  let raidUnlockCount = 0;

  for (const r of rewards) {
    if (r.kind === 'resource') {
      resourceTotals[r.resource] = (resourceTotals[r.resource] || 0) + r.amount;
    } else if (r.kind === 'unlock_raid') {
      raidUnlockCount++;
    }
  }

  const resourceKeys = ['skillPoints', 'credits', 'chronotraces', 'timeFlux', 'shardDust'] as const;
  for (const k of resourceKeys) {
    const v = resourceTotals[k] || 0;
    if (v > 0) chips.push({ text: `+${v}${getResourceSpec(k).glyph}`, class: 'res', style: chipStyleForResource(k) });
  }

  if (raidUnlockCount > 0) chips.push({ text: 'New raid location', class: 'unlocks' });

  return chips;
}

const hintSections = computed<HintSection[]>(() => {
  const q = props.quest;
  const out: HintSection[] = [];

  if (q.encounterTimeMin > 0) {
    out.push({ type: 'simple', label: 'Duration:', value: `${q.encounterTimeMin} min` });
  }

  const encs = q.encounters;
  if (encs.length) {
    const gs = getGameState();
    const items: HintItem[] = [];
    for (const enc of encs) {
      const desc = describeMutation(gs!, enc);
      if (desc && desc.length > 0) {
        const encSentiment = determineMutationSentiment(enc);
        if (encSentiment) {
          items.push({ text: desc, sentiment: encSentiment });
        }
      }
    }
    if (items.length > 0) {
      out.push({ type: 'heading', heading: 'Active effects', items });
    }
  }

  const rewards = q.rewards;
  const gs = getGameState();
  const lib = getGameLib();

  const outcomeItems: HintItem[] = [];
  for (const r of rewards) {
    const sentiment = determineSentiment(r);
    if (r.kind === 'raid_loot_chance' && sentiment) {
      outcomeItems.push({ text: `Loot chance ${r.delta >= 0 ? '+' : ''}${r.delta}%`, sentiment });
    } else if (r.kind === 'raid_rarity_buff' && sentiment) {
      outcomeItems.push({ text: `Loot rarity ${r.delta >= 0 ? '+' : ''}${r.delta}`, sentiment });
    } else if (r.kind === 'raid_mutation' && gs && sentiment) {
      const desc = describeMutation(gs, r.mutation);
      if (desc) {
        outcomeItems.push({ text: desc, sentiment });
      }
    } else if (r.kind === 'raid_add_item' && lib && sentiment) {
      if (q.showAddedItems) {
        const name = lib.getItem(r.itemId).name;
        outcomeItems.push({ text: `Drops: ${name}`, sentiment });
      } else {
        outcomeItems.push({ text: 'New items can be found in raid', sentiment });
      }
    } else if (r.kind === 'unlock_raid' && sentiment) {
      outcomeItems.push({ text: 'Discover a new raid location', sentiment });
    }
  }

  if (outcomeItems.length > 0) {
    out.push({ type: 'heading', heading: 'Outcome', items: outcomeItems, spaceBefore: true });
  }

  const rewardChips = formatRewardsChips(q);
  if (rewardChips.length) {
    out.push({ type: 'chips', label: 'Rewards:', chips: rewardChips });
  }
  return out;
});
</script>

<style scoped>
.quest-hint {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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

.hint-section.space-before {
  margin-top: 8px;
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

.bullet {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bullet.positive {
  background: rgb(34, 197, 94);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
}

.bullet.negative {
  background: rgb(239, 68, 68);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
}

.item-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-weight: 600;
}

.item-text :deep(.highlight) {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
}

.chip {
  display: inline-flex;
  align-items: baseline;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  margin-right: 8px;
  font-size: 13px;
}

.chip:last-child {
  margin-right: 0;
}

.chip.unlocks {
  color: rgba(251, 146, 60, 0.95);
  background: rgba(251, 146, 60, 0.10);
}
</style>
