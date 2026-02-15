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
    <canvas ref="baseCanvas" class="maze-layer"></canvas>
    <canvas ref="pathCanvas" class="maze-layer"></canvas>
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
import { axialToPixel } from '../logic/HexMath';
import { axialToIndex } from '../logic/Research';
import { CmdMazeMoveTo } from '../logic/input/InputCommands';
import { renderMazeBaseLayer } from '../logic/drawMaze';
import { renderMazePathOverlay } from '../logic/drawMazePath';
import { isMazeEntranceCell } from '../logic/Maze';
import { useHexPaneInteraction } from '../logic/pane/useHexPaneInteraction';
import { useHoverPathTransition } from '../logic/pane/useHoverPathTransition';
import { useMazeAvatar } from '../logic/pane/useMazeAvatar';
import { useMazeMoveAnimation } from '../logic/pane/useMazeMoveAnimation';
import { useMazePickupAnimation } from '../logic/pane/useMazePickupAnimation';
import type { Point2 } from '../logic/ItemLib';
import type { MazeResourceHoverHint, MazeResourceKey } from '../logic/pane/MazeOverlayState';

const container = ref<HTMLDivElement | null>(null);
const baseCanvas = ref<HTMLCanvasElement | null>(null);
const pathCanvas = ref<HTMLCanvasElement | null>(null);
const avatarCanvas = ref<HTMLCanvasElement | null>(null);
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
  transitionActive: hoverPathTransitionActive,
  queueTo: queueHoverPathTransition,
  clearImmediate: clearHoverPathImmediate,
  dispose: disposeHoverPathTransition,
} = useHoverPathTransition(renderPath, HOVER_PATH_TRANSITION_SPEED);

let baseRafId: number | null = null;

let isMoving = () => false;

function getDisplayAvatarCell(): Point2 {
  return pendingAvatarCell.value ?? getGameState().maze.avatarCell;
}

function buildHoverResourceHint(axial: Point2 | null): MazeResourceHoverHint | null {
  if (!axial) return null;
  const gs = getGameState();
  const spawn = gs.mazeResourceSpawns.find(
    s => s.cell.x === axial.x && s.cell.y === axial.y,
  );
  if (!spawn) return null;

  const taken = gs.maze.takenCells.some(c => c.x === axial.x && c.y === axial.y);
  if (taken) return null;

  const world = axialToPixel(spawn.cell, HEX_SIZE, origin.value);
  const z = zoom.value;
  const off = offset.value;

  return {
    resourceKey: spawn.resourceKey,
    amount: spawn.amount,
    screenX: world.x * z + off.x,
    screenY: world.y * z + off.y,
  };
}

function emitHoverResourceHint(axial: Point2 | null = hoverAxial.value): void {
  emit('resource-hover', buildHoverResourceHint(axial));
}

function buildHoverResourceHintsByKey(resourceKey: MazeResourceKey | null): MazeResourceHoverHint[] {
  if (!resourceKey) return [];

  const gs = getGameState();
  const takenKeys = new Set(gs.maze.takenCells.map((cell) => `${cell.x},${cell.y}`));
  const z = zoom.value;
  const off = offset.value;

  return gs.mazeResourceSpawns
    .filter((spawn) => spawn.resourceKey === resourceKey && !takenKeys.has(`${spawn.cell.x},${spawn.cell.y}`))
    .map((spawn) => {
      const world = axialToPixel(spawn.cell, HEX_SIZE, origin.value);
      return {
        resourceKey: spawn.resourceKey,
        amount: spawn.amount,
        screenX: world.x * z + off.x,
        screenY: world.y * z + off.y,
      };
    });
}

function emitHoverResourceHintBatch(): void {
  emit('resource-hover-batch', buildHoverResourceHintsByKey(props.highlightResourceKey));
}

function emitEntranceHover(axial: Point2 | null = hoverAxial.value): void {
  const isEntranceHover = !!axial && isMazeEntranceCell(getGameState(), axial);
  emit('entrance-hover', isEntranceHover);
}

