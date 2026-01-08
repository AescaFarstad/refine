<template>
  <div class="wafer-container">
    <div class="wafer-section">
      <WaferView
        :wafer="wafer"
        :version="waferVersion"
        :ghost-molecule="ghostMolecule"
        :ghost-position="ghostPosition"
        :ghost-valid="ghostValid"
        :highlight-item-idx="highlightItemIdx"
        :hide-molecules="showRefineAnim"
        :upgrade-preview-cells="upgradeHoverCells"
        :cell-effective-counts="preview.cellEffectiveCounts"
        :use-effective-essence="!draggingItem"
        :show-buff-overlays="true"
        :show-upgrade-hints="showWaferUpgrades"
        @hover="onHover"
        @click="onClick"
        @pickup="onPickup"
        @rotate="onRotate"
      />
      <RefineAnim
        v-if="showRefineAnim"
        :wafer="wafer"
      />
      <div v-if="draggingItem && !showRefineAnim" class="rotate-hint">
        Right-Click or Space to rotate ⟳
      </div>
      <div
        v-if="!hasGrownWafer && placedItemEntries.length === 0 && !draggingItem && !showRefineAnim && !hasUpgradePreview"
        class="empty-state-message"
      >
        Drag items here to refine them into resources
      </div>
      <div
        v-if="hasUpgradePreview && showWaferUpgrades && !showRefineAnim"
        class="wafer-upgrade-hint"
        :class="{ insufficient: !canAffordUpgrade }"
      >
        Grow wafer for
        <span class="resource-price" :style="{ color: shardColor }">
          {{ upgradeCost }} {{ shardSpec.glyph }}
        </span>
      </div>
    </div>

    <div class="placed-items-row">
      <div
        v-if="!failedRefineWithShards"
        v-for="(entry, idx) in placedItemEntries"
        :key="entry.idx"
        class="placed-item-cell"
        :class="{ highlighted: highlightItemIdx === entry.idx }"
        @click="removeItem(entry.idx)"
        @mouseenter="setHighlight(entry.idx)"
        @mouseleave="clearHighlight()"
      >
        <ItemDisplay :id="entry.item.id" :quantity="1" minor no-tooltip />
        <div class="remove-overlay">
          <span class="remove-cross">×</span>
        </div>
      </div>
      <div
        v-if="failedRefineWithShards"
        class="refine-fail-note"
      >
        Refining <span class="refine-fail-word">FAILED</span>, but the resources can be reclaimed as shards.
      </div>
    </div>

    <div class="info-panel">
      <div class="stats-table">
        <div class="stat-row">
          <span class="stat-label">Expected Credits:</span>
          <span class="stat-value hl" :style="{ color: creditsSpec.color }">{{ preview.expectedCredits }}{{ creditsSpec.glyph }}</span>
          <span class="stat-source" v-if="preview.creditsEssences > 0">
            from {{ preview.creditsEssences }}
            <template v-for="(key, idx) in creditsEssenceKeys" :key="key">
              <span v-if="getEssenceFrame(key) && source" class="ess-icon" :style="essenceIconStyle(key)" />
              <span v-else class="ess-letter">{{ essenceLetter(key) }}</span>
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Expected Chronotraces:</span>
          <span class="stat-value hl" :style="{ color: chronotracesSpec.color }">{{ preview.expectedChrono }}{{ chronotracesSpec.glyph }}</span>
          <span class="stat-source" v-if="preview.chronoEssences > 0">
            from {{ preview.chronoEssences }}
            <template v-for="(key, idx) in chronoEssenceKeys" :key="key">
              <span v-if="getEssenceFrame(key) && source" class="ess-icon" :style="essenceIconStyle(key)" />
              <span v-else class="ess-letter">{{ essenceLetter(key) }}</span>
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Expected Time Flux:</span>
          <span class="stat-value hl" :style="{ color: timeFluxSpec.color }">{{ preview.expectedFlux }}{{ timeFluxSpec.glyph }}</span>
          <span class="stat-source" v-if="preview.fluxEssences > 0">
            from {{ preview.fluxEssences }}
            <template v-for="(key, idx) in fluxEssenceKeys" :key="key">
              <span v-if="getEssenceFrame(key) && source" class="ess-icon" :style="essenceIconStyle(key)" />
              <span v-else class="ess-letter">{{ essenceLetter(key) }}</span>
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Failure Chance:</span>
          <span class="stat-value" :class="failureClass">{{ preview.failureChancePct }}%</span>
          <span class="stat-source" v-if="preview.emptyCells > 0 || cyanEssences > 0 || magentaEssences > 0">
            <template v-if="preview.emptyCells > 0">
              from {{ preview.emptyCells }} empty cells
            </template>
            <template v-if="cyanEssences > 0">
              <template v-if="preview.emptyCells > 0">, </template>
              -{{ cyanReduction }}% from {{ cyanEssences }}
              <template v-for="(key, idx) in cyanEssenceKeys" :key="key">
                <span v-if="getEssenceFrame(key) && source" class="ess-icon" :style="essenceIconStyle(key)" />
                <span v-else class="ess-letter">{{ essenceLetter(key) }}</span>
              </template>
            </template>
            <template v-if="magentaEssences > 0">
              <template v-if="preview.emptyCells > 0 || cyanEssences > 0">, </template>
              +{{ magentaPenalty }}% from {{ magentaEssences }}
              <template v-for="(key, idx) in magentaEssenceKeys" :key="key">
                <span v-if="getEssenceFrame(key) && source" class="ess-icon" :style="essenceIconStyle(key)" />
                <span v-else class="ess-letter">{{ essenceLetter(key) }}</span>
              </template>
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Time:</span>
          <span class="stat-value">4 hours</span>
          <span class="stat-source"></span>
        </div>
      </div>
    </div>

    <div class="action-section">
      <button
        v-if="!isRefining"
        class="start-btn"
        :disabled="!canRefine"
        @click="startRefining"
      >
        Start Refining
      </button>

      <div v-if="isRefining" class="progress-status">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: refineProgress + '%' }"></div>
        </div>
        <div class="time-remaining">{{ timeRemaining }} remaining</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import WaferView from './WaferView.vue';
