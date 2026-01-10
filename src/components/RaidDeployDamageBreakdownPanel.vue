<template>
  <div class="breakdown-panel">


    <table class="tooltip-table damage-breakdown-table">
      <thead>
        <tr>
          <th>Damage from</th>
          <th>Survived</th>
          <th><span class="tooltip-label" data-tooltip="Only deaths from monsters count">Failed</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in damageByMonsterRows" :key="row.id">
          <td class="tt-label">{{ row.label }}</td>
          <td>{{ fmtNum(row.successDamage, raidTimeBreakdownSuccesses) }}</td>
          <td>{{ fmtNum(row.failureDamage, raidTimeBreakdownFailures) }}</td>
        </tr>
        <tr>
          <td class="tt-label">Total</td>
          <td>{{ fmtNum(raidDamageBreakdownSuccess.totalDamageReceived, raidTimeBreakdownSuccesses) }}</td>
          <td>{{ fmtNum(raidDamageBreakdownFailure.totalDamageReceived, raidTimeBreakdownFailures) }}</td>
        </tr>
      </tbody>
    </table>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { uiState } from '../logic/UIState';

const raidTimeBreakdownSuccesses = computed(() => uiState.raidTimeBreakdownSuccesses);
const raidTimeBreakdownFailures = computed(() => uiState.raidMonsterDeaths);

function fmtNum(n: number, count: number): string {
  if (count <= 0) return '—';
  return Math.round(n).toString();
}

const raidDamageBreakdownSuccess = computed(() => uiState.raidDamageBreakdownSuccess);
const raidDamageBreakdownFailure = computed(() => uiState.raidDamageBreakdownFailure);





type DamageByMonsterRow = { id: string; label: string; successDamage: number; failureDamage: number; total: number };
const damageByMonsterRows = computed<DamageByMonsterRow[]>(() => {
  const s = raidDamageBreakdownSuccess.value.damageReceivedByMonsterId;
  const f = raidDamageBreakdownFailure.value.damageReceivedByMonsterId;
  const ids = new Set<string>();
  for (const id of Object.keys(s)) ids.add(id);
  for (const id of Object.keys(f)) ids.add(id);
  const rows: DamageByMonsterRow[] = [];
  for (const id of ids) {
    const successDamage = s[id] || 0;
    const failureDamage = f[id] || 0;
    if (successDamage === 0 && failureDamage === 0) continue;
    const label = uiState.lib!.monsters.get(id)!.name;
    const total = successDamage + failureDamage;
    rows.push({ id, label, successDamage, failureDamage, total });
  }
  rows.sort((a, b) => (b.total - a.total) || a.label.localeCompare(b.label));
  return rows;
});
</script>

<style scoped>
.breakdown-panel {
  width: max-content;
  max-width: 520px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
  overflow: visible;
}

/* Local table styles - independent from other breakdown panels */
.damage-breakdown-table {
  border-collapse: collapse;
  font-size: 12px;
  min-width: 0;
}

.damage-breakdown-table th,
.damage-breakdown-table td {
  padding: 0;
  vertical-align: middle;
}

.damage-breakdown-table tbody td {
  height: 28px;
}

.damage-breakdown-table th {
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

.damage-breakdown-table tbody tr:nth-child(even) td {
  background: rgba(255,255,255,0.04);
}

.damage-breakdown-table tbody tr:nth-child(even) td:first-child {
  border-radius: 4px 0 0 4px;
}

.damage-breakdown-table tbody tr:nth-child(even) td:last-child {
  border-radius: 0 4px 4px 0;
}

.damage-breakdown-table .tt-label {
  color: #cbd5e1; /* slate-300 */
  font-weight: 600;
  white-space: nowrap;
}

.damage-breakdown-table td:not(.tt-label) {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Column-specific styles */
.damage-breakdown-table td:nth-child(1) {
  width: 1%;
  white-space: nowrap;
  padding-left: 8px;
}

.damage-breakdown-table th:nth-child(1) {
  width: 1%;
  white-space: nowrap;
  border-bottom: 1px solid transparent;
  padding-left: 8px;
  padding-right: 18px;
}

/* Data columns - left padding for data rows only */
.damage-breakdown-table td:nth-child(2),
.damage-breakdown-table td:nth-child(3) {
  white-space: nowrap;
  padding-left: 18px;
}

/* Header columns - right padding to prevent bumping */
.damage-breakdown-table th:nth-child(2),
.damage-breakdown-table th:nth-child(3) {
  white-space: nowrap;
  padding-right: 18px;
}

/* Tooltip styles - consistent with RaidDeploy.vue */
.tooltip-label {
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;
  position: relative;
  cursor: default;
}

.tooltip-label[data-tooltip]::after {
  content: attr(data-tooltip);
  display: block;
  box-sizing: content-box;
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  width: max-content;
  min-height: 1em;
  padding: 8px 12px;
  /* Ensure fully opaque background while respecting theme variable */
  background: linear-gradient(0deg, var(--hint-bg, rgb(10, 14, 20)), var(--hint-bg, rgb(10, 14, 20))), rgb(10, 14, 20) !important;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  white-space: nowrap;
  line-height: 1.4;
  text-align: left;
  pointer-events: none;
  visibility: hidden;
  z-index: 10000 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tooltip-label[data-tooltip]::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 6px);
  right: 8px;
  border: 6px solid transparent;
  border-top-color: rgb(10, 14, 20);
  pointer-events: none;
  visibility: hidden;
  z-index: 10001 !important;
}

.tooltip-label[data-tooltip]:hover::after,
.tooltip-label[data-tooltip]:hover::before {
  visibility: visible;
}
</style>
