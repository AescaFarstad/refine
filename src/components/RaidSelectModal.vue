<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <button v-if="!previewRaid" class="close-btn close-btn-overlay-global" type="button" @click="$emit('close')">✕</button>
        <div class="modal-body">
          <!-- Left: raid list -->
          <div class="raid-list">
            <button
              v-for="r in uiState.raids"
              :key="r.id"
              class="raid-card"
              :class="{ active: r.id === previewRaidId, locked: isLocked(r) }"
              type="button"
              :disabled="isLocked(r)"
              @mouseenter="onPreview(r.id)"
              @click="onSelect(r.id)"
            >
              <div
                v-if="locationsAtlasReady && locationsAtlasSource"
                class="raid-bg"
                :style="raidBackgroundStyle(r)"
              />
              <div class="raid-title">{{ r.name }}</div>
              <div v-if="isLocked(r)" class="raid-locked">
                <span class="txt">Locked</span>
              </div>
            </button>
          </div>
          <!-- Right: raid preview -->
          <div class="raid-preview">
            <template v-if="previewRaid">
              <div class="preview-image" :style="previewImageStyle">
                <button class="close-btn close-btn-overlay" type="button" @click="$emit('close')">✕</button>
                <img
                  v-if="locationsAtlasReady && locationsAtlasSource"
                  class="location-atlas"
                  :src="locationsAtlasSource.src"
                  :style="previewLocationAtlasStyle"
                  alt=""
                  draggable="false"
                >
                <div v-else class="image-placeholder">[ Raid Image ]</div>
                <div class="ov ov-title">{{ previewRaid.name }}</div>

                <div class="ov ov-left">
                  <div class="ov-row">
                    <div class="ov-icon" :style="encounterIconStyle('winding_road')" />
                    <div class="ov-label">Walking</div>
                    <div class="ov-value">{{ distanceKm }} km</div>
                  </div>
                  <div v-if="lootCount > 0" class="ov-row">
                    <div class="ov-icon" :style="encounterIconStyle('rummaging')" />
                    <div class="ov-label">Scavenge</div>
                    <div class="ov-value">×{{ lootCount }}</div>
                  </div>
                  <div v-if="zoneCollapseTime" class="ov-row">
                    <div class="ov-icon" :style="encounterIconStyle('desintegration')" />
                    <div class="ov-label">Collapse</div>
                    <div class="ov-value">{{ zoneCollapseTime }}</div>
                  </div>
                </div>

                <div v-if="monsterSummary.length" class="ov ov-monsters">
                  <div v-for="m in monsterSummary" :key="m.id" class="ov-monster">
                    <div class="ov-monster-name">{{ m.name }}</div>
                    <div class="ov-monster-count">×{{ m.count }}</div>
                  </div>
                </div>

                <div v-if="itemBansMax > 0" class="ov ov-bans" :style="bansPositionStyle">
                  <div class="ban-panel-label">Items blocked</div>
                  <div class="ban-panel-value">{{ bannedCount }} / {{ itemBansMax }}</div>
                </div>

                <div v-if="foundRegularItems.length || foundRemainsItems.length" ref="itemsPanelRef" class="ov ov-bottom">
                  <div class="ov-items" :class="{ split: foundRegularItems.length && foundRemainsItems.length }">
                    <div v-if="foundRegularItems.length" class="ov-items-block ov-items-bannable">
                      <div
                        v-for="it in foundRegularItems"
                        :key="it.id"
                        class="bannable-item"
                        :class="{ 
                          banned: isItemBanned(it.id), 
                          'can-ban': canBanMore || isItemBanned(it.id),
                          'just-unbanned': justUnbannedItemId === it.id,
                          'just-banned': justBannedItemId === it.id
                        }"
                        @click="toggleBan(it.id)"
                        @mouseleave="onItemMouseLeave(it.id)"
                      >
                        <ItemDisplay :id="it.id" :quantity="1" minor />
                        <div v-if="isItemBanned(it.id)" class="banned-overlay">
                          <span class="banned-cross">✕</span>
                        </div>
                        <div v-else-if="canBanMore" class="ban-hover-overlay">
                          <span class="ban-cross">✕</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="foundRemainsItems.length" class="ov-items-block">
                      <ItemGrid :items="foundRemainsItems" minor />
                    </div>
                  </div>
                </div>
              </div>
              <div class="preview-description">
                {{ previewRaid.description || 'A challenging expedition into dangerous territory.' }}
              </div>
            </template>
            <div v-else class="no-preview">
              Hover over a raid to see details
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdSelectRaid, CmdToggleItemBan } from '../logic/input/InputCommands';
import type { FightEncounterDef, RaidDefinition } from '../logic/RaidLib';
import { formatDurationHM } from '../logic/StringUtils';
import ItemGrid from './ItemGrid.vue';
import ItemDisplay from './ItemDisplay.vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { locationsAtlasFrames, locationsAtlasMeta } from '../data/locationsAtlas';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ close: [], selected: [] }>();

