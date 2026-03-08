<template>
  <div class="dev-editor-root" @click.stop>
    <div class="editor-body">
      <div class="items-panel">
        <AllItems
          :items="filteredItems"
          :copy-id-on-click="true"
          :raid-filter-mode="true"
          :show-scores="true"
          :show-volumes="true"
          :available-raids="availableRaids"
          :active-raid-filter="activeRaidFilter"
          :show-rarity-label="true"
          :hide-sorting-ui="true"
          @pick-item="onPickItem"
          @drag-end="onDragEnd"
          @raid-filter="onRaidFilter"
        />
      </div>

      <div class="right-panel">
        <header class="editor-header">
          <div class="header-actions">
            <button type="button" class="btn" @click="onClear">Clear</button>
            <button type="button" class="btn" @click="onClearConnections">
              Clear connections
            </button>
            <button type="button" class="btn" @click="onBreakDown">
              Break down
            </button>
            <button type="button" class="btn" @click="copyToClipboard">
              Copy molecule code
            </button>
            <button type="button" class="btn close" @click="$emit('close')">
              Close
            </button>
          </div>
        </header>
        <div class="wafer-panel">
          <div class="wafer-header">
            <span>{{ hoverCoords }}</span>
            <button
              type="button"
              class="btn connect-toggle"
              :class="{ active: connectMode }"
              @click="connectMode = !connectMode"
            >
              Draw connections: {{ connectMode ? 'ON' : 'OFF' }}
            </button>
          </div>
          <div class="wafer-view-wrap">
            <WaferView
              :wafer="wafer"
              :version="waferVersion"
              :ghost-molecule="ghostMolecule"
              :ghost-position="ghostPosition"
              :ghost-valid="ghostValid"
              :highlight-item-idx="highlightItemIdx"
              :hide-molecules="false"
              :upgrade-preview-cells="null"
              :cell-effective-counts="null"
              :use-effective-essence="false"
              :show-buff-overlays="true"
              :show-upgrade-hints="false"
              :connect-mode="connectMode"
              @hover="onHover"
              @click="onClick"
              @pickup="onPickup"
              @rotate="onRotate"
              @connection="onConnection"
            />
          </div>
          <div class="code-preview">
            <textarea
              class="code-area"
              readonly
              :value="codePreview"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AllItems from './AllItems.vue';
import WaferView from './WaferView.vue';
import { uiState } from '../logic/UIState';
import itemsData from '../data/items';
import { createWafer, type Wafer, getCell, canPlaceMolecule, placeMolecule, removeMolecule, clearWafer } from '../logic/Wafer';
import { translateForSnap, rotateMolecule } from '../logic/MoleculeUtils';
import { HEX_SIZE, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT } from '../logic/RefineUIBehaviour';
import type { Molecule, Point2 } from '../logic/ItemLib';
import { updateManualDragMolecule } from '../logic/ManualDrag';

const emit = defineEmits<{ (e: 'close'): void }>();

type DragItem = { id: string; molecule: Molecule };

const wafer = ref<Wafer>(createWafer(6));
const waferVersion = ref(0);

const draggingItem = ref<DragItem | null>(null);

const ghostMolecule = ref<Molecule | null>(null);
const ghostPosition = ref<Point2 | null>(null);
const ghostValid = ref(false);
const highlightItemIdx = ref<number | null>(null);
const lastHoverPos = ref<Point2 | null>(null);
const rotation = ref(0);
const connectMode = ref(false);
const activeRaidFilter = ref<string | null>(null);

const DEV_ESSENCE_ITEMS: Record<string, string> = {
  red: 'dev_atom_red',
  green: 'dev_atom_green',
  blue: 'dev_atom_blue',
  yellow: 'dev_atom_yellow',
  black: 'dev_atom_black',
  white: 'dev_atom_white',
  indigo: 'dev_atom_indigo',
  crimson: 'dev_atom_crimson',
  emerald: 'dev_atom_emerald',
  gold: 'dev_atom_gold',
  orange: 'dev_atom_orange',
  gray: 'dev_atom_gray',
};

const allItems = computed(() => {
  if (!uiState.lib) return [];

  const list: Array<{ id: string; quantity: number }> = [];
  for (const [id] of uiState.lib.items) {
    list.push({ id, quantity: 1 });
  }

  list.sort((a, b) => {
    return uiState.lib!.getItem(a.id).order - uiState.lib!.getItem(b.id).order;
  });

  return list;
});

const availableRaids = computed(() => {
  if (!uiState.lib) return [];
  const raids = Array.from(uiState.lib.raids.values());
  raids.sort((a, b) => a.order - b.order);
  return raids;
});

