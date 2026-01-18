<template>
  <div
    class="card-deck"
    ref="deckRef"
    :style="deckVars"
    @pointermove="onPointerMove"
    @pointerleave="clearHover"
  >
    <div
      v-for="(item, index) in items"
      :key="item.id"
      class="card-slot"
      :class="{ 'is-hovered': index === effectiveHoverIndex, 'is-hidden': index === draggingIndex }"
      :style="cardStyle(index)"
    >
      <slot :item="item" :index="index" :width="cardWidth" :height="cardHeight" :hovered="index === effectiveHoverIndex" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

type DeckItem = { id: string } & Record<string, unknown>;

const props = withDefaults(defineProps<{
  items: DeckItem[];
  cardWidth: number;
  cardHeight: number;
  overlap?: number;
  minVisible?: number;
  squeeze?: number;
  lift?: number;
  draggingIndex?: number | null;
}>(), {
  overlap: 18,
  minVisible: 6,
  squeeze: 0.6,
  lift: 12,
  draggingIndex: null,
});

const deckRef = ref<HTMLDivElement | null>(null);
const deckWidth = ref(0);
const hoveredIndex = ref<number | null>(null);
const effectiveHoverIndex = computed(() => (props.draggingIndex == null ? hoveredIndex.value : null));

const deckVars = computed(() => ({
  '--card-width': `${props.cardWidth}px`,
  '--card-height': `${props.cardHeight}px`,
  '--deck-lift': `${props.lift}px`,
}));

const baseSpacing = computed(() => {
  const count = props.items.length;
  const defaultSpacing = props.cardWidth - props.overlap;
  if (count <= 1) return defaultSpacing;

  const fitSpacing = (deckWidth.value - props.cardWidth) / (count - 1);
  let spacing = Math.min(defaultSpacing, fitSpacing);
  if (spacing < props.minVisible) {
    spacing = fitSpacing;
  }
  return spacing;
});

const basePositions = computed(() => {
  const spacing = baseSpacing.value;
  return props.items.map((_, index) => index * spacing);
});

const positions = computed(() => {
  const base = basePositions.value;
  const hover = effectiveHoverIndex.value;
  if (hover == null) return base;
  return buildHoverPositions(base, hover);
});

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = deckRef.value!;
  deckWidth.value = el.clientWidth;
  resizeObserver = new ResizeObserver(() => {
    deckWidth.value = el.clientWidth;
  });
  resizeObserver.observe(el);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => props.draggingIndex,
  (next) => {
    if (next != null) hoveredIndex.value = null;
  }
);

function buildHoverPositions(base: number[], hoverIndex: number): number[] {
  const count = base.length;
  const next = [...base];
  const strength = (1 - props.squeeze) * 8;
  const power = 2;

  if (hoverIndex > 0) {
    const span = base[hoverIndex] - base[0];
    let sumW = 0;
    const weights: number[] = [];
    for (let g = 0; g < hoverIndex; g++) {
      const t = (g + 1) / hoverIndex;
      const w = 1 + strength * Math.pow(t, power);
      weights.push(w);
      sumW += w;
    }
    let x = base[0];
    for (let i = 0; i < hoverIndex; i++) {
      x += span * (weights[i] / sumW);
      next[i + 1] = x;
    }
  }

  const rightGaps = count - 1 - hoverIndex;
  if (rightGaps > 0) {
    const span = base[count - 1] - base[hoverIndex];
    let sumW = 0;
    const weights: number[] = [];
    for (let g = 0; g < rightGaps; g++) {
      const t = (rightGaps - g) / rightGaps;
      const w = 1 + strength * Math.pow(t, power);
      weights.push(w);
      sumW += w;
    }
    let x = base[hoverIndex];
    for (let i = 0; i < rightGaps; i++) {
      x += span * (weights[i] / sumW);
      next[hoverIndex + i + 1] = x;
    }
  }

  return next;
}

function clearHover(): void {
  hoveredIndex.value = null;
}

function onPointerMove(ev: PointerEvent): void {
  if (props.draggingIndex != null) return;
  const count = props.items.length;
  if (count === 0) return;

  const rect = deckRef.value!.getBoundingClientRect();
  const localX = ev.clientX - rect.left;
  if (count === 1) {
    if (hoveredIndex.value !== 0) hoveredIndex.value = 0;
    return;
  }

  const selectionSpan = props.cardWidth + (count - 1) * baseSpacing.value;
  const segmentW = selectionSpan / count;
  const clampedX = Math.min(selectionSpan - 0.0001, Math.max(0, localX));
  const nextIndex = Math.min(count - 1, Math.floor(clampedX / segmentW));
  if (hoveredIndex.value !== nextIndex) {
    hoveredIndex.value = nextIndex;
  }
}

function cardStyle(index: number): Record<string, string | number> {
  const x = positions.value[index];
  const isHovered = index === effectiveHoverIndex.value;
  return {
    '--card-x': `${x}px`,
    zIndex: isHovered ? 1000 : index + 1,
  };
}
</script>

<style scoped>
.card-deck {
  position: relative;
  width: 100%;
  height: calc(var(--card-height) + var(--deck-lift));
  overflow: visible;
}

.card-slot {
  position: absolute;
  top: var(--deck-lift);
  left: 0;
  width: var(--card-width);
  height: var(--card-height);
  --card-lift: 0px;
  transform: translate3d(var(--card-x), 0, 0) translateY(var(--card-lift));
  transition: transform 220ms ease, opacity 160ms ease, filter 200ms ease;
  will-change: transform;
}

.card-slot.is-hovered {
  --card-lift: calc(var(--deck-lift) * -1);
  filter: drop-shadow(0 14px 20px rgba(0, 0, 0, 0.45));
}

.card-slot.is-hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