import ItemDisplay from './ItemDisplay.vue';
import RefineAnim from './RefineAnim.vue';
import type { Wafer } from '../logic/Wafer';
import type { Molecule, Point2 } from '../logic/ItemLib';
import { canPlaceMolecule, getCell, computeUpgradeableRegion, computeWaferUpgradePrice } from '../logic/Wafer';
import { computeRefinePreviewChem } from '../logic/RefinePreview';
import { uiState, getGameState } from '../logic/UIState';
import { formatDurationHM } from '../logic/StringUtils';
import { globalInputQueue } from '../logic/Model';
import { CmdPlaceMolecule, CmdRemoveMolecule, CmdGrowWafer } from '../logic/input/InputCommands';
import atlasStorage from '../logic/AtlasStorage';
import { DISCOVERY } from '../logic/DiscoveryLib';
// All snapping handled via MoleculeUtils.translateForSnap
import { translateForSnap, rotateMolecule } from '../logic/MoleculeUtils';
import { HEX_SIZE, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT } from '../logic/RefineUIBehaviour';
import { updateManualDragMolecule } from '../logic/ManualDrag';
import { getResourceSpec } from '../logic/Resources';
import { CYAN_SUCCESS_BONUS_PCT, MAGENTA_SUCCESS_PENALTY_PCT } from '../logic/Const';


const props = defineProps<{
  draggingItem?: { id: string; molecule: Molecule } | null;
}>();

const emit = defineEmits<{
  (e: 'refine-start'): void;
  (e: 'clear-dragging'): void;
  (e: 'pickup-item', item: { id: string; molecule: Molecule }): void;
}>();

const creditsSpec = getResourceSpec('credits');
const chronotracesSpec = getResourceSpec('chronotraces');
const timeFluxSpec = getResourceSpec('timeFlux');
const shardSpec = getResourceSpec('shardDust');
const shardColor = shardSpec.color;

// Wafer comes from UIState (synced from GameState)
const wafer = computed(() => uiState.wafer);

// Touch waferVersion to ensure reactivity when wafer contents change
const waferVersion = computed(() => uiState.waferVersion);

const ghostMolecule = ref<Molecule | null>(null);
const ghostPosition = ref<Point2 | null>(null);
const ghostValid = ref(false);
const highlightItemIdx = ref<number | null>(null);
const lastHoverPos = ref<Point2 | null>(null);
const rotation = ref(0);
const upgradeHoverCells = ref<Point2[] | null>(null);


const activeRefinery = computed(() => uiState.refinery);
const isRefining = computed(() => {
  // Treat the refinery as "active" for the entire period where the
  // UI exposes a countdown, including the final 0s state. This avoids
  // a brief gap where refining has just finished but shards/outcome
  // have not yet been created, which previously caused the wafer image
  // to flash back in for a frame.
  return !!(activeRefinery.value && activeRefinery.value.timeRemainingSec !== undefined);
});

const hasShards = computed(() => {
  return uiState.shards && uiState.shards.length > 0;
});

