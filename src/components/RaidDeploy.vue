<template>
  <div class="deploy" v-if="hasDiscoveredMonsters">
    <div class="deploy-row">
      <span class="btn-wrap" :class="{ 'has-tooltip': !!deployDisabledReason }">
        <button class="deploy-btn" type="button" :disabled="!canDeploy" @click="deploy" @mouseenter="isDeployHovered = true" @mouseleave="isDeployHovered = false">Deploy</button>
        <span class="tooltip" v-if="deployDisabledReason">{{ deployDisabledReason }}</span>
      </span>
      <button v-if="canViewPrevious" class="deploy-btn secondary" type="button" @click="viewPrevious">View Last</button>
      <div class="stats">
        <div class="cell" :class="{ red: !canAfford }">
          <div class="cell-label tooltip-label" :data-tooltip="TOOLTIP_GEAR_COST">Gear cost</div>
          <span class="cell-value cost-value" :style="{ color: creditsSpec.color }">{{ selectedPrice.toLocaleString() }}{{ creditsSpec.glyph }}</span>
        </div>
        <div class="cell-stack">
          <div class="cell" :class="{ reddish: survivalChance < 50 && survivalChance >= 25, red: survivalChance < 25, 'flash-red': shouldFlashSurvival }">
            <div class="cell-label tooltip-label" :data-tooltip="survivalBreakdownTooltip">Survival</div>
            <span class="cell-value">~{{ survivalChance }}%</span>
          </div>
          <div v-if="hasDamageBreakdown" class="cell-stack-panel cell-stack-panel--right">
            <RaidDeployDamageBreakdownPanel />
          </div>
        </div>
        <div class="cell-stack">
          <div class="cell" :class="{ reddish: timeInHours > 4 && timeInHours <= 24, red: timeInHours > 24 }">
            <div class="cell-label tooltip-label">
              Time
              <div class="tooltip-panel">
                <div class="font-mono">{{ timeEstValues }}</div>
                <div class="tooltip-desc">{{ timeEstDesc }}</div>
              </div>
            </div>
            <span class="cell-value">{{ hasTimeData ? '~' : '' }}{{ estimatedTime }}</span>
          </div>
          <div v-if="hasTimeBreakdown" class="cell-stack-panel cell-stack-panel--left">
            <RaidDeployTimeBreakdownPanel />
          </div>
        </div>
        <div v-if="zoneCollapseTime" class="cell cell-zone-collapse" :class="{ reddish: isCollapseWarning, red: isCollapseDanger, 'has-death-pct': zoneCollapseDeathPct > 0 }">
          <div class="cell-label tooltip-label" :data-tooltip="TOOLTIP_ZONE_COLLAPSE">Zone collapse</div>
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
import { computed, ref } from 'vue';
import { getGameState, uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdStartRaid } from '../logic/input/InputCommands';
import type { RaidDefinition } from '../logic/RaidLib';
import { formatDurationHM } from '../logic/StringUtils';
import { getResourceSpec } from '../logic/Resources';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { getRaidGearCost, getRaidStartFailureReason } from '../logic/useRaidAgain';
import RaidDeployDamageBreakdownPanel from './RaidDeployDamageBreakdownPanel.vue';
import RaidDeployTimeBreakdownPanel from './RaidDeployTimeBreakdownPanel.vue';

const creditsSpec = getResourceSpec('credits');

const hasDiscoveredMonsters = computed(() => uiState.hasDiscoveredRaidMonsters);

const isDeployHovered = ref(false);
const shouldFlashSurvival = computed(() => isDeployHovered.value && survivalChance.value < 20);

const TOOLTIP_GEAR_COST = 'All gear will be lost regardless of the raid outcome.\nTake only what you need.';
const TOOLTIP_ZONE_COLLAPSE = 'You have limited time in the zone. Eventually it will collapse and disintegrate you.';

const activeRaidId = computed(() => uiState.activeRaidId || (uiState.raidOrder[0] || ''));
const selectedRaid = computed<RaidDefinition | null>(() => uiState.raids.find(r => r.id === activeRaidId.value) || null);

