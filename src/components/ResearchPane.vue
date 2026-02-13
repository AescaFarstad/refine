<template>
  <div
    class="research-root"
    ref="container"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
  >
    <canvas ref="baseCanvas" class="layer base"></canvas>
    <canvas ref="highlightCanvas" class="layer highlight"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { uiState, getGameState, getGameLib, getGameStateMutable } from '../logic/UIState';
import { clearCanvas, drawHexagon } from '../logic/DrawHex';
import type { Point2 } from '../logic/ItemLib';
import { pixelToAxial, axialToPixel } from '../logic/HexMath';
import { renderResearchBaseLayer } from '../logic/drawResearch';
import { findCheapestPath, indexToAxial, axialToIndex, calculateVisibility, calculateResearchNodePrice } from '../logic/Research';
import { globalInputQueue } from '../logic/Model';
import { CmdResearchNode } from '../logic/input/InputCommands';
import { getResourceSpec } from '../logic/Resources';
import type { ResearchHighlightHover } from '../logic/ResearchHighlightHover';

const container = ref<HTMLDivElement | null>(null);
const baseCanvas = ref<HTMLCanvasElement | null>(null);
const highlightCanvas = ref<HTMLCanvasElement | null>(null);

let rafId: number | null = null;
let pendingBaseMode: 'none' | 'present' | 'render' = 'none';
let pendingHighlightRender = false;

let baseBufferCanvas: HTMLCanvasElement | null = null;
let baseBufferOffset: Point2 = { x: 0, y: 0 };
let baseBufferZoom = 1;
let baseBufferValid = false;

const BASE_BUFFER_PADDING_PX = 768;
const ZOOM_STOP_RENDER_DEBOUNCE_MS = 400;

let zoomStopTimeoutId: number | null = null;

const HEX_SIZE = 18;
const BACKGROUND_HEX_SIZE = HEX_SIZE * 0.85;
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
const isPanning = ref(false);
const isMouseDown = ref(false);
const lastPanClient = ref<Point2 | null>(null);
const hoverAxial = ref<Point2 | null>(null);

const props = withDefaults(defineProps<{
  panelHighlight: ResearchHighlightHover | null;
}>(), {
  panelHighlight: null,
});

const emit = defineEmits<{
  (e: 'hover-cell', cell: Point2 | null): void;
}>();


defineExpose({
  zoom,
  offset,
  origin,
  HEX_SIZE,
});

const chronotracesSpec = getResourceSpec('chronotraces');
const RESEARCH_PATH_OBSTACLE_ICON_COLOR = chronotracesSpec.color;
const RESEARCH_PANEL_HIGHLIGHT_STYLE: Record<ResearchHighlightHover['kind'], { fillColor: string; strokeColor: string; innerStrokeColor: string }> = {
  resource: {
    fillColor: 'rgba(45, 212, 191, 0.32)',
    strokeColor: 'rgba(153, 246, 228, 1)',
    innerStrokeColor: 'rgba(240, 253, 250, 0.95)',
  },
  stat: {
    fillColor: 'rgba(250, 204, 21, 0.34)',
    strokeColor: 'rgba(254, 240, 138, 1)',
    innerStrokeColor: 'rgba(255, 251, 235, 0.95)',
  },
  discovery: {
    fillColor: 'rgba(147, 197, 253, 0.34)',
    strokeColor: 'rgba(219, 234, 254, 1)',
    innerStrokeColor: 'rgba(248, 250, 252, 0.95)',
  },
};

onMounted(() => {
  setupCanvases();
  scheduleRender({ base: true, highlight: true });
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
  if (zoomStopTimeoutId != null) {
    window.clearTimeout(zoomStopTimeoutId);
    zoomStopTimeoutId = null;
  }
});

watch(
  () => [uiState.researchOwnedCount, uiState.researchRevealRadius, uiState.discoveryCounter],
  () => {
    scheduleRender({ base: true, highlight: true });
  }
);

watch(
  () => props.panelHighlight,
  () => {
    scheduleRender({ highlight: true });
  }
);

function onResize() {
  setupCanvases();
  scheduleRender({ base: true, highlight: true });
}

