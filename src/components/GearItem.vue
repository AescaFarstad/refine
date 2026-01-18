<template>
  <button
    type="button"
    class="gear-item"
    :class="{ selected, unaffordable, blocked, 'hint-right': useRight, 'has-image': !!gearFrame }"
    ref="rootEl"
    @mouseenter="updateHintSide"
    @click="$emit('toggle')"
  >
    <!-- Gear image sprite -->
    <div v-if="source && gearFrame" class="g-sprite-wrap">
      <div class="g-sprite" :style="spriteStyle" />
    </div>

    <div class="g-name">{{ gear.name }}</div>

    <!-- Styled tooltip with all effects shown on hover -->
    <div class="hint" role="tooltip" aria-hidden="true" ref="hintEl">
      <GearStatsHint :gear="gear" :blocked="blocked" />
    </div>

    <!-- Bottom-right weight label (no special background); hidden when zero -->
    <div class="g-weight" v-if="gear.weight > 0">
      <span class="g-weight-num">{{ gear.weight }}</span>
      <span v-if="source && weightFrame" class="g-weight-icon" :style="weightIconStyle" aria-hidden="true" />
      <span v-else class="g-weight-fallback" aria-hidden="true">w</span>
    </div>

    <div class="g-count" v-if="count !== undefined">x{{ count }}</div>
    <div class="g-price" v-else-if="price > 0">{{ price.toLocaleString() }}{{ creditsSpec.glyph }}</div>
  </button>

</template>

<script setup lang="ts">
import { computed, toRefs, ref, onMounted } from 'vue';
import type { GearDefinition } from '../logic/GearLib';
import atlasStorage from '../logic/AtlasStorage';
import GearStatsHint from './GearStatsHint.vue';
import { getResourceSpec } from '../logic/Resources';

const props = defineProps<{
  gear: GearDefinition;
  selected: boolean;
  unaffordable: boolean;
  blocked: boolean;
  price: number;
  count?: number;
  hintRight?: boolean;
}>();

defineEmits<{ (e: 'toggle'): void }>();

const creditsSpec = getResourceSpec('credits');

// expose individual props to template for convenience
const { gear, selected, unaffordable, blocked, price, count, hintRight } = toRefs(props);

// Atlas state for gear images
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

const gearFrame = computed(() => {
  if (!ready.value) return null;
  const imageKey = props.gear.image;
  if (!imageKey) return null;
  return atlasStorage.getItemsFrame(imageKey);
});

const weightFrame = computed(() => (ready.value ? atlasStorage.getItemsFrame('weight') : null));

const spriteStyle = computed(() => {
  const f = gearFrame.value!;
  const atlasW = source.value!.naturalWidth;
  const atlasH = source.value!.naturalHeight;
  // Scale to fit within 48x48 container while maintaining aspect ratio
  const containerSize = 48;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1); // Don't upscale, only downscale
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.value!.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
});

const weightIconStyle = computed(() => {
  const f = weightFrame.value!;
  const atlasW = source.value!.naturalWidth;
  const atlasH = source.value!.naturalHeight;
  const containerSize = 12;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1);
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.value!.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
});

// dynamic edge-aware flipping
const rootEl = ref<HTMLElement | null>(null);
const hintEl = ref<HTMLElement | null>(null);
const dynamicRight = ref(false);
const useRight = computed(() => !!(hintRight?.value) || dynamicRight.value);

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
}

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

.g-name { font-weight: 800; }

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
