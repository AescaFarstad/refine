<template>
  <div
    class="edit-research-panel"
    :style="panelStyle"
    @mousedown.stop
  >
    <div
      v-if="hoveredArchetype && hoverPosition"
      class="hover-hint-container"
      :style="{ top: hoverPosition.y + 'px', left: hoverPosition.x + 'px' }"
    >
      <ResearchNodeHint
        :cell="mockHintCell"
        :node="null"
        :archetype="hoveredArchetype"
      />
    </div>

    <div class="panel-header" @mousedown.stop.prevent="onDragStart">
      <h3>Edit Research</h3>
      <button type="button" class="btn close" @click.stop="onCloseClick">✕</button>
    </div>
    <div class="panel-body">
      <div class="controls-row">
        <div class="controls-buttons">
          <button type="button" class="btn" @click="revealAllResearch">
            1000
          </button>
          <button type="button" class="btn" @click="copyAllToClipboard">
            Copy All
          </button>
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
        <PlacementTemplateWafer v-model="placementTemplateCells" />
      </div>

      <div class="radius-row">
        <span class="mode-label">Radius:</span>
        <button type="button" class="btn radius-btn" @click="decrementRadius">−</button>
        <span class="radius-value">{{ placementRadius }}</span>
        <button type="button" class="btn radius-btn" @click="incrementRadius">+</button>
        <div class="radius-row-right">
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
          <button type="button" class="btn btn-small save-btn" @click="saveToFiles">
            Save
          </button>
          <span v-if="saveStatus" class="save-status">{{ saveStatus }}</span>
        </div>
      </div>

      <div class="code-section">
        <textarea
          class="code-area"
          readonly
          :value="newlyPlacedCode"
          :placeholder="'Click on research nodes to place them...'"
        />
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
              @mouseenter="onHoverStart(arch.archetype, $event)"
              @mouseleave="onHoverEnd"
            >
              <div v-if="arch.icon.kind === 'itemImage'" class="gear-sprite-wrap">
                <div class="gear-sprite" :style="getGearSpriteStyle(arch.icon.key)" />
              </div>
              <span
                v-else
                class="archetype-icon"
                :style="getArchetypeIconStyle(arch.archetype, arch.icon)"
              >{{ arch.icon.key }}</span>
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
              @mouseenter="onHoverStart(arch.archetype, $event)"
              @mouseleave="onHoverEnd"
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

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { uiState, getGameState, getGameLib, getGameStateMutable } from '../logic/UIState';
import { indexToAxial } from '../logic/Research';
import { axialRange } from '../logic/HexMath';
import { getStatIcon, getResourceGlyph, type ResearchStatIcon } from '../logic/drawResearch';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { setResearchRevealRadius } from '../logic/Model';
import type { ReadonlyResearchArchetype } from '../logic/UIState';
import type { Point2 } from '../logic/ItemLib';
import type { ResearchCell } from '../logic/GameState';
import { RESEARCH_PLACEMENT_TEMPLATE_DEFAULT } from '../logic/researchPlacementTemplate';
import ResearchNodeHint from './researchHints/ResearchNodeHint.vue';
import PlacementTemplateWafer from './PlacementTemplateWafer.vue';

type Point = { x: number; y: number };
const position = ref<Point>({ x: 0, y: 0 });
const dragging = ref(false);
const dragStart = ref<Point | null>(null);
const dragOrigin = ref<Point | null>(null);

const atlasSource = atlasStorage.getItemsSource();

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

const placementTemplateCells = computed<Point2[]>({
  get: () => {
    const stored = (uiState as any).researchPlacementTemplate as Point2[] | undefined;
    if (stored) return stored;
    return RESEARCH_PLACEMENT_TEMPLATE_DEFAULT.map((cell) => ({ x: cell.x, y: cell.y }));
  },
  set: (value) => {
    (uiState as any).researchPlacementTemplate = value;
  }
});

function onCloseClick() {
  uiState.editResearchOpen = false;
  (uiState as any).researchEditMode = '';
}