function setupCanvases() {
  const root = container.value;
  if (!root) return;
  if (typeof document === 'undefined') return;

  const width = root.clientWidth || root.offsetWidth || 0;
  const height = root.clientHeight || root.offsetHeight || 0;
  if (!width || !height) return;

  canvasWidth.value = width;
  canvasHeight.value = height;

  const canvases = [baseCanvas.value, highlightCanvas.value];
  canvases.forEach(canvas => {
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
  });

  if (!baseBufferCanvas) {
    baseBufferCanvas = document.createElement('canvas');
  }
  const bufferWidth = width + BASE_BUFFER_PADDING_PX * 2;
  const bufferHeight = height + BASE_BUFFER_PADDING_PX * 2;
  if (baseBufferCanvas.width !== bufferWidth || baseBufferCanvas.height !== bufferHeight) {
    baseBufferCanvas.width = bufferWidth;
    baseBufferCanvas.height = bufferHeight;
    baseBufferValid = false;
  }
}

function scheduleRender({
  base,
  baseMode,
  highlight,
}: { base?: boolean; baseMode?: 'present' | 'render'; highlight?: boolean } = {}): void {
  if (base) {
    const requested = baseMode ?? 'render';
    pendingBaseMode =
      pendingBaseMode === 'render' || requested === 'render' ? 'render' : 'present';
  }
  if (highlight) pendingHighlightRender = true;
  if (rafId != null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;

    const baseModeToRun = pendingBaseMode;
    const shouldRenderHighlight = pendingHighlightRender;
    pendingBaseMode = 'none';
    pendingHighlightRender = false;

    if (baseModeToRun === 'render') renderBaseLayer();
    if (baseModeToRun === 'present') presentBaseLayer();
    if (shouldRenderHighlight) renderHighlightLayer();
  });
}

function renderBaseLayer() {
  const canvas = baseCanvas.value;
  if (!canvas) return;
  const displayCtx = canvas.getContext('2d');
  if (!displayCtx) return;
  const bufferCtx = baseBufferCanvas?.getContext('2d') || null;
  const hasBuffer = !!baseBufferCanvas && !!bufferCtx;
  const ctx = hasBuffer ? bufferCtx : displayCtx;

  // Reset transform before clearing
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(ctx);

  // Apply camera transform (zoom + pan)
  const z = zoom.value;
  const off = offset.value;
  if (hasBuffer && baseBufferCanvas) {
    const padX = (baseBufferCanvas.width - canvas.width) / 2;
    const padY = (baseBufferCanvas.height - canvas.height) / 2;
    ctx.setTransform(z, 0, 0, z, off.x + padX, off.y + padY);
  } else {
    ctx.setTransform(z, 0, 0, z, off.x, off.y);
  }

  const gs = getGameState();
  const lib = getGameLib();
  const o = origin.value;

  renderResearchBaseLayer(ctx, gs, lib, o, HEX_SIZE, BACKGROUND_HEX_SIZE);

  baseBufferOffset = { x: off.x, y: off.y };
  baseBufferZoom = z || 1;
  baseBufferValid = hasBuffer;

  if (hasBuffer) {
    presentBaseLayer();
  }
}

function presentBaseLayer() {
  const canvas = baseCanvas.value;
  if (!canvas) return;
  const displayCtx = canvas.getContext('2d');
  if (!displayCtx) return;

  if (!baseBufferCanvas || !baseBufferValid) {
    renderBaseLayer();
    return;
  }

  const currentZoom = zoom.value || 1;
  const bufferZoom = baseBufferZoom || 1;
  const scale = currentZoom / bufferZoom;

  const padX = (baseBufferCanvas.width - canvas.width) / 2;
  const padY = (baseBufferCanvas.height - canvas.height) / 2;

  const off = offset.value;
  const drawX = off.x - scale * (baseBufferOffset.x + padX);
  const drawY = off.y - scale * (baseBufferOffset.y + padY);

  const fullyCoversX = drawX <= 0 && drawX + scale * baseBufferCanvas.width >= canvas.width;
  const fullyCoversY = drawY <= 0 && drawY + scale * baseBufferCanvas.height >= canvas.height;
  if (!fullyCoversX || !fullyCoversY) {
    renderBaseLayer();
    return;
  }

  displayCtx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(displayCtx);
  displayCtx.setTransform(scale, 0, 0, scale, drawX, drawY);
  displayCtx.drawImage(baseBufferCanvas, 0, 0);
}

