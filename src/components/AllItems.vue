<template>
  <div class="panel all-items" @mouseenter="isHovering = true" @mouseleave="isHovering = false">
    <div class="header">
      <h3>All Items</h3>
      <span class="count" v-if="items?.length">{{ items.length }}</span>
    </div>
    <div class="essence-header" :class="{ reserved: essenceKeys.length === 0 }" :aria-hidden="essenceKeys.length === 0">
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
        @click="onSortBy(k)"
      >
        <span class="row-top">
          <span v-if="getEssenceFrame(k) && source" class="ess-icon14" :style="essenceIconStyle(14, k)" />
          <span v-else class="ess-letter14">{{ essenceLetter(k) }}</span>
          <span class="sort-arrow" :class="{ active: activeSort === k }">▼</span>
        </span>
        <span class="row-bottom">
          <span class="ess-total">{{ essenceTotals[k] || 0 }}</span>
        </span>
      </button>
    </div>
    <div class="grid-wrap">
      <ItemGrid
        :items="sortedItems" 
        :dim-ids="dimIds" 
        :draggable-ids="draggableIds"
        :show-molecule="isHovering"
        clickable 
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
import { computed, onMounted, ref } from 'vue';
import ItemGrid from './ItemGrid.vue';
import { uiState } from '../logic/UIState';
import atlasStorage from '../logic/AtlasStorage';

const props = defineProps<{ items: Array<{ id: string; quantity: number }>; requiredEssences?: Record<string, number>; copyIdOnClick?: boolean }>();
const emit = defineEmits<{ (e: 'pick-item', id: string): void; (e: 'drag-end'): void }>();

const isHovering = ref(false);

// Atlas state for essence icons
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) { /* noop */ }
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});

function getEssenceFrame(k: string) {
  return atlasStorage.getItemsFrame(k);
}

function essenceIconStyle(size: number, k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = size / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: size + 'px',
    height: size + 'px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
  return m[k] || k?.[0]?.toUpperCase?.() || '?';
}

// Total essences present in player's items (full inventory, not just available)
const essenceTotals = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  if (!uiState.lib) return totals;

  for (const it of uiState.items) {
    const def = uiState.lib.items.get(it.id);
    if (!def) continue;
    const ess = def.essence || {};
    const qty = Math.max(1, it.quantity || 1);
    for (const [k, v] of Object.entries(ess)) {
      if (!v) continue;
      totals[k] = (totals[k] || 0) + v * qty;
    }
  }
  return totals;
});

const orderedKeys: string[] = ['red', 'green', 'blue', 'yellow'];
const essenceKeys = computed<string[]>(() => {
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(essenceTotals.value)]));
  return keys.filter(k => (essenceTotals.value[k] || 0) > 0);
});

const activeSort = ref<string>('');

function essenceInItem(itemId: string, k: string): number {
  if (!uiState.lib) return 0;
  const def = uiState.lib.items.get(itemId);
  return Math.max(0, def?.essence?.[k] || 0);
}

const sortedItems = computed(() => {
  const list = [...(props.items || [])];
  const k = activeSort.value;
  if (!k || !uiState.lib) return list;

  if (k === '#') {
    return list.sort((a, b) => {
      const aOrder = uiState.lib!.items.get(a.id)!.order;
      const bOrder = uiState.lib!.items.get(b.id)!.order;
      return aOrder - bOrder;
    });
  }

  return list.sort((a, b) => {
    const av = essenceInItem(a.id, k);
    const bv = essenceInItem(b.id, k);
    if (av !== bv) return bv - av; // descending
    // Tie-breaker: larger quantity first, then id
    if ((b.quantity || 0) !== (a.quantity || 0)) return (b.quantity || 0) - (a.quantity || 0);
    return String(a.id).localeCompare(String(b.id));
  });
});

// Dimming logic based on selected recipe's required essences
const requiredKeys = computed<string[]>(() => {
  const ing = (props.requiredEssences || {}) as Record<string, number>;
  return Object.keys(ing).filter(k => (ing[k] || 0) > 0);
});

const dimIds = computed<Record<string, boolean>>(() => {
  const out: Record<string, boolean> = {};
  const req = requiredKeys.value;
  if (!req.length) return out; // nothing to dim
  for (const it of props.items || []) {
    const hasAny = req.some(k => essenceInItem(it.id, k) > 0);
    if (!hasAny) out[it.id] = true;
  }
  return out;
});

const draggableIds = computed<Record<string, boolean>>(() => {
  const out: Record<string, boolean> = {};
  if (!uiState.lib) return out;

  for (const it of props.items || []) {
    const def = uiState.lib.items.get(it.id);
    if (def?.molecule) {
      out[it.id] = true;
    }
  }
  return out;
});

function onSortBy(k: string) {
  activeSort.value = k;
}

async function onPick(id: string) {
  const it = props.items?.find(x => x.id === id);
  if (!it || (it.quantity || 0) <= 0) return;

  if (props.copyIdOnClick) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      await navigator.clipboard.writeText(id);
  }

  emit('pick-item', id);
}
</script>

<style scoped>
.all-items { height: 100%; display: flex; flex-direction: column; }
.header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
h3 { margin: 0; font-size: 16px; letter-spacing: 0.04em; }
.count { font-size: 12px; opacity: 0.8; }
.essence-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; min-height: 22px; flex-wrap: nowrap; overflow-x: auto; }
.essence-header.reserved { visibility: hidden; }
.essence-btn { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--panel-border); background: rgba(255,255,255,0.03); color: inherit; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.essence-btn:hover { background: rgba(255,255,255,0.06); }
.raid-sort-btn { padding: 2px 4px; }
.raid-sort-btn .row-top { min-height: 32px; }
.raid-sort-btn .ess-letter14 { width: 24px; height: 24px; font-size: 24px; font-weight: 900; background: none; }
.row-top { display: inline-flex; align-items: center; gap: 4px; line-height: 1; }
.row-bottom { line-height: 1; }
.ess-icon14 { display: inline-block; width: 14px; height: 14px; vertical-align: middle; }
.ess-letter14 { display: inline-grid; place-items: center; width: 14px; height: 14px; font-weight: 900; font-size: 11px; opacity: 0.95; border-radius: 3px; background: rgba(255,255,255,0.06); }
.ess-total { font-variant-numeric: tabular-nums; }
.sort-arrow { display: inline-block; width: 10px; text-align: center; opacity: 0; transition: opacity 100ms ease; }
.sort-arrow.active { opacity: 1; }
.grid-wrap { flex: 1; min-height: 0; }
</style>
