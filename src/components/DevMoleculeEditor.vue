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
          :use-custom-grid-content="showSignatures"
          @pick-item="onPickItem"
          @drag-end="onDragEnd"
          @raid-filter="onRaidFilter"
        >
          <template #raid-filter-actions>
            <button
              v-for="r in RARITIES"
              :key="r.key"
              type="button"
              class="raid-btn"
              :class="{ active: activeRarityFilter === r.key }"
              :style="{ color: rarityColors[r.key] }"
              @click="toggleRarityFilter(r.key)"
            >
              {{ r.letter }}
            </button>
            <button
              type="button"
              class="raid-btn signatures-toggle"
              :class="{ active: showSignatures }"
              @click="toggleSignatureGrid"
            >
              signatures
            </button>
          </template>
          <template #grid-content>
            <div class="signature-cheat-grid" :style="signatureAtlasVars">
              <button
                v-for="signature in allSignatures"
                :key="signature.id"
                type="button"
                class="sig-cheat-entry signature-entry-btn"
                @click="applySignature(signature.id)"
              >
                <div class="sig-cheat-sprite" :style="signatureSpriteStyle(signature.id)" />
                <div class="sig-cheat-name">{{ signature.name }}</div>
              </button>
            </div>
          </template>
        </AllItems>
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
            <button
              type="button"
              class="btn connect-toggle"
              :class="{ active: giveMode }"
              @click="giveMode = !giveMode"
            >
              Give: {{ giveMode ? 'ON' : 'OFF' }}
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
import { uiState, getGameStateMutable } from '../logic/UIState';
import itemsData from '../data/items';
import { createWafer, type Wafer, getCell, canPlaceMolecule, placeMolecule, removeMolecule, clearWafer, getEnabledCells } from '../logic/Wafer';
import { translateForSnap, rotateMolecule } from '../logic/MoleculeUtils';
import { HEX_SIZE, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT } from '../logic/RefineUIBehaviour';
import type { Molecule, Point2 } from '../logic/ItemLib';
import { updateManualDragMolecule } from '../logic/ManualDrag';
import { getSignatureAtlasVars, getSignatureSpriteStyle } from '../logic/signatureVisuals';

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
const giveMode = ref(false);
const activeRaidFilter = ref<string | null>(null);
const activeRarityFilter = ref<string | null>(null);
const showSignatures = ref(false);

const rarityColors: Record<string, string> = {
  common: '#9ca3af',
  uncommon: 'white',
  rare: '#60a5fa',
  legendary: '#fbbf24',
};

const RARITIES: ReadonlyArray<{ key: string; letter: string }> = [
  { key: 'common', letter: 'C' },
  { key: 'uncommon', letter: 'U' },
  { key: 'rare', letter: 'R' },
  { key: 'legendary', letter: 'L' },
];

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
  cyan: 'dev_atom_cyan',
  magenta: 'dev_atom_magenta',
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

const allSignatures = computed(() => {
  if (!uiState.lib) return [];
  const signatures = Array.from(uiState.lib.signatures.values());
  signatures.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return signatures;
});

const signatureAtlasVars = getSignatureAtlasVars();

const filteredItems = computed(() => {
  let items = allItems.value;

  if (activeRaidFilter.value && uiState.lib) {
    const raid = uiState.lib.raids.get(activeRaidFilter.value);
    if (raid && raid.allPotentialItems) {
      const raidItemIds = new Set(raid.allPotentialItems);
      items = items.filter(item => {
        if (item.id.startsWith('dev_')) return true;
        return raidItemIds.has(item.id);
      });
    }
  }

  if (activeRarityFilter.value && uiState.lib) {
    items = items.filter(item => {
      if (item.id.startsWith('dev_')) return true;
      const def = uiState.lib!.getItem(item.id);
      return def.rarity === activeRarityFilter.value;
    });
  }

  return items;
});

function onRaidFilter(raidId: string | null) {
  if (activeRaidFilter.value === raidId) {
    activeRaidFilter.value = null;
  } else {
    activeRaidFilter.value = raidId;
  }
}

function toggleRarityFilter(rarity: string) {
  activeRarityFilter.value = activeRarityFilter.value === rarity ? null : rarity;
}

function signatureSpriteStyle(id: string): Record<string, string> {
  return getSignatureSpriteStyle(id, 'revealed');
}

function toggleSignatureGrid() {
  showSignatures.value = !showSignatures.value;
  clearDragging();
}

const hoverCoords = computed(() => {
  const p = lastHoverPos.value;
  if (!p) return 'Hex: -, -';
  return `Hex: ${p.x}, ${p.y}`;
});

function onPickItem(id: string) {
  if (giveMode.value) {
    giveItem(id);
    return;
  }
  const def = (itemsData as any)[id];
  if (!def || !def.molecule) return;
  draggingItem.value = { id, molecule: def.molecule as Molecule };
  rotation.value = 0;
  if (lastHoverPos.value) {
    onHover(lastHoverPos.value);
  }
}

