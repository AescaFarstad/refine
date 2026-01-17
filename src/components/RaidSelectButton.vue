<template>
  <div ref="wrapRef" class="raid-select-wrap">
    <button class="raid-select-btn" type="button" @click="$emit('open')">
      <span class="label">{{ label }}</span>
      <span class="chevron">▼</span>
    </button>
    <div v-if="showDropdown" class="raid-dropdown">
      <div class="raid-table-head">
        <div class="cell name"></div>
        <div class="cell investigations">Investigations</div>
        <div class="cell strength">Monster strength</div>
        <div class="cell loot">Loot prospects</div>
      </div>
      <div class="raid-table-body">
        <button
          v-for="row in raidRows"
          :key="row.raid.id"
          class="raid-row"
          :class="{ active: row.isActive }"
          type="button"
          @click="onSelectRaid(row.raid.id)"
        >
          <div
            v-if="locationsAtlasReady && locationsAtlasSource"
            class="raid-row-bg"
            :style="raidBackgroundStyle(row.raid)"
          />
          <div class="cell name">{{ row.raid.name }}</div>
          <div class="cell investigations">{{ row.investigations }}</div>
          <div class="cell strength">{{ formatNumber(row.monsterStrength) }}</div>
          <div class="cell loot">{{ formatNumber(row.lootProspects) }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getGameLib, getGameState, type UIRaidDef, uiState } from '../logic/UIState';
import type { RaidDefinition } from '../logic/RaidLib';
import { questIsAvailable } from '../logic/RaidMutation';
import { globalInputQueue } from '../logic/Model';
import { CmdSelectRaid } from '../logic/input/InputCommands';
import atlasStorage from '../logic/AtlasStorage';
import { locationsAtlasFrames } from '../data/locationsAtlas';

defineEmits<{ open: [] }>();

const selectedRaid = computed(() => {
  if (!uiState.activeRaidId) return null;
  return uiState.raids.find(r => r.id === uiState.activeRaidId) || null;
});

const label = computed(() => {
  if (selectedRaid.value) return `Selected raid: ${selectedRaid.value.name}`;
  return 'Select raid...';
});

const locationsAtlasSource = ref<HTMLImageElement | null>(atlasStorage.getLocationsSource());
const locationsAtlasReady = ref<boolean>(atlasStorage.isLocationsAtlasLoaded());
const wrapRef = ref<HTMLDivElement | null>(null);
const rowWidth = ref(560);
const rowHeight = 54;
let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  if (!locationsAtlasReady.value) {
    try { await atlasStorage.loadLocationsAtlas(); } catch (_e) { /* noop */ }
    locationsAtlasReady.value = atlasStorage.isLocationsAtlasLoaded();
    locationsAtlasSource.value = atlasStorage.getLocationsSource();
  }
  const updateWidth = () => {
    const width = wrapRef.value!.getBoundingClientRect().width;
    rowWidth.value = Math.max(1, Math.floor(width - 20));
  };
  updateWidth();
  resizeObserver = new ResizeObserver(updateWidth);
  resizeObserver.observe(wrapRef.value!);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

interface RaidRow {
  raid: UIRaidDef;
  investigations: number;
  monsterStrength: number;
  lootProspects: number;
  isActive: boolean;
}

const showDropdown = computed(() => uiState.unlockedRaidIds.length > 2);

const raidRows = computed<RaidRow[]>(() => {
  uiState.raidKey;
  uiState.lastOutcome;
  uiState.questPrereqsVersion;
  const lib = getGameLib();
  const gs = getGameState();

  const raidById = new Map<string, UIRaidDef>();
  for (const raid of uiState.raids) {
    raidById.set(raid.id, raid);
  }

  const rows: RaidRow[] = [];
  for (const id of uiState.raidOrder) {
    if (!uiState.unlockedRaidIds.includes(id)) continue;
    const raid = raidById.get(id)!;
    rows.push({
      raid,
      investigations: countAvailableInvestigations(gs, lib, id),
      monsterStrength: Math.floor(computeMonsterStrength(lib, raid) / 1000),
      lootProspects: Math.floor(computeLootProspects(raid) / 10),
      isActive: uiState.activeRaidId === raid.id,
    });
  }
  return rows;
});