const previewRaidId = ref<string | null>(null);
const itemsPanelRef = ref<HTMLElement | null>(null);
const itemsPanelHeight = ref<number>(0);
const justUnbannedItemId = ref<string | null>(null);
const justBannedItemId = ref<string | null>(null);

const previewRaid = computed<RaidDefinition | null>(() => {
  if (!previewRaidId.value) return null;
  return uiState.raids.find(r => r.id === previewRaidId.value) || null;
});

const itemsAtlasSource = atlasStorage.getItemsSource();
const locationsAtlasSource = ref<HTMLImageElement | null>(atlasStorage.getLocationsSource());
const locationsAtlasReady = ref<boolean>(atlasStorage.isLocationsAtlasLoaded());
onMounted(async () => {
  if (!locationsAtlasReady.value) {
    try { await atlasStorage.loadLocationsAtlas(); } catch (_e) { /* noop */ }
    locationsAtlasReady.value = atlasStorage.isLocationsAtlasLoaded();
    locationsAtlasSource.value = atlasStorage.getLocationsSource();
  }
});

function encounterIconStyle(iconKey: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(iconKey)!;
  return atlasSpriteStyle(itemsAtlasSource, f, { size: 18, mode: 'fit', allowUpscale: false });
}

function raidBackgroundStyle(raid: RaidDefinition): Record<string, string> {
  const source = locationsAtlasSource.value!;
  const frame = locationsAtlasFrames[raid.locationImageId]!;

  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;

  // Calculate scale to cover the card (320px width, 72px height)
  const cardWidth = 320;
  const cardHeight = 72;

  // Scale to cover the card while maintaining aspect ratio
  const scaleX = cardWidth / frame.w;
  const scaleY = cardHeight / frame.h;
  const scale = Math.max(scaleX, scaleY);

  // Calculate position - centered horizontally, ~27.5% down vertically
  const scaledFrameW = frame.w * scale;
  const scaledFrameH = frame.h * scale;
  const offsetX = (scaledFrameW - cardWidth) / 2;
  const offsetY = scaledFrameH * 0.275 - cardHeight / 2;

  return {
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale + offsetX}px -${frame.y * scale + offsetY}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
}

const previewLocationFrame = computed(() => {
  const raid = previewRaid.value;
  if (!raid) return null;
  return locationsAtlasFrames[raid.locationImageId] || null;
});

const previewLocationAtlasStyle = computed<Record<string, string>>(() => {
  const f = previewLocationFrame.value;
  if (!f || !locationsAtlasMeta) return {} as Record<string, string>;
  return {
    width: `calc(100% * ${locationsAtlasMeta.w / f.w})`,
    height: `calc(100% * ${locationsAtlasMeta.h / f.h})`,
    transform: `translate(-${(f.x / locationsAtlasMeta.w) * 100}%, -${(f.y / locationsAtlasMeta.h) * 100}%)`,
  };
});

const previewImageStyle = computed<Record<string, string>>(() => {
  const f = previewLocationFrame.value!;
  return { width: `${f.w}px`, height: `${f.h}px` };
});

const lootCount = computed(() => {
  const raid = previewRaid.value;
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
  const raid = previewRaid.value;
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
  const raid = previewRaid.value;
  if (!raid || !raid.zoneCollapseSec || raid.zoneCollapseSec <= 0) return null;
  return formatDurationHM(raid.zoneCollapseSec);
});

