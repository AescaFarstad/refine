<template>
  <div>
    <div v-if="quests.length === 0" class="placeholder">No quests available for this raid.</div>

    <ul v-else class="quest-list">
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
            <span class="hint-value">{{ row.value }}</span>
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
import { describeMutation } from '../logic/RaidMutation';

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
  const arr: QuestDefinition[] = [];
  lib.quests.forEach((q) => {
    const applies = !q.raidRestriction || q.raidRestriction.includes(id);
    if (!applies) return;
    if (isCompleted(q.id)) return; // hide completed
    arr.push(q);
  });
  // Sort by name
  arr.sort((a, b) => (a.name < b.name ? -1 : 1));
  return arr;
});

function isCompleted(id: string): boolean {
  // Touch outcome key to ensure reactivity after a raid
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lastOutcome;
  const gs = getGameState();
  const list = gs?.completedQuests || [];
  return list.includes(id);
}

function isActive(id: string): boolean {
  // Depend on reactive ui mirror for reactivity
  const arr = uiState.activeQuests || [];
  return arr.includes(id);
}

function formatReward(q: QuestDefinition): string {
  const r = q.rewards || {};
  const parts: string[] = [];
  const reach = Math.max(0, r.reach || 0);
  if (reach > 0) parts.push(`Reach +${reach}`);
  const sp = Math.max(0, (r as any).skillPoints || 0);
  if (sp > 0) parts.push(`Skill Points +${sp}`);
  if ((r.unlocks || []).length > 0) parts.push(`Unlocks ${r.unlocks!.length}`);
  return parts.join(', ');
}

function restrictionLabel(q: QuestDefinition): string {
  const ids = q.raidRestriction || [];
  if (!ids.length) return 'Any raid';
  const lib = getGameLib();
  const names = ids.map(id => lib?.raids.get(id)?.name || id);
  return `Limited to: ${names.join(', ')}`;
}

function onQuestClick(q: QuestDefinition): void {
  if (q.autoaccept) return; // clicking does nothing
  const next = !isActive(q.id);
  globalInputQueue.push(new CmdToggleQuest({ id: q.id, active: next }));
}

function hintSections(q: QuestDefinition): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  // Added encounters (mutations)
  const encs = (q as any).encounters as import('../logic/RaidMutation').RaidMutation[] | undefined;
  if (Array.isArray(encs) && encs.length) {
    const gs = getGameState();
    const desc = encs
      .map(m => describeMutation(gs!, m))
      .filter((s): s is string => !!s && s.length > 0)
      .join('; ');
    if (desc) out.push({ label: 'Encounters:', value: desc });
  }
  // Rewards
  const reward = formatReward(q);
  if (reward) out.push({ label: 'Rewards', value: reward });
  return out;
}
</script>

<style scoped>
.placeholder { opacity: 0.7; font-style: italic; }
.section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; }
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
.hint-row { white-space: nowrap; display: grid; grid-template-columns: max-content 1fr; gap: 4px 8px; align-items: baseline; margin: 2px 0; }
.hint-label { color: var(--text-secondary); font-size: 11px; letter-spacing: 0.06em; font-weight: 800; }
.hint-value { color: var(--text-primary); font-size: 12px; font-weight: 800; }
.quest:hover .hint { display: block; }
</style>