function countAvailableInvestigations(gs: ReturnType<typeof getGameState>, lib: ReturnType<typeof getGameLib>, raidId: string): number {
  let count = 0;
  lib.quests.forEach((q) => {
    if (questIsAvailable(gs, q, raidId)) count += 1;
  });
  return count;
}

function computeMonsterStrength(lib: ReturnType<typeof getGameLib>, raid: RaidDefinition): number {
  let total = 0;
  for (const step of raid.encounters) {
    if (step.encounter.type !== 'FightEncounter') continue;
    const m = lib.monsters.get(step.encounter.monsterId)!;
    const cap = m.damageCap > 0 ? m.damageCap : Number.POSITIVE_INFINITY;
    const strength = (m.hp + (m.hp / cap)) * (m.damage + m.armor) * m.accuracy * (1 + m.dodge);
    total += strength * Math.max(0, step.count | 0);
  }
  return total;
}

function computeLootProspects(raid: RaidDefinition): number {
  let scavengeSites = 0;
  for (const step of raid.encounters) {
    if (step.encounter.type === 'LootEncounter') scavengeSites += Math.max(0, step.count | 0);
  }
  return scavengeSites * raid.baseLootChance;
}

function raidBackgroundStyle(raid: RaidDefinition): Record<string, string> {
  const source = locationsAtlasSource.value!;
  const frame = locationsAtlasFrames[raid.locationImageId]!;

  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;

  const width = rowWidth.value;
  const scaleX = width / frame.w;
  const scaleY = rowHeight / frame.h;
  const scale = Math.max(scaleX, scaleY);

  const scaledFrameW = frame.w * scale;
  const scaledFrameH = frame.h * scale;
  const offsetX = (scaledFrameW - width) / 2;
  const offsetY = scaledFrameH * 0.32 - rowHeight / 2;

  return {
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale + offsetX}px -${frame.y * scale + offsetY}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
}

function onSelectRaid(id: string): void {
  globalInputQueue.push(new CmdSelectRaid({ id }));
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}
</script>

<style scoped>
.raid-select-wrap {
  position: relative;
  overflow: visible;
}
.raid-select-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-weight: 800;
  font-size: 24px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s;
}
.raid-select-btn:hover {
  background: rgba(255,255,255,0.12);
}
.label {
  flex: 1;
  text-align: left;
}
.chevron {
  font-size: 10px;
  opacity: 0.6;
}
.raid-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #121822;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 10px 10px 12px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 var(--panel-shine);
  display: none;
  z-index: 20;
}
.raid-select-wrap:hover .raid-dropdown {
  display: block;
}
.raid-table-head,
.raid-row {
  display: grid;
  grid-template-columns: minmax(140px, 2.2fr) 130px 160px 130px;
  align-items: center;
  gap: 12px;
}
.raid-table-head {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  padding: 0 10px 8px;
}
.raid-table-body {
  display: grid;
  gap: 8px;
  padding: 2px 0;
  max-height: 320px;
  overflow: auto;
}
.raid-row {
  position: relative;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: rgba(14, 20, 30, 0.9);
  color: var(--text-primary);
  padding: 6px 12px;
  height: 54px;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: background 0.15s ease;
}
.raid-row:hover {
  background: rgba(34, 48, 68, 0.95);
}
.raid-row.active {
  border-color: rgba(74, 222, 128, 0.5);
  box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.25);
}
.raid-row-bg {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  z-index: 0;
  pointer-events: none;
}
.raid-row .cell {
  position: relative;
  z-index: 1;
  font-size: 18px;
  font-weight: 700;
}
.raid-row .cell.name {
  font-size: 19px;
  font-weight: 800;
}
.cell.strength,
.cell.loot,
.cell.investigations {
  text-align: center;
}
@media (max-width: 900px) {
  .raid-table-head,
  .raid-row {
    grid-template-columns: minmax(120px, 1.8fr) 110px 140px 120px;
  }
}
@media (max-width: 720px) {
  .raid-table-head,
  .raid-row {
    grid-template-columns: minmax(120px, 1.6fr) 90px 120px 110px;
  }
  .raid-table-body {
    max-height: 220px;
  }
}
</style>
