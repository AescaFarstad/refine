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
import { waferBuffCells } from '../logic/waferLayout';
import itemsData from '../data/items';
import { ManualDragEvents, setManualDragFollowerVisible, startManualDrag } from '../logic/ManualDrag';
import {
  drawHexAt,
  drawGrid,
  clearCanvas,
  drawHighlight,
  drawHexagon,
  drawPlus,
} from '../logic/DrawHex';

const props = defineProps<{
  wafer: Wafer;
  version?: number;
  ghostMolecule?: Molecule | null;
  ghostPosition?: Point2 | null;
  ghostValid?: boolean;
  ghostShowOutline?: boolean;
  highlightItemIdx?: number | null;
  hideMolecules?: boolean;
  upgradePreviewCells?: Point2[] | null;
  newSignatureMatches?: Array<{ id: string; offset: Point2 }> | null;
  // Per-cell effective counts for buffed atoms; key = "x,y"
  cellEffectiveCounts?: Record<string, number> | null;
  useEffectiveEssence?: boolean;
  showBuffOverlays?: boolean;
  showUpgradeHints?: boolean;
  // Dev-only: when true, mouse drag over atoms draws connections instead of moving molecules.
  connectMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'hover', pos: Point2 | null): void;
  (e: 'click', pos: Point2): void;
  (e: 'pickup', itemIdx: number): void;
  (e: 'rotate'): void;
  (e: 'connection', payload: { from: Point2; to: Point2 }): void;
}>();

const container = ref<HTMLDivElement | null>(null);
const gridCanvas = ref<HTMLCanvasElement | null>(null);
const moleculesCanvas = ref<HTMLCanvasElement | null>(null);
const overlayCanvas = ref<HTMLCanvasElement | null>(null);

const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };

const hoverItemIdx = ref<number | null>(null);
const connectionStart = ref<Point2 | null>(null);
const manualDragging = ref(false);


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

watch(() => [props.wafer, props.version, props.hideMolecules, props.useEffectiveEssence], () => {
  renderGrid();
  renderMolecules();
  renderOverlay();
}, { deep: true });

