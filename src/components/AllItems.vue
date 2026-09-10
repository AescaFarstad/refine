<template>
  <div class="panel all-items">
    <div v-if="!hideSortingUi" class="essence-header" :class="{ reserved: essenceKeys.length === 0 }" :aria-hidden="essenceKeys.length === 0">
      <button
        class="essence-btn raid-sort-btn"
        type="button"
        :aria-pressed="activeSort === '#'"
        @click="onSortBy('#')"
        title="Sort by: Dev → Remains → Raid order"
      >
        <span class="row-top">
          <span class="ess-letter14">#</span>
          <span class="sort-arrow" :class="{ active: activeSort === '#' }">▼</span>
        </span>
      </button>
      <button
        v-for="k in essenceKeys"
        :key="'ess-' + k"
        class="essence-btn"
        type="button"
        :aria-pressed="activeSort === k"
        :aria-label="`Sort by ${k} essence`"
        @click="onSortBy(k)"
      >
        <span class="row-top">
          <span class="ess-icon14" :style="essenceIconStyle(14, k)" />
          <span class="sort-arrow" :class="{ active: activeSort === k }">▼</span>
        </span>
        <span class="row-bottom">
          <span class="ess-total">{{ essenceTotals[k] || 0 }}</span>
        </span>
      </button>
      <EssenceCheatSheet :pulse="hasUnseenEssences" />
    </div>
    <div v-if="raidFilterMode && availableRaids && availableRaids.length" class="raid-filter-row">
      <button
        v-for="raid in availableRaids"
        :key="'raid-' + raid.id"
        type="button"
        class="raid-btn"
        :class="{ active: activeRaidFilter === raid.id }"
        :title="`${raid.name} (${raid.id})`"
        :aria-label="raid.name"
        :aria-pressed="activeRaidFilter === raid.id"
        @click="emit('raid-filter', raid.id)"
      >
        {{ raid.order + 1 }}
      </button>
      <slot name="raid-filter-actions" />
    </div>
    <div class="grid-wrap">
      <slot v-if="useCustomGridContent" name="grid-content" />
      <ItemGrid
        v-else
        :items="sortedItems"
        :dim-ids="dimIds"
        :show-volumes="showVolumes"
        :show-essences="false"
        :clickable="clickable"
        draggable
        no-tooltip
        @item-click="onPick"
        @item-drag-start="onPick"
        @item-drag-end="$emit('drag-end')"
      />
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ItemGrid from './ItemGrid.vue';
import EssenceCheatSheet from './EssenceCheatSheet.vue';
import { uiState } from '../logic/UIState';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';

const props = defineProps<{
  items: Array<{ id: string; quantity: number }>;
  clickable?: boolean;
  requiredEssences?: Record<string, number>;
  raidFilterMode?: boolean;
  availableRaids?: Array<{ id: string; name: string; order: number }>;
  activeRaidFilter?: string | null;
  showVolumes?: boolean;
  hideSortingUi?: boolean;
  useCustomGridContent?: boolean;
}>();
const emit = defineEmits<{
  (e: 'pick-item', id: string): void;
  (e: 'drag-end'): void;
  (e: 'raid-filter', raidId: string | null): void;
}>();

// Atlas state for essence icons - pre-loaded at app start
const source = atlasStorage.getItemsSource();

function essenceIconStyle(size: number, k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k)!;
  return atlasSpriteStyle(source, f, { size, mode: 'fixed' });
}

// Total essences present in player's items (full inventory, not just available)
const essenceTotals = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  if (!uiState.lib) return totals;

  for (const it of uiState.items) {
    const def = uiState.lib.getItem(it.id);
    const ess = def.essence;
    const qty = Math.max(1, it.quantity || 1);
    for (const [k, v] of Object.entries(ess)) {
      if (!v) continue;
      totals[k] = (totals[k] || 0) + v * qty;
    }
  }
  return totals;
});

const orderedKeys: string[] = ['red', 'red_s', 'green', 'green_s', 'blue', 'blue_s', 'yellow', 'yellow_s', 'black', 'white'];
const essenceKeys = computed<string[]>(() => {
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(essenceTotals.value)]));
  return keys.filter(k => (essenceTotals.value[k] || 0) > 0);
});