const selectedPrice = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.raidKey;
  const gs = getGameState();
  const raidId = activeRaidId.value;
  if (!raidId) return 0;
  return getRaidGearCost(gs, raidId);
});
const canAfford = computed(() => uiState.credits >= selectedPrice.value);
const deployDisabledReason = computed(() => {
  // Touch reactive keys so recompute happens on gear/quest changes
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.raidKey;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.activeQuests.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.lastOutcome;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.questPrereqsVersion;

  const raid = selectedRaid.value;
  if (!raid) return '';
  const gs = getGameState();
  return getRaidStartFailureReason(gs, raid.id);
});
const canDeploy = computed(() => !!selectedRaid.value && deployDisabledReason.value === '');
const canViewPrevious = computed(() => !!uiState.acknowledgedOutcome);

function deploy() {
  const raid = selectedRaid.value;
  if (!raid) return;
  if (!canDeploy.value) return;
  globalInputQueue.push(new CmdStartRaid({ id: raid.id }));
}

function viewPrevious() {
  if (!uiState.acknowledgedOutcome) return;
  uiState.showAcknowledgedOutcome = true;
}

const hasDamageBreakdown = computed(() => {
  const _dep = uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.UI_DAMAGE_BREAKDOWN] === true;
});

const hasTimeBreakdown = computed(() => {
  const _dep = uiState.discoveryCounter;
  return getGameState().discoveries[DISCOVERY.UI_TIME_BREAKDOWN] === true;
});

const zoneCollapseTime = computed(() => {
  const raid = selectedRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return null;
  return formatDurationHM(raid.zoneCollapseSec);
});

const hasTimeData = computed(() => {
  const hasSuccesses = uiState.raidTimeBreakdownSuccesses > 0;
  const hasZoneCollapseDeaths = uiState.raidZoneCollapseDeaths > 0;
  return hasSuccesses || hasZoneCollapseDeaths;
});

const isCollapseWarning = computed(() => {
  const raid = selectedRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return false;
  // If we have deaths to zone, don't show warning (show danger instead)
  if (zoneCollapseDeathPct.value > 0) return false;
  // No warning if we don't have time data
  if (!hasTimeData.value) return false;
  const estimateSec = uiState.raidTimeEstimateSec || 0;
  const collapseSec = raid.zoneCollapseSec;
  // Warning if estimated time is 80%+ of collapse time but no deaths yet
  return estimateSec >= collapseSec * 0.8;
});

const isCollapseDanger = computed(() => {
  const raid = selectedRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return false;
  // Danger only if we've actually died to zone collapse in simulations
  return zoneCollapseDeathPct.value > 0;
});

const zoneCollapseDeathPct = computed(() => Math.max(0, Math.min(100, Math.round(uiState.raidZoneCollapseDeathPct || 0))));

const survivalChance = computed(() => Math.max(0, Math.min(100, Math.round(uiState.raidSurvivalPct || 0))));
const survivalBreakdownTooltip = computed(() => {
  const count = uiState.raidTimeBreakdownSimulations;
  const monsterDeaths = uiState.raidMonsterDeaths;
  const zoneCollapseDeaths = uiState.raidZoneCollapseDeaths;
  const monsterDeathPct = Math.round((monsterDeaths / count) * 100);
  const zoneCollapseDeathPct = Math.round((zoneCollapseDeaths / count) * 100);

  let tooltip = '';
  if (monsterDeathPct > 0) {
    tooltip += `Deaths from monsters: ${monsterDeathPct}%\n`;
  }
  if (zoneCollapseDeathPct > 0) {
    tooltip += `Deaths from zone collapse: ${zoneCollapseDeathPct}%\n`;
  }
  if (tooltip) {
    tooltip += '\n';
  }
  tooltip += `Estimated based on ${count} virtual attempts.`;
  tooltip += `\nResults may vary from simulation to simulation.`;

  return tooltip;
});

const estimatedTime = computed(() => {
  const sec = uiState.raidTimeEstimateSec;
  if (!hasTimeData.value) return '—';
  if (sec === undefined || sec === null || sec <= 0) return '—';
  return formatDurationHM(sec);
});
const timeInHours = computed(() => (uiState.raidTimeEstimateSec || 0) / 3600);
const timeEstValues = computed(() => {
  const min = formatDurationHM(uiState.raidTimeEstimateMinSec || 0);
  const max = formatDurationHM(uiState.raidTimeEstimateMaxSec || 0);
  const stdDev = formatDurationHM(uiState.raidTimeEstimateStdDevSec || 0);
  return `${min} - ${max}, σ:${stdDev}`;
});

