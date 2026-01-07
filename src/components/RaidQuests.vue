<template>
  <div v-if="quests.length > 0">
    <div class="section-title">Investigations</div>
    <hr class="section-divider" />

    <ul class="quest-list">
      <li
        v-for="q in quests"
        :key="q.id"
        class="quest"
        :class="{ clickable: !q.autoaccept, accepted: q.autoaccept || isActive(q.id) }"
        @click="onQuestClick(q)"
      >
        <div class="q-head">
          <span class="q-name">{{ q.name }}</span>
          <span class="tag auto" v-if="q.autoaccept">Auto-accepted</span>
        </div>
        <div class="hint" role="tooltip">
          <div class="hint-row" v-for="(row, i) in hintSections(q)" :key="i">
            <span class="hint-label">{{ row.label }}</span>
            <span class="hint-value" v-if="row.value !== null">{{ row.value }}</span>
            <span class="hint-value" v-else>
              <span v-for="(chip, j) in row.chips" :key="j" class="chip" :class="chip.class" :style="chip.style">{{ chip.text }}</span>
            </span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameLib, getGameState } from '../logic/UIState';
import type { QuestDefinition } from '../logic/QuestLib';
import { globalInputQueue } from '../logic/Model';
import { CmdToggleQuest } from '../logic/input/InputCommands';
import { describeMutation, questIsAvailable } from '../logic/RaidMutation';
import { getResourceSpec, type ResourceKey } from '../logic/Resources';

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));

// All quests for the selected raid (hide completed)
const quests = computed<QuestDefinition[]>(() => {
  // Touch reactive keys so recompute happens on raid selection and outcomes
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.raidKey;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lastOutcome;

  const lib = getGameLib();
  const id = activeRaidId.value;
  if (!lib || !id) return [];
  const gs = getGameState();
  if (!gs) return [];
  const arr: QuestDefinition[] = [];
  lib.quests.forEach((q) => {
    if (!questIsAvailable(gs, q, id)) return;
    arr.push(q);
  });
  // Sort by name
  arr.sort((a, b) => (a.name < b.name ? -1 : 1));
  return arr;
});

function isActive(id: string): boolean {
  // Depend on reactive ui mirror for reactivity
  return uiState.activeQuests.includes(id);
}

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
  let unlockCount = 0;

  for (const r of rewards) {
    if (r.kind === 'resource') {
      resourceTotals[r.resource] = (resourceTotals[r.resource] || 0) + r.amount;
    } else if (r.kind === 'unlock' || r.kind === 'unlock_raid' || r.kind === 'unlock_gear' || r.kind === 'unlock_quest') {
      unlockCount++;
    }
  }

  const resourceKeys = ['skillPoints', 'credits', 'chronotraces', 'timeFlux', 'shardDust'] as const;
  for (const k of resourceKeys) {
    const v = resourceTotals[k] || 0;
    if (v > 0) chips.push({ text: `+${v}${getResourceSpec(k).glyph}`, class: 'res', style: chipStyleForResource(k) });
  }

  if (unlockCount > 0) chips.push({ text: `Unlocks ${unlockCount}`, class: 'unlocks' });

  return chips;
}

function onQuestClick(q: QuestDefinition): void {
  if (q.autoaccept) return; // clicking does nothing
  const next = !isActive(q.id);
  globalInputQueue.push(new CmdToggleQuest({ id: q.id, active: next }));
}

function hintSections(q: QuestDefinition): HintRow[] {
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
}
</script>

<style scoped>
.section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; text-align: center; }
.section-divider { border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 0 0 12px 0; }
.quest-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.quest {
  border: none; /* no border around quest */
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  height: 64px; /* fixed size tiles */
  display: flex;
  align-items: center;
  position: relative; /* for tooltip positioning */
}
.q-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.q-name { font-weight: 900; }
.tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; padding: 2px 6px; opacity: 0.9; border: none; }
.tag.auto { color: var(--accent); background: rgba(79, 209, 197, 0.12); }
.quest.accepted { background: rgba(74, 222, 128, 0.15); }
.quest.clickable { cursor: pointer; }
.quest.clickable:not(.accepted):hover { background: rgba(255,255,255,0.06); }

/* Styled tooltip shown instantly on hover */
.hint {
  position: absolute;
  top: 0;
  right: calc(100% + 8px); /* show on the left of the card */
  left: auto;
  display: none; /* instant show on hover */
  z-index: 20;
  /* Distinct, fully opaque tooltip background */
  background: var(--hint-bg);
  border: 1px solid var(--hint-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-width: 160px;
  width: max-content;        /* expand to fit content width */
  max-width: 75vw;           /* cap to viewport to avoid overflow */
  box-shadow: inset 0 1px 0 var(--panel-shine),
              0 8px 24px rgba(0,0,0,0.5);
  pointer-events: none; /* prevent flicker */
  grid-template-columns: max-content 1fr;
  gap: 2px 8px;
  align-items: baseline;
}
.hint::before {
  content: '';
  position: absolute;
  top: 12px;
  right: -6px; /* arrow on right, pointing to card */
  width: 10px;
  height: 10px;
  background: var(--hint-bg); /* match opaque tooltip */
  border-right: 1px solid var(--hint-border);
  border-top: 1px solid var(--hint-border);
  transform: rotate(45deg);
}
.hint-row { white-space: nowrap; display: contents; }
.hint-label { color: var(--text-secondary); font-size: 11px; letter-spacing: 0.06em; font-weight: 800; }
.hint-value { color: var(--text-primary); font-size: 12px; font-weight: 800; }
.quest:hover .hint { display: grid; }

.chip { display: inline-flex; align-items: baseline; padding: 2px 6px; border-radius: 999px; background: rgba(255,255,255,0.06); margin-right: 6px; }
.chip:last-child { margin-right: 0; }
.chip.unlocks { color: rgba(251, 146, 60, 0.95); background: rgba(251, 146, 60, 0.10); }
</style>
