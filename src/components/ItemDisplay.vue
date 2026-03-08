<template>
  <div class="item-cell-wrap" v-bind="$attrs" ref="wrapRef" @mouseenter="onEnter" @mouseleave="onLeave">
    <div class="item-cell" :class="{ minor, 'has-vol': showVolume }">
      <div class="sprite" :style="spriteStyle" />
      <div v-if="showNewBand" class="new-band">New</div>

      <div v-if="showScore && hasFiniteScore" class="score">{{ displayScore }}</div>
      <div v-if="showVolume" class="vol">{{ displayVolume }}</div>
      <div v-if="quantity > 1" class="qty">x{{ quantity }}</div>

      <div class="essences" v-if="showEssences && !minor && essencesToShow.length">
        <div
          v-for="(row, rowIndex) in essenceRows"
          :key="rowIndex"
          class="ess-row"
        >
          <template v-for="(e, idx) in row" :key="e.key">
            <span class="ess-entry">
              <span class="ess-icon" :style="essenceIconStyle(e.key)" />
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
        <span class="tp-value" :class="`rarity-${itemDef.rarity}`">{{ displayRarity }}</span>
      </div>
      <div v-if="displayVolume != null" class="tp-row">
        <span class="tp-label">Volume</span>
        <span class="tp-value">{{ displayVolume }}</span>
      </div>
      <div v-if="tooltipMoleculeStyle" class="tp-molecule" :style="tooltipMoleculeStyle" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import itemsData from '../data/items';
import type { ItemDefinition } from '../logic/ItemLib';
import { uiState } from '../logic/UIState';

defineOptions({ inheritAttrs: false });

const props = defineProps<{ id: string; quantity?: number; minor?: boolean; noTooltip?: boolean; showScore?: boolean; showVolume?: boolean; showEssences?: boolean }>();

const quantity = computed(() => Math.max(1, props.quantity ?? 1));
const minor = computed(() => !!props.minor);
const showScore = computed(() => !!props.showScore);
const showVolume = computed(() => !!props.showVolume);
const showEssences = computed(() => props.showEssences !== false);
const showNewBand = computed(() => !!uiState.unrefinedOwnedItemIdMap[props.id]);

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

// Atlas state - atlases are pre-loaded at app start
const source = atlasStorage.getItemsSource();
const moleculesSource = atlasStorage.getMoleculesSource();

const itemDef = computed<ItemDefinition>(() => (itemsData as Record<string, ItemDefinition>)[props.id]!);
const frame = computed(() => {
  const itemFrame = atlasStorage.getItemsFrame(props.id);
  if (itemFrame) return itemFrame;
  const firstAtom = itemDef.value.molecule.atoms[0]!;
  return atlasStorage.getItemsFrame(firstAtom.color)!;
});
const moleculeFrame = computed(() => atlasStorage.getMoleculesFrame(`mol:${props.id}`));
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
  const f = frame.value;
  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;
  return {
    width: f.w + 'px',
    height: f.h + 'px',
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x}px -${f.y}px`,
    backgroundSize: `${atlasW}px ${atlasH}px`,
  } as Record<string, string>;
});

function makeMoleculeStyle(targetW: number, targetH: number): Record<string, string> | null {
  const f = moleculeFrame.value;
  if (!moleculesSource || !f) return null;
  const scale = Math.min(targetW / f.w, targetH / f.h);
  const atlasW = moleculesSource.naturalWidth;
  const atlasH = moleculesSource.naturalHeight;
  return {
    backgroundImage: `url(${moleculesSource.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

const tooltipMoleculeStyle = computed(() => {
  if (!hovered.value) return null;
  return makeMoleculeStyle(96, 96);
});

// Essences display
type EssenceKey = 'red' | 'green' | 'blue' | 'yellow' | string;
const orderedKeys: EssenceKey[] = ['red', 'red_s', 'green', 'green_s', 'blue', 'blue_s', 'yellow', 'yellow_s'];
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

function essenceIconStyle(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k)!;
  return atlasSpriteStyle(source, f, { size: 16, mode: 'fixed' });
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
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.item-cell-wrap:hover .item-cell {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.15);
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
}
.new-band {
  position: absolute;
  top: 0;
  left: 0;
  width: 52px;
  padding: 2px 0;
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
  color: #fff;
  background: linear-gradient(180deg, #ef4444, #b91c1c);
  transform: translate(-14px, 5px) rotate(-45deg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 12;
}
.item-cell.minor .new-band {
  width: 38px;
  padding: 1px 0;
  font-size: 7px;
  transform: translate(-11px, 3px) rotate(-45deg);
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
  right: 0;
  top: 0;
  padding: 0px 2px;
  font-weight: 800;
  font-size: 18px;
  line-height: 1;
  background: rgba(0,0,0,0.55);
  border-radius: 0 0 0 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.item-cell.minor .qty {
  font-size: 14px;
  padding: 0px 4px;
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
.tp-value.rarity-common { color: #9ca3af; }
.tp-value.rarity-uncommon { color: white; }
.tp-value.rarity-rare { color: #60a5fa; }
.tp-value.rarity-legendary { color: #fbbf24; }

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
