<template>
  <TopPanel />
  <main class="content">
    <section class="tab-content">
      <Raids v-if="activeTab === 'raid'" />
      <Refine v-else-if="activeTab === 'refine'" />
      <Research v-else />
    </section>
  </main>
  <OutcomeModal />
  <LevelUpModal />
  <CheatOverlay />
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import TopPanel from './components/TopPanel.vue';
import Raids from './components/Raids.vue';
import Refine from './components/Refine.vue';
import Research from './components/Research.vue';
import OutcomeModal from './components/OutcomeModal.vue';
import LevelUpModal from './components/LevelUpModal.vue';
import CheatOverlay from './components/CheatOverlay.vue';
import { uiState } from './logic/UIState';

type TabKey = 'raid' | 'refine' | 'research';
const activeTab = computed<TabKey>({
  get: () => uiState.activeTab,
  set: (v: TabKey) => { uiState.activeTab = v; },
});

// Cheat key sequence: q w e d
const seq = ['q', 'w', 'e', 'd'];
let seqIndex = 0;

function onKeydown(ev: KeyboardEvent) {
  // ignore if any modifier is held or target is an input/textarea
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
  --panel-bg: rgba(20, 28, 40, 0.92); /* dark tactical panel */
  --panel-border: rgba(100, 120, 140, 0.25); /* subtle blue-gray border */
  --panel-shine: rgba(255, 255, 255, 0.03);
  --accent: #4fd1c5;         /* teal/cyan - primary interactive color */
  --accent-strong: #38b2ac;  /* stronger teal */
  --accent-hover: #81e6d9;   /* lighter teal for hover */
  --accent-warm: #f59e0b;    /* amber/orange accent */
  --text-primary: #e8edf3;   /* light gray-blue */
  --text-secondary: #8b98a8; /* muted gray */
  --text-disabled: #5a6477;  /* darker muted */
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
.content { padding: 16px; box-sizing: border-box; flex: 1 1 auto; }

#app { display: flex; flex-direction: column; min-height: 100%; }

/* Removed the old bordered sub-window container */

.tab-content {
  padding: 20px;
}

/* Shared small panel styling for inner blocks */
.panel {
  background: rgba(25, 35, 50, 0.65);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 14px;
  box-shadow: inset 0 1px 0 var(--panel-shine),
              0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
