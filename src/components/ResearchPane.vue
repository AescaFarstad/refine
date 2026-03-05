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
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { clearCanvas, drawHexagon } from '../logic/DrawHex';
import type { Point2 } from '../logic/ItemLib';
import { axialRange, axialToPixel } from '../logic/HexMath';
import { renderResearchBaseLayer } from '../logic/drawResearch';
import { findCheapestPath, indexToAxial, axialToIndex, calculateResearchNodePrice } from '../logic/Research';
import { globalInputQueue } from '../logic/Model';
import { CmdResearchNode } from '../logic/input/InputCommands';
import { getResourceSpec } from '../logic/Resources';
import type { ResearchHighlightHover } from '../logic/ResearchHighlightHover';
import { useHexPaneInteraction } from '../logic/pane/useHexPaneInteraction';
import { useResearchPaneDevEdit } from '../logic/pane/useResearchPaneDevEdit';
import { computeHexBoundary } from '../logic/hexBoundary';

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

const HEX_SIZE = 18;
const BACKGROUND_HEX_SIZE = HEX_SIZE * 0.85;
const OWNED_BACKGROUND_HEX_SIZE = HEX_SIZE * 0.9;
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

const props = withDefaults(defineProps<{
  panelHighlight: ResearchHighlightHover | null;
}>(), {
  panelHighlight: null,
});

const emit = defineEmits<{
  (e: 'hover-cell', cell: Point2 | null): void;
}>();


const HIGHLIGHT_ANIM_DURATION = 600; // ms
const HIGHLIGHT_ANGLE_STEP = Math.PI * 2 / 3;
let highlightAnimation: {
  highlight: ResearchHighlightHover;
  startTime: number;
  duration: number;
  fromAngle: number;
  toAngle: number;
  fromScale: number;
} | null = null;
let highlightSettledAngle = 0;

function getHighlightAnimProgress(): { angle: number; scale: number; t: number } {
  if (!highlightAnimation) return { angle: highlightSettledAngle, scale: 1, t: 1 };
  const elapsed = performance.now() - highlightAnimation.startTime;
  const t = Math.min(elapsed / highlightAnimation.duration, 1);
  const eased = 1 - Math.pow(1 - t, 3);
  const angle = highlightAnimation.fromAngle + eased * (highlightAnimation.toAngle - highlightAnimation.fromAngle);
  const scalePulse = 1 - Math.abs(2 * t - 1);
  const scale = highlightAnimation.fromScale + eased * (1 - highlightAnimation.fromScale) + scalePulse * 0.25;
  return { angle, scale, t };
}

function playHighlightAnimation(highlight: ResearchHighlightHover): void {
  const current = getHighlightAnimProgress();
  const sameHighlight = highlightAnimation && highlightAnimation.highlight.kind === highlight.kind
    && ('archetypeId' in highlight ? highlight.archetypeId === (highlightAnimation.highlight as any).archetypeId : true);

  const fromAngle = sameHighlight ? current.angle : 0;
  const fromScale = sameHighlight ? current.scale : 1;
  const toAngle = fromAngle + HIGHLIGHT_ANGLE_STEP;
  highlightAnimation = { highlight, startTime: performance.now(), duration: HIGHLIGHT_ANIM_DURATION, fromAngle, toAngle, fromScale };
  highlightSettledAngle = toAngle;
  scheduleRender({ highlight: true });
}