const showRefineAnim = computed(() => {
  return isRefining.value || hasShards.value || !!uiState.lastRefineryOutcome;
});

const hasGrownWafer = computed(() => {
  return uiState.waferUpgradesPurchased > 0;
});

const refineProgress = computed(() => activeRefinery.value?.progressPct || 0);
const timeRemaining = computed(() => formatDurationHM(activeRefinery.value?.timeRemainingSec || 0));

const hasUpgradePreview = computed(() => !!upgradeHoverCells.value && upgradeHoverCells.value.length > 0);
const showWaferUpgrades = computed(() => {
  // Touch discoveryCounter to trigger recompute when discoveries change
  const _dep = uiState.discoveryCounter;
  const gs = getGameState();
  const hasDiscoveredShards = gs?.discoveries?.[DISCOVERY.SHARDS] === true;
  return hasDiscoveredShards || uiState.shardDust > 0 || uiState.waferUpgradesPurchased > 0;
});
const upgradeCost = computed(() => {
  if (!hasUpgradePreview.value) return 0;
  return computeWaferUpgradePrice(uiState.waferUpgradesPurchased);
});
const canAffordUpgrade = computed(() => {
  return hasUpgradePreview.value && upgradeCost.value > 0 && uiState.shardDust >= upgradeCost.value;
});

watch(showWaferUpgrades, (enabled) => {
  if (!enabled) upgradeHoverCells.value = null;
});

onMounted(() => {
  const gs = getGameState();
  if (gs && gs.waferSize) {
    gs.waferSize.x = WAFER_CANVAS_WIDTH;
    gs.waferSize.y = WAFER_CANVAS_HEIGHT;
  }
});

const preview = computed(() => {
  // Touch waferVersion for reactivity
  waferVersion.value;

  if (!wafer.value) {
    return {
      essenceTotals: {} as Record<string, number>,
      expectedCredits: 0,
      expectedChrono: 0,
      expectedFlux: 0,
      failureChancePct: 0,
      creditsEssences: 0,
      chronoEssences: 0,
      fluxEssences: 0,
      emptyCells: 0,
      cellEffectiveCounts: {} as Record<string, number>,
    };
  }

  const basePreview = computeRefinePreviewChem(wafer.value);

  // Calculate essence counts for each resource type
  const essenceTotals = basePreview.essenceTotals || {};
  const creditsEssences = (essenceTotals.red || 0);
  const chronoEssences = (essenceTotals.blue || 0);
  const fluxEssences = (essenceTotals.green || 0);

  // Use the pre-calculated empty count from wafer
  const emptyCells = wafer.value.emptyCount || 0;

  return {
    ...basePreview,
    creditsEssences,
    chronoEssences,
    fluxEssences,
    emptyCells,
  };
});

const creditsEssenceKeys = computed(() => {
  return preview.value.creditsEssences > 0 ? ['red'] : [];
});

const chronoEssenceKeys = computed(() => {
  return preview.value.chronoEssences > 0 ? ['blue'] : [];
});

const fluxEssenceKeys = computed(() => {
  return preview.value.fluxEssences > 0 ? ['green'] : [];
});

const cyanEssences = computed(() => {
  return preview.value.essenceTotals?.cyan || 0;
});

const cyanEssenceKeys = computed(() => {
  return cyanEssences.value > 0 ? ['cyan'] : [];
});

const cyanReduction = computed(() => {
  return cyanEssences.value * CYAN_SUCCESS_BONUS_PCT;
});

const magentaEssences = computed(() => {
  return preview.value.essenceTotals?.magenta || 0;
});

const magentaEssenceKeys = computed(() => {
  return magentaEssences.value > 0 ? ['magenta'] : [];
});

const magentaPenalty = computed(() => {
  return magentaEssences.value * MAGENTA_SUCCESS_PENALTY_PCT;
});

const failureClass = computed(() => {
  const pct = preview.value.failureChancePct;
  if (pct === 0) return 'success';
  if (pct <= 25) return 'warning';
  return 'danger';
});

const placedItems = computed(() => {
  // Touch waferVersion for reactivity
  waferVersion.value;
  if (!wafer.value) return [];
  if (!wafer.value || !Array.isArray(wafer.value.items)) return [];
  return wafer.value.items.filter((item: any) => item !== null);
});

// Keep original indices for mapping list entries back to wafer.items
const placedItemEntries = computed(() => {
  waferVersion.value;
  if (!wafer.value || isRefining.value) return [] as Array<{ item: any; idx: number }>;
  const out: Array<{ item: any; idx: number }> = [];
  wafer.value.items.forEach((it: any, i: number) => { if (it) out.push({ item: it, idx: i }); });
  return out;
});