function computeHoverPathCost(axial: Point2 | null): number {
  if (!axial) return 0;
  const gs = getGameState();
  const from = getQueuedAvatarCell();
  const result = bfsMazePath(gs, from, axial);
  if (!result.reachable) return 0;
  return result.cost;
}

function emitHoverPathCost(axial: Point2 | null = hoverAxial.value): void {
  emit('hover-path-cost', computeHoverPathCost(axial));
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
  spawnAt: spawnPickup,
  dispose: disposePickupAnimation,
} = useMazePickupAnimation({
  effectsCanvas,
  zoom,
  offset,
  hexSize: HEX_SIZE,
  origin,
});

const {
  movePath,
  moveAnimProgress,
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
  scheduleBaseRender,
  updateAvatarPosition,
  onSegmentComplete: (targetCell, takenBefore) => {
    const gs = getGameState();
    const key = `${targetCell.x},${targetCell.y}`;
    if (takenBefore.has(key)) return;
    const spawn = gs.mazeResourceSpawns.find(
      s => s.cell.x === targetCell.x && s.cell.y === targetCell.y,
    );
    if (spawn) {
      spawnPickup(targetCell, spawn);
    }
  },
  onPathAnimationFullyComplete: () => {
    onHoverChanged(hoverAxial.value);
    ensureIdleFacingLoop();
  },
});

isMoving = () => movePath.value.length > 0 || segmentQueue.value.length > 0;

// Debug: call window.debugMaze() from console when hover paths stop working
function debugMaze() {
  const gs = getGameState();
  const ha = hoverAxial.value;
  const bfsResult = ha ? bfsMazePath(gs, gs.maze.avatarCell, ha) : null;
  const avatarIdx = axialToIndex(gs.maze.avatarCell.x, gs.maze.avatarCell.y);
  const avatarOwned = avatarIdx !== -1 ? gs.researchCells[avatarIdx]?.owned : 'OUT_OF_GRID';
  console.table({
    avatarCell: `${gs.maze.avatarCell.x},${gs.maze.avatarCell.y}`,
    avatarCellOwned: avatarOwned,
    movementUsed: gs.maze.movementUsed,
    timeFlux: gs.timeFlux,
    remaining: gs.timeFlux - gs.maze.movementUsed,
    mazeVersion: gs.maze.version,
    movePathLen: movePath.value.length,
    segmentQueueLen: segmentQueue.value.length,
    moveAnimProgress: moveAnimProgress.value,
    animActive: movePath.value.length > 0,
    hoverAxial: ha ? `${ha.x},${ha.y}` : 'null',
    hoverPathLen: displayedHoverPath.value.length,
    hoverPathTransitionActive: hoverPathTransitionActive.value,
    bfsReachable: bfsResult?.reachable ?? 'N/A',
    bfsCost: bfsResult?.cost ?? 'N/A',
    bfsPathLen: bfsResult?.path.length ?? 'N/A',
  });
  if (movePath.value.length > 0 || segmentQueue.value.length > 0) {
    console.warn('[debugMaze] movePath/segmentQueue non-empty — hover path starts from queue tip.');
    console.log('movePath:', JSON.parse(JSON.stringify(movePath.value)));
    console.log('segmentQueue:', JSON.parse(JSON.stringify(segmentQueue.value)));
  }
}
(window as any).debugMaze = debugMaze;

onMounted(() => {
  setupCanvases();
  drawAvatar();
  scheduleBaseRender();
  updateAvatarPosition();
  emitHoverResourceHint(null);
  emitHoverResourceHintBatch();
  emitHoverPathCost(null);
  emitEntranceHover(null);
  window.addEventListener('resize', onResize);
  window.addEventListener('mouseup', onWindowMouseUp);
});

onUnmounted(() => {
  delete (window as any).debugMaze;
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mouseup', onWindowMouseUp);
  if (baseRafId != null) {
    cancelAnimationFrame(baseRafId);
    baseRafId = null;
  }
  disposeAvatar();
  disposeMoveAnimation();
  disposePickupAnimation();
  disposeHoverPathTransition();
  emit('resource-hover', null);
  emit('resource-hover-batch', []);
  emit('hover-path-cost', 0);
  emit('entrance-hover', false);
});