interface MonsterSummary { id: string; name: string; count: number }
const monsterSummary = computed<MonsterSummary[]>(() => {
  const raid = previewRaid.value;
  if (!raid) return [];
  const lib = uiState.lib!;
  const counts: Record<string, number> = {};
  for (const step of raid.encounters || []) {
    if (step.encounter.type !== 'FightEncounter') continue;
    const id = (step.encounter as FightEncounterDef).monsterId;
    const c = Math.max(0, step.count | 0);
    counts[id] = (counts[id] || 0) + c;
  }
  const rows: MonsterSummary[] = [];
  for (const id of Object.keys(counts)) {
    const m = lib.monsters.get(id)!;
    rows.push({ id, name: m.name, count: counts[id] || 0 });
  }
  rows.sort((a, b) => (a.name < b.name ? -1 : 1));
  return rows;
});

const foundItemIds = computed<string[]>(() => {
  const id = previewRaidId.value;
  if (!id) return [];
  return uiState.raidFoundItemIdsByRaidId[id] ?? [];
});

const foundRegularItems = computed(() => {
  const lib = uiState.lib!;
  return foundItemIds.value
    .filter(id => !lib.getItem(id).remains)
    .map(id => ({ id, quantity: 1 }));
});

const foundRemainsItems = computed(() => {
  const lib = uiState.lib!;
  return foundItemIds.value
    .filter(id => lib.getItem(id).remains)
    .map(id => ({ id, quantity: 1 }));
});

function updateItemsPanelHeight() {
  nextTick(() => {
    if (itemsPanelRef.value) {
      itemsPanelHeight.value = itemsPanelRef.value.offsetHeight;
    }
  });
}

watch([foundRegularItems, foundRemainsItems], () => {
  updateItemsPanelHeight();
});

watch(previewRaidId, () => {
  updateItemsPanelHeight();
  justUnbannedItemId.value = null;
  justBannedItemId.value = null;
});

const bansPositionStyle = computed(() => {
  if (itemsPanelHeight.value > 0) {
    return { bottom: `${10 + itemsPanelHeight.value + 7}px` };
  }
  return { bottom: '92px' }; // fallback
});

function isLocked(r: RaidDefinition): boolean {
  return !uiState.unlockedRaidIds.includes(r.id);
}

function onPreview(id: string) {
  if (isLocked(uiState.raids.find(r => r.id === id)!)) return;
  previewRaidId.value = id;
}

function onSelect(id: string) {
  if (!id) return;
  const r = uiState.raids.find(rr => rr.id === id);
  if (!r || isLocked(r)) return;
  globalInputQueue.push(new CmdSelectRaid({ id }));
  emit('selected');
  emit('close');
}

watch(() => props.visible, (v, oldV) => {
  if (v) {
    previewRaidId.value = uiState.activeRaidId || null;
    updateItemsPanelHeight();
    justUnbannedItemId.value = null;
    justBannedItemId.value = null;
  } else if (oldV && !v) {
    // Closing: select the previewed raid if it exists and is different from active
    if (previewRaidId.value && previewRaidId.value !== uiState.activeRaidId) {
      const r = uiState.raids.find(rr => rr.id === previewRaidId.value);
      if (r && !isLocked(r)) {
        globalInputQueue.push(new CmdSelectRaid({ id: previewRaidId.value }));
        emit('selected');
      }
    }
  }
});

function firstUnlockedRaidId(): string | null {
  for (const id of uiState.raidOrder) {
    const r = uiState.raids.find(rr => rr.id === id);
    if (r && !isLocked(r)) return id;
  }
  return null;
}

// Item banning
const itemBansMax = computed(() => uiState.itemBans);

const bannedCount = computed(() => {
  const id = previewRaidId.value;
  if (!id) return 0;
  return (uiState.bannedItemIdsByRaidId[id] ?? []).length;
});

const canBanMore = computed(() => {
  return bannedCount.value < itemBansMax.value;
});

function isItemBanned(itemId: string): boolean {
  const id = previewRaidId.value;
  if (!id) return false;
  return (uiState.bannedItemIdsByRaidId[id] ?? []).includes(itemId);
}

