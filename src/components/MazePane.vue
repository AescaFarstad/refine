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
    <canvas ref="avatarCanvas" class="maze-avatar-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { clearCanvas } from '../logic/DrawHex';
import { axialToPixel } from '../logic/HexMath';
import { bfsMazePath } from '../logic/BFS';
import { axialToIndex } from '../logic/Research';
import { CmdMazeMoveTo } from '../logic/input/InputCommands';
import { renderMazeBaseLayer } from '../logic/drawMaze';
import { renderMazePathOverlay } from '../logic/drawMazePath';
import { useHexPaneInteraction } from '../logic/pane/useHexPaneInteraction';
import type { Point2 } from '../logic/ItemLib';

const container = ref<HTMLDivElement | null>(null);
const baseCanvas = ref<HTMLCanvasElement | null>(null);
const pathCanvas = ref<HTMLCanvasElement | null>(null);
const avatarCanvas = ref<HTMLCanvasElement | null>(null);

const HEX_SIZE = 18;
const CELL_SIZE = HEX_SIZE * 1;
const CELL_FILL_SIZE = CELL_SIZE + 0.6;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const AVATAR_CANVAS_SIZE = 96;
const AVATAR_MOVE_SPEED = 8; // cells per second

const canvasWidth = ref(0);
const canvasHeight = ref(0);

const origin = computed<Point2>(() => ({
  x: canvasWidth.value / 2,
  y: canvasHeight.value / 2,
}));

const zoom = ref(1);
const offset = ref<Point2>({ x: 0, y: 0 });
const hoverAxial = ref<Point2 | null>(null);

// Animation state (transient, Vue-local)
const movePath = ref<Point2[]>([]);
const moveAnimProgress = ref(0);
const facingAngle = ref(0);
let animStartCell: Point2 = { x: 0, y: 0 }; // captured when animation begins
let animFrameId: number | null = null;
let lastAnimTime: number = 0;

// Segment queue: when a path passes through resource nodes, we split it into
// segments and complete each one in turn, sending a command at every stop.
const segmentQueue = ref<{ path: Point2[]; target: Point2 }[]>([]);

// Hover path for overlay
const hoverPath = ref<Point2[]>([]);

let baseRafId: number | null = null;

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
    animFrameId: animFrameId,
    hoverAxial: ha ? `${ha.x},${ha.y}` : 'null',
    hoverPathLen: hoverPath.value.length,
    bfsReachable: bfsResult?.reachable ?? 'N/A',
    bfsCost: bfsResult?.cost ?? 'N/A',
    bfsPathLen: bfsResult?.path.length ?? 'N/A',
  });
  if (movePath.value.length > 0 || segmentQueue.value.length > 0) {
    console.warn('[debugMaze] movePath/segmentQueue non-empty — this blocks hover paths!');
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
  if (animFrameId != null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
});

watch(
  () => [uiState.researchOwnedCount, uiState.discoveryCounter],
  () => {
    scheduleBaseRender();
  }
);

// Redraw base layer + reposition avatar when maze resets (version bump)
watch(
  () => uiState.mazeVersion,
  () => {
    pendingAvatarCell = null;
    scheduleBaseRender();
    updateAvatarPosition();
  }
);

// Clear pending override once the game state has processed the move
watch(
  () => uiState.mazeMovementUsed,
  () => {
    pendingAvatarCell = null;
  }
);

function onResize(): void {
  setupCanvases();
  scheduleBaseRender();
  updateAvatarPosition();
}

