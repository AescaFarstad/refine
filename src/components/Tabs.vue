<template>
  <nav class="tabs">
    <button
      class="tab"
      :class="{ active: activeTab === 'raid' }"
      @click="switchTab('raid')"
      :disabled="uiState.timeActive"
      type="button"
    >
      <span class="tab-title">Raids</span>
      <span class="tab-sub" :class="{ 'resource-animate': animatingCredits }"><span class="tab-label">{{ creditsSpec.name }}</span><span class="tab-value" data-resource-display="credits" :style="{ color: creditsSpec.color }">{{ creditsDisplay }}</span></span>
    </button>
    <button
      v-if="uiState.hasDiscoveredRefineTab"
      class="tab"
      :class="{ active: activeTab === 'refine', 'tab-unvisited': !uiState.hasVisitedRefineTab }"
      @click="switchTab('refine')"
      :disabled="uiState.timeActive"
      type="button"
    >
      <span class="tab-title">Refine</span>
      <span class="tab-sub" :class="{ 'resource-animate': animatingShards }"><span class="tab-label">{{ shardSpec.name }}</span><span class="tab-value" data-resource-display="shards" :style="{ color: shardSpec.color }">{{ shardsDisplay }}</span></span>
    </button>
    <button
      v-if="uiState.hasDiscoveredResearchTab"
      class="tab"
      :class="{ active: activeTab === 'research', 'tab-unvisited': !uiState.hasVisitedResearchTab }"
      @click="switchTab('research')"
      :disabled="uiState.timeActive"
      type="button"
    >
      <span class="tab-title">Research</span>
      <span class="tab-sub" :class="{ 'resource-animate': animatingChronotraces }"><span class="tab-label">{{ chronotracesSpec.name }}</span><span class="tab-value" data-resource-display="chronotraces" :style="{ color: chronotracesSpec.color }">{{ chronoDisplay }}</span></span>
    </button>
    <button
      v-if="uiState.hasDiscoveredMazeTab"
      class="tab"
      :class="{ active: activeTab === 'maze', 'tab-unvisited': !uiState.hasVisitedMazeTab }"
      @click="switchTab('maze')"
      :disabled="uiState.timeActive"
      type="button"
    >
      <span class="tab-title">{{ mazeTabTitle }}</span>
      <span class="tab-sub" :class="{ 'resource-animate': animatingTimeFlux }"><span class="tab-label">{{ timeFluxSpec.name }}</span><span class="tab-value" data-resource-display="timeFlux" :style="{ color: timeFluxSpec.color }">{{ fluxDisplay }}</span></span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { uiState, getGameLib } from '../logic/UIState';
import { getResourceSpec } from '../logic/Resources';
import { globalInputQueue } from '../logic/Model';
import { CmdSwitchTab } from '../logic/input/InputCommands';

type TabKey = 'raid' | 'refine' | 'research' | 'maze';
const activeTab = computed<TabKey>(() => uiState.activeTab);

function switchTab(tab: TabKey) {
  globalInputQueue.push(new CmdSwitchTab({ tab }));
}

// Maze progress tracking
const totalMazes = computed(() => getGameLib()?.mazeLevels?.length || 0);
const completedMazes = computed(() => uiState.mazeLevelIndex);
const hasMazeProgress = computed(() => completedMazes.value > 0);
const mazeTabTitle = computed(() =>
  hasMazeProgress.value ? `Maze ${completedMazes.value}/${totalMazes.value}` : 'Maze'
);

const creditsSpec = getResourceSpec('credits');
const chronotracesSpec = getResourceSpec('chronotraces');
const timeFluxSpec = getResourceSpec('timeFlux');
const shardSpec = getResourceSpec('shardDust');

// Tab sub-line resource displays
const creditsDisplay = computed(() => `${uiState.credits}${creditsSpec.glyph}`);
const chronoDisplay = computed(() => `${uiState.chronotraces}${chronotracesSpec.glyph}`);
const fluxDisplay = computed(() => `${uiState.timeFlux}${timeFluxSpec.glyph}`);
const shardsDisplay = computed(() => `${uiState.shardDust}${shardSpec.glyph}`);

// Animation state for resource increases
const animatingCredits = ref(false);
const animatingChronotraces = ref(false);
const animatingTimeFlux = ref(false);
const animatingShards = ref(false);

const prevCredits = ref(uiState.credits);
const prevChronotraces = ref(uiState.chronotraces);
const prevTimeFlux = ref(uiState.timeFlux);
const prevShards = ref(uiState.shardDust);

// Animation timeout IDs to handle rapid succession
let creditsTimeout: number | null = null;
let chronoTimeout: number | null = null;
let fluxTimeout: number | null = null;
let shardsTimeout: number | null = null;

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

watch(() => uiState.shardDust, (newVal, oldVal) => {
  if (newVal > prevShards.value) {
    if (shardsTimeout !== null) {
      clearTimeout(shardsTimeout);
    }
    animatingShards.value = false;
    setTimeout(() => {
      animatingShards.value = true;
      shardsTimeout = setTimeout(() => {
        animatingShards.value = false;
        shardsTimeout = null;
      }, 600) as any;
    }, 10);
  }
  prevShards.value = newVal;
});
</script>

<style scoped>
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

/* Pulsating animation for discovered but unvisited tabs */
.tab.tab-unvisited:not(.active):not(:disabled) {
  animation: tab-pulse 1.5s ease-in-out infinite;
}

@keyframes tab-pulse {
  0%, 100% {
    background: rgba(79, 209, 197, 0.1);
    box-shadow: 0 0 4px 0 rgba(79, 209, 197, 0.2);
    color: #94a3b8;
  }
  50% {
    background: rgba(79, 209, 197, 0.45);
    box-shadow: 0 0 24px 6px rgba(79, 209, 197, 0.6), inset 0 0 16px rgba(79, 209, 197, 0.25);
    color: #fff;
  }
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