function toggleBan(itemId: string) {
  const id = previewRaidId.value;
  if (!id) return;
  
  const currentlyBanned = isItemBanned(itemId);
  
  // If trying to ban but already at max, do nothing
  if (!currentlyBanned && !canBanMore.value) return;
  
  // Track just-banned/unbanned state to suppress hover effects until mouse leaves
  if (currentlyBanned) {
    justUnbannedItemId.value = itemId;
    justBannedItemId.value = null;
  } else {
    justBannedItemId.value = itemId;
    justUnbannedItemId.value = null;
  }
  
  globalInputQueue.push(new CmdToggleItemBan({
    raidId: id,
    itemId: itemId,
    banned: !currentlyBanned,
  }));
}

function onItemMouseLeave(itemId: string) {
  if (justUnbannedItemId.value === itemId) {
    justUnbannedItemId.value = null;
  }
  if (justBannedItemId.value === itemId) {
    justBannedItemId.value = null;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}
.modal-content {
  position: relative;
  background: var(--bg-2);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  width: 97vw;
  max-width: 1380px;
  min-height: 712px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.close-btn {
  border: 1px solid var(--panel-border);
  background: rgba(15, 23, 42, 0.5);
  color: var(--text-primary);
  font-size: 18px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 10px;
  z-index: 10;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.close-btn:hover {
  background: rgba(26, 35, 50, 0.7);
  color: var(--text-primary);
  border-color: var(--accent);
}
.close-btn-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
}
.close-btn-overlay-global {
  position: absolute;
  top: 12px;
  right: 12px;
}
.modal-body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  overflow: auto;
  flex: 1;
  scrollbar-gutter: stable;
}
/* Left panel: raid list */
.raid-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overflow-x: visible;
  max-height: 60vh;
  scrollbar-gutter: stable;
  padding-top: 4px;
  margin-top: -4px;
}
.raid-card {
  position: relative;
  height: 72px;
  border: 2px solid var(--panel-border);
  outline: none;
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--text-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: 800;
  letter-spacing: 0.02em;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 var(--panel-shine);
  transition: all 0.15s ease;
}
.raid-card:hover:not(:disabled):not(.locked) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 var(--panel-shine);
  border-color: var(--accent);
  background: var(--bg-2);
}
.raid-card:active:not(:disabled):not(.locked) {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 var(--panel-shine);
}
.raid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.4;
  z-index: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.raid-card:hover:not(:disabled):not(.locked) .raid-bg {
  opacity: 0.55;
}
.raid-card.active {
  background: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.4);
  box-shadow: 0 2px 8px rgba(74, 222, 128, 0.3), inset 0 1px 0 rgba(74, 222, 128, 0.2);
}
.raid-card.locked {
  --locked-color: var(--text-disabled);
  opacity: 0.7;
  cursor: not-allowed;
  border: 3px solid var(--locked-color);
}
.raid-card.locked .raid-bg {
  filter: blur(3px);
}
.raid-card:disabled {
  cursor: not-allowed;
}
.raid-title {
  position: relative;
  z-index: 1;
  font-size: 16px;
}
.raid-card.locked::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 24px;
  pointer-events: none;
  z-index: 1;
  background-image:
    repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.38) 0, rgba(0, 0, 0, 0.38) 8px, transparent 8px, transparent 16px);
  background-size: 20px 20px, 20px 20px;
}
.raid-locked {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--locked-color);
  font-weight: 800;
  font-size: 12px;
  padding: 0 8px;
  text-align: center;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  z-index: 2;
}
/* Right panel: raid preview */
.raid-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: auto;
}
.preview-image {
  position: relative;
  background: var(--bg-0);
  border-radius: 6px;
  overflow: hidden;
  margin: 0 auto;
}
.location-atlas {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  max-width: none;
  max-height: none;
  image-rendering: auto;
  user-select: none;
  pointer-events: none;
}
.image-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  font-style: italic;
}
.preview-description {
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.5;
  min-height: calc(1.5em * 4);
}
.ov {
  position: absolute;
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.ov-title {
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 14px;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: var(--text-primary);
  background: rgba(15, 23, 42, 0.5);
}
.ov-left {
  top: 10px;
  left: 10px;
  display: grid;
  row-gap: 7px;
  min-width: 180px;
  font-size: 13px;
}
.ov-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
}
.ov-icon {
  image-rendering: auto;
  filter: grayscale(1) brightness(0.95);
  opacity: 0.85;
  justify-self: center;
}
.ov-label {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  opacity: 0.85;
}
.ov-value {
  font-weight: 900;
  color: var(--text-primary);
}
.ov-monsters {
  top: 115px;
  left: 10px;
  display: grid;
  row-gap: 7px;
  font-size: 13px;
}
.ov-monster {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: baseline;
}
.ov-monster-name {
  font-weight: 800;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ov-monster-count {
  font-weight: 900;
  color: var(--text-primary);
}
.ov-bans {
  left: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: baseline;
  min-width: 180px;
  font-size: 13px;
}
.ban-panel-label {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  opacity: 0.85;
}
.ban-panel-value {
  font-weight: 900;
  color: var(--text-primary);
}
.ov-bottom {
  left: 10px;
  right: 10px;
  bottom: 10px;
  padding: 10px;
  background: rgba(23, 33, 47, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.ov-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.ov-items.split {
  grid-template-columns: 3fr 1fr;
  gap: 12px;
}
.ov-items-block {
  min-width: 0;
}
.no-preview {
  display: grid;
  place-items: center;
  height: 200px;
  color: var(--text-secondary);
  font-style: italic;
}
.select-btn {
  margin-top: auto;
  height: 48px;
  padding: 0 20px;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.35);
  background: rgba(34,197,94,0.18);
  color: #86efac;
  cursor: pointer;
}
.select-btn:hover {
  background: rgba(34,197,94,0.28);
}
.select-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}

.modal-body::-webkit-scrollbar { width: 10px; }
.modal-body::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 5px; }
.modal-body::-webkit-scrollbar-thumb { background: rgba(79, 209, 197, 0.3); border-radius: 5px; border: 2px solid rgba(0, 0, 0, 0.2); }
.modal-body::-webkit-scrollbar-thumb:hover { background: rgba(79, 209, 197, 0.5); }
.modal-body::-webkit-scrollbar-thumb:active { background: rgba(79, 209, 197, 0.6); }
.modal-body { scrollbar-width: thin; scrollbar-color: rgba(79, 209, 197, 0.3) rgba(0, 0, 0, 0.2); }