const failedRefineWithShards = computed(() => {
  const outcome = uiState.lastRefineryOutcome;
  const hasFailure = !!outcome && !outcome.success;
  const hasShards = uiState.shards && uiState.shards.length > 0;
  return hasFailure && hasShards;
});

const canRefine = computed(() => {
  return placedItems.value.length > 0 && !hasShards.value;
});

// Atlas state for essence icons
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) { /* noop */ }
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});


function getEssenceFrame(k: string) {
  return atlasStorage.getItemsFrame(k);
}

function essenceIconStyle(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = 16 / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: '16px',
    height: '16px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y', cyan: 'C', magenta: 'M' };
  return m[k] || k?.[0]?.toUpperCase?.() || '?';
}


watch(() => props.draggingItem, (newVal) => {
  if (newVal) {
    console.log('[Wafer] draggingItem set', { id: newVal.id });
    rotation.value = 0;
    upgradeHoverCells.value = null;
    if (lastHoverPos.value) {
      onHover(lastHoverPos.value);
    }
  } else {
    console.log('[Wafer] draggingItem cleared');
    ghostMolecule.value = null;
    ghostPosition.value = null;
    rotation.value = 0;
    if (lastHoverPos.value) {
      onHover(lastHoverPos.value);
    } else {
      upgradeHoverCells.value = null;
    }
  }
});

function onHover(pos: Point2 | null) {
  lastHoverPos.value = pos;

  if (showRefineAnim.value) {
    ghostMolecule.value = null;
    ghostPosition.value = null;
    highlightItemIdx.value = null;
    upgradeHoverCells.value = null;
    return;
  }

  if (!showWaferUpgrades.value) {
    upgradeHoverCells.value = null;
  }

  // Wafer growth preview (only when not dragging an item)
  if (showWaferUpgrades.value && !props.draggingItem && pos && wafer.value) {
    const cell = getCell(wafer.value, pos as Point2);
    if (cell && !cell.enabled && cell.canBeUpgraded) {
      const region = computeUpgradeableRegion(wafer.value, pos as Point2);
      upgradeHoverCells.value = region.length ? region : null;
    } else {
      upgradeHoverCells.value = null;
    }
  } else if (!pos) {
    upgradeHoverCells.value = null;
  }

  // Sync list highlight with wafer hover
  if (!pos || props.draggingItem) {
    highlightItemIdx.value = null;
  } else if (wafer.value) {
    const cell = getCell(wafer.value, pos as Point2);
    highlightItemIdx.value = (cell && cell.itemIdx != null) ? cell.itemIdx : null;
  }

  // Ghost preview only when dragging an item
  if (!props.draggingItem || !pos) {
    ghostMolecule.value = null;
    ghostPosition.value = null;
    ghostValid.value = false;
    return;
  }

  const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };
  const rotated = rotateMolecule(props.draggingItem.molecule, rotation.value);
  const { translated } = translateForSnap(rotated, pos, HEX_SIZE, origin);
  ghostMolecule.value = translated;
  ghostPosition.value = pos;
  ghostValid.value = canPlaceMolecule(wafer.value, translated);
}

function onClick(pos: Point2) {
  if (showRefineAnim.value) return;

  if (props.draggingItem) {
    const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };
    const rotated = rotateMolecule(props.draggingItem.molecule, rotation.value);
    const { translated } = translateForSnap(rotated, pos, HEX_SIZE, origin);

    if (!wafer.value || !canPlaceMolecule(wafer.value, translated)) {
      // Keep the item "in hand" if dropped on an invalid spot.
      ghostMolecule.value = translated;
      ghostPosition.value = pos;
      ghostValid.value = false;
      return;
    }

    globalInputQueue.push(new CmdPlaceMolecule({
      itemId: props.draggingItem.id,
      molecule: translated,
      rotation: rotation.value,
    }));

    ghostMolecule.value = null;
    ghostPosition.value = null;
    emit('clear-dragging');
  } else {
    if (!showWaferUpgrades.value) return;
    if (!wafer.value) return;
    const cell = getCell(wafer.value, pos);
    if (!cell || cell.enabled || !cell.canBeUpgraded) return;

    const region = computeUpgradeableRegion(wafer.value, pos);
    if (!region || region.length === 0) return;

    const cost = computeWaferUpgradePrice(uiState.waferUpgradesPurchased);
    if (cost <= 0) return;
    if (uiState.shardDust < cost) return;

    globalInputQueue.push(new CmdGrowWafer({ pos }));
    upgradeHoverCells.value = null;
  }
}

