<template>
  <div
    class="maze-pane-root"
    ref="container"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
    @dragenter.prevent
    @dragover.prevent
    @dragleave.prevent
    @drop.prevent
  >
    <canvas ref="baseCanvas" class="maze-layer"></canvas>
    <canvas ref="furnitureCanvas" class="maze-layer"></canvas>
    <canvas ref="pathCanvas" class="maze-layer"></canvas>
    <canvas ref="refresherEffectsCanvas" class="maze-layer maze-effects-layer"></canvas>
    <canvas ref="effectsCanvas" class="maze-layer maze-effects-layer"></canvas>
    <canvas ref="avatarCanvas" class="maze-avatar-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { clearCanvas } from '../logic/DrawHex';
import { bfsMazePath } from '../logic/BFS';
import { pixelToAxial } from '../logic/HexMath';
import { CmdMazeMoveTo, CmdMazePlaceNexusItem } from '../logic/input/InputCommands';
import { renderMazeTerrainLayer, renderMazeFurnitureLayer } from '../logic/drawMaze';
import { renderMazePathOverlay } from '../logic/drawMazePath';
import { useHexPaneInteraction } from '../logic/pane/useHexPaneInteraction';
import { useHoverPathTransition } from '../logic/pane/useHoverPathTransition';
import { useMazeAvatar } from '../logic/pane/useMazeAvatar';
import { useMazeMoveAnimation } from '../logic/pane/useMazeMoveAnimation';
import { useMazeResourceEffects } from '../logic/pane/useMazeResourceEffects';
import { useMazeResourceHighlights } from '../logic/pane/useMazeResourceHighlights';
import { renderMazeNexusPlacementPreview } from '../logic/pane/drawMazeNexusPlacementPreview';
import { useMazeNexusDragPreview } from '../logic/pane/useMazeNexusDragPreview';
import { useMazeOverlaySignals } from '../logic/pane/useMazeOverlaySignals';
import { MAZE_DRAG_MOVE_EVENT, MAZE_DRAG_END_EVENT } from '../logic/MazeNexusDnd';
import type { Point2 } from '../logic/ItemLib';
import type { MazeResourceHoverHint, MazeResourceKey } from '../logic/pane/MazeOverlayState';

const container = ref<HTMLDivElement | null>(null);
const baseCanvas = ref<HTMLCanvasElement | null>(null);
const furnitureCanvas = ref<HTMLCanvasElement | null>(null);
const pathCanvas = ref<HTMLCanvasElement | null>(null);
const avatarCanvas = ref<HTMLCanvasElement | null>(null);
const refresherEffectsCanvas = ref<HTMLCanvasElement | null>(null);
const effectsCanvas = ref<HTMLCanvasElement | null>(null);

const emit = defineEmits<{
  (e: 'resource-hover', hint: MazeResourceHoverHint | null): void;
  (e: 'resource-hover-batch', hints: MazeResourceHoverHint[]): void;
  (e: 'hover-path-cost', cost: number): void;
  (e: 'entrance-hover', hovering: boolean): void;
}>();

const props = defineProps<{
  highlightResourceKey: MazeResourceKey | null;
}>();

const HEX_SIZE = 18;
const CELL_SIZE = HEX_SIZE * 1;
const CELL_FILL_SIZE = CELL_SIZE + 0.6;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const AVATAR_CANVAS_SIZE = 96;
const AVATAR_MOVE_SPEED = 16; // cells per second
const AVATAR_TURN_SPEED = 12; // radians per second
const HOVER_PATH_TRANSITION_SPEED = 60; // cells per second

const canvasWidth = ref(0);
const canvasHeight = ref(0);

const origin = computed<Point2>(() => ({
  x: canvasWidth.value / 2,
  y: canvasHeight.value / 2,
}));

const zoom = ref(1);
const offset = ref<Point2>({ x: 0, y: 0 });
const hoverAxial = ref<Point2 | null>(null);
const mouseWorldPos = ref<Point2 | null>(null);

const {
  displayedPath: displayedHoverPath,
  queueTo: queueHoverPathTransition,
  clearImmediate: clearHoverPathImmediate,
  dispose: disposeHoverPathTransition,
} = useHoverPathTransition(renderPath, HOVER_PATH_TRANSITION_SPEED);

