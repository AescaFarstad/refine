<template>
  <div class="wafer-view" ref="container">
    <canvas ref="gridCanvas" class="layer"></canvas>
    <canvas ref="moleculesCanvas" class="layer"></canvas>
    <canvas 
      ref="overlayCanvas" 
      class="layer" 
      @mousemove="onMouseMove" 
      @mousedown="onMouseDown"
      @pointerdown="onPointerDown"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @click="onClick"
      @contextmenu="onContextMenu"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { Wafer } from '../logic/Wafer';
import type { Molecule, Point2 } from '../logic/ItemLib';
import { getEnabledCells, getCell } from '../logic/Wafer';
import { axialToPixel, pixelToAxial } from '../logic/HexMath';
import atlasStorage from '../logic/AtlasStorage';
import { drawMolecule, drawGhostMolecule } from '../logic/DrawMolecule';
import { HEX_SIZE, ESSENCE_SIZE, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT, eventToCanvasPixel, setHiddenDragImage, setMoleculeDragImage } from '../logic/RefineUIBehaviour';
import itemsData from '../data/items';
import { ManualDragEvents, setManualDragFollowerVisible, startManualDrag } from '../logic/ManualDrag';
import {
  drawHexAt,
  drawGrid,
  clearCanvas,
  getEssenceColor,
  drawHighlight,
} from '../logic/DrawHex';

const props = defineProps<{
  wafer: Wafer;
  version?: number;
  ghostMolecule?: Molecule | null;
  ghostPosition?: Point2 | null;
  ghostValid?: boolean;
  // Index in wafer.items to highlight (from parent UI), or null
  highlightItemIdx?: number | null;
}>();

const emit = defineEmits<{
  (e: 'hover', pos: Point2 | null): void;
  (e: 'click', pos: Point2): void;
  (e: 'pickup', itemIdx: number): void;
  (e: 'rotate'): void;
}>();

const container = ref<HTMLDivElement | null>(null);
const gridCanvas = ref<HTMLCanvasElement | null>(null);
const moleculesCanvas = ref<HTMLCanvasElement | null>(null);
const overlayCanvas = ref<HTMLCanvasElement | null>(null);

const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };

// Local hover state: which placed molecule (by wafer.items index) is under the cursor
const hoverItemIdx = ref<number | null>(null);

// Drag detection state
// (Removed complex drag tracking)

onMounted(async () => {
  await atlasStorage.loadItemsAtlas();
  setupCanvases();
  renderGrid();
  renderMolecules();
  window.addEventListener(ManualDragEvents.End, onManualDragEnd as any);
  window.addEventListener(ManualDragEvents.Move, onManualDragMove as any);
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener(ManualDragEvents.End, onManualDragEnd as any);
  window.removeEventListener(ManualDragEvents.Move, onManualDragMove as any);
  window.removeEventListener('keydown', onKeyDown);
});

watch(() => [props.wafer, props.version], () => {
  renderGrid();
  renderMolecules();
}, { deep: true });

watch(() => [props.ghostMolecule, props.ghostPosition, props.ghostValid], () => {
  renderOverlay();
}, { deep: true });

watch(() => props.highlightItemIdx, () => {
  // Parent requested highlight for a specific placed item (e.g., hovering list row)
  renderOverlay();
});

function setupCanvases() {
  const canvases = [gridCanvas.value, moleculesCanvas.value, overlayCanvas.value];
  canvases.forEach(canvas => {
    if (!canvas) return;
    canvas.width = WAFER_CANVAS_WIDTH;
    canvas.height = WAFER_CANVAS_HEIGHT;
  });
  renderGrid();
  renderMolecules();
  renderOverlay();
}

function renderGrid() {
  const canvas = gridCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  clearCanvas(ctx);

  const enabledCells = getEnabledCells(props.wafer);
  for (const cell of enabledCells) {
    drawHexAt(ctx, { x: cell.x, y: cell.y }, HEX_SIZE, origin, {
      fillColor: 'rgba(23, 33, 47, 0.8)',
      strokeColor: 'rgba(100, 120, 140, 0.4)',
      lineWidth: 1.5,
    });
  }
}

function renderMolecules() {
  const canvas = moleculesCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  clearCanvas(ctx);
  for (const item of props.wafer.items) {
    if (!item) continue;
    drawMolecule(ctx, item.molecule, HEX_SIZE, origin, { bondStroke: 'rgba(200, 200, 200, 0.6)', bondWidth: 3, essenceSize: ESSENCE_SIZE });
  }
}

function renderOverlay() {
  const canvas = overlayCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  clearCanvas(ctx);

  if (props.ghostMolecule && props.ghostPosition) {
    const color = props.ghostValid ? 'rgba(79, 209, 197, 0.28)' : 'rgba(239, 68, 68, 0.28)';
    const strokeColor = props.ghostValid ? '#4fd1c5' : '#ef4444';

    // Draw snapped hex highlights under atoms
    for (const atom of props.ghostMolecule.atoms) {
      const pos = { x: atom.x, y: atom.y };
      drawHexAt(ctx, pos, HEX_SIZE, origin, {
        fillColor: color,
        strokeColor,
        lineWidth: 2.5,
      });
    }

    // Draw molecule preview (bonds + essence sprites)
    drawGhostMolecule(ctx, props.ghostMolecule, !!props.ghostValid, HEX_SIZE, origin, ESSENCE_SIZE);
  }

  // Draw highlight after ghost overlay to ensure visibility
  const indicesToHighlight: number[] = [];
  if (hoverItemIdx.value != null && hoverItemIdx.value >= 0) {
    indicesToHighlight.push(hoverItemIdx.value);
  }
  if (props.highlightItemIdx != null && props.highlightItemIdx >= 0) {
    if (!indicesToHighlight.includes(props.highlightItemIdx)) {
      indicesToHighlight.push(props.highlightItemIdx);
    }
  }
  for (const idx of indicesToHighlight) {
    const item = props.wafer.items[idx];
    if (!item) continue;
    for (const atom of item.molecule.atoms) {
      // Use same style family as drag preview: soft cyan fill + stroke
      drawHexAt(ctx, { x: atom.x, y: atom.y }, HEX_SIZE, origin, {
        fillColor: 'rgba(79, 209, 197, 0.18)',
        strokeColor: '#4fd1c5',
        lineWidth: 2.5,
      });
    }
  }
}