// Get all available research archetypes separated by type
const availableArchetypes = computed(() => {
  // Depend on edit version so this recomputes after edits
  const _version = (uiState as any).researchEditVersion;

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

  const nonGear: Array<{ id: string; label: string; icon: ResearchStatIcon; type: string; archetype: ReadonlyResearchArchetype; isAlreadyPlaced: boolean }> = [];
  const gear: Array<{ id: string; label: string; gearId?: string; imageKey?: string; isAlreadyUnlocked: boolean; archetype: ReadonlyResearchArchetype; category: string }> = [];

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
      const category = gearDef?.category || '';
      const isStartGear = gearId ? (gs?.unlockedGear?.includes(gearId) ?? false) : false;
      gear.push({ id, label, gearId, imageKey, isAlreadyUnlocked: isAlreadyPlaced || isStartGear, archetype, category });
    } else if (archetype.type === 'stat') {
      const reward = rewards.find(r => r.kind === 'stat');
      const stat = reward && reward.kind === 'stat' ? reward.stat : '';
      const label = stat || id;
      const icon = getStatIcon(stat);
      nonGear.push({ id, label, icon, type: 'stat', archetype, isAlreadyPlaced });
    } else if (archetype.type === 'resource') {
      const reward = rewards.find(r => r.kind === 'resource');
      const resource = reward && reward.kind === 'resource' ? reward.resource : '';
      const amount = reward && reward.kind === 'resource' ? reward.amount : 0;
      const label = `${resource} (${amount})`;
      const icon: ResearchStatIcon = { kind: 'glyph', key: getResourceGlyph(resource) };
      nonGear.push({ id, label, icon, type: 'resource', archetype, isAlreadyPlaced });
    } else {
      // Discovery or other types
      const label = id;

      let icon: ResearchStatIcon = { kind: 'glyph', key: '⚠' };

      const sourceIcon = (archetype.ownedIcon && archetype.ownedIcon.kind !== 'none')
        ? archetype.ownedIcon
        : archetype.icon;

      if (sourceIcon && sourceIcon.kind !== 'none') {
        if (sourceIcon.kind === 'itemImage') {
          icon = { kind: 'itemImage', key: sourceIcon.key };
        } else if (sourceIcon.kind === 'glyph') {
          // ResearchArchetypeIcon uses 'glyph', ResearchStatIcon uses 'key'
          icon = { kind: 'glyph', key: sourceIcon.glyph };
        }
      }

      nonGear.push({ id, label, icon, type: archetype.type, archetype, isAlreadyPlaced });
    }
  });

  // Sort non-gear by type, then label
  nonGear.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
  // Sort gear by category, then label
  gear.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

  return { nonGear, gear };
});

const hoveredArchetype = ref<ReadonlyResearchArchetype | null>(null);
const hoverPosition = ref<Point | null>(null);

const mockHintCell = computed((): ResearchCell => {
  return {
    nodeId: -1,
    archetypeId: hoveredArchetype.value?.id || '',
    nexusId: '',
    nexusPlacementId: 0,
    passable: true,
    mazeMoveCostMult: 1,
    revealed: true,
    owned: true, // Show owned state to reveal full info
    cost: 0,
    blocked: false,
    filledByAntiVoid: false,
  };
});

function onHoverStart(archetype: ReadonlyResearchArchetype, event: MouseEvent) {
  const button = event.currentTarget as HTMLElement;
  const panel = button.closest('.edit-research-panel') as HTMLElement;
  if (!panel) return;
  const panelRect = panel.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  hoverPosition.value = {
    x: buttonRect.left - panelRect.left + 20,
    y: buttonRect.bottom - panelRect.top + 5,
  };

  hoveredArchetype.value = archetype;
}

function onHoverEnd() {
  hoveredArchetype.value = null;
  hoverPosition.value = null;
}

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
  const gs = getGameStateMutable();
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
    const orderedCells = [...node.cells].sort((a, b) => {
      return a.y === b.y ? a.x - b.x : a.y - b.y;
    });
    const cellsCode = orderedCells.length === 1
      ? `{ x: ${orderedCells[0].x}, y: ${orderedCells[0].y} }`
      : `[${orderedCells.map((cell) => `{ x: ${cell.x}, y: ${cell.y} }`).join(', ')}]`;
    let line = `  { archetypeId: '${node.archetypeId}', cells: ${cellsCode}`;
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

