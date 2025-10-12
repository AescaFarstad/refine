<template>
  <TopPanel />
  <main class="content">
    <div class="terminal">
    <nav class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'raids' }"
        @click="activeTab = 'raids'"
      >Raids</button>
      <button
        class="tab"
        :class="{ active: activeTab === 'refine' }"
        @click="activeTab = 'refine'"
      >Refine</button>
      <button
        class="tab"
        :class="{ active: activeTab === 'research' }"
        @click="activeTab = 'research'"
      >Research</button>
    </nav>

    <section class="tab-content">
      <Raids v-if="activeTab === 'raids'" />
      <Refine v-else-if="activeTab === 'refine'" />
      <Research v-else />
    </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TopPanel from './components/TopPanel.vue';
import Raids from './components/Raids.vue';
import Refine from './components/Refine.vue';
import Research from './components/Research.vue';

type TabKey = 'raids' | 'refine' | 'research';
const activeTab = ref<TabKey>('raids');
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
.content { padding: 16px; }

.terminal {
  max-width: 1100px;
  margin: 0 auto; /* center */
  background: linear-gradient(180deg, var(--panel-bg), rgba(10, 15, 26, 0.88));
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), 
              0 4px 12px rgba(0, 0, 0, 0.5),
              inset 0 1px 0 var(--panel-shine);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.tabs {
  display: flex;
  width: 100%;
  gap: 0;
  border-bottom: 1px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.tab {
  background: transparent;
  border: none;
  padding: 14px 8px;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  flex: 1 1 0;     /* stretch equally */
  text-align: center;
  transition: all 0.2s ease;
}

.tab:hover { 
  color: var(--text-primary); 
  background: rgba(79, 209, 197, 0.08); 
}
.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, rgba(79, 209, 197, 0.12), rgba(79, 209, 197, 0.04));
}

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