function onMouseDown(event: MouseEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  // Handle right-click for rotation
  if (event.button === 2) {
    event.preventDefault();
    emit('rotate');
    return;
  }

  // Only left click for pickup
  if (event.button !== 0) return;

  // If we are hovering an item, pick it up immediately
  if (hoverItemIdx.value !== null) {
    const item = props.wafer.items[hoverItemIdx.value];
    if (item) {
      // Start manual drag so we have a follower if we leave the wafer
      startManualDrag({ id: item.id, molecule: item.molecule }, event);
      emit('pickup', hoverItemIdx.value);
    }
  }
}

function onMouseMove(event: MouseEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  const { x: pixelX, y: pixelY } = eventToCanvasPixel(event, canvas);

  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  // Always emit snapped axial so overlay can indicate invalid positions too
  emit('hover', axial);

  // Update hover highlight for molecule under cursor (if any)
  const cell = getCell(props.wafer, axial);
  const nextIdx = (cell && cell.itemIdx != null) ? cell.itemIdx : null;
  if (nextIdx !== hoverItemIdx.value) {
    hoverItemIdx.value = nextIdx;
    renderOverlay();
  }
}

function onMouseLeave(_event: MouseEvent) {
  // Clear hover state when leaving wafer area (manual drag)
  emit('hover', null);
  if (hoverItemIdx.value != null) {
    hoverItemIdx.value = null;
    renderOverlay();
  }
  // Also clear drag start if leaving canvas? 
  // Actually, if we drag out, we might want to keep tracking? 
  // But for now let's clear it to be safe or rely on global mouse up.
  // If we drag out, we probably want to pickup immediately?
  // For now, let's just leave it. Global mouseup handles the reset.
}

function onMouseUp(event: MouseEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  // Only left click triggers placement
  if (event.button !== 0) return;

  const { x: pixelX, y: pixelY } = eventToCanvasPixel(event, canvas);
  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  emit('click', axial);
}

function onClick(event: MouseEvent) {
  // Handled by mouseup now
}

function onPointerDown(event: PointerEvent) {
  // Handle right-click for rotation
  if (event.button === 2) {
    event.preventDefault();
    event.stopPropagation();
    emit('rotate');
    return;
  }
}

function onKeyDown(event: KeyboardEvent) {
  // Rotate on Space bar only
  if (event.key === ' ') {
    event.preventDefault();
    emit('rotate');
  }
}

function onContextMenu(event: MouseEvent) {
  // Handle rotation directly in contextmenu event
  event.preventDefault();
  event.stopPropagation();
  emit('rotate');
}

function onDragEnter(event: DragEvent) {
  // Hide system drag image when entering wafer; use overlay instead
  setHiddenDragImage(event.dataTransfer);
}

function onDragOver(event: DragEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  const { x: pixelX, y: pixelY } = eventToCanvasPixel(event, canvas);

  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  // Hide system drag image while over wafer to rely on overlay
  setHiddenDragImage(event.dataTransfer);
  // Always emit snapped axial so overlay can indicate invalid (red) positions too
  emit('hover', axial);
}

function onDrop(event: DragEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const pixelX = event.clientX - rect.left;
  const pixelY = event.clientY - rect.top;

  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  emit('click', axial);
}

function onDragLeave(event: DragEvent) {
  // Restore a visible drag image for outside-wafer dragging
  let mol = props.ghostMolecule as Molecule | null | undefined;
  if (!mol && event.dataTransfer) {
    const id = event.dataTransfer.getData('text/plain');
    const def = (itemsData as any)[id];
    mol = def?.molecule as Molecule | undefined;
  }
  if (mol) {
    setMoleculeDragImage(event.dataTransfer, mol);
  }
  // Clear hover state when leaving the wafer canvas during a drag
  emit('hover', null);
}

// Manual drag end handler: translate client coords to axial and emit click
function onManualDragEnd(e: CustomEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas || !e?.detail) return;
  const { clientX, clientY, canceled } = e.detail as any;
  if (canceled) return;
  // On drop, ensure follower is shown again for subsequent drags
  setManualDragFollowerVisible(true);
  const rect = canvas.getBoundingClientRect();
  const within = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  if (!within) return;
  const pixelX = clientX - rect.left;
  const pixelY = clientY - rect.top;
  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  emit('click', axial);
}

// Manual drag move handler: drive hover while manually dragging
function onManualDragMove(e: CustomEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas || !e?.detail) return;
  const { clientX, clientY } = e.detail as any;
  const rect = canvas.getBoundingClientRect();
  const within = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  // Hide follower when over wafer; show outside
  setManualDragFollowerVisible(!within);
  if (!within) { emit('hover', null); return; }
  const pixelX = clientX - rect.left;
  const pixelY = clientY - rect.top;
  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  emit('hover', axial);
}
</script>

<style scoped>
.wafer-view {
  position: relative;
  width: 800px;
  height: 400px;
  background: var(--bg-0);
  border: 2px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4),
              0 4px 12px rgba(0, 0, 0, 0.3);
}

.layer {
  position: absolute;
  top: 0;
  left: 0;
}
</style>
