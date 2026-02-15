<template>
  <div
    class="maze-pane-root"
    ref="container"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
  >
    <canvas ref="canvas" class="maze-layer"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { clearCanvas } from '../logic/DrawHex';
import type { Point2 } from '../logic/ItemLib';
import { useHexPaneInteraction } from '../logic/pane/useHexPaneInteraction';
import { renderMazeBaseLayer } from '../logic/drawMaze';

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const HEX_SIZE = 18;
const CELL_SIZE = HEX_SIZE * 1;
const CELL_FILL_SIZE = CELL_SIZE + 0.6;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

const canvasWidth = ref(0);
const canvasHeight = ref(0);

const origin = computed<Point2>(() => ({
  x: canvasWidth.value / 2,
  y: canvasHeight.value / 2,
}));

const zoom = ref(1);
const offset = ref<Point2>({ x: 0, y: 0 });
const hoverAxial = ref<Point2 | null>(null);

let rafId: number | null = null;

onMounted(() => {
  setupCanvas();
  scheduleRender();
  window.addEventListener('resize', onResize);
  window.addEventListener('mouseup', onWindowMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mouseup', onWindowMouseUp);
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});

watch(
  () => [uiState.researchOwnedCount, uiState.discoveryCounter],
  () => {
    scheduleRender();
  }
);

function onResize(): void {
  setupCanvas();
  scheduleRender();
}

function setupCanvas(): void {
  const root = container.value;
  if (!root) return;

  const width = root.clientWidth || root.offsetWidth || 0;
  const height = root.clientHeight || root.offsetHeight || 0;
  if (!width || !height) return;

  canvasWidth.value = width;
  canvasHeight.value = height;

  const c = canvas.value;
  if (!c) return;
  c.width = width;
  c.height = height;
}

function scheduleRender(): void {
  if (rafId != null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    render();
  });
}

function render(): void {
  const c = canvas.value;
  if (!c) return;

  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(ctx);

  const z = zoom.value;
  const off = offset.value;
  ctx.setTransform(z, 0, 0, z, off.x, off.y);

  const gs = getGameState();
  const o = origin.value;
  renderMazeBaseLayer(ctx, gs, o, HEX_SIZE, CELL_FILL_SIZE);
}

const {
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onWindowMouseUp,
} = useHexPaneInteraction({
  canvas,
  origin,
  hexSize: HEX_SIZE,
  zoom,
  offset,
  hoverAxial,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  isPaintMode: () => false,
  onHoverChanged: () => {},
  onPrimaryClick: () => {},
  onPaintAt: () => {},
  onPanOrZoomTransient: () => {
    scheduleRender();
  },
  onPanOrZoomCommit: () => {
    scheduleRender();
  },
  onMouseLeave: () => {},
});
</script>

<style scoped>
.maze-pane-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.maze-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