function scheduleZoomStopRender(): void {
  if (typeof window === 'undefined') return;
  if (zoomStopTimeoutId != null) {
    window.clearTimeout(zoomStopTimeoutId);
    zoomStopTimeoutId = null;
  }
  zoomStopTimeoutId = window.setTimeout(() => {
    zoomStopTimeoutId = null;
    scheduleRender({ base: true, baseMode: 'render', highlight: true });
  }, ZOOM_STOP_RENDER_DEBOUNCE_MS);
}

function renderHighlightLayer() {
  const canvas = highlightCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Reset transform and clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(ctx);

  const mode = (uiState as any).researchEditMode as '' | 'empty' | 'void' | 'obstacle' | 'coordinates' | undefined;
  if (mode) {
    // In edit mode we do not show purchase paths
    return;
  }

  const axial = hoverAxial.value;
  const gs = getGameState();
  const z = zoom.value || 1;
  const off = offset.value;
  const o = origin.value;

  if (axial) {
    const idx = axialToIndex(axial.x, axial.y);
    if (idx !== -1) {
      const cell = gs.researchCells[idx]!;
      if (cell.revealed && !cell.owned) {
        const path = findCheapestPath(gs, axial.x, axial.y);
        if (path.reachable && path.pathLength > 0) {
          // Calculate the price and check affordability
          const pathCost = path.cost;
          const price = calculateResearchNodePrice(gs, pathCost);
          const canAfford = pathCost === 0 || gs.chronotraces >= price;

          // Apply camera transform
          ctx.setTransform(z, 0, 0, z, off.x, off.y);

          // Choose colors based on affordability
          const fillColor = canAfford
            ? 'rgba(56, 189, 248, 0.22)'    // cyan/blue for affordable
            : 'rgba(239, 68, 68, 0.22)';     // red for unaffordable
          const strokeColor = canAfford
            ? 'rgba(56, 189, 248, 0.9)'     // cyan/blue for affordable
            : 'rgba(239, 68, 68, 0.9)';      // red for unaffordable

          // Highlight all cells that will be converted
          const pathCells = path.pathCells;
          const len = path.pathLength;

          for (let i = 0; i < len; i++) {
            const cellIdx = pathCells[i];
            const cellData = gs.researchCells[cellIdx]!;
            const a = indexToAxial(cellIdx);
            const center = axialToPixel({ x: a.x, y: a.y }, HEX_SIZE, o);
            drawHexagon(ctx, center, HEX_SIZE * 0.9, {
              fillColor,
              strokeColor,
              lineWidth: 2,
            });

            // Draw resource icon for obstacle cells that will be destroyed (cost > 0)
            if (cellData.cost > 0) {
              ctx.save();
              ctx.fillStyle = RESEARCH_PATH_OBSTACLE_ICON_COLOR;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.font = `bold ${HEX_SIZE * 1.2}px system-ui, -apple-system, Segoe UI, sans-serif`;
              ctx.fillText(chronotracesSpec.glyph, center.x, center.y);
              ctx.restore();
            }
          }
        }
      }
    }
  }

  if (props.panelHighlight) {
    ctx.setTransform(z, 0, 0, z, off.x, off.y);
    drawPanelHighlightLayer(ctx, gs, props.panelHighlight, o);
  }
}