function onPickup(itemIdx: number) {
  if (showRefineAnim.value) return;
  if (!wafer.value) return;

  const item = wafer.value.items[itemIdx];
  if (item) {
    emit('pickup-item', { id: item.id, molecule: item.molecule });
    globalInputQueue.push(new CmdRemoveMolecule({ itemIdx }));
  }
}

function removeItem(idx: number) {
  if (showRefineAnim.value) return;
  // Dispatch command to remove molecule from GameState
  globalInputQueue.push(new CmdRemoveMolecule({ itemIdx: idx }));
}

function setHighlight(idx: number) {
  if (props.draggingItem) return;
  highlightItemIdx.value = idx;
}

function clearHighlight() {
  highlightItemIdx.value = null;
}

function startRefining() {
  if (!canRefine.value) return;
  emit('refine-start');
}

function onRotate() {
  console.log('[Wafer] rotate event', { hasDraggingItem: !!props.draggingItem, rotation: rotation.value });
  if (!props.draggingItem) return;

  rotation.value = (rotation.value + 1) % 6;
  console.log('[Wafer] rotate applied', { rotation: rotation.value });

  // Update the manual drag follower if active
  const rotated = rotateMolecule(props.draggingItem.molecule, rotation.value);
  updateManualDragMolecule(rotated);

  if (lastHoverPos.value) {
    onHover(lastHoverPos.value);
  }
}

</script>

<style scoped>
.wafer-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.wafer-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.wafer-hidden {
  visibility: hidden;
}

.empty-state-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 32px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  pointer-events: none;
  user-select: none;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.rotate-hint {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.2);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.05em;
  pointer-events: none;
  user-select: none;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 450px;
  justify-content: center;
}

.wafer-upgrade-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.7);
  color: rgba(226, 232, 240, 0.95);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  pointer-events: none;
  user-select: none;
  z-index: 25;
}

.wafer-upgrade-hint .resource-price {
  font-weight: 700;
}

.wafer-upgrade-hint.insufficient {
  opacity: 0.7;
  color: rgba(248, 113, 113, 0.95);
  border-color: rgba(248, 113, 113, 0.8);
}

.placed-items-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  align-items: center;
  min-height: 56px;
  width: 804px;
}

.refine-fail-note {
  padding: 4px 0;
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-align: center;
}

.refine-fail-word {
  color: #fca5a5;
}

.placed-item-cell {
  position: relative;
  cursor: pointer;
  transition: all 0.15s ease;
}



.placed-item-cell .remove-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.placed-item-cell:hover .remove-overlay {
  opacity: 1;
}

.placed-item-cell.highlighted {
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 0 0 2px #4fd1c5 inset, 0 3px 10px rgba(79, 209, 197, 0.25);
  border-radius: 6px;
}

.remove-cross {
  color: white;
  font-weight: 400;
  font-size: 60px;
  line-height: 0.8;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-panel {
  background: var(--panel-bg);
  border-radius: 6px;
  padding: 16px;
  width: 772px;
}

.stats-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}


.stat-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--panel-border);
  font-size: 14px;
  gap: 24px;
}

.stat-row:last-of-type {
  border-bottom: none;
}

.stat-label {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 180px;
}

.stat-value {
  min-width: 50px;
}

.stat-source {
  color: var(--text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ess-icon {
  display: inline-block;
  vertical-align: middle;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
  width: 16px;
  height: 16px;
}

.ess-letter {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  font-weight: 900;
  font-size: 12px;
  opacity: 0.95;
  border-radius: 3px;
  background: rgba(255,255,255,0.08);
}

.hl {
  color: var(--accent);
  font-weight: 600;
}

.success {
  color: #4fd1c5;
  font-weight: 500;
}

.warning {
  color: #fbbf24;
  font-weight: 500;
}

.danger {
  color: #ef4444;
  font-weight: 500;
}

.muted {
  color: var(--text-secondary);
}

.small {
  font-size: 12px;
}

.start-btn {
  margin-top: 8px;
  height: 32px;
  padding: 0 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  border: 1px solid rgba(34,197,94,0.35);
  background: rgba(34,197,94,0.18);
  color: #86efac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.start-btn:hover {
  background: rgba(34,197,94,0.28);
}

.start-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}

.start-btn:disabled:hover {
  background: rgba(34,197,94,0.10);
}

.progress-status {
  margin-top: 16px;
  width: 100%;
}

.progress-bar {
  width: 150px;
  height: 8px;
  background: var(--bg-1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s linear;
}

.time-remaining {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 30px;
}
</style>
