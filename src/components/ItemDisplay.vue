<template>
  <div class="item-cell-wrap" v-bind="$attrs" ref="wrapRef" @mouseenter="onEnter" @mouseleave="onLeave">
    <div class="item-cell" :class="{ minor, 'has-vol': showVolume }">
      <div class="sprite" v-if="source && frame" :class="{ 'sprite-dimmed': moleculeUrl }" :style="spriteStyle" />
      <div class="molecule-view" v-if="moleculeUrl" :style="{ backgroundImage: `url(${moleculeUrl})` }" />
      <div v-else-if="!source || !frame" class="placeholder">{{ id }}</div>

      <div v-if="showScore && hasFiniteScore" class="score">{{ displayScore }}</div>
      <div v-if="showVolume" class="vol">{{ displayVolume }}</div>
      <div v-if="quantity > 1" class="qty">x{{ quantity }}</div>

      <div class="essences" v-if="!minor && essencesToShow.length && !moleculeUrl">
        <div
          v-for="(row, rowIndex) in essenceRows"
          :key="rowIndex"
          class="ess-row"
        >
          <template v-for="(e, idx) in row" :key="e.key">
            <span class="ess-entry">
              <span
                v-if="getEssenceFrame(e.key) && source"
                class="ess-icon"
                :style="essenceIconStyle(e.key)"
              />
              <span v-else class="ess-letter">{{ essenceLetter(e.key) }}</span>
              <span v-if="e.value !== 1" class="ess-num">{{ e.value }}</span>
            </span>
            <span v-if="idx < row.length - 1" class="sp" />
          </template>
        </div>
      </div>

      <div
        v-if="!minor && displayRarityShort"
        class="rarity-label"
        :class="`rarity-${displayRarity.toLowerCase()}`"
      >
        {{ displayRarityShort }}
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="!noTooltip"
      ref="tooltipRef"
      v-show="hovered"
      class="tooltip-panel"
      :class="{ visible: hovered, below: tooltipBelow }"
      :style="tooltipStyle"
      aria-hidden="true"
    >
      <div class="tp-title">{{ displayName }}</div>
      <div v-if="displayRarity" class="tp-row">
        <span class="tp-label">Rarity</span>
        <span class="tp-value">{{ displayRarity }}</span>
      </div>
      <div v-if="displayVolume != null" class="tp-row">
        <span class="tp-label">Volume</span>
        <span class="tp-value">{{ displayVolume }}</span>
      </div>
      <div v-if="tooltipMoleculeUrl" class="tp-molecule" :style="{ backgroundImage: `url(${tooltipMoleculeUrl})` }" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { ensureMoleculeAtlas } from '../logic/MoleculeAtlas';
import itemsData from '../data/items';
import type { ItemDefinition } from '../logic/ItemLib';

defineOptions({ inheritAttrs: false });

const props = defineProps<{ id: string; quantity?: number; minor?: boolean; noTooltip?: boolean; showMolecule?: boolean; showScore?: boolean; showVolume?: boolean }>();

const quantity = computed(() => Math.max(1, props.quantity ?? 1));
const minor = computed(() => !!props.minor);
const showScore = computed(() => !!props.showScore);
const showVolume = computed(() => !!props.showVolume);

const wrapRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const hovered = ref(false);
const tooltipBelow = ref(false);
const tooltipStyle = ref<Record<string, string>>({});

function updateTooltipPosition() {
  const wrap = wrapRef.value!;
  const tooltip = tooltipRef.value!;
  const a = wrap.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  const desiredCenterX = a.left + a.width / 2;
  const margin = 10;
  const minCenterX = margin + tooltipRect.width / 2;
  const maxCenterX = window.innerWidth - margin - tooltipRect.width / 2;
  const centerX = Math.min(Math.max(desiredCenterX, minCenterX), maxCenterX);

  const yGap = 8;
  const fitsAbove = a.top - yGap - tooltipRect.height >= margin;
  tooltipBelow.value = !fitsAbove;

  const top = fitsAbove ? a.top - yGap : a.bottom + yGap;
  const translateY = fitsAbove ? '-100%' : '0';

  const tooltipLeft = centerX - tooltipRect.width / 2;
  const arrowX = Math.min(Math.max(desiredCenterX - tooltipLeft, 14), tooltipRect.width - 14);

  tooltipStyle.value = {
    left: `${centerX}px`,
    top: `${top}px`,
    transform: `translate(-50%, ${translateY})`,
    '--tp-arrow-left': `${arrowX}px`,
  };
}

async function onEnter() {
  if (props.noTooltip) return;
  hovered.value = true;
  await nextTick();
  updateTooltipPosition();
  window.addEventListener('scroll', updateTooltipPosition, true);
  window.addEventListener('resize', updateTooltipPosition, true);
}

function onLeave() {
  if (props.noTooltip) return;
  hovered.value = false;
  window.removeEventListener('scroll', updateTooltipPosition, true);
  window.removeEventListener('resize', updateTooltipPosition, true);
}

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateTooltipPosition, true);
  window.removeEventListener('resize', updateTooltipPosition, true);
});

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

const moleculeUrl = ref<string | null>(null);
watch(
  () => [props.showMolecule, props.id] as const,
  async ([showMolecule, id], _prev, onCleanup) => {
    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    if (!showMolecule) {
      moleculeUrl.value = null;
      return;
    }

    try {
      await ensureMoleculeAtlas();
      if (cancelled) return;
      moleculeUrl.value = atlasStorage.getMoleculeImage(id);
    } catch (e) {
      console.error('Error updating molecule image:', e);
      if (cancelled) return;
      moleculeUrl.value = null;
    }
  },
  { immediate: true }
);