function clearNewlyPlaced() {
  (uiState as any).researchNewlyPlaced = [];
  (uiState as any).researchEditVersion = ((uiState as any).researchEditVersion || 0) + 1;
}

const saveStatus = ref<string>('');

async function saveToFiles() {
  const gs = getGameState();
  const lib = getGameLib();
  if (!gs || !gs.researchCells || !lib?.research) return;

  const cells = gs.researchCells;

  const emptyCells: Array<{ x: number; y: number }> = [];
  const voidCells: Array<{ x: number; y: number }> = [];
  // Collect non-empty/void/obstacle cells keyed by index
  const placementCells: Array<{ axial: { x: number; y: number }; nodeId: number; archetypeId: string }> = [];

  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx];
    if (!cell) continue;

    const axial = indexToAxial(idx);

    if (cell.archetypeId === 'empty') {
      emptyCells.push({ x: axial.x, y: axial.y });
      continue;
    }
    if (cell.archetypeId === 'void') {
      voidCells.push({ x: axial.x, y: axial.y });
      continue;
    }
    if (cell.archetypeId === 'obs' || cell.archetypeId === 'obstacle') continue;

    placementCells.push({ axial, nodeId: cell.nodeId, archetypeId: cell.archetypeId });
  }

  // Build placements: use lib node grouping only when the archetypeId still matches.
  // Cells that were repainted (archetypeId differs from their original node) become
  // individual single-cell placements.
  type Placement = {
    archetypeId: string;
    cells: Array<{ x: number; y: number }>;
    radius: number;
    type: string;
    initiallyOwned?: boolean;
  };

  const placements: Placement[] = [];
  const usedByLibNode = new Set<string>(); // "x,y" keys of cells claimed by intact lib nodes

  // First pass: find lib nodes that are still intact (all cells still have matching archetypeId)
  for (const [nodeId, nodeInstance] of lib.research.nodes) {
    const archetype = lib.research.archetypes.get(nodeInstance.archetypeId);
    if (!archetype) continue;
    // Skip generic obstacle/empty/void archetypes (but NOT hub which has type 'empty')
    const aid = nodeInstance.archetypeId;
    if (aid === 'obs' || aid === 'obstacle' || aid === 'empty' || aid === 'void') continue;

    // Check if all cells of this lib node still have the same archetypeId
    const nodeCells = placementCells.filter(
      c => c.nodeId === nodeId && c.archetypeId === nodeInstance.archetypeId
    );
    if (nodeCells.length === 0) continue;

    // Check the node is fully intact (same cell count as in lib)
    const allNodeCells = placementCells.filter(c => c.nodeId === nodeId);
    const intact = nodeCells.length === nodeInstance.cells.length
      && allNodeCells.length === nodeInstance.cells.length;

    if (intact) {
      // Reconstruct with radius if applicable
      let radius = 0;
      let outCells = nodeCells.map(c => c.axial);
      if (nodeInstance.centerCell) {
        const cx = nodeInstance.centerCell.x;
        const cy = nodeInstance.centerCell.y;
        for (const c of outCells) {
          const dx = c.x - cx;
          const dy = c.y - cy;
          const dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
          if (dist > radius) radius = dist;
        }
        outCells = [{ x: cx, y: cy }];
      }

      placements.push({
        archetypeId: nodeInstance.archetypeId,
        cells: outCells,
        radius,
        type: archetype.type,
        initiallyOwned: nodeInstance.initiallyOwned || undefined,
      });

      for (const c of nodeCells) {
        usedByLibNode.add(`${c.axial.x},${c.axial.y}`);
      }
    }
  }

  // Second pass: remaining cells (user-painted) — use researchNewlyPlaced entries
  // to preserve radius info instead of treating each cell individually.
  const newlyPlaced: Array<{ archetypeId: string; cells: Array<{ x: number; y: number }>; radius: number }> =
    (uiState as any).researchNewlyPlaced || [];

  const usedByNewlyPlaced = new Set<string>();

  for (const entry of newlyPlaced) {
    // Check that the center cells still have the matching archetypeId in the game state
    const validCenters = entry.cells.filter(c => {
      const key = `${c.x},${c.y}`;
      if (usedByLibNode.has(key)) return false;
      const cell = placementCells.find(pc => pc.axial.x === c.x && pc.axial.y === c.y);
      return cell && cell.archetypeId === entry.archetypeId;
    });
    if (validCenters.length === 0) continue;

    const archetype = lib.research.archetypes.get(entry.archetypeId);
    if (!archetype) continue;

    placements.push({
      archetypeId: entry.archetypeId,
      cells: validCenters,
      radius: entry.radius,
      type: archetype.type,
    });

    // Mark all cells covered by this entry (centers + expanded radius) as used
    for (const c of validCenters) {
      if (entry.radius > 0) {
        for (const expanded of axialRange(c, entry.radius)) {
          usedByNewlyPlaced.add(`${expanded.x},${expanded.y}`);
        }
      } else {
        usedByNewlyPlaced.add(`${c.x},${c.y}`);
      }
    }
  }

  // Any remaining cells not covered by lib nodes or newlyPlaced entries
  for (const c of placementCells) {
    const key = `${c.axial.x},${c.axial.y}`;
    if (usedByLibNode.has(key) || usedByNewlyPlaced.has(key)) continue;
    const archetype = lib.research.archetypes.get(c.archetypeId);
    if (!archetype) continue;

    placements.push({
      archetypeId: c.archetypeId,
      cells: [c.axial],
      radius: 0,
      type: archetype.type,
    });
  }

  saveStatus.value = 'Saving...';
  try {
    const resp = await fetch('/__dev/save-research-pane', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placements, emptyCells, voidCells }),
    });
    const result = await resp.json();
    if (result.ok) {
      const c = result.counts;
      saveStatus.value = `Saved: ${c.special}sp ${c.gear}g ${c.stats}st | ${c.emptyCells}e ${c.voidCells}v`;
    } else {
      saveStatus.value = `Error: ${result.error}`;
    }
  } catch (err: any) {
    saveStatus.value = `Failed: ${err.message}`;
  }
  setTimeout(() => { saveStatus.value = ''; }, 4000);
}

