<template>
  <div class="abridged-details">
    <div v-if="monsterSummary.length" class="encounters-wrapper">
      <div class="section-title">Fighting encounters:</div>
      <div class="encounters-section">
        <div class="encounter-list">
          <div v-for="m in monsterSummary" :key="m.id" class="encounter-row">
            <span class="enc-name">{{ m.name }}</span>
            <span class="enc-count">×{{ m.count }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="lootCount > 0" class="scavenge-row">
      <span class="section-title">Scavenge sites:</span>
      <span class="scavenge-count">×{{ lootCount }}</span>
    </div>
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Walking distance</span>
        <span class="stat-value">{{ distanceKm }} km</span>
      </div>
    </div>
    <div v-if="zoneCollapseTime" class="stats-row">
      <div class="stat-item">
        <span class="stat-label">Zone collapse</span>
        <span class="stat-value">{{ zoneCollapseTime }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameLib } from '../logic/UIState';
import type { RaidDefinition } from '../logic/RaidLib';
import { formatDurationHM } from '../logic/StringUtils';

const props = defineProps<{ raid: RaidDefinition }>();

interface MonsterSummary { id: string; name: string; count: number }

const monsterSummary = computed<MonsterSummary[]>(() => {
  const raid = props.raid;
  const lib = getGameLib();
  if (!raid || !lib) return [];

  const counts: Record<string, number> = {};
  for (const step of raid.encounters || []) {
    if (step.encounter.type !== 'FightEncounter') continue;
    const id = (step.encounter as any).monsterId as string;
    const c = Math.max(0, step.count | 0);
    counts[id] = (counts[id] || 0) + c;
  }

  const rows: MonsterSummary[] = [];
  for (const id of Object.keys(counts)) {
    const m = lib.monsters.get(id);
    if (!m) continue;
    rows.push({ id, name: m.name, count: counts[id] || 0 });
  }
  rows.sort((a, b) => (a.name < b.name ? -1 : 1));
  return rows;
});

const lootCount = computed(() => {
  const raid = props.raid;
  if (!raid) return 0;
  let count = 0;
  for (const e of raid.encounters || []) {
    if (e.encounter.type === 'LootEncounter') {
      count += Math.max(0, Math.floor(e.count || 0));
    }
  }
  return count;
});

const distanceKm = computed(() => {
  const raid = props.raid;
  if (!raid) return 0;
  let km = 0;
  for (const e of raid.encounters || []) {
    if (e.encounter.type === 'WalkEncounter') {
      km += Math.max(0, Math.floor(e.count || 0));
    }
  }
  return km;
});

const zoneCollapseTime = computed(() => {
  const raid = props.raid;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return null;
  return formatDurationHM(raid.zoneCollapseSec);
});
</script>

<style scoped>
.abridged-details {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.section-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}
.encounters-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.encounters-section {
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  padding: 12px 14px;
  max-width: 320px;
}
.encounter-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.encounter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 15px;
}
.enc-name {
  font-weight: 600;
}
.enc-count {
  color: var(--text-secondary);
  font-weight: 700;
}
.scavenge-row {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}
.scavenge-count {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-secondary);
}
.stats-row {
  display: flex;
  gap: 16px;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.stat-value {
  font-weight: 700;
  font-size: 15px;
}
</style>
