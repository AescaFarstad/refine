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
    <div v-if="lootCount > 0" class="stat-row">
      <div class="stat-icon" :style="encounterIconStyle('rummaging')" />
      <div class="stat-text">
        <span class="section-title">Scavenge sites:</span>
        <span class="stat-value">×{{ lootCount }}</span>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-icon" :style="encounterIconStyle('winding_road')" />
      <div class="stat-text">
        <span class="stat-label">Walking distance</span>
        <span class="stat-value">{{ distanceKm }} km</span>
      </div>
    </div>
    <div v-if="zoneCollapseTime" class="stat-row">
      <div class="stat-icon" :style="encounterIconStyle('desintegration')" />
      <div class="stat-text">
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
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';

const props = defineProps<{ raid: RaidDefinition }>();

interface MonsterSummary { id: string; name: string; count: number }

const itemsAtlasSource = atlasStorage.getItemsSource();

function encounterIconStyle(iconKey: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(iconKey)!;
  return atlasSpriteStyle(itemsAtlasSource, f, { size: 22, mode: 'fit', allowUpscale: false });
}

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
.stat-row {
  display: grid;
  grid-template-columns: 28px 1fr;
  column-gap: 10px;
  align-items: center;
}
.stat-icon {
  image-rendering: auto;
  filter: grayscale(1) brightness(0.95);
  opacity: 0.85;
  justify-self: center;
}
.stat-text {
  display: flex;
  align-items: baseline;
  gap: 10px;
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