watch(() => [props.ghostMolecule, props.ghostPosition, props.ghostValid, props.hideMolecules, props.upgradePreviewCells, props.newSignatureMatches], () => {
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

  if (props.hideMolecules) return;

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

  if (props.hideMolecules) return;

  for (const item of props.wafer.items) {
    if (!item) continue;
    const useEffective = props.useEffectiveEssence !== false;
    if (useEffective) {
      drawMolecule(ctx, item.molecule, HEX_SIZE, origin, {
        bondStroke: 'rgba(200, 200, 200, 0.6)',
        bondWidth: 3,
        essenceSize: ESSENCE_SIZE,
        getColor: (atom) => {
          const cell = getCell(props.wafer, { x: atom.x, y: atom.y });
          return (cell && cell.effectiveEssence) || atom.color;
        },
      });
    } else {
      drawMolecule(ctx, item.molecule, HEX_SIZE, origin, {
        bondStroke: 'rgba(200, 200, 200, 0.6)',
        bondWidth: 3,
        essenceSize: ESSENCE_SIZE,
      });
    }
  }
}

function renderOverlay() {
  const canvas = overlayCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  clearCanvas(ctx);

  const showBuffOverlays = props.showBuffOverlays !== false;
  const showUpgradeHints = props.showUpgradeHints !== false;

  if (!props.hideMolecules && (props.newSignatureMatches?.length || 0) > 0) {
    const sigSource = atlasStorage.getMoleculesSource()!;
    ctx.save();
    ctx.globalAlpha = 0.9;

    for (const match of props.newSignatureMatches!) {
      const f = atlasStorage.getMoleculesFrame(`sig:wafer:${match.id}`)!;
      const anchor = atlasStorage.getSignatureWaferAnchor(match.id)!;
      const off = axialToPixel(match.offset, HEX_SIZE, { x: 0, y: 0 });
      ctx.drawImage(
        sigSource,
        f.x,
        f.y,
        f.w,
        f.h,
        origin.x + off.x - anchor.x,
        origin.y + off.y - anchor.y,
        f.w,
        f.h,
      );
    }

    ctx.restore();
  }

  if (!props.hideMolecules && props.wafer && props.cellEffectiveCounts && showBuffOverlays) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px sans-serif';
    for (const [key, count] of Object.entries(props.cellEffectiveCounts)) {
      if (!count || count <= 1) continue;
      const [sx, sy] = key.split(',');
      const x = Number(sx);
      const y = Number(sy);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const center = axialToPixel({ x, y }, HEX_SIZE, origin);

      if (count === 2) {
        const r = HEX_SIZE * 0.18;
        ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (count > 2) {
        const text = String(count);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(248, 250, 252, 0.97)';
        ctx.strokeText(text, center.x, center.y);
        ctx.fillText(text, center.x, center.y);
      }
    }
    ctx.restore();
  }

  if (!props.hideMolecules && props.wafer && showBuffOverlays) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px sans-serif';
    for (const buff of waferBuffCells) {
      const cell = getCell(props.wafer, { x: buff.x, y: buff.y });
      // Only show buff labels on enabled, empty cells.
      if (!cell || !cell.enabled || cell.itemIdx != null) continue;

      let label = '';
      if (buff.mul && buff.mul !== 1) {
        label = `x${buff.mul}`;
      } else if (buff.add && buff.add !== 0) {
        label = `+${buff.add}`;
      }
      if (!label) continue;

      const center = axialToPixel({ x: buff.x, y: buff.y }, HEX_SIZE, origin);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
      ctx.strokeText(label, center.x, center.y);
      ctx.fillText(label, center.x, center.y);
    }
    ctx.restore();
  }

  if (!props.hideMolecules && props.wafer && showUpgradeHints) {
    const preview = props.upgradePreviewCells || [];
    const previewSet = new Set<string>();
    for (const p of preview) {
      previewSet.add(`${p.x},${p.y}`);
    }
    const hasPreview = previewSet.size > 0;

    for (const cell of props.wafer.cells.values()) {
      if (cell.enabled || !cell.canBeUpgraded) continue;

      const key = `${cell.x},${cell.y}`;
      const inPreview = hasPreview && previewSet.has(key);

      const radius = inPreview ? HEX_SIZE : HEX_SIZE * 0.8;
      const fillColor = inPreview
        ? 'rgba(79, 209, 197, 0.28)'
        : 'rgba(79, 209, 197, 0.10)';

      const center = axialToPixel({ x: cell.x, y: cell.y }, HEX_SIZE, origin);

      drawHexagon(ctx, center, radius, {
        fillColor,
        strokeColor: 'rgba(0, 0, 0, 0)',
        lineWidth: 0,
      });

      drawPlus(ctx, center, HEX_SIZE, {
        color: inPreview ? 'rgba(248, 250, 252, 0.95)' : 'rgba(248, 250, 252, 0.45)',
        lineWidth: inPreview ? 2.4 : 1.6,
        sizeFactor: 0.35,
      });
    }
  }

  if (props.ghostMolecule && props.ghostPosition) {
    const color = props.ghostValid ? 'rgba(79, 209, 197, 0.28)' : 'rgba(239, 68, 68, 0.28)';
    const strokeColor = props.ghostValid ? '#4fd1c5' : '#ef4444';

    if (props.ghostShowOutline !== false) {
      // Draw snapped hex highlights under atoms
      for (const atom of props.ghostMolecule.atoms) {
        const pos = { x: atom.x, y: atom.y };
        drawHexAt(ctx, pos, HEX_SIZE, origin, {
          fillColor: color,
          strokeColor,
          lineWidth: 2.5,
        });
      }
    }

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

  if (event.button === 2) return;
  if (event.button !== 0) return;

  if (props.connectMode) {
    const { x: pixelX, y: pixelY } = eventToCanvasPixel(event, canvas);
    const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
    const cell = getCell(props.wafer, axial);
    if (cell && cell.itemIdx != null) {
      connectionStart.value = { x: cell.x, y: cell.y };
    } else {
      connectionStart.value = null;
    }
    return;
  }

  if (hoverItemIdx.value !== null) {
    const item = props.wafer.items[hoverItemIdx.value];
    if (item) {
      manualDragging.value = true;
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
  emit('hover', null);
  if (hoverItemIdx.value != null) {
    hoverItemIdx.value = null;
    renderOverlay();
  }
}

function onMouseUp(event: MouseEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  // Only left click triggers placement
  if (event.button !== 0) return;
  if (manualDragging.value) return;

  const { x: pixelX, y: pixelY } = eventToCanvasPixel(event, canvas);
  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  if (props.connectMode && connectionStart.value) {
    const start = connectionStart.value;
    connectionStart.value = null;
    const endCell = getCell(props.wafer, axial);
    if (endCell && endCell.itemIdx != null) {
      if (start.x !== endCell.x || start.y !== endCell.y) {
        emit('connection', { from: { x: start.x, y: start.y }, to: { x: endCell.x, y: endCell.y } });
      }
    }
    return;
  }

  emit('click', axial);
}

function onPointerDown(event: PointerEvent) {
  if (event.button === 2) return;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === ' ') {
    event.preventDefault();
    emit('rotate');
  }
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  emit('rotate');
}

function onDragEnter(event: DragEvent) {
  setHiddenDragImage(event.dataTransfer);
}

function onDragOver(event: DragEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas) return;

  const { x: pixelX, y: pixelY } = eventToCanvasPixel(event, canvas);

  const axial = pixelToAxial({ x: pixelX, y: pixelY }, HEX_SIZE, origin);
  setHiddenDragImage(event.dataTransfer);
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
  let mol = props.ghostMolecule as Molecule | null | undefined;
  if (!mol && event.dataTransfer) {
    const id = event.dataTransfer.getData('text/plain');
    const def = (itemsData as any)[id];
    mol = def?.molecule as Molecule | undefined;
  }
  if (mol) {
    setMoleculeDragImage(event.dataTransfer, mol);
  }
  emit('hover', null);
}

// Manual drag end handler: translate client coords to axial and emit click
function onManualDragEnd(e: CustomEvent) {
  const canvas = overlayCanvas.value;
  if (!canvas || !e?.detail) return;
  const { clientX, clientY, canceled } = e.detail as any;
  manualDragging.value = false;
  if (canceled) return;
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
