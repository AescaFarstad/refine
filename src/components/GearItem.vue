<template>
  <button
    type="button"
    class="gear-item"
    :class="{ selected, unaffordable, blocked, 'hint-right': useRight, 'has-image': !!gearFrame }"
    ref="rootEl"
    @mouseenter="updateHintSide"
    @mouseleave="clearRaidResourceInfoHover"
    @click="handleClick"
    @dblclick.prevent.stop="handleDoubleClick"
  >
    <!-- Gear image sprite -->
    <div class="g-sprite-wrap">
      <div class="g-sprite" :style="spriteStyle" />
    </div>

    <div class="g-name">{{ gear.name }}</div>

    <!-- Styled tooltip with all effects shown on hover -->
    <div class="hint" role="tooltip" aria-hidden="true" ref="hintEl">
      <GearStatsHint :gear="gear" :blocked="blocked" />
    </div>

    <div v-if="xpRows.length > 0" class="g-xp" aria-hidden="true">
      <div v-for="(row, rowIndex) in xpRows" :key="rowIndex" class="g-xp-row">
        <span
          v-for="(pip, pipIndex) in row"
          :key="pipIndex"
          :class="['g-xp-pip', { completed: pip === '⋆' }]"
        >{{ pip }}</span>
      </div>
    </div>

    <!-- Bottom-right weight label (no special background); hidden when zero -->
    <div class="g-weight" v-if="effectiveWeight > 0">
      <span class="g-weight-num">{{ effectiveWeight }}</span>
      <span class="g-weight-icon" :style="weightIconStyle" aria-hidden="true" />
    </div>

    <div class="g-count" v-if="count !== undefined">x{{ count }}</div>
    <div class="g-price" v-else-if="price > 0">{{ price.toLocaleString() }}{{ creditsSpec.glyph }}</div>
  </button>

</template>

<script setup lang="ts">
import { computed, toRefs, ref, onBeforeUnmount } from 'vue';
import type { GearDefinition } from '../logic/GearLib';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import GearStatsHint from './GearStatsHint.vue';
import { getResourceSpec } from '../logic/Resources';
import { getGameState, uiState } from '../logic/UIState';
import { getAppliedGearUpgradeIds, getCachedActiveRaidGear, getGearUpgradeThresholds } from '../logic/GearUpgrades';
import { DISCOVERY } from '../logic/DiscoveryLib';

const props = defineProps<{
  gear: GearDefinition;
  selected: boolean;
  unaffordable: boolean;
  blocked: boolean;
  price: number;
  count?: number;
  hintRight?: boolean;
}>();

const emit = defineEmits<{ (e: 'toggle'): void }>();

const creditsSpec = getResourceSpec('credits');

// expose individual props to template for convenience
const { gear, selected, unaffordable, blocked, price, count, hintRight } = toRefs(props);

const source = atlasStorage.getItemsSource();

const gearFrame = computed(() => {
  const imageKey = props.gear.image;
  return atlasStorage.getItemsFrame(imageKey)!;
});

const weightFrame = computed(() => atlasStorage.getItemsFrame('weight')!);

const spriteStyle = computed(() => {
  const f = gearFrame.value!;
  return atlasSpriteStyle(source, f, { size: 48, mode: 'fit', allowUpscale: false });
});

const weightIconStyle = computed(() => {
  const f = weightFrame.value!;
  return atlasSpriteStyle(source, f, { size: 12, mode: 'fit', allowUpscale: false });
});

const effectiveGear = computed(() => {
  uiState.gearUpgradeIdsById;
  const gs = getGameState();
  if (!gs || !gs.raid.id) return props.gear;
  return getCachedActiveRaidGear(gs, props.gear.id);
});

const effectiveWeight = computed(() => {
  return effectiveGear.value.weight;
});

