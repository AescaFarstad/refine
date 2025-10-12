<template>
  <div class="item-cell-wrap">
    <div class="item-cell" :class="{ minor }">
      <div class="sprite" v-if="source && frame" :style="spriteStyle" />
      <div v-else class="placeholder">{{ id }}</div>

      <div v-if="quantity > 1" class="qty">x{{ quantity }}</div>

      <div class="essences" v-if="!minor && essencesToShow.length">
        <template v-for="(e, idx) in essencesToShow" :key="e.key">
          <span class="ess-num">{{ e.value }}</span>
          <span v-if="getEssenceFrame(e.key) && source" class="ess-icon" :style="essenceIconStyle(e.key)" />
          <span v-else class="ess-letter">{{ essenceLetter(e.key) }}</span>
          <span v-if="idx < essencesToShow.length - 1" class="sp" />
        </template>
      </div>
    </div>

    <div class="tooltip-panel" aria-hidden="true">
      <div class="tp-title">{{ displayName }}</div>
      <div v-if="displayVolume != null" class="tp-row">
        <span class="tp-label">Volume</span>
        <span class="tp-value">{{ displayVolume }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import itemsData from '../data/items';

const props = defineProps<{ id: string; quantity?: number; minor?: boolean }>();

const quantity = computed(() => Math.max(1, props.quantity ?? 1));
const minor = computed(() => !!props.minor);

// Atlas state
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) { /* noop */ }
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});

const frame = computed(() => atlasStorage.getItemsFrame(props.id));

const itemDef = computed(() => (itemsData as any)[props.id] as { name?: string; volume?: number } | undefined);
const displayName = computed(() => itemDef.value?.name ?? props.id);
const displayVolume = computed(() => itemDef.value?.volume);

const spriteStyle = computed(() => {
  if (!source.value || !frame.value) return {} as Record<string, string>;
  const f = frame.value;
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: f.w + 'px',
    height: f.h + 'px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x}px -${f.y}px`,
    backgroundSize: `${atlasW}px ${atlasH}px`,
  } as Record<string, string>;
});

// Essences display
type EssenceKey = 'red' | 'green' | 'blue' | 'yellow' | string;
const orderedKeys: EssenceKey[] = ['red', 'green', 'blue', 'yellow'];
const essencesToShow = computed(() => {
  const rec = (itemsData as any)[props.id] as { essence?: Record<string, number> } | undefined;
  const e = rec?.essence || {};
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(e)]));
  const list = keys
    .map(k => ({ key: k, value: (e as any)[k] as number | undefined }))
    .filter(x => (x.value || 0) > 0);
  return list;
});

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
  return m[k] || k[0]?.toUpperCase() || '?';
}

function getEssenceFrame(k: string) {
  return atlasStorage.getItemsFrame(k);
}

function essenceIconStyle(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  // Scale the entire atlas proportionally so the essence icon fits in 14x14
  const scale = 14 / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: '14px',
    height: '14px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}
</script>

<style scoped>
.item-cell-wrap {
  position: relative;
  display: inline-block;
}
.item-cell {
  position: relative;
  width: 96px;
  height: 96px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: rgba(255,255,255,0.02);
  overflow: hidden;
}
.item-cell.minor {
  width: 48px;
  height: 48px;
}
.sprite {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  image-rendering: auto;
}
.item-cell.minor .sprite {
  transform: translate(-50%, -50%) scale(0.5);
  filter: grayscale(1) brightness(0.9);
}
.placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 10px;
  opacity: 0.6;
}
.qty {
  position: absolute;
  top: 3px;
  right: 3px;
  padding: 1px 4px;
  font-weight: 800;
  font-size: 16px;
  background: rgba(0,0,0,0.55);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.item-cell.minor .qty {
  font-size: 12px;
  padding: 0px 3px;
}
.essences {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 2px 3px;
  background: linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.55));
  font-weight: 800;
  font-size: 12px;
}
.ess-num { margin-right: 1px; }
.ess-letter { opacity: 0.9; font-size: 11px; }
.ess-icon {
  display: inline-block;
  vertical-align: middle;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,0.4));
}
.sp { width: 4px; display: inline-block; }

.tooltip-panel {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%) translateY(4px) scale(0.98);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  box-shadow: 0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 var(--panel-shine);
  min-width: 140px;
  max-width: 240px;
  pointer-events: none;
  z-index: 999;
  opacity: 0;
  transition: opacity 120ms ease, transform 140ms ease;
}
.item-cell-wrap:hover .tooltip-panel {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}
.tooltip-panel::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid rgba(10, 15, 26, 0.94);
  filter: drop-shadow(0 1px 0 var(--panel-border));
}
.tp-title { font-weight: 800; margin-bottom: 4px; letter-spacing: 0.02em; }
.tp-row { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
.tp-label { opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em; }
.tp-value { font-weight: 800; }
</style>
