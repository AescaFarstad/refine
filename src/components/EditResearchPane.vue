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
        <button type="button" class="btn" @click="copyAllToClipboard">
          Copy All
        </button>
        <button type="button" class="btn" @click="copyResearchStateCheatToClipboard">
          Copy State
        </button>
        <button type="button" class="btn" @click="runHardcodedResearchStateCheat">
          Apply State
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
        <button
          type="button"
          class="btn mode-btn"
          :class="{ active: activeMode === 'coordinates' }"
          @click="toggleMode('coordinates')"
        >
          Coordinates
        </button>
      </div>

      <div class="radius-row">
        <span class="mode-label">Radius:</span>
        <button type="button" class="btn radius-btn" @click="decrementRadius">−</button>
        <span class="radius-value">{{ placementRadius }}</span>
        <button type="button" class="btn radius-btn" @click="incrementRadius">+</button>
      </div>

      <div class="archetype-section">

        <!-- Non-gear archetypes (stats, resources, etc.) -->
        <div v-if="availableArchetypes.nonGear.length > 0" class="archetype-subsection">
          <div class="archetype-grid-4col">
            <button
              v-for="arch in availableArchetypes.nonGear"
              :key="arch.id"
              type="button"
              class="btn archetype-btn"
              :class="{ active: activeMode === arch.id }"
              @click="placeArchetype(arch.id)"
            >
              <div v-if="arch.icon.kind === 'itemImage'" class="gear-sprite-wrap">
                <div class="gear-sprite" :style="getGearSpriteStyle(arch.icon.key)" />
              </div>
              <span v-else class="archetype-icon">{{ arch.icon.key }}</span>
              <span class="archetype-label">{{ arch.label }}</span>
            </button>
          </div>
        </div>

        <!-- Gear archetypes (visually separated) -->
        <div v-if="availableArchetypes.gear.length > 0" class="archetype-subsection gear-subsection">
          <div class="archetype-grid-4col">
            <button
              v-for="arch in availableArchetypes.gear"
              :key="arch.id"
              type="button"
              class="btn archetype-btn gear-btn"
              :class="{ active: activeMode === arch.id, 'already-unlocked': arch.isAlreadyUnlocked }"
              @click="placeArchetype(arch.id)"
            >
              <div v-if="arch.imageKey" class="gear-sprite-wrap">
                <div class="gear-sprite" :style="getGearSpriteStyle(arch.imageKey)" />
              </div>
              <span class="archetype-label">{{ arch.label }}</span>
            </button>
          </div>
        </div>
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

      <div class="code-section">
        <div class="code-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Newly Placed Nodes</span>
          <div style="display: flex; gap: 4px;">
            <button
              type="button"
              class="btn btn-small"
              @click="copyNewlyPlacedToClipboard"
              :disabled="newlyPlacedNodes.length === 0"
            >
              Copy
            </button>
            <button
              type="button"
              class="btn btn-small"
              @click="clearNewlyPlaced"
              :disabled="newlyPlacedNodes.length === 0"
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          class="code-area"
          readonly
          :value="newlyPlacedCode"
          :placeholder="'Click on research nodes to place them...\nThey will appear here ready to paste into research_pane.ts'"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { uiState, getGameState, getGameLib } from '../logic/UIState';
import { indexToAxial } from '../logic/Research';
import { getStatIcon, getResourceGlyph, type ResearchStatIcon } from '../logic/drawResearch';
import atlasStorage from '../logic/AtlasStorage';
import { setResearchRevealRadius } from '../logic/Model';
import { CheatLoadResearchState } from '../logic/cheat/CheatCommands';

type Point = { x: number; y: number };

const position = ref<Point>({ x: 0, y: 0 });
const dragging = ref(false);
const dragStart = ref<Point | null>(null);
const dragOrigin = ref<Point | null>(null);

// Atlas state for gear images
const atlasSource = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const atlasReady = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!atlasReady.value) {
    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) { /* noop */ }
    atlasReady.value = atlasStorage.isItemsAtlasLoaded();
    atlasSource.value = atlasStorage.getItemsSource();
  }
});

// Newly placed research nodes tracking - synced with UIState
const newlyPlacedNodes = computed({
  get: () => (uiState as any).researchNewlyPlaced || [],
  set: (value) => {
    (uiState as any).researchNewlyPlaced = value;
  }
});

// Current radius for placement - synced with UIState
const placementRadius = computed({
  get: () => (uiState as any).researchPlacementRadius || 0,
  set: (value) => {
    (uiState as any).researchPlacementRadius = value;
  }
});

const panelStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px)`,
}));

function onCloseClick() {
  uiState.editResearchOpen = false;
  (uiState as any).researchEditMode = '';
}

// Get all available research archetypes separated by type
const availableArchetypes = computed(() => {
  const lib = getGameLib();
  if (!lib || !lib.research) return { nonGear: [], gear: [] };

  const gs = getGameState();

  // Find which archetypes are already placed on the research pane
  const placedArchetypes = new Set<string>();
  if (gs?.researchCells) {
    for (const cell of gs.researchCells) {
      if (cell?.archetypeId) {
        placedArchetypes.add(cell.archetypeId);
      }
    }
  }

  const nonGear: Array<{ id: string; label: string; icon: ResearchStatIcon; type: string }> = [];
  const gear: Array<{ id: string; label: string; gearId?: string; imageKey?: string; isAlreadyUnlocked: boolean }> = [];

  lib.research.archetypes.forEach((archetype, id) => {
    if (id === 'hub' || id === 'obs' || id === 'empty' || id === 'void') return;

    const isAlreadyPlaced = placedArchetypes.has(id);

    const rewards = archetype.rewards || [];

    if (archetype.type === 'gear') {
      const reward = rewards.find(r => r.kind === 'unlock_gear');
      const gearId = reward && reward.kind === 'unlock_gear' ? reward.gearId : undefined;
      const label = gearId || id;
      // Get gear definition for image key
      const gearDef = gearId ? lib.gear.get(gearId) : null;
      const imageKey = gearDef?.image;
      gear.push({ id, label, gearId, imageKey, isAlreadyUnlocked: isAlreadyPlaced });
    } else if (archetype.type === 'stat') {
      const reward = rewards.find(r => r.kind === 'stat');
      const stat = reward && reward.kind === 'stat' ? reward.stat : '';
      const label = stat || id;
      const icon = getStatIcon(stat);
      nonGear.push({ id, label, icon, type: 'stat' });
    } else if (archetype.type === 'resource') {
      const reward = rewards.find(r => r.kind === 'resource');
      const resource = reward && reward.kind === 'resource' ? reward.resource : '';
      const amount = reward && reward.kind === 'resource' ? reward.amount : 0;
      const label = `${resource} (${amount})`;
      const icon: ResearchStatIcon = { kind: 'glyph', key: getResourceGlyph(resource) };
      nonGear.push({ id, label, icon, type: 'resource' });
    } else {
      const label = id;
      const icon: ResearchStatIcon = { kind: 'glyph', key: '⚠' };
      nonGear.push({ id, label, icon, type: archetype.type });
    }
  });

  // Sort alphabetically by label
  nonGear.sort((a, b) => a.label.localeCompare(b.label));
  gear.sort((a, b) => a.label.localeCompare(b.label));

  return { nonGear, gear };
});

function incrementRadius() {
  placementRadius.value = Math.max(0, Math.min(10, placementRadius.value + 1));
}

function decrementRadius() {
  placementRadius.value = Math.max(0, placementRadius.value - 1);
}

function placeArchetype(archetypeId: string) {
  (uiState as any).researchEditMode = archetypeId;
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
  // Use the proper function that updates reveal radius and recalculates visibility
  setResearchRevealRadius(gs, 1000);
  // Update UIState to trigger watcher and redraw
  uiState.researchRevealRadius = 1000;
}

type EditMode = '' | 'empty' | 'void' | 'obstacle' | 'coordinates';

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

  const lines: string[] = [];
  for (let i = 0; i < coords.length; i += 6) {
    const chunk = coords.slice(i, i + 6);
    const line = '  ' + chunk.map(p => `{ x: ${p.x}, y: ${p.y} }`).join(', ') + ',';
    lines.push(line);
  }
  return lines.join('\n');
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

  const lines: string[] = [];
  for (let i = 0; i < coords.length; i += 6) {
    const chunk = coords.slice(i, i + 6);
    const line = '  ' + chunk.map(p => `{ x: ${p.x}, y: ${p.y} }`).join(', ') + ',';
    lines.push(line);
  }
  return lines.join('\n');
});

const newlyPlacedCode = computed(() => {
  // Depend on edit version so this recomputes after edits
  const _version = (uiState as any).researchEditVersion;

  const nodes = (uiState as any).researchNewlyPlaced || [];
  if (nodes.length === 0) return '';

  const lines: string[] = [];
  for (const node of nodes) {
    let line = `  { archetypeId: '${node.archetypeId}', cells: { x: ${node.cells.x}, y: ${node.cells.y} }`;
    if (node.radius > 0) {
      line += `, radius: ${node.radius}`;
    }
    line += ' },';
    lines.push(line);
  }
  return lines.join('\n');
});

async function copyAllToClipboard() {
  const emptyCode = emptyCellsCode.value;
  const voidCode = voidCellsCode.value;

  const fullCode = `export const researchPaneEmptyCells: Point2[] = [
${emptyCode}
];

export const researchPaneVoidCells: Point2[] = [
${voidCode}
];`;

  try {
    await navigator.clipboard.writeText(fullCode);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

async function copyNewlyPlacedToClipboard() {
  const code = newlyPlacedCode.value;
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

function getOwnedResearchCells(): Array<{ x: number; y: number }> {
  const gs = getGameState();
  const coords: Array<{ x: number; y: number }> = [];
  for (let idx = 0; idx < gs.researchCells.length; idx++) {
    const cell = gs.researchCells[idx];
    if (!cell.owned || cell.blocked) continue;
    coords.push(indexToAxial(idx));
  }
  coords.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  return coords;
}

function formatCheatLoadResearchState(ownedCells: Array<{ x: number; y: number }>): string {
  if (ownedCells.length === 0) {
    return "new CheatLoadResearchState({ ownedCells: [] })";
  }

  const lines: string[] = [];
  lines.push('new CheatLoadResearchState({');
  lines.push('  ownedCells: [');
  for (let i = 0; i < ownedCells.length; i += 6) {
    const chunk = ownedCells.slice(i, i + 6);
    lines.push('    ' + chunk.map(p => `{ x: ${p.x}, y: ${p.y} }`).join(', ') + ',');
  }
  lines.push('  ],');
  lines.push('})');
  return lines.join('\n');
}

async function copyResearchStateCheatToClipboard() {
  const ownedCells = getOwnedResearchCells();
  const code = formatCheatLoadResearchState(ownedCells);
  try {
    await navigator.clipboard.writeText(code);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

const HARD_CODED_OWNED_CELLS: Array<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

function runHardcodedResearchStateCheat() {
  const gs = getGameState();
  gs.cheats.push(new CheatLoadResearchState({ ownedCells: HARD_CODED_OWNED_CELLS }));
}

function clearNewlyPlaced() {
  (uiState as any).researchNewlyPlaced = [];
  (uiState as any).researchEditVersion = ((uiState as any).researchEditVersion || 0) + 1;
}

function getGearSpriteStyle(imageKey: string | undefined): Record<string, string> {
  if (!atlasSource.value || !atlasReady.value || !imageKey) return {};
  const frame = atlasStorage.getItemsFrame(imageKey);
  if (!frame) return {};

  const f = frame;
  const atlasW = atlasSource.value.naturalWidth;
  const atlasH = atlasSource.value.naturalHeight;
  // Scale to fit within 32x32 container while maintaining aspect ratio
  const containerSize = 32;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1);
  const displayW = f.w * scale;
  const displayH = f.h * scale;

  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${atlasSource.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
}
</script>

<style scoped>
.edit-research-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 600px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: radial-gradient(circle at top, rgba(15, 23, 42, 0.96), #020617);
  border-radius: 8px;
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
  font-size: 16px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panel-body {
  padding: 8px;
  font-size: 14px;
  line-height: 1.4;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.controls-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.mode-label {
  opacity: 0.75;
  font-weight: 600;
}

.btn {
  padding: 4px 10px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 5px;
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
  font-size: 14px;
  line-height: 1;
}

.btn:hover {
  background: rgba(30, 64, 175, 0.6);
}

.code-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.code-header {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.8;
  font-weight: 600;
}

.code-area {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  font-family: monospace;
  font-size: 12px;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  border-radius: 5px;
  border: 1px solid var(--panel-border);
  padding: 6px 8px;
  box-sizing: border-box;
}

.radius-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.radius-btn {
  padding: 2px 8px;
  font-size: 18px;
  font-weight: 700;
  min-width: 32px;
}

.radius-value {
  min-width: 28px;
  text-align: center;
  font-weight: 700;
  font-size: 16px;
  color: var(--accent);
}

.archetype-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.archetype-subsection {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gear-subsection {
  padding-top: 6px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}

.subsection-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.65;
  font-weight: 700;
}

.archetype-grid-4col {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.archetype-btn {
  padding: 6px 8px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  min-height: 38px;
  border: 0px;
  background-color: rgb(22, 31, 42);
}

.archetype-btn.gear-btn {
  justify-content: flex-start;
}

.gear-sprite-wrap {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.gear-sprite {
  flex-shrink: 0;
  image-rendering: auto;
}

.archetype-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
  min-width: 26px;
  text-align: center;
}

.archetype-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 600;
}

.archetype-btn.active {
  background: rgba(56, 189, 248, 0.25);
  border-color: rgba(56, 189, 248, 0.8);
  color: var(--accent);
}

.archetype-btn.already-unlocked {
  opacity: 0.4;
  background: rgba(100, 100, 100, 0.15);
  color: rgba(148, 163, 184, 0.704);
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn:disabled:hover {
  background: rgba(15, 23, 42, 0.95);
}
</style>