const timeEstDesc = computed(() => {
  const count = uiState.raidTimeBreakdownSimulations;
  return `Estimated based on ${count} virtual attempts.\nResults may vary from simulation to simulation.`;
});
</script>

<style scoped>
.deploy-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.btn-wrap { display: inline-block; position: relative; }
.btn-wrap .tooltip {
  position: absolute;
  bottom: 100%;
  left: 0;
  transform: none;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: rgba(10, 14, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #f0c070;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: none;
  max-width: min(320px, 90vw);
  white-space: normal;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.btn-wrap .tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 12px;
  transform: none;
  border: 6px solid transparent;
  border-top-color: rgba(10, 14, 20, 0.95);
}
.btn-wrap:hover .tooltip { opacity: 1; }
.stats { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
:deep(.cell) {
  background: var(--raid-panel-bg, rgba(23, 33, 47, 0.92));
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
:deep(.cell.red) { color: #ef4444; }
:deep(.cell.reddish) { color: #fb923c; } /* orange-400 */
/* Label/value split to mirror TopPanel highlighting */
:deep(.cell-label) { 
  font-size: 12px; 
  color: #94a3b8; /* slate-400 */ 
  text-transform: uppercase; 
  letter-spacing: 0.06em; 
  font-weight: 400; 
}
:deep(.tooltip-label) {
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  position: relative;
  display: inline-block;
  cursor: default;
}
:deep(.tooltip-label[data-tooltip])::after,
.tooltip-trigger[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  white-space: pre-line;
  line-height: 1.25;
  width: max-content;
  max-width: 360px;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
:deep(.tooltip-label[data-tooltip])::before,
.tooltip-trigger[data-tooltip]::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--hint-bg, rgba(10, 14, 20, 0.95));
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 1001;
}
:deep(.tooltip-label[data-tooltip]:hover)::after,
:deep(.tooltip-label[data-tooltip]:hover)::before,
.tooltip-trigger[data-tooltip]:hover::after,
.tooltip-trigger[data-tooltip]:hover::before {
  opacity: 1;
}
:deep(.tooltip-panel) {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-radius: 4px;
  color: var(--text-primary, #e0e0e0);
  text-transform: none;
  letter-spacing: normal;
  font-size: 13px;
  font-weight: 500;
  width: max-content;
  max-width: 460px;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
:deep(.tooltip-panel)::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: var(--hint-bg, rgba(10, 14, 20, 0.95));
  border-right: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
  border-bottom: 1px solid var(--hint-border, rgba(255, 255, 255, 0.15));
}
:deep(.tooltip-label:hover .tooltip-panel) {
  opacity: 1;
}
:deep(.cell-value) { 
  font-weight: 700; 
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
:deep(.cost-value) {
  font-weight: 800;
  font-family: system-ui, -apple-system, sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
/* When in red/reddish state, allow inherited color for both parts */
:deep(.cell.red .cell-label),
:deep(.cell.red .cell-value),
:deep(.cell.reddish .cell-label),
:deep(.cell.reddish .cell-value) { color: inherit; }

.cell-stack {
  position: relative;
  display: inline-block;
  overflow: visible;
}

.cell-stack-panel {
  position: absolute;
  top: calc(100% + 10px);
  z-index: 2000;
}

.cell-stack-panel--right { right: 0; }
.cell-stack-panel--left { left: 0; }
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
  border: 1px solid rgba(34,197,94,0.5);
  background: rgba(34,197,94,0.32);
  color: #86efac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.deploy-btn:hover { background: rgba(34,197,94,0.45); }
.deploy-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
.deploy-btn:disabled:hover { background: rgba(34,197,94,0.10); }
.deploy-btn.secondary {
  border-color: rgba(79, 209, 197, 0.45);
  background: rgba(79, 209, 197, 0.2);
  color: #99f6e4;
}
.deploy-btn.secondary:hover {
  background: rgba(79, 209, 197, 0.3);
}

/* Flash red animation for low survival warning */
@keyframes flash-red {
  0%, 100% {
    background: var(--raid-panel-bg, rgba(23, 33, 47, 0.92));
    box-shadow: none;
  }
  50% {
    background: rgba(239, 68, 68, 0.4);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
  }
}

:deep(.cell.flash-red) {
  animation: flash-red 0.5s ease-in-out infinite;
}


.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 700;
  margin-bottom: 8px;
}

.tooltip-desc {
  white-space: pre-line;
  font-weight: 400;
  opacity: 0.9;
}
</style>
