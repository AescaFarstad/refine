<template>
  <div class="deploy">
    <div class="deploy-row">
      <button class="deploy-btn" type="button" :disabled="!canDeploy" @click="deploy">Deploy</button>
      <div class="stats">
        <div class="cell" :class="{ red: !canAfford }">
          <span class="cell-label">Gear cost</span>
          <span class="cell-value" :style="{ color: creditsSpec.color }">{{ selectedPrice }}{{ creditsSpec.glyph }}</span>
        </div>
        <div class="cell" :class="{ reddish: survivalChance < 50 && survivalChance >= 25, red: survivalChance < 25 }">
          <span class="cell-label">Survival</span>
          <span class="cell-value">~{{ survivalChance }}%</span>
        </div>
        <div class="cell" :class="{ reddish: timeInHours > 4 && timeInHours <= 24, red: timeInHours > 24 }">
          <span class="cell-label">Time</span>
          <span class="cell-value">~{{ estimatedTime }}</span>
        </div>
        <div v-if="zoneCollapseTime" class="cell cell-zone-collapse" :class="{ reddish: isCollapseWarning, red: isCollapseDanger, 'has-death-pct': zoneCollapseDeathPct > 0 }">
          <span class="cell-label">Zone collapse</span>
          <span class="cell-value">
            {{ zoneCollapseTime }}
            <span v-if="zoneCollapseDeathPct > 0" style="font-size: 11px; opacity: 0.85;">
              ({{ zoneCollapseDeathPct }}% odds you won't make it in time)
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdStartRaid } from '../logic/input/InputCommands';
import type { RaidDefinition } from '../logic/RaidLib';
import { formatDurationHM } from '../logic/StringUtils';
import { getResourceSpec } from '../logic/Resources';

const creditsSpec = getResourceSpec('credits');

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));
const selectedRaid = computed<RaidDefinition | null>(() => uiState.raids.find(r => r.id === activeRaidId.value) || null);

const selectedPrice = computed(() => uiState.selectedGearPrice || 0);
const canAfford = computed(() => uiState.credits >= selectedPrice.value);
const canDeploy = computed(() => !!selectedRaid.value && !isLocked(selectedRaid.value) && canAfford.value);

function isLocked(r: RaidDefinition): boolean {
  return !uiState.unlockedRaidIds.includes(r.id);
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
const timeInHours = computed(() => (uiState.raidTimeEstimateSec || 0) / 3600);

const zoneCollapseTime = computed(() => {
  const raid = selectedRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return null;
  return formatDurationHM(raid.zoneCollapseSec);
});

const isCollapseWarning = computed(() => {
  const raid = selectedRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return false;
  const estimateSec = uiState.raidTimeEstimateSec || 0;
  const collapseSec = raid.zoneCollapseSec;
  // Warning if estimated time is 50-80% of collapse time
  return estimateSec >= collapseSec * 0.5 && estimateSec < collapseSec * 0.8;
});

const isCollapseDanger = computed(() => {
  const raid = selectedRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return false;
  const estimateSec = uiState.raidTimeEstimateSec || 0;
  const collapseSec = raid.zoneCollapseSec;
  // Danger if estimated time is 80%+ of collapse time
  return estimateSec >= collapseSec * 0.8;
});

const zoneCollapseDeathPct = computed(() => Math.max(0, Math.min(100, Math.round(uiState.raidZoneCollapseDeathPct || 0))));
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
.cell.reddish { color: #fb923c; } /* orange-400 */
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
/* When in red/reddish state, allow inherited color for both parts */
.cell.red .cell-label,
.cell.red .cell-value,
.cell.reddish .cell-label,
.cell.reddish .cell-value { color: inherit; }
/* Zone collapse cell: wider when showing death percentage */
.cell-zone-collapse.has-death-pct {
  flex: 0 0 auto;
  width: auto;
  min-width: 200px;
  max-width: 500px;
}
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