const tooltipMoleculeUrl = ref<string | null>(null);
watch(
  () => [hovered.value, props.id] as const,
  async ([isHovered, id], _prev, onCleanup) => {
    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    if (!isHovered) {
      tooltipMoleculeUrl.value = null;
      return;
    }

    try {
      await ensureMoleculeAtlas();
      if (cancelled) return;
      tooltipMoleculeUrl.value = atlasStorage.getMoleculeImage(id);
    } catch (e) {
      if (cancelled) return;
      tooltipMoleculeUrl.value = null;
    }
  },
  { immediate: true }
);

const frame = computed(() => atlasStorage.getItemsFrame(props.id));

const itemDef = computed<ItemDefinition>(() => (itemsData as Record<string, ItemDefinition>)[props.id]!);
const displayName = computed(() => itemDef.value.name);
const displayVolume = computed(() => itemDef.value.volume);
const displayRarity = computed(() => {
  return itemDef.value.rarity.toUpperCase();
});

const displayRarityShort = computed(() => {
  const rarity = itemDef.value.rarity;
  return rarity[0].toUpperCase();
});

const displayScore = computed(() => {
  if (!Number.isFinite(itemDef.value.score)) return '';
  const rounded = Math.round(itemDef.value.score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
});

const hasFiniteScore = computed(() => Number.isFinite(itemDef.value.score));

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
  const e = itemDef.value.essence;
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(e)]));
  const list = keys
    .map(k => ({ key: k, value: e[k] }))
    .filter(x => x.value > 0);
  return list;
});

const essenceRows = computed(() => {
  const list = essencesToShow.value;
  if (!list.length) return [];
  if (list.length >= 5) {
    const split = Math.floor(list.length / 2);
    return [list.slice(0, split), list.slice(split)];
  }
  return [list];
});

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y', cyan: 'C' };
  return m[k] || k[0]?.toUpperCase() || '?';
}

function getEssenceFrame(k: string) {
  return atlasStorage.getItemsFrame(k);
}

function essenceIconStyle(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  // Scale the entire atlas proportionally so the essence icon fits in 14x14
  const size = 16;
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
</script>

<style scoped>
.item-cell-wrap {
  position: relative;
  display: inline-block;
}
.item-cell {
  position: relative;
  box-sizing: border-box;
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
.sprite.sprite-dimmed {
  opacity: 0.5;
  filter: brightness(0.5);
}
.item-cell.minor .sprite {
  transform: translate(-50%, -50%) scale(0.5);
}
.molecule-view {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  image-rendering: auto;
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
.item-cell.has-vol .qty {
  top: 23px;
}
.item-cell.minor .qty {
  font-size: 12px;
  padding: 0px 3px;
}
.item-cell.minor.has-vol .qty {
  top: 20px;
}
.score {
  position: absolute;
  top: 3px;
  left: 3px;
  padding: 1px 4px;
  font-weight: 800;
  font-size: 13px;
  background: rgba(0,0,0,0.55);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}
.item-cell.minor .score {
  font-size: 11px;
  padding: 0px 3px;
}
.vol {
  position: absolute;
  top: 3px;
  right: 3px;
  padding: 1px 4px;
  font-weight: 800;
  font-size: 13px;
  background: rgba(0,0,0,0.55);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}
.item-cell.minor .vol {
  font-size: 11px;
  padding: 0px 3px;
}
.essences {
  position: absolute;
  bottom: 0;
  right: 2px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  padding: 2px 3px;
  background: linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.7));
  border-radius: 4px;
  font-weight: 800;
  font-size: 12px;
}
.ess-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.ess-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1px;
}
.ess-num {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 900;
  color: #ffffff;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
}
.ess-letter {
  opacity: 0.9;
  font-size: 11px;
  width: 100%;
  text-align: center;
  line-height: 16px;
}
.ess-icon {
  display: inline-block;
  vertical-align: middle;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,0.4));
}
.sp { width: 3px; display: inline-block; }

.tooltip-panel {
  position: fixed;
  left: 0;
  top: 0;
  transform: translate(-50%, -100%);
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  box-shadow: 0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 var(--panel-shine);
  min-width: 140px;
  max-width: 240px;
  pointer-events: none;
  z-index: 20000;
  opacity: 0;
  transition: opacity 120ms ease;
}
.tooltip-panel.visible { opacity: 1; }
.tooltip-panel::after {
  content: '';
  position: absolute;
  top: 100%;
  left: var(--tp-arrow-left, 50%);
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid rgba(10, 15, 26, 0.94);
  filter: drop-shadow(0 1px 0 var(--panel-border));
}
.tooltip-panel.below::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom: 7px solid rgba(20, 28, 40, 0.98);
}
.tp-title { font-weight: 800; margin-bottom: 4px; letter-spacing: 0.02em; }
.tp-molecule {
  width: 96px;
  height: 96px;
  margin: 8px auto 0;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
.tp-row { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
.tp-label { opacity: 0.8; text-transform: uppercase; letter-spacing: 0.06em; }
.tp-value { font-weight: 800; }

.rarity-label {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 9px;
  font-weight: 700;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 10;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  line-height: 1;
}
.rarity-label.rarity-common { color: #9ca3af; }
.rarity-label.rarity-uncommon { color: white; }
.rarity-label.rarity-rare { color: #60a5fa; }
.rarity-label.rarity-legendary { color: #fbbf24; font-weight: 900; }
</style>
