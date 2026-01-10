<template>
  <div class="breakdown-panel">
    <table class="tooltip-table time-breakdown-table">
      <thead>
        <tr>
          <th>Time spent</th>
          <th class="tt-icon-head"></th>
          <th>Survived</th>
          <th>Failed</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in timeRows" :key="row.id">
          <td class="tt-label">{{ row.label }}</td>
          <td class="tt-icon-cell">
            <div v-if="itemsAtlasReady && row.iconKey" class="tt-icon" :style="encounterIconStyle(row.iconKey)" />
          </td>
          <td :class="{ max: isMaxCell(row.successSec, maxSuccessNonTotalSec, raidTimeBreakdownSuccesses, row.ignoreMax) }">
            {{ fmtTime(row.successSec, raidTimeBreakdownSuccesses) }}
          </td>
          <td :class="{ max: isMaxCell(row.failureSec, maxFailureNonTotalSec, raidTimeBreakdownFailures, row.ignoreMax) }">
            {{ row.id === 'total' ? '' : fmtTime(row.failureSec, raidTimeBreakdownFailures) }}
          </td>
        </tr>
      </tbody>
    </table>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiState } from '../logic/UIState';
import { formatDurationHM } from '../logic/StringUtils';
import atlasStorage from '../logic/AtlasStorage';

const itemsAtlasSource = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const itemsAtlasReady = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (itemsAtlasReady.value) return;
  try {
    await atlasStorage.loadItemsAtlas();
  } catch (_e) { /* noop */ }
  itemsAtlasReady.value = atlasStorage.isItemsAtlasLoaded();
  itemsAtlasSource.value = atlasStorage.getItemsSource();
});

const raidTimeBreakdownSuccesses = computed(() => uiState.raidTimeBreakdownSuccesses);
const raidTimeBreakdownFailures = computed(() => uiState.raidTimeBreakdownFailures);
const raidTimeBreakdownOverall = computed(() => uiState.raidTimeBreakdownOverallSec);
const raidTimeBreakdownSuccess = computed(() => uiState.raidTimeBreakdownSuccessSec);
const raidTimeBreakdownFailure = computed(() => uiState.raidTimeBreakdownFailureSec);

function fmtTime(sec: number, count: number): string {
  if (count <= 0) return '—';
  return formatDurationHM(sec);
}

type TimeRow = { id: string; label: string; iconKey: string; ignoreMax: boolean; overallSec: number; successSec: number; failureSec: number };
const timeRows = computed<TimeRow[]>(() => {
  const o = raidTimeBreakdownOverall.value;
  const s = raidTimeBreakdownSuccess.value;
  const f = raidTimeBreakdownFailure.value;
  return ([
    { id: 'total', label: 'Total', iconKey: '', ignoreMax: true, overallSec: o.totalSec, successSec: s.totalSec, failureSec: f.totalSec },
    { id: 'fighting', label: 'Fighting', iconKey: 'swords_crossed', ignoreMax: false, overallSec: o.fightingSec, successSec: s.fightingSec, failureSec: f.fightingSec },
    { id: 'walking', label: 'Walking', iconKey: 'winding_road', ignoreMax: false, overallSec: o.walkingSec, successSec: s.walkingSec, failureSec: f.walkingSec },
    { id: 'scavenging', label: 'Scavenging', iconKey: 'rummaging', ignoreMax: false, overallSec: o.scavengingSec, successSec: s.scavengingSec, failureSec: f.scavengingSec },
    { id: 'dissecting', label: 'Dissecting', iconKey: 'bone_saw', ignoreMax: false, overallSec: o.dissectingSec, successSec: s.dissectingSec, failureSec: f.dissectingSec },
    { id: 'investigating', label: 'Investigating', iconKey: 'questions', ignoreMax: false, overallSec: o.investigatingSec, successSec: s.investigatingSec, failureSec: f.investigatingSec },
    { id: 'preparing', label: 'Preparing', iconKey: 'preapply_medicine', ignoreMax: false, overallSec: o.preparingSec, successSec: s.preparingSec, failureSec: f.preparingSec },
  ] as TimeRow[]).filter(r => r.id === 'total' || (r.overallSec || 0) > 0);
});

