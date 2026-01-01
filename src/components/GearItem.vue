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
      <div class="hint-row" v-for="(row, i) in hintRows" :key="i">
        <span class="hint-label">{{ row.label }}</span>
        <span class="hint-value">{{ row.value }}</span>
      </div>
    </div>

    <!-- Bottom-right weight label (no special background); hidden when zero -->
    <div class="g-weight" v-if="gear.weight > 0">{{ gear.weight }} w</div>

    <div class="g-price" v-if="price > 0">{{ price.toLocaleString() }}✦</div>
  </button>

</template>

<script setup lang="ts">
import { computed, toRefs, ref, onMounted } from 'vue';
import type { GearDefinition } from '../logic/GearLib';
import atlasStorage from '../logic/AtlasStorage';

const props = defineProps<{
  gear: GearDefinition;
  selected: boolean;
  unaffordable: boolean;
  blocked: boolean;
  price: number;
  hintRight?: boolean;
}>();

defineEmits<{ (e: 'toggle'): void }>();

// expose individual props to template for convenience
const { gear, selected, unaffordable, blocked, price, hintRight } = toRefs(props);

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

const spriteStyle = computed(() => {
  if (!source.value || !gearFrame.value) return {} as Record<string, string>;
  const f = gearFrame.value;
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  // Scale to fit within 48x48 container while maintaining aspect ratio
  const containerSize = 48;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1); // Don't upscale, only downscale
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.value.src})`,
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

function fmtSigned(n: number, suffix = ''): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `${n}${suffix}`;
  return `0${suffix}`;
}

const hintRows = computed((): Array<{ label: string; value: string }> => {
  const g = props.gear;
  const rows: Array<{ label: string; value: string }> = [];
  // Movement and regen
  if (g.speedPercent) rows.push({ label: 'Speed', value: `${fmtSigned(g.speedPercent, '%')}` });
  if (g.speedFlat) rows.push({ label: 'Speed (flat)', value: `${fmtSigned(g.speedFlat)}` });
  if (g.regenPerKm) rows.push({ label: 'Regen', value: `${fmtSigned(g.regenPerKm)} hp/km` });
  if (g.regenAfterEncounter) rows.push({ label: 'Regen/encounter', value: `${fmtSigned(g.regenAfterEncounter)} hp` });
  // Survivability & combat
  if (g.hp) rows.push({ label: 'HP', value: `${fmtSigned(g.hp)}` });
  if (g.damage) rows.push({ label: 'Damage', value: `${fmtSigned(g.damage)}` });
  if (g.chanceToHit) rows.push({ label: 'Hit chance', value: `${fmtSigned(g.chanceToHit, '%')}` });
  if (g.chanceToBlock) rows.push({ label: 'Block chance', value: `${fmtSigned(g.chanceToBlock, '%')}` });
  if (g.reflectOnHitPct) rows.push({ label: 'Reflect on hit', value: `${fmtSigned(g.reflectOnHitPct, '%')}` });
  if (g.reflectOnBlockPct) rows.push({ label: 'Reflect on block', value: `${fmtSigned(g.reflectOnBlockPct, '%')}` });
  // Utility & carry
  if (g.lootChance) rows.push({ label: 'Loot chance', value: `${fmtSigned(g.lootChance, '%')}` });
  if (g.maxWeight) rows.push({ label: 'Max weight', value: `${fmtSigned(g.maxWeight)}` });
  if (g.volume) rows.push({ label: 'Volume', value: `${fmtSigned(g.volume)}` });
  // Perk
  if (g.perk) rows.push({ label: 'Perk', value: g.perk });
  return rows;
});
</script>

<style scoped>
.gear-item {
  position: relative;
  text-align: left;
  border: none;
  border-radius: 4px;
  padding: 10px 10px 10px 10px; /* equal padding - weight/price are absolutely positioned */
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  color: var(--text-primary);
  z-index: 0; /* establish baseline stacking */
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
}
.gear-item.has-image {
  padding-left: 8px;
}
.gear-item:hover { z-index: 2000; } /* float hovered card above siblings */
.gear-item.selected { background: rgba(74, 222, 128, 0.15); }
.gear-item.unaffordable { /* border removed; keep subtle deemphasis via opacity if needed elsewhere */ }
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
  background: var(--hint-bg); /* distinct, opaque */
  border: 1px solid var(--hint-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-width: 120px;
  width: max-content;
  max-width: 75vw;           /* cap to viewport width */
  box-shadow: inset 0 1px 0 var(--panel-shine),
              0 8px 24px rgba(0,0,0,0.5);
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
.hint-row { white-space: nowrap; display: grid; grid-template-columns: max-content 1fr; gap: 4px 8px; align-items: baseline; margin: 2px 0; }
.hint-label { color: var(--text-secondary); font-size: 11px; letter-spacing: 0.06em; font-weight: 800; }
.hint-value { color: var(--text-primary); font-size: 12px; font-weight: 800; }
.gear-item:hover .hint { display: block; }

.g-weight {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 700;
}
.g-price {
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px 8px;
  border-bottom-left-radius: 6px;
  border-top-right-radius: 4px;
  background: rgba(255,255,255,0.08); /* dim badge */
  color: var(--text-primary);          /* bright price text */
  font-size: 12px;
  font-weight: 900;
}
</style>
