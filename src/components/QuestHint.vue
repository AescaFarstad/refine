<template>
  <div class="quest-hint" role="tooltip">
    <div class="hint-row" v-for="(row, i) in hintSections" :key="i">
      <span class="hint-label">{{ row.label }}</span>
      <span class="hint-value" v-if="row.value !== null">{{ row.value }}</span>
      <span class="hint-value" v-else>
        <span v-for="(chip, j) in row.chips" :key="j" class="chip" :class="chip.class" :style="chip.style">{{ chip.text }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameLib, getGameState } from '../logic/UIState';
import type { QuestDefinition } from '../logic/QuestLib';
import { describeMutation } from '../logic/RaidMutation';
import { getResourceSpec, type ResourceKey } from '../logic/Resources';

const props = defineProps<{
  quest: QuestDefinition;
}>();

type ChipStyle = Record<string, string>;
type HintChip = { text: string; class: string; style?: ChipStyle };
type HintRow = { label: string; value: string | null; chips: HintChip[] };

function chipStyleForResource(key: ResourceKey): ChipStyle {
  const spec = getResourceSpec(key);
  return {
    color: spec.color,
    background: spec.bgColor,
  };
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

const hintSections = computed<HintRow[]>(() => {
  const q = props.quest;
  const out: HintRow[] = [];
  const encs = q.encounters;
  if (encs.length) {
    const gs = getGameState();
    const desc = encs
      .map(m => describeMutation(gs!, m))
      .filter((s): s is string => !!s && s.length > 0)
      .join('; ');
    if (desc) out.push({ label: 'Active effects:', value: desc, chips: [] });
  }

  const rewards = q.rewards;
  const gs = getGameState();
  const lib = getGameLib();

  for (const r of rewards) {
    if (r.kind === 'raid_loot_chance') {
      out.push({ label: 'Raid:', value: `Loot chance ${r.delta >= 0 ? '+' : ''}${r.delta}%`, chips: [] });
    } else if (r.kind === 'raid_rarity_buff') {
      out.push({ label: 'Raid:', value: `Loot rarity ${r.delta >= 0 ? '+' : ''}${r.delta}`, chips: [] });
    } else if (r.kind === 'raid_mutation' && gs) {
      const desc = describeMutation(gs, r.mutation);
      if (desc) out.push({ label: 'Raid:', value: desc, chips: [] });
    } else if (r.kind === 'raid_add_item' && lib) {
      if (q.showAddedItems) {
        const name = lib.getItem(r.itemId).name;
        out.push({ label: 'Raid:', value: `Drops: ${name}`, chips: [] });
      } else {
        out.push({ label: 'Raid:', value: 'New items can be found in raid', chips: [] });
      }
    } else if (r.kind === 'unlock_raid') {
      out.push({ label: 'Reward:', value: 'Discover a new raid location', chips: [] });
    }
  }

  const rewardChips = formatRewardsChips(q);
  if (rewardChips.length) out.push({ label: 'Rewards:', value: null, chips: rewardChips });
  return out;
});
</script>

<style scoped>
.quest-hint {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 8px;
  align-items: baseline;
}

.hint-row {
  white-space: nowrap;
  display: contents;
}

.hint-label {
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 0.06em;
  font-weight: 800;
}

.hint-value {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 800;
}

.chip {
  display: inline-flex;
  align-items: baseline;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  margin-right: 6px;
}

.chip:last-child {
  margin-right: 0;
}

.chip.unlocks {
  color: rgba(251, 146, 60, 0.95);
  background: rgba(251, 146, 60, 0.10);
}
</style>