function giveItem(id: string) {
  const gs = getGameStateMutable();
  const itemDef = gs.lib.getItem(id);
  for (const [k, v] of Object.entries(itemDef.essence)) {
    if (!v) continue;
    gs.encounteredEssences[k] = true;
  }
  gs.items[id] = (gs.items[id] ?? 0) + 1;
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

function getCenteredSignatureOffset(signatureId: string): Point2 {
  const signature = uiState.lib!.signatures.get(signatureId)!;
  const enabledCells = getEnabledCells(wafer.value);
  const enabledKeys = new Set(enabledCells.map((cell) => `${cell.x},${cell.y}`));
  const candidateOffsets = new Map<string, Point2>();

  for (const cell of enabledCells) {
    candidateOffsets.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
    for (const atom of signature.molecule.atoms) {
      const offset = {
        x: cell.x - atom.x,
        y: cell.y - atom.y,
      };
      candidateOffsets.set(`${offset.x},${offset.y}`, offset);
    }
  }

  let bestOffset: Point2 | null = null;
  let bestOnboardCount = -1;
  let bestDistanceScore = Number.POSITIVE_INFINITY;
  let bestMaxDistance = Number.POSITIVE_INFINITY;

  for (const offset of candidateOffsets.values()) {
    let onboardCount = 0;
    let distanceScore = 0;
    let maxDistance = 0;

    for (const atom of signature.molecule.atoms) {
      const x = atom.x + offset.x;
      const y = atom.y + offset.y;
      if (!enabledKeys.has(`${x},${y}`)) continue;
      onboardCount++;
      const z = -x - y;
      const distance = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
      distanceScore += distance;
      if (distance > maxDistance) maxDistance = distance;
    }

    if (onboardCount > bestOnboardCount) {
      bestOffset = offset;
      bestOnboardCount = onboardCount;
      bestDistanceScore = distanceScore;
      bestMaxDistance = maxDistance;
      continue;
    }
    if (onboardCount < bestOnboardCount) continue;

    if (distanceScore < bestDistanceScore) {
      bestOffset = offset;
      bestDistanceScore = distanceScore;
      bestMaxDistance = maxDistance;
      continue;
    }
    if (distanceScore > bestDistanceScore) continue;

    if (maxDistance < bestMaxDistance) {
      bestOffset = offset;
      bestMaxDistance = maxDistance;
      continue;
    }
    if (maxDistance > bestMaxDistance) continue;

    if (bestOffset === null || offset.x < bestOffset.x || (offset.x === bestOffset.x && offset.y < bestOffset.y)) {
      bestOffset = offset;
    }
  }

  if (!bestOffset) {
    throw new Error(`Unable to place signature '${signatureId}' inside enabled wafer cells`);
  }
  if (bestOnboardCount !== signature.molecule.atoms.length) {
    throw new Error(`Signature '${signatureId}' does not fit in the current wafer`);
  }

  return bestOffset;
}

function applySignature(signatureId: string) {
  const w = wafer.value;
  const signature = uiState.lib!.signatures.get(signatureId)!;
  const offset = getCenteredSignatureOffset(signatureId);

  clearWafer(w);

  for (const atom of signature.molecule.atoms) {
    const placed = placeMolecule(w, DEV_ESSENCE_ITEMS[atom.color] || signatureId, {
      atoms: [{
        color: atom.color,
        x: atom.x + offset.x,
        y: atom.y + offset.y,
      }],
      connections: [],
    });
    if (!placed) {
      throw new Error(`Failed to place signature atom for '${signatureId}'`);
    }
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
  width: 100%;
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

.raid-btn { min-width: 28px; height: 28px; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--panel-border); background: rgba(255,255,255,0.03); color: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 120ms ease; position: relative; }
.raid-btn:hover { background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.5); transform: translateY(-1px); }
.raid-btn.active { background: rgba(34, 197, 94, 0.25); border-color: rgba(34, 197, 94, 0.7); color: #a7f3d0; }

.signatures-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  height: 28px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  text-transform: lowercase;
}

.signatures-toggle:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}

.signatures-toggle.active {
  background: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.7);
  color: #a7f3d0;
}

.signature-cheat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;
  min-height: 100%;
  overflow-y: auto;
  padding-right: 2px;
}

.signature-entry-btn {
  min-width: 52px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  cursor: pointer;
}

.signature-entry-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.sig-cheat-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 3px;
  border: 1px solid transparent;
  transition: background 0.12s, border-color 0.12s;
}

.sig-cheat-sprite {
  display: block;
}

.sig-cheat-name {
  text-align: center;
  font-size: 9px;
  color: var(--text-secondary);
  line-height: 1;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