let terrainRafId: number | null = null;
let furnitureRafId: number | null = null;
let isMoving = () => false;

function getDisplayAvatarCell(): Point2 {
  return pendingAvatarCell.value ?? getGameState().maze.avatarCell;
}

const {
  facingAngle,
  drawAvatar,
  updateAvatarPosition,
  ensureIdleFacingLoop,
  stopIdleFacingLoop,
  positionAvatarAt,
  turnTowards,
  dispose: disposeAvatar,
} = useMazeAvatar({
  avatarCanvas,
  zoom,
  offset,
  origin,
  hexSize: HEX_SIZE,
  avatarCanvasSize: AVATAR_CANVAS_SIZE,
  avatarTurnSpeed: AVATAR_TURN_SPEED,
  getDisplayAvatarCell,
  getDisplayedHoverPath: () => displayedHoverPath.value,
  getMouseWorldPos: () => mouseWorldPos.value,
  isMoving: () => isMoving(),
});

const {
  onSegmentComplete: onResourceSegmentComplete,
  getVisuallyTakenCellKeys,
  clearVisualRefreshMask,
  dispose: disposeResourceEffects,
} = useMazeResourceEffects({
  pickupCanvas: effectsCanvas,
  refresherCanvas: refresherEffectsCanvas,
  zoom,
  offset,
  hexSize: HEX_SIZE,
  origin,
  getGameState,
  scheduleBaseRender: scheduleFurnitureRender,
});

const resourceHighlights = useMazeResourceHighlights({
  getGameState,
  hoverAxial,
  getHighlightResourceKey: () => props.highlightResourceKey,
});

const {
  movePath,
  segmentQueue,
  pendingAvatarCell,
  getQueuedAvatarCell,
  getQueuedMovementUsed,
  onPrimaryClick: onPrimaryMoveClick,
  dispose: disposeMoveAnimation,
} = useMazeMoveAnimation({
  hexSize: HEX_SIZE,
  avatarMoveSpeed: AVATAR_MOVE_SPEED,
  origin,
  facingAngle,
  turnTowards,
  positionAvatarAt,
  stopIdleFacingLoop,
  getGameState,
  queueMoveCommand: (target) => {
    globalInputQueue.push(new CmdMazeMoveTo({ target }));
  },
  clearHoverPathImmediate,
  scheduleBaseRender: scheduleFurnitureRender,
  updateAvatarPosition,
  onSegmentComplete: (targetCell, takenBefore, segmentPath) => {
    onResourceSegmentComplete(targetCell, takenBefore, segmentPath);
  },
  onPathAnimationFullyComplete: () => {
    onHoverChanged(hoverAxial.value);
    ensureIdleFacingLoop();
  },
});

isMoving = () => movePath.value.length > 0 || segmentQueue.value.length > 0;

const overlaySignals = useMazeOverlaySignals({
  getGameState,
  getHighlightResourceKey: () => props.highlightResourceKey,
  getQueuedAvatarCell,
  origin,
  zoom,
  offset,
  hoverAxial,
  hexSize: HEX_SIZE,
  emitResourceHover: (hint) => {
    emit('resource-hover', hint);
  },
  emitResourceHoverBatch: (hints) => {
    emit('resource-hover-batch', hints);
  },
  emitHoverPathCost: (cost) => {
    emit('hover-path-cost', cost);
  },
  emitEntranceHover: (hovering) => {
    emit('entrance-hover', hovering);
  },
});

const {
  dragNexusItemId,
  dragNexusAxial,
  dragNexusValid,
  onMazeDragMove,
  onMazeDragEnd,
} = useMazeNexusDragPreview({
  getGameState,
  clientToAxial,
  queuePlaceNexusItem: (target, nexusItemId) => {
    globalInputQueue.push(new CmdMazePlaceNexusItem({ target, nexusItemId }));
  },
  onPreviewChanged: renderPath,
  onPlacementCommitted: scheduleFurnitureRender,
});

function emitHoverSignals(): void {
  overlaySignals.emitAllForCurrentHover();
}

function emitResourceSignals(): void {
  overlaySignals.emitHoverResourceHint();
  overlaySignals.emitHoverResourceHintBatch();
}