function setupCanvases(): void {
  const root = container.value;
  if (!root) return;

  const width = root.clientWidth || root.offsetWidth || 0;
  const height = root.clientHeight || root.offsetHeight || 0;
  if (!width || !height) return;

  canvasWidth.value = width;
  canvasHeight.value = height;

  for (const c of [baseCanvas.value, pathCanvas.value]) {
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

  const hp = hoverPath.value;
  if (hp.length === 0) return;

  const z = zoom.value;
  const off = offset.value;
  ctx.setTransform(z, 0, 0, z, off.x, off.y);

  const gs = getGameState();
  const from = pendingAvatarCell ?? gs.maze.avatarCell;
  const remaining = gs.timeFlux - gs.maze.movementUsed;
  renderMazePathOverlay(ctx, hp, from, origin.value, HEX_SIZE, remaining);
}

// --- Avatar rendering ---

function drawAvatar(): void {
  const c = avatarCanvas.value;
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = AVATAR_CANVAS_SIZE * dpr;
  c.height = AVATAR_CANVAS_SIZE * dpr;
  c.style.width = `${AVATAR_CANVAS_SIZE}px`;
  c.style.height = `${AVATAR_CANVAS_SIZE}px`;
  const ctx = c.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  const cx = AVATAR_CANVAS_SIZE / 2;
  const cy = AVATAR_CANVAS_SIZE / 2;
  const r = HEX_SIZE * 0.65;

  ctx.clearRect(0, 0, AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE);
  ctx.save();
  ctx.translate(cx, cy);

  // Arrow shape: triangle pointing right + rear protrusion
  ctx.fillStyle = 'rgb(255, 220, 80)';
  ctx.strokeStyle = 'rgb(180, 150, 40)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Front point
  ctx.moveTo(r, 0);
  // Bottom wing
  ctx.lineTo(-r * 0.6, r * 0.6);
  // Rear notch
  ctx.lineTo(-r * 0.3, 0);
  // Top wing
  ctx.lineTo(-r * 0.6, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function positionAvatarAt(pixelX: number, pixelY: number, angle: number): void {
  const c = avatarCanvas.value;
  if (!c) return;

  const z = zoom.value;
  const off = offset.value;
  const screenX = pixelX * z + off.x;
  const screenY = pixelY * z + off.y;

  const half = AVATAR_CANVAS_SIZE / 2;
  c.style.left = `${screenX - half}px`;
  c.style.top = `${screenY - half}px`;
  c.style.transform = `rotate(${angle}rad) scale(${z})`;
}

function updateAvatarPosition(): void {
  const gs = getGameState();
  const pixel = axialToPixel(gs.maze.avatarCell, HEX_SIZE, origin.value);
  positionAvatarAt(pixel.x, pixel.y, facingAngle.value);
}

// --- Animation loop ---

function startMoveAnimation(path: Point2[], fromCell?: Point2): void {
  if (path.length === 0) return;
  const src = fromCell ?? getGameState().maze.avatarCell;
  animStartCell = { x: src.x, y: src.y };
  movePath.value = path;
  moveAnimProgress.value = 0;
  lastAnimTime = performance.now();
  if (animFrameId == null) {
    animFrameId = requestAnimationFrame(animationTick);
  }
}

function animationTick(now: number): void {
  animFrameId = null;
  const dt = Math.max(0, (now - lastAnimTime) / 1000);
  lastAnimTime = now;

  const path = movePath.value;
  if (path.length === 0) return;

  moveAnimProgress.value += dt * AVATAR_MOVE_SPEED;

  const currentStep = Math.floor(moveAnimProgress.value);

  if (currentStep >= path.length) {
    // Animation complete — position at target, then send command
    const target = path[path.length - 1]!;
    const targetPixel = axialToPixel(target, HEX_SIZE, origin.value);
    positionAvatarAt(targetPixel.x, targetPixel.y, facingAngle.value);

    movePath.value = [];
    moveAnimProgress.value = 0;
    pendingAvatarCell = { x: target.x, y: target.y };
    globalInputQueue.push(new CmdMazeMoveTo({ target }));
    scheduleBaseRender();

    // If there are queued segments, start the next one from the current stop
    if (segmentQueue.value.length > 0) {
      const nextSeg = segmentQueue.value.shift()!;
      startMoveAnimation(nextSeg.path, target);
      return;
    }
    // Don't call updateAvatarPosition() — command hasn't been processed yet.
    // The mazeVersion watch will reposition after reset/payout if needed.

    // Re-show hover path to wherever the mouse is sitting
    onHoverChanged(hoverAxial.value);
    return;
  }

  // Interpolate position between cells
  const t = moveAnimProgress.value - currentStep;
  const fromCell = currentStep === 0
    ? animStartCell
    : path[currentStep - 1]!;
  const toCell = path[currentStep];
  if (!toCell) {
    console.warn('[MazePane] animationTick safety: toCell is falsy!', { currentStep, pathLen: path.length, progress: moveAnimProgress.value });
    movePath.value = [];
    moveAnimProgress.value = 0;
    return;
  }

  const fromPixel = axialToPixel(fromCell, HEX_SIZE, origin.value);
  const toPixel = axialToPixel(toCell, HEX_SIZE, origin.value);

  const interpX = fromPixel.x + (toPixel.x - fromPixel.x) * t;
  const interpY = fromPixel.y + (toPixel.y - fromPixel.y) * t;

  // Update facing angle toward next cell
  const dx = toPixel.x - fromPixel.x;
  const dy = toPixel.y - fromPixel.y;
  if (dx !== 0 || dy !== 0) {
    facingAngle.value = Math.atan2(dy, dx);
  }

  positionAvatarAt(interpX, interpY, facingAngle.value);

  animFrameId = requestAnimationFrame(animationTick);
}

// --- Interaction ---

// When a command is queued but not yet processed, the visual avatar position
// may differ from gs.maze.avatarCell.  This stores the override; null = use gs.
let pendingAvatarCell: Point2 | null = null;

function onHoverChanged(axial: Point2 | null): void {
  if (!axial || movePath.value.length > 0 || segmentQueue.value.length > 0) {
    hoverPath.value = [];
    renderPath();
    return;
  }

  const gs = getGameState();
  const from = pendingAvatarCell ?? gs.maze.avatarCell;
  const result = bfsMazePath(gs, from, axial);
  hoverPath.value = result.reachable ? result.path : [];
  renderPath();
}

function onPrimaryClick(axial: Point2): void {
  // Don't accept clicks during animation or queued segments
  if (movePath.value.length > 0 || segmentQueue.value.length > 0) return;

  const gs = getGameState();
  const result = bfsMazePath(gs, gs.maze.avatarCell, axial);
  if (!result.reachable || result.cost === 0) return;

  // Clear hover path
  hoverPath.value = [];
  renderPath();

  // Check if this would exceed pool — if so, send command immediately (forced reset)
  const remaining = gs.timeFlux - gs.maze.movementUsed;
  if (result.cost > remaining) {
    globalInputQueue.push(new CmdMazeMoveTo({ target: axial }));
    scheduleBaseRender();
    updateAvatarPosition();
    return;
  }

  // Build set of untaken resource cells to detect intermediate stops
  const resourceCells = new Set<string>();
  for (const spawn of gs.mazeResourceSpawns) {
    if (!gs.maze.takenCells.some(t => t.x === spawn.cell.x && t.y === spawn.cell.y)) {
      resourceCells.add(`${spawn.cell.x},${spawn.cell.y}`);
    }
  }

  // Find intermediate resource stop indices (exclude the final cell — it's the destination)
  const stopIndices: number[] = [];
  for (let i = 0; i < result.path.length - 1; i++) {
    const cell = result.path[i]!;
    if (resourceCells.has(`${cell.x},${cell.y}`)) {
      stopIndices.push(i);
    }
  }

  if (stopIndices.length === 0) {
    // No intermediate resource stops — animate entire path as before
    startMoveAnimation(result.path);
    return;
  }

  // Split the path into segments, stopping at each resource node
  const segments: { path: Point2[]; target: Point2 }[] = [];
  let segStart = 0;
  for (const stopIdx of stopIndices) {
    const segPath = result.path.slice(segStart, stopIdx + 1);
    segments.push({ path: segPath, target: result.path[stopIdx]! });
    segStart = stopIdx + 1;
  }
  // Final segment from last resource to destination
  if (segStart < result.path.length) {
    const segPath = result.path.slice(segStart);
    segments.push({ path: segPath, target: result.path[result.path.length - 1]! });
  }

  // Queue all segments after the first; start animating the first
  segmentQueue.value = segments.slice(1);
  startMoveAnimation(segments[0]!.path);
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
  isPaintMode: () => false,
  onHoverChanged,
  onPrimaryClick,
  onPaintAt: () => {},
  onPanOrZoomTransient: () => {
    scheduleBaseRender();
    renderPath();
    updateAvatarPosition();
  },
  onPanOrZoomCommit: () => {
    scheduleBaseRender();
    renderPath();
    updateAvatarPosition();
  },
  onMouseLeave: () => {
    hoverPath.value = [];
    renderPath();
  },
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
  pointer-events: none;
}

.maze-layer:first-of-type {
  pointer-events: auto;
}

.maze-avatar-canvas {
  position: absolute;
  pointer-events: none;
  image-rendering: auto;
}
</style>