const filteredItems = computed(() => {
  if (!activeRaidFilter.value) return allItems.value;
  if (!uiState.lib) return allItems.value;

  const raid = uiState.lib.raids.get(activeRaidFilter.value);
  if (!raid || !raid.allPotentialItems) return allItems.value;

  const raidItemIds = new Set(raid.allPotentialItems);

  return allItems.value.filter(item => {
    if (item.id.startsWith('dev_')) return true;
    return raidItemIds.has(item.id);
  });
});

function onRaidFilter(raidId: string | null) {
  if (activeRaidFilter.value === raidId) {
    activeRaidFilter.value = null;
  } else {
    activeRaidFilter.value = raidId;
  }
}

const hoverCoords = computed(() => {
  const p = lastHoverPos.value;
  if (!p) return 'Hex: -, -';
  return `Hex: ${p.x}, ${p.y}`;
});

function onPickItem(id: string) {
  const def = (itemsData as any)[id];
  if (!def || !def.molecule) return;
  draggingItem.value = { id, molecule: def.molecule as Molecule };
  rotation.value = 0;
  if (lastHoverPos.value) {
    onHover(lastHoverPos.value);
  }
}

function onDragEnd() {
  // Defer clearing so WaferView's click handler (from ManualDrag end) can run first.
  setTimeout(() => {
    clearDragging();
  }, 0);
}

function onClear() {
  clearWafer(wafer.value);
  bumpWafer();
  clearDragging();
}

function onClearConnections() {
  const w = wafer.value;
  if (!w) return;
  for (const item of w.items) {
    if (!item || !item.molecule) continue;
    if (Array.isArray(item.molecule.connections)) {
      item.molecule.connections = [];
    }
  }
  bumpWafer();
}

function onBreakDown() {
  const w = wafer.value;
  if (!w) return;
  const placements: Array<{ id: string; molecule: Molecule }> = [];

  for (const item of w.items) {
    if (!item || !item.molecule) continue;
    for (const atom of item.molecule.atoms) {
      const color = atom.color;
      const devId = DEV_ESSENCE_ITEMS[color] || item.id;
      placements.push({
        id: devId,
        molecule: {
          atoms: [{ color, x: atom.x, y: atom.y }],
          connections: [],
        },
      });
    }
  }

  clearWafer(w);

  for (const p of placements) {
    placeMolecule(w, p.id, p.molecule, 0);
  }

  bumpWafer();
  clearDragging();
}

const codePreview = computed(() => {
  waferVersion.value;
  const w = wafer.value;
  if (!w) {
    return [
      'molecule: {',
      '  atoms: [',
      '  ],',
      '  connections: [',
      '    // TODO: add connections',
      '  ],',
      '},',
    ].join('\n');
  }
  const parts: Array<{ color: string; x: number; y: number }> = [];
  for (const cell of w.cells.values()) {
    if (!cell.enabled || !cell.essence) continue;
    parts.push({ color: cell.essence, x: cell.x, y: cell.y });
  }
  parts.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  const connections: Array<{ from: Point2; to: Point2 }> = [];
  const seen = new Set<string>();
  for (const item of w.items) {
    if (!item || !item.molecule || !Array.isArray(item.molecule.connections)) continue;
    for (const c of item.molecule.connections) {
      if (!c || !c.from || !c.to) continue;
      const a = `${c.from.x},${c.from.y}`;
      const b = `${c.to.x},${c.to.y}`;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      connections.push({
        from: { x: c.from.x, y: c.from.y },
        to: { x: c.to.x, y: c.to.y },
      });
    }
  }

  const lines: string[] = [];
  lines.push('molecule: {');
  lines.push('  atoms: [');
  for (const atom of parts) {
    lines.push(`    { color: '${atom.color}', x: ${atom.x}, y: ${atom.y} },`);
  }
  lines.push('  ],');
  lines.push('  connections: [');
  for (const c of connections) {
    lines.push(
      `    { from: { x: ${c.from.x}, y: ${c.from.y} }, to: { x: ${c.to.x}, y: ${c.to.y} } },`,
    );
  }
  lines.push('  ],');
  lines.push('},');
  return lines.join('\n');
});