function drawPanelHighlightLayer(
  ctx: CanvasRenderingContext2D,
  gs: ReturnType<typeof getGameState>,
  highlight: ResearchHighlightHover,
  originPoint: Point2
): void {
  const style = RESEARCH_PANEL_HIGHLIGHT_STYLE[highlight.kind];
  const lib = getGameLib();

  ctx.save();
  ctx.shadowColor = style.strokeColor;
  ctx.shadowBlur = 14;

  for (let idx = 0; idx < gs.researchCells.length; idx++) {
    const cell = gs.researchCells[idx]!;
    if (!cell.revealed || cell.owned || cell.blocked) continue;

    const archetype = lib.research.archetypes.get(cell.archetypeId)!;
    const matches = highlight.kind === 'discovery'
      ? archetype.type === 'discovery'
      : cell.archetypeId === highlight.archetypeId;
    if (!matches) continue;

    const axial = indexToAxial(idx);
    const center = axialToPixel({ x: axial.x, y: axial.y }, HEX_SIZE, originPoint);

    drawHexagon(ctx, center, HEX_SIZE * 0.96, {
      fillColor: style.fillColor,
      strokeColor: style.strokeColor,
      lineWidth: 3,
    });

    drawHexagon(ctx, center, HEX_SIZE * 0.62, {
      fillColor: 'rgba(0, 0, 0, 0)',
      strokeColor: style.innerStrokeColor,
      lineWidth: 2,
    });
  }

  ctx.restore();
}

function onWheel(event: WheelEvent) {
  const canvas = baseCanvas.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;

  const oldZoom = zoom.value || 1;
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  let newZoom = oldZoom * zoomFactor;
  newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

  if (newZoom === oldZoom) return;

  const off = offset.value;
  const worldX = (px - off.x) / oldZoom;
  const worldY = (py - off.y) / oldZoom;

  offset.value = {
    x: px - worldX * newZoom,
    y: py - worldY * newZoom,
  };
  zoom.value = newZoom;

  scheduleRender({ base: true, baseMode: 'present', highlight: true });
  scheduleZoomStopRender();
}

const isPainting = ref(false);

function onMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  isMouseDown.value = true;
  isPanning.value = false;
  lastPanClient.value = { x: event.clientX, y: event.clientY };

  // Shift + edit mode = paint brush mode
  const mode = (uiState as any).researchEditMode as string | undefined;
  if (event.shiftKey && mode) {
    isPainting.value = true;
    updateHoverCell(event);
    if (hoverAxial.value) {
      applyEditModeAt(hoverAxial.value);
    }
  }
}

function onMouseMove(event: MouseEvent) {
  updateHoverCell(event);

  // Paint brush mode: apply edit at each cell while dragging with shift
  if (isPainting.value && isMouseDown.value) {
    if (hoverAxial.value) {
      applyEditModeAt(hoverAxial.value);
    }
    return;
  }

  if (!isMouseDown.value || !lastPanClient.value) return;
  const prev = lastPanClient.value;
  const dx = event.clientX - prev.x;
  const dy = event.clientY - prev.y;

  if (!isPanning.value) {
    const distSq = dx * dx + dy * dy;
    if (distSq < 9) {
      return;
    }
    isPanning.value = true;
  }

  lastPanClient.value = { x: event.clientX, y: event.clientY };

  offset.value = {
    x: offset.value.x + dx,
    y: offset.value.y + dy,
  };

  scheduleRender({ base: true, baseMode: 'present', highlight: true });
}

function onMouseUp(event: MouseEvent) {
  if (event.button !== 0) return;
  const wasPainting = isPainting.value;
  const wasPanning = isMouseDown.value && isPanning.value;
  if (isMouseDown.value && !isPanning.value && !wasPainting) {
    handleClick(event);
  }
  isMouseDown.value = false;
  isPanning.value = false;
  isPainting.value = false;
  lastPanClient.value = null;
  if (wasPanning) {
    scheduleRender({ base: true, baseMode: 'render', highlight: true });
  }
}

function onMouseLeave(_event: MouseEvent) {
  const wasPanning = isMouseDown.value && isPanning.value;
  isMouseDown.value = false;
  isPanning.value = false;
  isPainting.value = false;
  lastPanClient.value = null;
  if (hoverAxial.value) {
    hoverAxial.value = null;
    emit('hover-cell', null);
  }
  scheduleRender({ highlight: true });
  if (wasPanning) {
    scheduleRender({ base: true, baseMode: 'render' });
  }
}

function onWindowMouseUp(event: MouseEvent) {
  if (event.button !== 0) return;
  const wasPanning = isMouseDown.value && isPanning.value;
  isMouseDown.value = false;
  isPanning.value = false;
  isPainting.value = false;
  lastPanClient.value = null;
  if (wasPanning) {
    scheduleRender({ base: true, baseMode: 'render', highlight: true });
  }
}