const hasUnseenEssences = computed(() => {
  const seen = new Set(uiState.seenEssences);
  return uiState.encounteredEssences.some(k => !seen.has(k));
});

const activeSort = ref<string>('');

function essenceInItem(itemId: string, k: string): number {
  if (!uiState.lib) return 0;
  const def = uiState.lib.getItem(itemId);
  return Math.max(0, def.essence[k] || 0);
}

const sortedItems = computed(() => {
  const k = activeSort.value;
  if (!k || !uiState.lib) return props.items;
  const list = [...props.items];

  if (k === '#') {
    return list.sort((a, b) => {
      const aOrder = uiState.lib!.getItem(a.id).order;
      const bOrder = uiState.lib!.getItem(b.id).order;
      return aOrder - bOrder;
    });
  }

  return list.sort((a, b) => {
    const av = essenceInItem(a.id, k);
    const bv = essenceInItem(b.id, k);
    if (av !== bv) return bv - av; // descending
    // Tie-breaker: larger quantity first, then id
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.id.localeCompare(b.id);
  });
});

// Dimming logic based on selected recipe's required essences
const requiredKeys = computed<string[]>(() => {
  const ing = props.requiredEssences ?? {};
  return Object.keys(ing).filter(k => (ing[k] || 0) > 0);
});

const dimIds = computed<Record<string, boolean>>(() => {
  const out: Record<string, boolean> = {};
  const req = requiredKeys.value;
  if (!req.length) return out; // nothing to dim
  for (const it of props.items) {
    const hasAny = req.some(k => essenceInItem(it.id, k) > 0);
    if (!hasAny) out[it.id] = true;
  }
  return out;
});

function onSortBy(k: string) {
  activeSort.value = k;
}

function onPick(id: string) {
  const it = props.items.find(x => x.id === id);
  if (!it || it.quantity <= 0) return;

  emit('pick-item', id);
}

</script>

<style scoped>
.all-items { height: 100%; display: flex; flex-direction: column; }
/* Inherited by both grid layers; hovering never invalidates the item render. */
.all-items:hover { --item-grid-molecule-opacity: 1; --item-grid-base-opacity: 0.18; }
.essence-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; min-height: 22px; flex-wrap: wrap; }
.essence-header.reserved { visibility: hidden; }
.essence-btn { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--panel-border); background: rgba(255,255,255,0.03); color: inherit; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.essence-btn:hover { background: rgba(255,255,255,0.06); }
.raid-sort-btn { padding: 2px 4px; }
.raid-sort-btn .row-top { min-height: 32px; }
.raid-sort-btn .ess-letter14 { width: 18px; height: 18px; font-size: 24px; font-weight: 900; background: none;}
.row-top { display: inline-flex; align-items: center; gap: 4px; line-height: 1; }
.row-bottom { line-height: 1; }
.ess-icon14 { display: inline-block; width: 14px; height: 14px; vertical-align: middle; }
.ess-letter14 { display: inline-grid; place-items: center; width: 14px; height: 14px; font-weight: 900; font-size: 11px; opacity: 0.95; border-radius: 3px; background: rgba(255,255,255,0.06); }
.ess-total { font-variant-numeric: tabular-nums; }
.sort-arrow { display: inline-block; width: 10px; text-align: center; opacity: 0; transition: opacity 100ms ease; }
.sort-arrow.active { opacity: 1; }
.raid-filter-row { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; flex-wrap: wrap; }
.raid-btn { min-width: 28px; height: 28px; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--panel-border); background: rgba(255,255,255,0.03); color: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 120ms ease; position: relative; }
.raid-btn:hover { background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.5); transform: translateY(-1px); }
.raid-btn.active { background: rgba(34, 197, 94, 0.25); border-color: rgba(34, 197, 94, 0.7); color: #a7f3d0; }
.raid-btn:hover::after { content: attr(title); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 4px; padding: 4px 8px; background: rgba(15, 23, 42, 0.95); border: 1px solid var(--panel-border); border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; z-index: 1000; pointer-events: none; color: #e5e7eb; }
.grid-wrap { flex: 1; min-height: 0; }
</style>
