<template>
  <TopPanel />
  <main class="content">
    <section class="tab-content">
      <Raids v-if="activeTab === 'raid'" />
      <Refine v-else-if="activeTab === 'refine'" />
      <Research v-else-if="activeTab === 'research'" />
      <Maze v-else-if="activeTab === 'maze'" />
    </section>
  </main>
  <RaidOutcomeModal v-if="uiState.lastOutcome" />
  <GearUpgradeModal />
  <SignatureLearnModal />
  <SignaturePlacementDiscoveryModal />
  <RewardUIRouter />
  <IntroModal />
  <CheatOverlay />
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import TopPanel from './components/TopPanel.vue';
import Raids from './components/Raids.vue';
import Refine from './components/Refine.vue';
import Research from './components/Research.vue';
import Maze from './components/Maze.vue';
import RaidOutcomeModal from './components/RaidOutcomeModal.vue';
import GearUpgradeModal from './components/GearUpgradeModal.vue';
import SignatureLearnModal from './components/SignatureLearnModal.vue';
import SignaturePlacementDiscoveryModal from './components/SignaturePlacementDiscoveryModal.vue';
import RewardUIRouter from './components/rewardUI/RewardUIRouter.vue';
import CheatOverlay from './components/CheatOverlay.vue';
import IntroModal from './components/IntroModal.vue';
import { uiState } from './logic/UIState';

type TabKey = 'raid' | 'refine' | 'research' | 'maze';
const activeTab = computed<TabKey>(() => uiState.activeTab);

const seq = ['q', 'w', 'e', 'd'];
let seqIndex = 0;

function onKeydown(ev: KeyboardEvent) {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const target = ev.target as HTMLElement | null;
  const tag = (target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

  const k = (ev.key || '').toLowerCase();
  if (!k) return;

  if (k === seq[seqIndex]) {
    seqIndex += 1;
    if (seqIndex >= seq.length) {
      seqIndex = 0;
      uiState.cheatOpen = true;
    }
  } else {
    // allow restart if key matches first position, else reset
    seqIndex = (k === seq[0]) ? 1 : 0;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style>
:root {
  --bg-0: #0a0f1a;          /* darkest - nearly black */
  --bg-1: #151d2b;          /* dark blue-gray */
  --bg-2: #1a2332;          /* slightly lighter */
  --bg-2-op: #1a2332e9;          /* slightly lighter */
  --panel-bg: rgba(23, 33, 47, 0.62); /* dark tactical panel */
  --panel-border: rgba(100, 120, 140, 0.25); /* subtle blue-gray border */
  --panel-shine: rgba(255, 255, 255, 0.03);
  --accent: #4fd1c5;         /* teal/cyan - primary interactive color */
  --accent-strong: #38b2ac;  /* stronger teal */
  --accent-hover: #81e6d9;   /* lighter teal for hover */
  --accent-warm: #9f6707;    /* amber/orange accent */
  --text-primary: #e8edf3;   /* light gray-blue */
  --text-secondary: #8b98a8; /* muted gray */
  --text-disabled: #5a6477;  /* darker muted */

  /* Tooltip palette (neutral slate theme, matches hover panels) */
  --hint-bg: rgba(15, 23, 42, 0.95);
  --hint-border: rgba(148, 163, 184, 0.7);
}

html, body, #app { height: 100%; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Noto Sans", "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
  color: var(--text-primary);
  background: radial-gradient(1400px 700px at 75% 10%, rgba(15, 25, 40, 0.8), transparent),
              linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 50%, var(--bg-0) 100%);
  background-attachment: fixed;
  letter-spacing: 0.015em;
}
.manual-dragging, .manual-dragging * { user-select: none !important; -webkit-user-drag: none !important; }
.content { box-sizing: border-box; flex: 1 1 auto; }

.tab-content {
  height: 100%;
}

#app { display: flex; flex-direction: column; min-height: 100%; }

.panel {
  background: rgba(25, 35, 50, 0.65);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 14px;
  box-shadow: inset 0 1px 0 var(--panel-shine),
              0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