const xpRows = computed((): string[][] => {
  if (props.gear.xp.length === 0) return [];

  uiState.gearXpById;
  uiState.gearUpgradeIdsById;
  const gs = getGameState();
  const xp = gs.gearXpById[props.gear.id] ?? 0;
  const thresholds = getGearUpgradeThresholds(props.gear);
  const appliedCount = getAppliedGearUpgradeIds(gs, props.gear.id).length;
  const target = thresholds[appliedCount] ?? thresholds[thresholds.length - 1] ?? 0;
  if (target <= 0 || xp <= 0) return [];

  const prevThreshold = appliedCount > 0 ? (thresholds[appliedCount - 1] ?? 0) : 0;
  const relativeTarget = target - prevThreshold;
  const relativeXp = xp - prevThreshold;
  const completed = Math.max(0, Math.min(relativeTarget, relativeXp));
  const symbols = Array.from({ length: relativeTarget }, (_, index) => (index < completed ? '⋆' : '⋄'));

  const pointsPerRow = symbols.length <= 15 ? symbols.length : Math.ceil(symbols.length / 2);
  const rows: string[][] = [];
  for (let i = 0; i < symbols.length; i += pointsPerRow) {
    rows.push(symbols.slice(i, i + pointsPerRow));
  }
  return rows;
});

// dynamic edge-aware flipping
const rootEl = ref<HTMLElement | null>(null);
const hintEl = ref<HTMLElement | null>(null);
const dynamicRight = ref(false);
const useRight = computed(() => !!(hintRight?.value) || dynamicRight.value);
let clickTimerId: number | null = null;

function updateHintSide(): void {
  const el = rootEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 1024;

  // Measure hint width (approx) by temporarily showing it invisibly
  let hintW = 320;
  const h = hintEl.value as HTMLElement | null;
  if (h) {
    const prevDisplay = h.style.display;
    const prevVis = h.style.visibility;
    h.style.display = 'block';
    h.style.visibility = 'hidden';
    // ensure it can expand to content to get a realistic width
    const prevWidth = h.style.width;
    h.style.width = 'max-content';
    hintW = Math.max(h.offsetWidth || h.scrollWidth || hintW, 160);
    h.style.display = prevDisplay;
    h.style.visibility = prevVis;
    h.style.width = prevWidth;
  }

  const gap = 12; // gap between card and hint
  const spaceLeft = rect.left - gap;
  const spaceRight = vw - rect.right - gap;
  // Prefer the side with more available space; flip to right if left is tight
  dynamicRight.value = (spaceLeft < hintW) && (spaceRight >= spaceLeft);

  const g = effectiveGear.value;
  if (g.gatherRaidResources || g.raidPassiveCreditsPerHour > 0 || g.raidResourceStorageBonus > 0) {
    uiState.raidResourceInfoHoverGearId = props.gear.id;
  }
}

function clearRaidResourceInfoHover(): void {
  if (uiState.raidResourceInfoHoverGearId !== props.gear.id) return;
  uiState.raidResourceInfoHoverGearId = '';
}

function emitToggle(): void {
  if (clickTimerId !== null) {
    clearTimeout(clickTimerId);
    clickTimerId = null;
  }
  emit('toggle');
}

function handleClick(): void {
  const gs = getGameState();
  if (gs.discoveries[DISCOVERY.DEV] !== true) {
    emit('toggle');
    return;
  }

  if (clickTimerId !== null) {
    clearTimeout(clickTimerId);
  }
  clickTimerId = window.setTimeout(() => {
    clickTimerId = null;
    emit('toggle');
  }, 180);
}

function handleDoubleClick(): void {
  if (clickTimerId !== null) {
    clearTimeout(clickTimerId);
    clickTimerId = null;
  }
  const gs = getGameState();
  if (gs.discoveries[DISCOVERY.DEV] !== true) {
    emitToggle();
    return;
  }
  uiState.editGearXpGearId = props.gear.id;
  uiState.editGearXpModalOpen = true;
}

