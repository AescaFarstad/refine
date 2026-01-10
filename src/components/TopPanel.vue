<template>
  <header class="top-panel">
    <div class="bar">
      <Tabs />

      <!-- Current time display -->
      <div class="metric time-metric"><span class="label">Time</span><span class="value time-value">{{ timeDisplay }}</span></div>

      <div class="spacer"></div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { timeDisplay } from '../logic/UIState';
import Tabs from './Tabs.vue';
</script>

<style scoped>
.top-panel {
  display: block;
  background: rgba(26, 35, 50, 0.5);
  color: #e2e8f0; /* slate-200 */
  border-bottom: 1px solid rgba(79, 209, 197, 0.2);
  box-shadow: 0 1px 0 0 rgba(79, 209, 197, 0.1);
  position: relative;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.bar {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.spacer { flex: 1 1 auto; }

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
</style>