async function copyToClipboard() {
  const text = codePreview.value;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall through to execCommand
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

function clearDragging() {
  draggingItem.value = null;
  ghostMolecule.value = null;
  ghostPosition.value = null;
  ghostValid.value = false;
}

watch(draggingItem, (newVal) => {
  if (!newVal) {
    ghostMolecule.value = null;
    ghostPosition.value = null;
    ghostValid.value = false;
    rotation.value = 0;
    return;
  }
  rotation.value = 0;
  if (lastHoverPos.value) {
    onHover(lastHoverPos.value);
  }
});

function onHover(pos: Point2 | null) {
  lastHoverPos.value = pos;
  const w = wafer.value;

  if (!pos || !w) {
    highlightItemIdx.value = null;
  } else {
    const cell = getCell(w, pos);
    highlightItemIdx.value = cell && cell.itemIdx != null ? cell.itemIdx : null;
  }

  if (!draggingItem.value || !pos || !w) {
    ghostMolecule.value = null;
    ghostPosition.value = null;
    ghostValid.value = false;
    return;
  }

  const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };
  const rotated = rotateMolecule(draggingItem.value.molecule, rotation.value);
  const { translated } = translateForSnap(rotated, pos, HEX_SIZE, origin);
  ghostMolecule.value = translated;
  ghostPosition.value = pos;
  ghostValid.value = canPlaceMolecule(w, translated, true);
}

function bumpWafer() {
  waferVersion.value++;
}

function onConnection(payload: { from: Point2; to: Point2 }) {
  const w = wafer.value;
  if (!w) return;

  const from = payload.from;
  const to = payload.to;

  if (from.x === to.x && from.y === to.y) return;

  const fromCell = getCell(w, from);
  const toCell = getCell(w, to);
  if (!fromCell || !toCell) return;
  if (fromCell.itemIdx == null || toCell.itemIdx == null) return;

  const itemIdx = fromCell.itemIdx;
  const item = w.items[itemIdx];
  if (!item || !item.molecule) return;

  if (!Array.isArray(item.molecule.connections)) {
    item.molecule.connections = [];
  }

  const existing = item.molecule.connections;
  const already = existing.some((c) => {
    const fx = c.from.x;
    const fy = c.from.y;
    const tx = c.to.x;
    const ty = c.to.y;
    return (
      (fx === from.x && fy === from.y && tx === to.x && ty === to.y) ||
      (fx === to.x && fy === to.y && tx === from.x && ty === from.y)
    );
  });
  if (already) return;

  existing.push({
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
  });

  bumpWafer();
}

function onClick(pos: Point2) {
  const w = wafer.value;
  if (!w || !draggingItem.value) return;

  const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };
  const rotated = rotateMolecule(draggingItem.value.molecule, rotation.value);
  const { translated } = translateForSnap(rotated, pos, HEX_SIZE, origin);
  if (!canPlaceMolecule(w, translated, true)) {
    return;
  }

  placeMolecule(w, draggingItem.value.id, translated, rotation.value);
  bumpWafer();
  clearDragging();
}

function onPickup(itemIdx: number) {
  const w = wafer.value;
  if (!w) return;
  const item = w.items[itemIdx];
  if (!item) return;
  draggingItem.value = { id: item.id, molecule: item.molecule };
  removeMolecule(w, itemIdx);
  bumpWafer();
}

function onRotate() {
  if (!draggingItem.value) return;

  rotation.value = (rotation.value + 1) % 6;

  const rotated = rotateMolecule(draggingItem.value.molecule, rotation.value);
  updateManualDragMolecule(rotated);

  if (lastHoverPos.value) {
    onHover(lastHoverPos.value);
  }
}
</script>

<style scoped>
.dev-editor-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 6px 4px;
  box-sizing: border-box;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-body {
  display: flex;
  gap: 6px;
  flex: 1;
  min-height: 0;
}

.items-panel {
  flex: 1 1 auto;
  min-width: 0;
  max-height: 100%;
}

.right-panel {
  flex: 0 0 auto;
  width: 820px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.wafer-panel {
  background: var(--panel-bg);
  border-radius: 6px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
}

.wafer-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.hint {
  font-size: 11px;
  opacity: 0.7;
}

.btn.connect-toggle {
  padding: 3px 8px;
  font-size: 11px;
}

.btn.connect-toggle.active {
  background: rgba(34, 197, 94, 0.3);
  border-color: rgba(34, 197, 94, 0.9);
}

.wafer-view-wrap {
  margin-top: 4px;
  display: flex;
  justify-content: center;
  flex: 0 0 auto;
}

.code-preview {
  margin-top: 4px;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.code-area {
  width: 100%;
  height: 100%;
  resize: none;
  min-height: 0;
  flex: 1 1 auto;
  font-family: monospace;
  font-size: 11px;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  padding: 6px 8px;
  box-sizing: border-box;
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

.btn.close {
  border-color: rgba(239, 68, 68, 0.6);
  color: #fecaca;
}

.btn:hover {
  background: rgba(30, 64, 175, 0.6);
}
</style>