defineExpose({
  zoom,
  offset,
  origin,
  HEX_SIZE,
  playHighlightAnimation,
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
const NODE_PLACEMENT_PREVIEW_RADIUS = 3;
const NODE_PLACEMENT_PREVIEW_FILL = 'rgba(56, 189, 248, 0.08)';
const NODE_PLACEMENT_PREVIEW_STROKE = 'rgba(56, 189, 248, 0.92)';
const NODE_PLACEMENT_PREVIEW_STROKE_WIDTH = 2.4;

const NODE_SHAPE_PREVIEW_FILL = 'rgba(34, 197, 94, 0.12)';
const NODE_SHAPE_PREVIEW_STROKE = 'rgba(34, 197, 94, 0.92)';
const NODE_SHAPE_PREVIEW_STROKE_WIDTH = 2.4;
const ARROW_OBSTACLE_PREVIEW_FILL = 'rgba(251, 191, 36, 0.24)';
const ARROW_OBSTACLE_PREVIEW_STROKE = 'rgba(253, 230, 138, 0.96)';
const HEX_DIRECTION_OFFSETS: Point2[] = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

const {
  getEditMode,
  isNodePlacementMode,
  getNodePlacementPreviewCells,
  applyEditModeAt,
} = useResearchPaneDevEdit({
  onEdited: () => {
    scheduleRender({ base: true, highlight: true });
  },
});

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

watch(
  () => [(uiState as any).researchEditMode, (uiState as any).researchPlacementRadius, (uiState as any).researchPlacementTemplate],
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

  renderResearchBaseLayer(
    ctx,
    gs,
    lib,
    o,
    HEX_SIZE,
    BACKGROUND_HEX_SIZE,
    OWNED_BACKGROUND_HEX_SIZE,
  );

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

function withCameraTransform(
  ctx: CanvasRenderingContext2D,
  zoomValue: number,
  offsetValue: Point2,
  draw: () => void
): void {
  ctx.save();
  ctx.setTransform(zoomValue, 0, 0, zoomValue, offsetValue.x, offsetValue.y);
  draw();
  ctx.restore();
}

function drawPurchasePathPreview(
  ctx: CanvasRenderingContext2D,
  gs: ReturnType<typeof getGameState>,
  axial: Point2,
  zoomValue: number,
  offsetValue: Point2,
  originPoint: Point2
): void {
  const idx = axialToIndex(axial.x, axial.y);
  if (idx === -1) return;
  const cell = gs.researchCells[idx]!;
  if (!cell.revealed || cell.owned) return;

  const path = findCheapestPath(gs, axial.x, axial.y);
  if (!path.reachable || path.pathLength <= 0) return;

  const pathCost = path.cost;
  const price = calculateResearchNodePrice(gs, pathCost);
  const canAfford = pathCost === 0 || gs.chronotraces >= price;
  const fillColor = canAfford ? 'rgba(56, 189, 248, 0.22)' : 'rgba(239, 68, 68, 0.22)';
  const strokeColor = canAfford ? 'rgba(56, 189, 248, 0.9)' : 'rgba(239, 68, 68, 0.9)';

  withCameraTransform(ctx, zoomValue, offsetValue, () => {
    for (let i = 0; i < path.pathLength; i++) {
      const cellIdx = path.pathCells[i];
      const cellData = gs.researchCells[cellIdx]!;
      const axialCell = indexToAxial(cellIdx);
      const center = axialToPixel({ x: axialCell.x, y: axialCell.y }, HEX_SIZE, originPoint);
      drawHexagon(ctx, center, HEX_SIZE * 0.9, {
        fillColor,
        strokeColor,
        lineWidth: 2,
      });
      if (cellData.cost <= 0) continue;
      ctx.save();
      ctx.fillStyle = RESEARCH_PATH_OBSTACLE_ICON_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${HEX_SIZE * 1.2}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.fillText(chronotracesSpec.glyph, center.x, center.y);
      ctx.restore();
    }
  });
}

function renderHighlightLayer() {
  const canvas = highlightCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Reset transform and clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(ctx);

  const mode = getEditMode();
  const axial = hoverAxial.value;
  const gs = getGameState();
  const z = zoom.value || 1;
  const off = offset.value;
  const o = origin.value;
  if (mode) {
    if (axial && isNodePlacementMode(mode)) {
      drawNodePlacementBoundary(ctx, axial, z, off, o);
    }
    // In edit mode we do not show purchase paths
    return;
  }

  if (axial) {
    drawPurchasePathPreview(ctx, gs, axial, z, off, o);
  }

  if (axial) {
    drawArrowObstaclePreview(ctx, gs, axial, z, off, o);
  }

  const activeHighlight = highlightAnimation?.highlight ?? props.panelHighlight;
  const { angle: animAngle, scale: animScale, t: animT } = getHighlightAnimProgress();
  if (highlightAnimation) {
    if (animT >= 1) {
      highlightAnimation = null;
    } else {
      scheduleRender({ highlight: true });
    }
  }

  if (!activeHighlight) return;
  withCameraTransform(ctx, z, off, () => {
    drawPanelHighlightLayer(ctx, gs, activeHighlight, o, animAngle, animScale);
  });
}

function drawArrowObstaclePreview(
  ctx: CanvasRenderingContext2D,
  gs: ReturnType<typeof getGameState>,
  originCell: Point2,
  zoomValue: number,
  offsetValue: Point2,
  originPoint: Point2
): void {
  const projectedCells = getArrowObstacleProjectedCells(gs, originCell);
  if (projectedCells.length === 0) return;

  withCameraTransform(ctx, zoomValue, offsetValue, () => {
    for (const cell of projectedCells) {
      const center = axialToPixel(cell, HEX_SIZE, originPoint);
      drawHexagon(ctx, center, HEX_SIZE * 0.84, {
        fillColor: ARROW_OBSTACLE_PREVIEW_FILL,
        strokeColor: ARROW_OBSTACLE_PREVIEW_STROKE,
        lineWidth: 2,
      });
    }
  });
}

function getArrowObstacleProjectedCells(
  gs: ReturnType<typeof getGameState>,
  originCell: Point2
): Point2[] {
  const idx = axialToIndex(originCell.x, originCell.y);
  if (idx === -1) return [];

  const sourceCell = gs.researchCells[idx]!;
  if (!sourceCell.revealed || sourceCell.owned) return [];

  const archetype = getGameLib().research.archetypes.get(sourceCell.archetypeId)!;
  if (archetype.type !== 'obstacle') return [];

  const count = archetype.obstacleVisual.highlightCells;
  if (count <= 0) return [];

  const direction = archetype.obstacleVisual.direction;
  const step = HEX_DIRECTION_OFFSETS[direction]!;
  const cells: Point2[] = [];

  for (let i = 1; i <= count; i++) {
    const target: Point2 = {
      x: originCell.x + step.x * i,
      y: originCell.y + step.y * i,
    };
    const targetIdx = axialToIndex(target.x, target.y);
    if (targetIdx === -1) break;
    cells.push(target);
  }

  return cells;
}

function drawBoundaryPreview(
  ctx: CanvasRenderingContext2D,
  loops: ReturnType<typeof computeHexBoundary>,
  zoomValue: number,
  offsetValue: Point2,
  originPoint: Point2,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
): void {
  if (loops.length === 0) return;
  const loopPoints = loops.map(loop => loop.points);
  withCameraTransform(ctx, zoomValue, offsetValue, () => {
    traceHexBoundaryPath(ctx, loopPoints, originPoint, HEX_SIZE);
    ctx.fillStyle = fillColor;
    ctx.fill('evenodd');
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  });
}

function drawNodePlacementBoundary(
  ctx: CanvasRenderingContext2D,
  center: Point2,
  zoomValue: number,
  offsetValue: Point2,
  originPoint: Point2
): void {
  drawBoundaryPreview(
    ctx,
    computeHexBoundary(axialRange(center, NODE_PLACEMENT_PREVIEW_RADIUS)),
    zoomValue,
    offsetValue,
    originPoint,
    NODE_PLACEMENT_PREVIEW_FILL,
    NODE_PLACEMENT_PREVIEW_STROKE,
    NODE_PLACEMENT_PREVIEW_STROKE_WIDTH
  );

  // Draw the actual node shape (template cells expanded by placement radius) in green
  const nodeCells = getNodePlacementPreviewCells(center);
  drawBoundaryPreview(
    ctx,
    computeHexBoundary(nodeCells),
    zoomValue,
    offsetValue,
    originPoint,
    NODE_SHAPE_PREVIEW_FILL,
    NODE_SHAPE_PREVIEW_STROKE,
    NODE_SHAPE_PREVIEW_STROKE_WIDTH
  );
}

function traceHexBoundaryPath(
  ctx: CanvasRenderingContext2D,
  loops: readonly (readonly Point2[])[],
  originPoint: Point2,
  scale: number
): void {
  ctx.beginPath();
  for (const loop of loops) {
    const pointCount = loop.length;
    if (pointCount < 2) continue;
    const first = loop[0]!;
    ctx.moveTo(originPoint.x + first.x * scale, originPoint.y + first.y * scale);
    for (let i = 1; i < pointCount; i++) {
      const p = loop[i]!;
      ctx.lineTo(originPoint.x + p.x * scale, originPoint.y + p.y * scale);
    }
    ctx.closePath();
  }
}

function drawPanelHighlightLayer(
  ctx: CanvasRenderingContext2D,
  gs: ReturnType<typeof getGameState>,
  highlight: ResearchHighlightHover,
  originPoint: Point2,
  rotationAngle: number = 0,
  scale: number = 1
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
      ? (archetype.type === 'discovery' || archetype.type === 'refining')
      : cell.archetypeId === highlight.archetypeId;
    if (!matches) continue;

    const axial = indexToAxial(idx);
    const center = axialToPixel({ x: axial.x, y: axial.y }, HEX_SIZE, originPoint);

    const hasTransform = rotationAngle !== 0 || scale !== 1;
    if (hasTransform) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(rotationAngle);
      ctx.scale(scale, scale);
      ctx.translate(-center.x, -center.y);
    }

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

    if (hasTransform) {
      ctx.restore();
    }
  }

  ctx.restore();
}

const {
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onWindowMouseUp,
} = useHexPaneInteraction({
  canvas: baseCanvas,
  origin,
  hexSize: HEX_SIZE,
  zoom,
  offset,
  hoverAxial,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  zoomStopRenderDebounceMs: 400,
  isPaintMode: (event) => {
    const mode = getEditMode();
    return event.shiftKey && !!mode;
  },
  onHoverChanged: (axial) => {
    emit('hover-cell', axial);
    scheduleRender({ highlight: true });
  },
  onPrimaryClick: (axial) => {
    handleClick(axial);
  },
  onPaintAt: (axial) => {
    applyEditModeAt(axial);
  },
  onPanOrZoomTransient: () => {
    scheduleRender({ base: true, baseMode: 'present', highlight: true });
  },
  onPanOrZoomCommit: () => {
    scheduleRender({ base: true, baseMode: 'render', highlight: true });
  },
  onMouseLeave: () => {
    scheduleRender({ highlight: true });
  },
});

function handleClick(axial: Point2): void {
  const mode = getEditMode();
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
