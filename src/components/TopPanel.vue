<template>
  <header class="top-panel">
    <div class="bar">
      <nav class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'raid' }"
          @click="activeTab = 'raid'"
          :disabled="uiState.timeActive"
          type="button"
        >
          <span class="tab-title">Raids</span>
          <span class="tab-sub" :class="{ 'resource-animate': animatingCredits }"><span class="tab-label">Credits</span><span class="tab-value" data-resource-display="credits">{{ creditsDisplay }}</span></span>
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'refine' }"
          @click="activeTab = 'refine'"
          :disabled="uiState.timeActive"
          type="button"
        >
          <span class="tab-title">Refine</span>
          <span class="tab-sub"><span class="tab-label">Items</span><span class="tab-value">{{ inventoryCountDisplay }}</span></span>
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'research' }"
          @click="activeTab = 'research'"
          :disabled="uiState.timeActive"
          type="button"
        >
          <span class="tab-title">Research</span>
          <span class="tab-sub" :class="{ 'resource-animate': animatingChronotraces }"><span class="tab-label">Chronotraces</span><span class="tab-value" data-resource-display="chronotraces">{{ chronoDisplay }}</span></span>
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'maze' }"
          @click="activeTab = 'maze'"
          :disabled="uiState.timeActive"
          type="button"
        >
          <span class="tab-title">Maze</span>
          <span class="tab-sub" :class="{ 'resource-animate': animatingTimeFlux }"><span class="tab-label">Time Flux</span><span class="tab-value" data-resource-display="timeFlux">{{ fluxDisplay }}</span></span>
        </button>
      </nav>

      <!-- Current time display moved to replace metrics -->
      <div class="metric time-metric"><span class="label">Time</span><span class="value time-value">{{ timeDisplay }}</span></div>



      <div class="spacer"></div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiState, timeDisplay } from '../logic/UIState';

type TabKey = 'raid' | 'refine' | 'research' | 'maze';
const activeTab = computed<TabKey>({
  get: () => uiState.activeTab,
  set: (v: TabKey) => { uiState.activeTab = v; },
});

// Tab sub-line resource displays
const creditsDisplay = computed(() => `${uiState.credits}✦`);
const chronoDisplay = computed(() => `${uiState.chronotraces}⧖`);
const fluxDisplay = computed(() => `${uiState.timeFlux}∿`);
const inventoryCount = computed(() => (uiState.items || []).reduce((acc, it) => acc + (it?.quantity || 0), 0));
const inventoryCountDisplay = computed(() => `${inventoryCount.value}`);

// Animation state for resource increases
const animatingCredits = ref(false);
const animatingChronotraces = ref(false);
const animatingTimeFlux = ref(false);

const prevCredits = ref(uiState.credits);
const prevChronotraces = ref(uiState.chronotraces);
const prevTimeFlux = ref(uiState.timeFlux);

// Animation timeout IDs to handle rapid succession
let creditsTimeout: number | null = null;
let chronoTimeout: number | null = null;
let fluxTimeout: number | null = null;

watch(() => uiState.credits, (newVal, oldVal) => {
  if (newVal > prevCredits.value) {
    if (creditsTimeout !== null) {
      clearTimeout(creditsTimeout);
    }
    animatingCredits.value = false;
    setTimeout(() => {
      animatingCredits.value = true;
      creditsTimeout = setTimeout(() => {
        animatingCredits.value = false;
        creditsTimeout = null;
      }, 600) as any; // Match CSS animation duration
    }, 10);
  }
  prevCredits.value = newVal;
});

watch(() => uiState.chronotraces, (newVal, oldVal) => {
  if (newVal > prevChronotraces.value) {
    if (chronoTimeout !== null) {
      clearTimeout(chronoTimeout);
    }
    animatingChronotraces.value = false;
    setTimeout(() => {
      animatingChronotraces.value = true;
      chronoTimeout = setTimeout(() => {
        animatingChronotraces.value = false;
        chronoTimeout = null;
      }, 600) as any;
    }, 10);
  }
  prevChronotraces.value = newVal;
});

watch(() => uiState.timeFlux, (newVal, oldVal) => {
  if (newVal > prevTimeFlux.value) {
    if (fluxTimeout !== null) {
      clearTimeout(fluxTimeout);
    }
    animatingTimeFlux.value = false;
    setTimeout(() => {
      animatingTimeFlux.value = true;
      fluxTimeout = setTimeout(() => {
        animatingTimeFlux.value = false;
        fluxTimeout = null;
      }, 600) as any;
    }, 10);
  }
  prevTimeFlux.value = newVal;
});
</script>

