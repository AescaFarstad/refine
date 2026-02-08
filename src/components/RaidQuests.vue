<template>
  <div v-if="quests.length > 0">
    <div class="section-title">Additional objectives</div>
    <hr class="section-divider" />

    <ul class="quest-list">
      <li
        v-for="q in quests"
        :key="q.id"
        class="quest"
        :class="{ clickable: !q.autoaccept, accepted: q.autoaccept || isActive(q.id), unreviewed: !isReviewed(q.id) }"
        @click="onQuestClick(q)"
        @mouseenter="onQuestHover(q)"
      >
        <div class="q-head">
          <span class="q-name">{{ q.name }}</span>
          <span class="tag auto" v-if="q.autoaccept">Auto-accepted</span>
        </div>
        <div v-if="q.gearRequired.length" class="q-req">
          <span class="q-req-label">Requires:</span>
          <span v-for="gearId in q.gearRequired" :key="gearId" class="q-req-item">
            <span class="q-req-icon" :style="gearIconStyle(gearId)" />
            <span class="q-req-name">{{ getGearName(gearId) }}</span>
          </span>
        </div>
        <div class="hint" role="tooltip">
          <QuestHint :quest="q" />
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
import { CmdToggleQuest, CmdReviewQuest } from '../logic/input/InputCommands';
import { questIsAvailable } from '../logic/RaidMutation';
import QuestHint from './QuestHint.vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));
const itemsAtlasSource = atlasStorage.getItemsSource();

// All quests for the selected raid (hide completed)
const quests = computed<QuestDefinition[]>(() => {
  // Touch reactive keys so recompute happens on raid selection and outcomes
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.raidKey;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lastOutcome;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.questPrereqsVersion;

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

function isReviewed(id: string): boolean {
  return uiState.reviewedQuestIds.includes(id);
}

function onQuestHover(q: QuestDefinition): void {
  if (!isReviewed(q.id)) {
    globalInputQueue.push(new CmdReviewQuest({ id: q.id }));
  }
}

function onQuestClick(q: QuestDefinition): void {
  if (q.autoaccept) return; // clicking does nothing
  const next = !isActive(q.id);
  globalInputQueue.push(new CmdToggleQuest({ id: q.id, active: next }));
}

function getGearName(gearId: string): string {
  return getGameLib().gear.get(gearId)!.name || gearId;
}

function getGearFrame(gearId: string) {
  const gear = getGameLib().gear.get(gearId)!;
  return atlasStorage.getItemsFrame(gear.image)!;
}

function gearIconStyle(gearId: string): Record<string, string> {
  const f = getGearFrame(gearId);
  return atlasSpriteStyle(itemsAtlasSource, f, { size: 14, mode: 'fit', allowUpscale: false });
}
</script>

<style scoped>
.section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; margin-bottom: 8px; text-align: center; }
.section-divider { border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 0 0 12px 0; }
.quest-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.quest {
  border: 1px solid transparent; /* reserve space for animated border */
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  min-height: 64px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  position: relative; /* for tooltip positioning */
}
.q-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.q-name { font-weight: 900; }
.tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; padding: 2px 6px; opacity: 0.9; border: none; }
.tag.auto { color: var(--accent); background: rgba(79, 209, 197, 0.12); }
.q-req { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: rgba(255, 255, 255, 0.7); }
.q-req-label { text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: rgba(255, 255, 255, 0.45); }
.q-req-item { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: rgba(255, 255, 255, 0.9); }
.q-req-icon { display: inline-block; }
.quest.accepted { background: rgba(74, 222, 128, 0.15); }
.quest.clickable { cursor: pointer; }
.quest.clickable:not(.accepted):hover { background: rgba(255,255,255,0.12); }
.quest.unreviewed { animation: quest-glow 1.5s ease-in-out infinite; }
@keyframes quest-glow {
  0%, 100% { border-color: rgba(79, 209, 197, 0.2); background: var(--raid-item-bg, rgba(255,255,255,0.08)); }
  50% { border-color: rgba(79, 209, 197, 0.7); background: rgba(79, 209, 197, 0.12); }
}

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
.quest:hover .hint { display: block; }
</style>