.raid-list::-webkit-scrollbar { width: 10px; }
.raid-list::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 5px; }
.raid-list::-webkit-scrollbar-thumb { background: rgba(79, 209, 197, 0.3); border-radius: 5px; border: 2px solid rgba(0, 0, 0, 0.2); }
.raid-list::-webkit-scrollbar-thumb:hover { background: rgba(79, 209, 197, 0.5); }
.raid-list::-webkit-scrollbar-thumb:active { background: rgba(79, 209, 197, 0.6); }
.raid-list { scrollbar-width: thin; scrollbar-color: rgba(79, 209, 197, 0.3) rgba(0, 0, 0, 0.2); }

/* Item banning */
.ov-items-bannable {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.bannable-item {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
}

.bannable-item.can-ban {
  cursor: pointer;
}

/* Banned: half-transparent */
.bannable-item.banned {
  opacity: 0.5;
  filter: grayscale(0.7);
  cursor: pointer;
}

/* Banned: hover restores opacity, lifts, hides red (unless just-banned) */
.bannable-item.banned:not(.just-banned):hover {
  opacity: 1;
  filter: grayscale(0);
  transform: translateY(-2px);
}

.bannable-item.banned:not(.just-banned):hover .banned-overlay {
  opacity: 0;
}

/* Just-unbanned: stay flat (no lift) */
.bannable-item.just-unbanned {
  transform: translateY(0);
}

/* Overlays: match item-cell bounds (48x48 with border-radius 6px) */
.banned-overlay,
.ban-hover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  border-radius: 6px;
}

.banned-overlay {
  background: rgba(220, 38, 38, 0.4);
  transition: opacity 0.15s ease;
}

.banned-cross {
  color: #fca5a5;
  font-weight: 400;
  font-size: 36px;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.ban-hover-overlay {
  opacity: 0;
  background: rgba(220, 38, 38, 0.4);
  transition: opacity 0.15s ease;
}

/* Unbanned: hover shows overlay (unless just-unbanned) */
.bannable-item.can-ban:not(.banned):not(.just-unbanned):hover .ban-hover-overlay {
  opacity: 1;
}

.ban-cross {
  color: #fca5a5;
  font-weight: 400;
  font-size: 36px;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}
</style>