const maxSuccessNonTotalSec = computed(() => {
  let max = 0;
  for (const row of timeRows.value) {
    if (row.ignoreMax) continue;
    if (row.successSec > max) max = row.successSec;
  }
  return max;
});

const maxFailureNonTotalSec = computed(() => {
  let max = 0;
  for (const row of timeRows.value) {
    if (row.ignoreMax) continue;
    if (row.failureSec > max) max = row.failureSec;
  }
  return max;
});

function isMaxCell(sec: number, max: number, count: number, ignore: boolean): boolean {
  if (ignore) return false;
  if (count <= 0) return false;
  if (max <= 0) return false;
  return sec === max;
}

function encounterIconStyle(iconKey: string): Record<string, string> {
  const source = itemsAtlasSource.value!;
  const f = atlasStorage.getItemsFrame(iconKey)!;
  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;
  const containerSize = 22;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1);
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
}
</script>

<style scoped>
.breakdown-panel {
  width: max-content;
  max-width: 520px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
  overflow: auto;
}

/* Local table styles - independent from other breakdown panels */
.time-breakdown-table {
  border-collapse: collapse;
  font-size: 12px;
  min-width: min-content;
}

.time-breakdown-table th,
.time-breakdown-table td {
  padding: 0;
  vertical-align: middle;
}

.time-breakdown-table tbody td {
  height: 28px;
}

.time-breakdown-table th {
  font-size: 11px;
  color: #94a3b8; /* slate-400 */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  text-align: left;
  vertical-align: bottom;
  padding-bottom: 4px;
}

.time-breakdown-table tbody tr:nth-child(even) td {
  background: rgba(255,255,255,0.04);
}

.time-breakdown-table tbody tr:nth-child(even) td:first-child {
  border-radius: 4px 0 0 4px;
}

.time-breakdown-table tbody tr:nth-child(even) td:last-child {
  border-radius: 0 4px 4px 0;
}

.time-breakdown-table .tt-label {
  color: #cbd5e1; /* slate-300 */
  font-weight: 600;
  white-space: nowrap;
}

.time-breakdown-table td:not(.tt-icon-cell):not(.tt-label) {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.time-breakdown-table td.max {
  font-weight: 900;
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
}

.time-breakdown-table th.tt-icon-head {
  width: 28px;
}

.time-breakdown-table td.tt-icon-cell {
  width: 28px;
  padding-left: 6px;
  padding-right: 6px;
}

.time-breakdown-table .tt-icon {
  image-rendering: auto;
  filter: grayscale(1) brightness(0.95);
  opacity: 0.85;
}

/* Column-specific styles */
.time-breakdown-table td:nth-child(1) {
  width: 1px;
  white-space: nowrap;
  padding-left: 8px;
  padding-right: 4px;
}

.time-breakdown-table th:nth-child(1) {
  width: 1px;
  white-space: nowrap;
  border-bottom: 1px solid transparent;
  padding-left: 8px;
  padding-right: 18px;
}

.time-breakdown-table td:nth-child(2),
.time-breakdown-table th:nth-child(2) {
  width: 1%;
}

.time-breakdown-table th:nth-child(2) {
  border-bottom: 1px solid transparent;
  padding-right: 4px;
}

/* Data columns - left padding for data rows only */
.time-breakdown-table td:nth-child(3),
.time-breakdown-table td:nth-child(4) {
  white-space: nowrap;
  padding-left: 18px;
}

/* Header columns - right padding to prevent bumping */
.time-breakdown-table th:nth-child(3),
.time-breakdown-table th:nth-child(4) {
  white-space: nowrap;
  padding-right: 18px;
}
</style>
