<template>
  <header class="top-panel">
    <div class="metric"><span class="label">Credits</span><span class="value">{{ uiState.credits.toLocaleString() }}</span></div>
    <div class="metric"><span class="label">Chronotraces</span><span class="value">{{ uiState.chronotraces.toLocaleString() }}</span></div>
    <div class="metric"><span class="label">Time</span><span class="value">{{ timeDisplay }}</span></div>

    <div class="spacer"></div>

    <button
      class="time-advance-btn"
      :disabled="!uiState.canAdvanceTime"
      :title="uiState.canAdvanceTime ? 'Advance time' : 'Nothing is queued up'"
      type="button"
      @click="advanceTime"
    >
      <span class="btn-label">Advance Time Continium</span>
      <span class="icon-play" aria-hidden="true">▶</span>
    </button>
  </header>
  <div class="top-panel-spacer" />
</template>

<script setup lang="ts">
import { uiState, timeDisplay } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAdvanceTime } from '../logic/input/InputCommands';

function advanceTime() {
  console.log('Advance time');
  globalInputQueue.push(new CmdAdvanceTime());
}
</script>

<style scoped>
.top-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: #0f172a; /* slate-900 */
  color: #e2e8f0; /* slate-200 */
  border-bottom: 1px solid #1f2937; /* gray-800 */
  box-sizing: border-box;
  z-index: 9999; /* ensure above any blurred/backdrop layers */
}

.spacer { flex: 1 1 auto; }

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

.top-panel-spacer {
  /* Spacer to avoid content hidden under fixed header */
  height: 48px;
}
</style>