function getGearSpriteStyle(imageKey: string | undefined): Record<string, string> {
  const frame = atlasStorage.getItemsFrame(imageKey!)!;
  return atlasSpriteStyle(atlasSource, frame, { size: 32, mode: 'fit', allowUpscale: false });
}

function getArchetypeIconStyle(
  archetype: ReadonlyResearchArchetype,
  icon: ResearchStatIcon
): Record<string, string> {
  if (icon.kind !== 'glyph') return {};
  if (archetype.type !== 'obstacle') return {};
  const rotationDeg = archetype.obstacleVisual.direction * -60;
  return {
    transform: `rotate(${rotationDeg}deg)`,
    transformOrigin: '50% 50%',
    display: 'inline-block',
  };
}
</script>

<style scoped>
.edit-research-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 470px;
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
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panel-body {
  padding: 5px;
  font-size: 12px;
  line-height: 1.4;
  overflow: auto;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.controls-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.controls-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 auto;
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
  padding: 3px 7px;
  font-size: 12px;
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
  min-height: 60px;
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

.radius-row-right {
  margin-left: auto;
  padding-right: 80px;
  display: flex;
  gap: 4px;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}

.archetype-btn {
  padding: 2px 3px;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  min-height: 34px;
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
  font-size: 13px;
  line-height: 1.2;
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

.save-btn {
  background: rgba(22, 163, 74, 0.3);
  border-color: rgba(34, 197, 94, 0.6);
}

.save-btn:hover {
  background: rgba(22, 163, 74, 0.5);
}

.save-status {
  font-size: 11px;
  opacity: 0.8;
  align-self: center;
}

.hover-hint-container {
  position: absolute;
  z-index: 100;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid var(--panel-border);
  padding: 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  max-width: 300px;
}
</style>