function syncViewportDependentRendering(): void {
  scheduleTerrainRender();
  scheduleFurnitureRender();
  renderPath();
  updateAvatarPosition();
  ensureIdleFacingLoop();
  emitResourceSignals();
}

onMounted(() => {
  setupCanvases();
  drawAvatar();
  scheduleTerrainRender();
  scheduleFurnitureRender();
  updateAvatarPosition();
  overlaySignals.emitHoverResourceHint(null);
  overlaySignals.emitHoverResourceHintBatch();
  overlaySignals.emitHoverPathCost(null);
  overlaySignals.emitEntranceHover(null);
  window.addEventListener('resize', onResize);
  window.addEventListener('mouseup', onWindowMouseUp);
  window.addEventListener(MAZE_DRAG_MOVE_EVENT, onMazeDragMove as EventListener);
  window.addEventListener(MAZE_DRAG_END_EVENT, onMazeDragEnd as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mouseup', onWindowMouseUp);
  window.removeEventListener(MAZE_DRAG_MOVE_EVENT, onMazeDragMove as EventListener);
  window.removeEventListener(MAZE_DRAG_END_EVENT, onMazeDragEnd as EventListener);
  if (terrainRafId != null) {
    cancelAnimationFrame(terrainRafId);
    terrainRafId = null;
  }
  if (furnitureRafId != null) {
    cancelAnimationFrame(furnitureRafId);
    furnitureRafId = null;
  }
  disposeAvatar();
  disposeMoveAnimation();
  disposeResourceEffects();
  disposeHoverPathTransition();
  overlaySignals.clearAll();
});

watch(
  () => [uiState.researchOwnedCount, uiState.discoveryCounter, uiState.credits],
  () => {
    scheduleTerrainRender();
    scheduleFurnitureRender();
    emitHoverSignals();
  }
);

watch(
  () => uiState.mazeVersion,
  () => {
    pendingAvatarCell.value = null;
    clearVisualRefreshMask();
    scheduleFurnitureRender();
    updateAvatarPosition();
    emitHoverSignals();
  }
);

watch(
  () => uiState.mazeMovementUsed,
  () => {
    pendingAvatarCell.value = null;
    emitHoverSignals();
  }
);

watch(
  () => props.highlightResourceKey,
  () => {
    scheduleFurnitureRender();
    overlaySignals.emitHoverResourceHintBatch();
  }
);

function onResize(): void {
  setupCanvases();
  scheduleTerrainRender();
  scheduleFurnitureRender();
  updateAvatarPosition();
  emitResourceSignals();
  overlaySignals.emitEntranceHover();
}

function setupCanvases(): void {
  const root = container.value;
  if (!root) return;

  const width = root.clientWidth || root.offsetWidth || 0;
  const height = root.clientHeight || root.offsetHeight || 0;
  if (!width || !height) return;

  canvasWidth.value = width;
  canvasHeight.value = height;

  for (const c of [baseCanvas.value, furnitureCanvas.value, pathCanvas.value, refresherEffectsCanvas.value, effectsCanvas.value]) {
    if (!c) continue;
    c.width = width;
    c.height = height;
  }
}

function scheduleTerrainRender(): void {
  if (terrainRafId != null) return;
  terrainRafId = requestAnimationFrame(() => {
    terrainRafId = null;
    renderTerrain();
  });
}

function scheduleFurnitureRender(): void {
  if (furnitureRafId != null) return;
  furnitureRafId = requestAnimationFrame(() => {
    furnitureRafId = null;
    renderFurniture();
  });
}

function renderTerrain(): void {
  const c = baseCanvas.value;
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
  renderMazeTerrainLayer(
    ctx,
    gs,
    o,
    HEX_SIZE,
    CELL_FILL_SIZE,
  );
}

function renderFurniture(): void {
  const c = furnitureCanvas.value;
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
  const highlightedResourceCellKeys = resourceHighlights.buildHighlightedResourceCellKeys();
  const visuallyTakenCellKeys = getVisuallyTakenCellKeys();
  renderMazeFurnitureLayer(
    ctx,
    gs,
    o,
    HEX_SIZE,
    gs.maze.takenCells,
    highlightedResourceCellKeys,
    visuallyTakenCellKeys,
  );
}

function renderPath(): void {
  const c = pathCanvas.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(ctx);

  const hp = displayedHoverPath.value;
  const previewAxial = dragNexusAxial.value;
  const previewItemId = dragNexusItemId.value;
  if (hp.length === 0 && !previewAxial) return;

  const z = zoom.value;
  const off = offset.value;
  ctx.setTransform(z, 0, 0, z, off.x, off.y);

  const gs = getGameState();
  if (hp.length > 0) {
    const from = getQueuedAvatarCell();
    const remaining = Math.max(0, gs.timeFlux - getQueuedMovementUsed());
    renderMazePathOverlay(ctx, hp, from, origin.value, HEX_SIZE, remaining);
  }

  if (previewAxial && previewItemId) {
    renderMazeNexusPlacementPreview(ctx, {
      gs,
      nexusItemId: previewItemId,
      anchor: previewAxial,
      valid: dragNexusValid.value,
      origin: origin.value,
      hexSize: HEX_SIZE,
    });
  }
}

function onHoverChanged(axial: Point2 | null): void {
  scheduleFurnitureRender();

  if (!axial) {
    queueHoverPathTransition([]);
    overlaySignals.emitHoverResourceHint(null);
    overlaySignals.emitHoverPathCost(null);
    overlaySignals.emitEntranceHover(null);
    return;
  }

  const gs = getGameState();
  const from = getQueuedAvatarCell();
  const result = bfsMazePath(gs, from, axial);
  queueHoverPathTransition(result.reachable ? result.path : []);
  ensureIdleFacingLoop();
  overlaySignals.emitHoverResourceHint(axial);
  overlaySignals.emitHoverPathCostValue(result.reachable ? result.cost : 0);
  overlaySignals.emitEntranceHover(axial);
}

const {
  onWheel: onInteractionWheel,
  onMouseDown: onInteractionMouseDown,
  onMouseMove: onInteractionMouseMove,
  onMouseUp: onInteractionMouseUp,
  onMouseLeave: onInteractionMouseLeave,
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
  isPaintMode: () => false,
  onHoverChanged,
  onPrimaryClick: (axial) => {
    onPrimaryMoveClick(axial);
    onHoverChanged(hoverAxial.value);
  },
  onPaintAt: () => {},
  onPanOrZoomTransient: () => {
    syncViewportDependentRendering();
  },
  onPanOrZoomCommit: () => {
    syncViewportDependentRendering();
  },
  onMouseLeave: () => {
    queueHoverPathTransition([]);
    ensureIdleFacingLoop();
  },
});