watch(
  () => [uiState.researchOwnedCount, uiState.discoveryCounter],
  () => {
    scheduleBaseRender();
    emitHoverResourceHint();
    emitHoverResourceHintBatch();
    emitHoverPathCost();
    emitEntranceHover();
  }
);

// Redraw base layer + reposition avatar when maze resets (version bump)
watch(
  () => uiState.mazeVersion,
  () => {
    pendingAvatarCell.value = null;
    scheduleBaseRender();
    updateAvatarPosition();
    emitHoverResourceHint();
    emitHoverResourceHintBatch();
    emitHoverPathCost();
    emitEntranceHover();
  }
);

// Clear pending override once the game state has processed the move
watch(
  () => uiState.mazeMovementUsed,
  () => {
    pendingAvatarCell.value = null;
    emitHoverResourceHint();
    emitHoverResourceHintBatch();
    emitHoverPathCost();
    emitEntranceHover();
  }
);

watch(
  () => props.highlightResourceKey,
  () => {
    emitHoverResourceHintBatch();
  }
);

function onResize(): void {
  setupCanvases();
  scheduleBaseRender();
  updateAvatarPosition();
  emitHoverResourceHint();
  emitHoverResourceHintBatch();
  emitEntranceHover();
}

function setupCanvases(): void {
  const root = container.value;
  if (!root) return;

  const width = root.clientWidth || root.offsetWidth || 0;
  const height = root.clientHeight || root.offsetHeight || 0;
  if (!width || !height) return;

  canvasWidth.value = width;
  canvasHeight.value = height;

  for (const c of [baseCanvas.value, pathCanvas.value, effectsCanvas.value]) {
    if (!c) continue;
    c.width = width;
    c.height = height;
  }
}

function scheduleBaseRender(): void {
  if (baseRafId != null) return;
  baseRafId = requestAnimationFrame(() => {
    baseRafId = null;
    renderBase();
  });
}

function renderBase(): void {
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
  renderMazeBaseLayer(ctx, gs, o, HEX_SIZE, CELL_FILL_SIZE, gs.maze.takenCells);
}

function renderPath(): void {
  const c = pathCanvas.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  clearCanvas(ctx);

  const hp = displayedHoverPath.value;
  if (hp.length === 0) return;

  const z = zoom.value;
  const off = offset.value;
  ctx.setTransform(z, 0, 0, z, off.x, off.y);

  const gs = getGameState();
  const from = getQueuedAvatarCell();
  const remaining = Math.max(0, gs.timeFlux - getQueuedMovementUsed());
  renderMazePathOverlay(ctx, hp, from, origin.value, HEX_SIZE, remaining);
}

// --- Interaction ---

// When a command is queued but not yet processed, the visual avatar position
// may differ from gs.maze.avatarCell.  This stores the override; null = use gs.
function onHoverChanged(axial: Point2 | null): void {
  if (!axial) {
    queueHoverPathTransition([]);
    emitHoverResourceHint(null);
    emitHoverPathCost(null);
    emitEntranceHover(null);
    return;
  }

  const gs = getGameState();
  const from = getQueuedAvatarCell();
  const result = bfsMazePath(gs, from, axial);
  queueHoverPathTransition(result.reachable ? result.path : []);
  ensureIdleFacingLoop();
  emitHoverResourceHint(axial);
  emit('hover-path-cost', result.reachable ? result.cost : 0);
  emitEntranceHover(axial);
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
    scheduleBaseRender();
    renderPath();
    updateAvatarPosition();
    ensureIdleFacingLoop();
    emitHoverResourceHint();
    emitHoverResourceHintBatch();
  },
  onPanOrZoomCommit: () => {
    scheduleBaseRender();
    renderPath();
    updateAvatarPosition();
    ensureIdleFacingLoop();
    emitHoverResourceHint();
    emitHoverResourceHintBatch();
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
