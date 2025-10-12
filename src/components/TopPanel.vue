<template>
  <header class="top-panel">
    <div class="bar">
      <nav class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'raid' }"
          @click="activeTab = 'raid'"
          type="button"
        >Raids</button>
        <button
          class="tab"
          :class="{ active: activeTab === 'refine' }"
          @click="activeTab = 'refine'"
          type="button"
        >Refine</button>
        <button
          class="tab"
          :class="{ active: activeTab === 'research' }"
          @click="activeTab = 'research'"
          type="button"
        >Research</button>
      </nav>

      <div class="metric"><span class="label">Credits</span><span class="value">{{ uiState.credits.toLocaleString() }}</span></div>
      <div class="metric"><span class="label">Chronotraces</span><span class="value">{{ uiState.chronotraces.toLocaleString() }}</span></div>
      <div class="metric"><span class="label">Time</span><span class="value">{{ timeDisplay }}</span></div>

      <div class="spacer"></div>

      <div class="time-advance" @mouseenter="hoverHint = true" @mouseleave="hoverHint = false">
        <button
          class="time-advance-btn"
          :disabled="!uiState.canAdvanceTime"
          type="button"
          @click="advanceTime"
        >
          <span class="btn-label">Advance Time Continium</span>
          <span class="icon-play" aria-hidden="true">▶</span>
        </button>
        <div
          v-if="!uiState.canAdvanceTime && hoverHint"
          class="time-advance-hint"
          role="tooltip"
        >
          <div class="hint-title">Nothing is queued up.</div>
          <div class="hint-sub">Deploy into a raid or load a refinery</div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { uiState, timeDisplay } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAdvanceTime } from '../logic/input/InputCommands';

function advanceTime() {
  console.log('Advance time');
  globalInputQueue.push(new CmdAdvanceTime());
}

type TabKey = 'raid' | 'refine' | 'research';
const activeTab = computed<TabKey>({
  get: () => uiState.activeTab,
  set: (v: TabKey) => { uiState.activeTab = v; },
});

const hoverHint = ref(false);
</script>

<style scoped>
.top-panel {
  display: block;
  background: #0f172a; /* slate-900 */
  color: #e2e8f0; /* slate-200 */
  border-bottom: 1px solid #1f2937; /* gray-800 */
}

.bar {
  height: 48px;
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

/* Tabs bar under the top metrics */
.tabs {
  display: inline-flex;
  align-items: stretch;
  height: 48px;
  gap: 0;
}

.tab {
  background: transparent;
  border: none;
  padding: 0 12px;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8; /* slate-400 */
  cursor: pointer;
  border-bottom: 2px solid transparent;
  flex: 0 0 auto;     /* size to content */
  text-align: center;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s ease;
}

.tab:hover { 
  color: #e2e8f0; 
  background: rgba(79, 209, 197, 0.08); 
}
.tab.active {
  color: #4fd1c5;
  border-bottom-color: #4fd1c5;
  background: linear-gradient(180deg, rgba(79, 209, 197, 0.12), rgba(79, 209, 197, 0.04));
}
</style>
