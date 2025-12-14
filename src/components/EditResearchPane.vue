<template>
  <div
    class="edit-research-panel"
    :style="panelStyle"
    @mousedown.stop
  >
    <div class="panel-header" @mousedown.stop.prevent="onDragStart">
      <h3>Edit Research</h3>
      <button type="button" class="btn close" @click.stop="onCloseClick">✕</button>
    </div>
    <div class="panel-body">
      <div class="controls-row">
        <button type="button" class="btn" @click="revealAllResearch">
          Set reveal radius to 1000
        </button>
      </div>

      <div class="mode-row">
        <span class="mode-label">Edit mode:</span>
        <button
          type="button"
          class="btn mode-btn"
          :class="{ active: activeMode === 'empty' }"
          @click="toggleMode('empty')"
        >
          Empty
        </button>
        <button
          type="button"
          class="btn mode-btn"
          :class="{ active: activeMode === 'void' }"
          @click="toggleMode('void')"
        >
          Void
        </button>
        <button
          type="button"
          class="btn mode-btn"
          :class="{ active: activeMode === 'obstacle' }"
          @click="toggleMode('obstacle')"
        >
          Obstacle
        </button>
      </div>

      <div class="code-section">
        <div class="code-header">Empty cells (researchPaneEmptyCells)</div>
        <textarea
          class="code-area"
          readonly
          :value="emptyCellsCode"
        />
      </div>

      <div class="code-section">
        <div class="code-header">Void cells (researchPaneVoidCells)</div>
        <textarea
          class="code-area"
          readonly
          :value="voidCellsCode"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { indexToAxial } from '../logic/Research';

type Point = { x: number; y: number };

const position = ref<Point>({ x: 24, y: 24 });
const dragging = ref(false);
const dragStart = ref<Point | null>(null);
const dragOrigin = ref<Point | null>(null);

const panelStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px)`,
}));

function onCloseClick() {
  uiState.editResearchOpen = false;
  (uiState as any).researchEditMode = '';
}

function onDragStart(event: MouseEvent) {
  dragging.value = true;
  dragStart.value = { x: event.clientX, y: event.clientY };
  dragOrigin.value = { x: position.value.x, y: position.value.y };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function onDragMove(event: MouseEvent) {
  if (!dragging.value || !dragStart.value || !dragOrigin.value) return;
  const dx = event.clientX - dragStart.value.x;
  const dy = event.clientY - dragStart.value.y;
  position.value = {
    x: dragOrigin.value.x + dx,
    y: dragOrigin.value.y + dy,
  };
}

function onDragEnd(event?: MouseEvent) {
  if (event && event.button !== 0) return;
  dragging.value = false;
  dragStart.value = null;
  dragOrigin.value = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
});

function revealAllResearch() {
  const gs = getGameState();
  if (!gs) return;
  if (typeof (gs as any).setResearchRevealRadius === 'function') {
    (gs as any).setResearchRevealRadius(1000);
  } else {
    (gs as any).researchRevealRadius = 1000;
  }
}

type EditMode = '' | 'empty' | 'void' | 'obstacle';

const activeMode = computed<EditMode>(() => (uiState as any).researchEditMode as EditMode);

function toggleMode(mode: Exclude<EditMode, ''>) {
  const current = (uiState as any).researchEditMode as EditMode;
  uiState.researchEditMode = current === mode ? '' : mode;
}

const emptyCellsCode = computed(() => {
  // Depend on edit version so this recomputes after edits
  const _version = (uiState as any).researchEditVersion;

  const gs = getGameState();
  if (!gs || !gs.researchCells) return '';

  const coords: Array<{ x: number; y: number }> = [];
  const cells = gs.researchCells;

  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx];
    if (!cell) continue;
    if (cell.archetypeId !== 'empty') continue;
    const axial = indexToAxial(idx);
    coords.push({ x: axial.x, y: axial.y });
  }

  coords.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  return coords.map(p => `  { x: ${p.x}, y: ${p.y} },`).join('\n');
});

const voidCellsCode = computed(() => {
  const _version = (uiState as any).researchEditVersion;

  const gs = getGameState();
  if (!gs || !gs.researchCells) return '';

  const coords: Array<{ x: number; y: number }> = [];
  const cells = gs.researchCells;

  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx];
    if (!cell) continue;
    if (cell.archetypeId !== 'void') continue;
    const axial = indexToAxial(idx);
    coords.push({ x: axial.x, y: axial.y });
  }

  coords.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  return coords.map(p => `  { x: ${p.x}, y: ${p.y} },`).join('\n');
});
</script>

<style scoped>
.edit-research-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 340px;
  max-height: 80%;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top, rgba(15, 23, 42, 0.96), #020617);
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.85);
  color: var(--text-primary);
  z-index: 30;
  pointer-events: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: move;
  border-bottom: 1px solid rgba(148, 163, 184, 0.35);
  background: linear-gradient(
    90deg,
    rgba(15, 23, 42, 0.98),
    rgba(30, 64, 175, 0.75)
  );
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panel-body {
  padding: 10px;
  font-size: 12px;
  line-height: 1.4;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.controls-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.mode-label {
  opacity: 0.75;
}

.btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  background: rgba(15, 23, 42, 0.95);
  color: var(--text-primary);
  cursor: pointer;
}

.mode-btn.active {
  background: rgba(56, 189, 248, 0.25);
  border-color: rgba(56, 189, 248, 0.8);
  color: var(--accent);
}

.btn.close {
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1;
}

.btn:hover {
  background: rgba(30, 64, 175, 0.6);
}

.code-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.code-header {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.8;
}

.code-area {
  width: 100%;
  min-height: 80px;
  resize: vertical;
  font-family: monospace;
  font-size: 11px;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  padding: 6px 8px;
  box-sizing: border-box;
}
</style>