<style scoped>
.top-panel {
  display: block;
  background: #0f172a; /* slate-900 */
  color: #e2e8f0; /* slate-200 */
  border-bottom: 1px solid #1f2937; /* gray-800 */
}

.bar {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  box-sizing: border-box;
}

.spacer { flex: 1 1 auto; }

.time-advance { position: relative; display: inline-block; }
.time-advance-hint {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.3;
  box-shadow: 0 6px 20px rgba(0,0,0,0.35), inset 0 1px 0 var(--panel-shine);
  max-width: 280px;
  z-index: 20;
}
.time-advance-hint::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 18px;
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--panel-bg);
}
.time-advance-hint .hint-title { font-weight: 800; letter-spacing: 0.02em; margin-bottom: 2px; }
.time-advance-hint .hint-sub { color: var(--text-secondary); }

.time-advance-btn {
  height: 32px;
  padding: 0 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.35);
  background: rgba(34,197,94,0.18);
  color: #86efac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.time-advance-btn:hover {
  background: rgba(34,197,94,0.28);
}

.time-advance-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
.time-advance-btn:disabled:hover {
  background: rgba(34,197,94,0.10);
}

.time-advance-btn .icon-play {
  display: inline-block;
  font-size: 18px;
  line-height: 1;
  transform: translateY(-2px);
}

.metric {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: #94a3b8; /* slate-400 */
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.value {
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* Reserve stable width for time to avoid layout shift as it changes */
.time-metric .time-value {
  display: inline-block;
  min-width: 5ch;
  text-align: right;
  white-space: nowrap;
}

/* Tabs bar under the top metrics */

.tabs {
  display: inline-flex;
  align-items: stretch;
  height: 64px;
  gap: 0;
}

.tab {
  background: transparent;
  border: none;
  padding: 6px 14px;
  font-size: 12px;
  color: #94a3b8; /* slate-400 */
  cursor: pointer;
  border-bottom: 2px solid transparent;
  flex: 0 0 auto;     /* size to content */
  text-align: center;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  line-height: 1.05;
  gap: 2px;
  transition: all 0.2s ease;
}

.tab-title {
  font-size: 18px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 6px;
}
/* Sub-line container mirrors metric layout */
.tab-sub {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  letter-spacing: normal; /* don't inherit tab letter spacing */
  text-transform: none;   /* don't inherit uppercase */
}
.tab-sub .tab-value {
  font-size: 1rem; /* match metrics value size */
  color: #e2e8f0;  /* match metrics value brightness */
  font-weight: 700; /* make highlighted number bolder */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.tab-sub .tab-label {
  font-size: 12px;
  color: #94a3b8; /* slate-400 */
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 400; /* avoid inheriting boldness from header */
}

.tab:hover { 
  color: #e2e8f0; 
  background: rgba(79, 209, 197, 0.08); 
}
.tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
  color: #94a3b8;
}
.tab.active {
  color: #4fd1c5;
  border-bottom-color: #4fd1c5;
  background: linear-gradient(180deg, rgba(79, 209, 197, 0.12), rgba(79, 209, 197, 0.04));
}

/* Resource increase animation */
.tab-sub {
  position: relative;
  overflow: hidden;
  padding: 2px 4px;
  border-radius: 4px;
}

.tab-label,
.tab-value {
  position: relative;
  z-index: 1;
}

.tab-value {
  display: inline-block;
  transition: transform 0.1s ease;
}

.tab-sub.resource-animate .tab-value {
  animation: resource-scale-pulse 0.6s ease-out;
}

.tab-sub.resource-animate::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at center, rgba(79, 209, 197, 0.32) 0%, rgba(79, 209, 197, 0.16) 45%, transparent 80%);
  opacity: 0;
  transform: scale(0.96);
  animation: resource-highlight 0.6s ease-out;
  pointer-events: none;
  z-index: 0;
}

@keyframes resource-scale-pulse {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.25);
  }
  50% {
    transform: scale(1.15);
  }
  75% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes resource-highlight {
  0% {
    opacity: 0;
    transform: scale(0.96);
  }
  30% {
    opacity: 0.85;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.02);
  }
}

</style>