function updateHoverCell(event: MouseEvent): void {
  const canvas = baseCanvas.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;

  const z = zoom.value || 1;
  const off = offset.value;
  const worldX = (px - off.x) / z;
  const worldY = (py - off.y) / z;

  const o = origin.value;
  const axial = pixelToAxial({ x: worldX, y: worldY }, HEX_SIZE, o);

  const prev = hoverAxial.value;
  if (!prev || prev.x !== axial.x || prev.y !== axial.y) {
    hoverAxial.value = axial;
    emit('hover-cell', axial);
    scheduleRender({ highlight: true });
  }
}

function applyEditModeAt(axial: Point2): void {
  const mode = (uiState as any).researchEditMode as string | undefined;
  if (!mode) return;

  const gs = getGameStateMutable();
  const idx = axialToIndex(axial.x, axial.y);
  if (idx === -1) return;
  const cell = gs.researchCells[idx];
  if (!cell) return;

  if (mode === 'coordinates') {
    const coordText = `{ x: ${axial.x}, y: ${axial.y} }`;
    navigator.clipboard.writeText(coordText).catch(err => {
      console.error('Failed to copy coordinates to clipboard:', err);
    });
    return;
  }

  let archetypeId: string;
  if (mode === 'empty') {
    archetypeId = 'empty';
  } else if (mode === 'void') {
    archetypeId = 'void';
  } else if (mode === 'obstacle') {
    archetypeId = 'obs';
  } else {
    // Check if mode is a custom archetype ID
    const lib = getGameLib();
    if (lib.research.archetypes.has(mode)) {
      archetypeId = mode;

      // Track newly placed archetype node
      const radius = (uiState as any).researchPlacementRadius || 0;
      const newlyPlaced = (uiState as any).researchNewlyPlaced || [];
      newlyPlaced.push({
        archetypeId: mode,
        cells: { x: axial.x, y: axial.y },
        radius: radius
      });
      (uiState as any).researchNewlyPlaced = newlyPlaced;
      (uiState as any).researchEditVersion = ((uiState as any).researchEditVersion || 0) + 1;
    } else {
      return;
    }
  }

  cell.archetypeId = archetypeId;

  const lib = getGameLib();
  const arch = lib.research.archetypes.get(archetypeId) || null;

  if (arch) {
    if (arch.type === 'void') {
      cell.blocked = true;
      cell.cost = 0;
      cell.owned = false;
      cell.revealed = false;
    } else if (arch.type === 'obstacle' || arch.covert) {
      cell.blocked = false;
      cell.cost = 1;
    } else {
      cell.blocked = false;
      cell.cost = 0;
    }
  } else {
    cell.blocked = mode === 'void';
    cell.cost = mode === 'obstacle' ? 1 : 0;
  }

  calculateVisibility(gs, lib.research);

  // Force local redraw and notify dev tools
  scheduleRender({ base: true, highlight: true });
  (uiState as any).researchEditVersion = ((uiState as any).researchEditVersion || 0) + 1;
}

function handleClick(event: MouseEvent): void {
  const canvas = baseCanvas.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;

  const z = zoom.value || 1;
  const off = offset.value;
  const worldX = (px - off.x) / z;
  const worldY = (py - off.y) / z;

  const o = origin.value;
  const axial = pixelToAxial({ x: worldX, y: worldY }, HEX_SIZE, o);

  const mode = (uiState as any).researchEditMode as '' | 'empty' | 'void' | 'obstacle' | 'coordinates' | undefined;
  if (mode) {
    applyEditModeAt(axial);
    return;
  }

  const gs = getGameState();
  const idx = axialToIndex(axial.x, axial.y);
  if (idx === -1) return;
  const cell = gs.researchCells[idx];
  if (!cell || !cell.revealed || cell.owned) return;

  const path = findCheapestPath(gs, axial.x, axial.y);
  if (!path.reachable) return;

  globalInputQueue.push(new CmdResearchNode({ pos: axial }));
}
</script>

<style scoped>
.research-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.base {
  z-index: 1;
}

.highlight {
  z-index: 2;
  pointer-events: none;
}
</style>
