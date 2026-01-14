<template>
  <div class="wafer-container">
    <div class="wafer-section">
      <WaferView
        :wafer="wafer"
        :version="waferVersion"
        :ghost-molecule="ghostMolecule"
        :ghost-position="ghostPosition"
        :ghost-valid="ghostValid"
        :ghost-show-outline="ghostShowOutline"
        :highlight-item-idx="highlightItemIdx"
        :hide-molecules="showRefineAnim"
        :upgrade-preview-cells="upgradeHoverCells"
        :cell-effective-counts="preview.cellEffectiveCounts"
        :new-signature-matches="preview.newSignatureMatches"
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

	    <WaferInfo :preview="preview" :should-flash-failure="shouldFlashFailure" />

	    <div class="action-section">
	      <button
        v-if="!isRefining"
        class="start-btn"
        :disabled="!canRefine"
        @click="startRefining"
        @mouseenter="isRefineHovered = true"
        @mouseleave="isRefineHovered = false"
      >
        Start Refining (4 hours)
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
	import WaferInfo from './WaferInfo.vue';
	import type { Wafer } from '../logic/Wafer';
	import type { Molecule, Point2 } from '../logic/ItemLib';
	import { canPlaceMolecule, getCell, computeUpgradeableRegion, computeWaferUpgradePrice } from '../logic/Wafer';
	import { computeRefinePreviewChem, computeUniqueItemsYieldBonusPct } from '../logic/RefinePreview';
	import { uiState, getGameState } from '../logic/UIState';
	import { formatDurationHM } from '../logic/StringUtils';
	import { globalInputQueue } from '../logic/Model';
	import { CmdPlaceMolecule, CmdRemoveMolecule, CmdGrowWafer } from '../logic/input/InputCommands';
	import { DISCOVERY } from '../logic/DiscoveryLib';
	// All snapping handled via MoleculeUtils.translateForSnap
	import { translateForSnap, rotateMolecule } from '../logic/MoleculeUtils';
	import { HEX_SIZE, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT } from '../logic/RefineUIBehaviour';
	import { updateManualDragMolecule } from '../logic/ManualDrag';
	import { getResourceSpec } from '../logic/Resources';


const props = defineProps<{
  draggingItem?: { id: string; molecule: Molecule } | null;
}>();

const emit = defineEmits<{
  (e: 'refine-start'): void;
  (e: 'clear-dragging'): void;
  (e: 'pickup-item', item: { id: string; molecule: Molecule }): void;
}>();

	const shardSpec = getResourceSpec('shardDust');
	const shardColor = shardSpec.color;

// Wafer comes from UIState (synced from GameState)
const wafer = computed(() => uiState.wafer);

// Touch waferVersion to ensure reactivity when wafer contents change
const waferVersion = computed(() => uiState.waferVersion);

	const ghostMolecule = ref<Molecule | null>(null);
	const ghostPosition = ref<Point2 | null>(null);
const ghostValid = ref(false);
const ghostShowOutline = ref(false);
const highlightItemIdx = ref<number | null>(null);
const lastHoverPos = ref<Point2 | null>(null);
const rotation = ref(0);
const upgradeHoverCells = ref<Point2[] | null>(null);
const isRefineHovered = ref(false);
const shouldFlashFailure = computed(() => isRefineHovered.value && canRefine.value && preview.value.failureChancePct > 20);


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
  // Touch discoveryCounter to react to discovery changes
  const _dep = uiState.discoveryCounter;

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
      totalYieldPct: 100,
      cyanYieldBonus: 0,
      uniqueItemsYieldBonus: 0,
      signatureYieldBonus: 0,
      newSignatureYieldBonus: 0,
      newSignatureMatches: [] as Array<{ id: string; offset: { x: number; y: number } }>,
    };
  }

  const gs = getGameState()!;
  const uniqueItemsYieldBonus = (gs.discoveries[DISCOVERY.UNIQUE_ITEMS_YIELD] === true)
    ? computeUniqueItemsYieldBonusPct(gs.refinedUniqueItemIds, wafer.value.items)
    : 0;

  const basePreview = computeRefinePreviewChem(wafer.value, {
    signatures: uiState.lib!.signatures,
    signatureLevel: uiState.signatureLevel,
    completedSignatureIds: uiState.completedSignatureIds,
    uniqueItemsYieldBonus,
  });

  // Calculate essence counts for each resource type
  const essenceTotals = basePreview.essenceTotals || {};
  const creditsEssences = (essenceTotals.red || 0);
  const chronoEssences = (essenceTotals.blue || 0);
  const fluxEssences = (essenceTotals.green || 0);

  // Use the pre-calculated empty count from wafer
  const emptyCells = wafer.value.emptyCount || 0;

  // Check if CYAN_YIELD is discovered - only then apply cyan yield bonus
  const hasCyanYield = gs.discoveries[DISCOVERY.CYAN_YIELD] === true;

  // If CYAN_YIELD is not discovered, recalculate expected values without the cyan yield bonus
  let { expectedCredits, expectedChrono, expectedFlux, totalYieldPct, cyanYieldBonus } = basePreview;

  if (!hasCyanYield && cyanYieldBonus > 0) {
    // Remove the cyan yield bonus from the calculation
    const yieldWithoutCyan = (totalYieldPct - cyanYieldBonus) / 100;
    const yieldWithCyan = totalYieldPct / 100;
    const adjustmentFactor = yieldWithoutCyan / yieldWithCyan;

    expectedCredits = Math.round(expectedCredits * adjustmentFactor);
    expectedChrono = Math.round(expectedChrono * adjustmentFactor);
    expectedFlux = Math.round(expectedFlux * adjustmentFactor);
    totalYieldPct = totalYieldPct - cyanYieldBonus;
    cyanYieldBonus = 0;
  }

  return {
    ...basePreview,
    expectedCredits,
    expectedChrono,
    expectedFlux,
    totalYieldPct,
    cyanYieldBonus,
    creditsEssences,
    chronoEssences,
    fluxEssences,
    emptyCells,
  };
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

function moleculeOverlapsEnabledCell(w: Wafer, mol: Molecule): boolean {
  for (const atom of mol.atoms) {
    const cell = getCell(w, { x: atom.x, y: atom.y });
    if (cell && cell.enabled) return true;
  }
  return false;
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
    ghostShowOutline.value = false;
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
    ghostShowOutline.value = false;
    return;
  }

  const origin: Point2 = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };
  const rotated = rotateMolecule(props.draggingItem.molecule, rotation.value);
  const { translated } = translateForSnap(rotated, pos, HEX_SIZE, origin);
  ghostMolecule.value = translated;
  ghostPosition.value = pos;
  ghostValid.value = canPlaceMolecule(wafer.value, translated);
  ghostShowOutline.value = moleculeOverlapsEnabledCell(wafer.value, translated);
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
      ghostShowOutline.value = !!wafer.value && moleculeOverlapsEnabledCell(wafer.value, translated);
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

.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
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
