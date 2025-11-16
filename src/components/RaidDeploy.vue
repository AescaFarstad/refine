<template>
  <div class="deploy">
    <div class="deploy-row">
      <button class="deploy-btn" type="button" :disabled="!canDeploy" @click="deploy">Deploy</button>
      <div class="stats">
        <div class="cell" :class="{ red: !canAfford }">
          <span class="cell-label">Gear cost</span>
          <span class="cell-value">{{ selectedPrice }}✦</span>
        </div>
        <div class="cell">
          <span class="cell-label">Survival</span>
          <span class="cell-value">~{{ survivalChance }}%</span>
        </div>
        <div class="cell">
          <span class="cell-label">Time</span>
          <span class="cell-value">~{{ estimatedTime }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdStartRaid } from '../logic/input/InputCommands';
import type { RaidDefinition } from '../logic/RaidLib';
import { formatDurationHM } from '../logic/StringUtils';

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));
const selectedRaid = computed<RaidDefinition | null>(() => uiState.raids.find(r => r.id === activeRaidId.value) || null);

const selectedPrice = computed(() => uiState.selectedGearPrice || 0);
const canAfford = computed(() => uiState.credits >= selectedPrice.value);
const canDeploy = computed(() => !!selectedRaid.value && !isLocked(selectedRaid.value) && canAfford.value);

function isLocked(r: RaidDefinition): boolean {
  const gs = getGameState();
  const reach = gs?.reach || 0;
  return reach < Math.max(0, r.reachRequired || 0);
}

function deploy() {
  const raid = selectedRaid.value;
  if (!raid) return;
  if (!canDeploy.value) return;
  globalInputQueue.push(new CmdStartRaid({ id: raid.id }));
}

// Estimates provided via UI state
const survivalChance = computed(() => Math.max(0, Math.min(100, Math.round(uiState.raidSurvivalPct || 0))));
const estimatedTime = computed(() => formatDurationHM(Math.max(0, uiState.raidTimeEstimateSec || 0)));
</script>

<style scoped>
.deploy-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.stats { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cell { 
  background: rgba(255,255,255,0.04); 
  border-radius: 6px; 
  padding: 8px 10px; 
  text-align: center; 
  flex: 0 0 200px; 
  width: 200px; 
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}
.cell.red { color: #ef4444; }
/* Label/value split to mirror TopPanel highlighting */
.cell-label { 
  font-size: 12px; 
  color: #94a3b8; /* slate-400 */ 
  text-transform: uppercase; 
  letter-spacing: 0.06em; 
  font-weight: 400; 
}
.cell-value { 
  font-weight: 700; 
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
/* When in red state, allow inherited color for both parts */
.cell.red .cell-label, 
.cell.red .cell-value { color: inherit; }
/* Match TopPanel time-advance button styling */
.deploy-btn {
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
.deploy-btn:hover { background: rgba(34,197,94,0.28); }
.deploy-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
.deploy-btn:disabled:hover { background: rgba(34,197,94,0.10); }
</style>