onBeforeUnmount(() => {
  if (clickTimerId !== null) {
    clearTimeout(clickTimerId);
    clickTimerId = null;
  }
  clearRaidResourceInfoHover();
});

</script>

<style scoped>
.gear-item {
  position: relative;
  text-align: left;
  border: none;
  border-radius: 4px;
  padding: 5px 6px 5px 6px;
  background: var(--raid-item-bg, rgba(255,255,255,0.08));
  cursor: pointer;
  color: var(--text-primary);
  z-index: 0; /* establish baseline stacking */
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}
.gear-item.has-image {
  padding-left: 8px;
}
.gear-item:hover {
  z-index: 2000; /* float hovered card above siblings */
  background: var(--raid-item-bg-hover, rgba(255,255,255,0.14));
}
.gear-item.selected {
  background: rgba(74, 222, 128, 0.25);
  box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.5), 0 0 0 1px rgba(74, 222, 128, 0.2);
}
.gear-item.blocked > *:not(.hint) { opacity: 0.6; }

.g-sprite-wrap {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.g-sprite {
  flex-shrink: 0;
  image-rendering: auto;
}

.g-name {
  font-weight: 800;
  transform: translateY(1px);
}

/* Styled tooltip shown instantly on hover */
.hint {
  position: absolute;
  top: 0;
  right: calc(100% + 8px); /* align to the left of the card */
  left: auto;
  display: none; /* instant show on hover */
  z-index: 3000; /* above all adjacent item labels */
  background: var(--hint-bg);
  border: 1px solid var(--hint-border);
  border-radius: 4px;
  padding: 4px 10px;
  min-width: 120px;
  width: max-content;
  max-width: 75vw;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  pointer-events: none; /* prevent flicker */
}
.gear-item.hint-right .hint { /* place hint to the right of card for first column */
  left: calc(100% + 8px);
  right: auto;
}
.hint::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -6px; /* arrow on right edge pointing to card */
  width: 10px;
  height: 10px;
  background: var(--hint-bg); /* match opaque background */
  border-right: 1px solid var(--hint-border);
  border-top: 1px solid var(--hint-border);
  transform: translateY(-50%) rotate(45deg);
}
.gear-item.hint-right .hint::before { /* flip arrow to left side when hint is on the right */
  right: auto;
  left: -6px;
  border-right: none;
  border-left: 1px solid var(--hint-border);
  border-top: none;
  border-bottom: 1px solid var(--hint-border);
}
.gear-item:hover .hint { display: block; }

.g-xp {
  position: absolute;
  left: 6px;
  right: 34px;
  bottom: 3px;
  pointer-events: none;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 900;
  line-height: 0.75;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
  overflow: hidden;
}

.g-xp-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.g-xp-pip {
  display: inline-block;
  color: rgba(139, 152, 168, 0.42);
}

.g-xp-pip.completed {
  color: var(--text-primary);
  transform: scale(1.18);
  transform-origin: center;
  text-shadow: 0 0 6px rgba(255, 255, 255, 0.18), 0 1px 2px rgba(0, 0, 0, 0.8);
}

.gear-item.has-image .g-xp {
  left: 64px;
}

.g-weight {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
}

.g-weight-num {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.g-weight-icon {
  display: inline-block;
  flex-shrink: 0;
  opacity: 0.95;
}

.g-weight-fallback {
  font-size: 11px;
  font-weight: 800;
}
.g-price {
  position: absolute;
  top: 0;
  right: 0;
  padding: 3px 6px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: var(--raid-item-bg, rgba(255,255,255,0.08)); /* dim badge */
  color: var(--text-primary);          /* bright price text */
  font-size: 14px;
  font-weight: 900;
}

.g-count {
  position: absolute;
  top: 0;
  right: 0;
  padding: 3px 6px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: rgba(96, 165, 250, 0.3); /* blue-tinted to distinguish from price */
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 900;
}
</style>