function updateMouseWorldPos(event: MouseEvent | WheelEvent): void {
  const root = container.value;
  if (!root) return;
  const rect = root.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  const z = zoom.value || 1;
  const off = offset.value;
  mouseWorldPos.value = {
    x: (px - off.x) / z,
    y: (py - off.y) / z,
  };
}

function onWheel(event: WheelEvent): void {
  onInteractionWheel(event);
  updateMouseWorldPos(event);
  ensureIdleFacingLoop();
}

function onMouseDown(event: MouseEvent): void {
  updateMouseWorldPos(event);
  onInteractionMouseDown(event);
  ensureIdleFacingLoop();
}

function onMouseMove(event: MouseEvent): void {
  onInteractionMouseMove(event);
  updateMouseWorldPos(event);
  ensureIdleFacingLoop();
}

function onMouseUp(event: MouseEvent): void {
  updateMouseWorldPos(event);
  onInteractionMouseUp(event);
  ensureIdleFacingLoop();
}

function onMouseLeave(event: MouseEvent): void {
  mouseWorldPos.value = null;
  onInteractionMouseLeave(event);
  ensureIdleFacingLoop();
}

function clientToAxial(clientX: number, clientY: number): Point2 | null {
  const root = container.value;
  if (!root) return null;

  const rect = root.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;

  const z = zoom.value || 1;
  const off = offset.value;
  const worldX = (px - off.x) / z;
  const worldY = (py - off.y) / z;

  return pixelToAxial({ x: worldX, y: worldY }, HEX_SIZE, origin.value);
}
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
  pointer-events: none;
}

.maze-layer:first-of-type {
  pointer-events: auto;
}

.maze-effects-layer {
  pointer-events: none;
}

.maze-avatar-canvas {
  position: absolute;
  pointer-events: none;
  image-rendering: auto;
}
</style>
