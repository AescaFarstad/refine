<template>
  <div class="info-panel" :class="{ clickable: showSignatureTabs }" @click="cycleInfoTab">
    <div v-if="showSignatureTabs" class="info-tabs">
      <div
        class="info-tab"
        :class="{ active: infoTab === 'wafer' }"
      >
        Wafer Info
      </div>
      <div
        class="info-tab"
        :class="{ active: infoTab === 'signatures', flashing: shouldFlashSignaturesTab }"
      >
        Signatures
      </div>
    </div>

    <div class="info-body">
      <div v-if="!showSignatureTabs || infoTab === 'wafer'" class="stats-table">
        <div v-if="showYield" class="stat-row">
          <span class="stat-label">Yield:</span>
          <span class="stat-value" :class="{ 'yield-bonus': preview.totalYieldPct > 100 }">{{ preview.totalYieldPct }}%</span>
          <span class="stat-source">
            <template v-if="preview.signatureYieldBonus > 0">
              +{{ preview.signatureYieldBonus }}% (signatures)
            </template>
            <template v-if="preview.newSignatureYieldBonus > 0">
              <template v-if="preview.signatureYieldBonus > 0"> </template>
              +{{ preview.newSignatureYieldBonus }}% (NEW
              <template v-for="sig in preview.newSignatureMatches" :key="sig.id">
                <span
                  class="sig-inline"
                  :style="signatureInlineStyle(sig.id)"
                />
              </template>
              signatures)
            </template>
            <template v-if="preview.cyanYieldBonus > 0">
              <template v-if="preview.signatureYieldBonus > 0 || preview.newSignatureYieldBonus > 0"> </template>
              +{{ preview.cyanYieldBonus }}% {{ cyanEssences }}
              <template v-for="key in cyanEssenceKeys" :key="key">
                <span class="ess-icon" :style="essenceIconStyle(key)" />
              </template>
            </template>
            <template v-if="preview.magentaYieldBonus > 0">
              <template v-if="preview.signatureYieldBonus > 0 || preview.newSignatureYieldBonus > 0 || preview.cyanYieldBonus > 0"> </template>
              +{{ preview.magentaYieldBonus }}% from {{ magentaEssences }}
              <template v-for="key in magentaEssenceKeys" :key="key">
                <span class="ess-icon" :style="essenceIconStyle(key)" />
              </template>
            </template>
            <template v-if="preview.uniqueItemsYieldBonus > 0">
              +{{ preview.uniqueItemsYieldBonus }}% (unique items)
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Expected Credits:</span>
          <span class="stat-value hl" :style="{ color: creditsSpec.color }">{{ preview.expectedCredits }}{{ creditsSpec.glyph }}</span>
          <span class="stat-source" v-if="preview.creditsEssences > 0">
            from {{ preview.creditsEssences }}
            <template v-for="key in creditsEssenceKeys" :key="key">
              <span class="ess-icon" :style="essenceIconStyle(key)" />
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Expected Chronotraces:</span>
          <span class="stat-value hl" :style="{ color: chronotracesSpec.color }">{{ preview.expectedChrono }}{{ chronotracesSpec.glyph }}</span>
          <span class="stat-source" v-if="preview.chronoEssences > 0">
            from {{ preview.chronoEssences }}
            <template v-for="key in chronoEssenceKeys" :key="key">
              <span class="ess-icon" :style="essenceIconStyle(key)" />
            </template>
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Expected Time Flux:</span>
          <span class="stat-value hl" :style="{ color: timeFluxSpec.color }">{{ preview.expectedFlux }}{{ timeFluxSpec.glyph }}</span>
          <span class="stat-source" v-if="preview.fluxEssences > 0">
            from {{ preview.fluxEssences }}
            <template v-for="key in fluxEssenceKeys" :key="key">
              <span class="ess-icon" :style="essenceIconStyle(key)" />
            </template>
          </span>
        </div>

        <div v-for="go in preview.gearOutputs" :key="go.gearId" class="stat-row">
          <span class="stat-label">Gear Output:</span>
          <span class="stat-value gear-output">
            <span class="gear-icon" :style="gearIconStyle(go.gearId)" />
            <span class="gear-count">×{{ go.count }}</span>
          </span>
          <span class="stat-source">
            from {{ preview.essenceTotals[go.fromEssence] || 0 }}
            <span class="ess-icon" :style="essenceIconStyle(go.fromEssence)" />
          </span>
        </div>

        <div class="stat-row" :class="{ 'flash-red': shouldFlashFailure }">
          <span class="stat-label">Failure Chance:</span>
          <span class="stat-value" :class="failureClass">{{ preview.failureChancePct }}%</span>
          <span class="stat-source" v-if="preview.emptyCells > 0 || cyanEssences > 0 || magentaEssences > 0">
            <template v-if="preview.emptyCells > 0">
              from {{ preview.emptyCells }} empty cells
            </template>
            <template v-if="cyanEssences > 0">
              <template v-if="preview.emptyCells > 0">, </template>
              {{ cyanReduction }}% success from
              <template v-for="key in cyanEssenceKeys" :key="key">
                <span class="ess-icon" :style="essenceIconStyle(key)" />
              </template>
            </template>
            <template v-if="magentaEssences > 0">
              <template v-if="preview.emptyCells > 0 || cyanEssences > 0">, </template>
              +{{ magentaPenalty }}% from {{ magentaEssences }}
              <template v-for="key in magentaEssenceKeys" :key="key">
                <span class="ess-icon" :style="essenceIconStyle(key)" />
              </template>
            </template>
          </span>
        </div>
      </div>

      <Signatures v-else :wafer-signature-ids="waferSignatureIds" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Signatures from './Signatures.vue';
import atlasStorage from '../logic/AtlasStorage';
import { atlasSpriteStyle } from '../logic/AtlasSpriteStyle';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { CmdDiscover } from '../logic/input/InputCommands';
import { globalInputQueue } from '../logic/Model';
import type { Point2 } from '../logic/ItemLib';
import { getResourceSpec } from '../logic/Resources';
import { uiState, getGameState } from '../logic/UIState';
import { CYAN_SUCCESS_BONUS_PCT, MAGENTA_SUCCESS_PENALTY_PCT } from '../logic/Const';

export interface GearOutputPreview {
  gearId: string;
  count: number;
  fromEssence: string;
}

export interface WaferInfoPreview {
  totalYieldPct: number;
  signatureYieldBonus: number;
  newSignatureYieldBonus: number;
  newSignatureMatches: Array<{ id: string; offset: Point2 }>;
  cyanYieldBonus: number;
  magentaYieldBonus: number;
  uniqueItemsYieldBonus: number;

  expectedCredits: number;
  expectedChrono: number;
  expectedFlux: number;

  creditsEssences: number;
  chronoEssences: number;
  fluxEssences: number;

  failureChancePct: number;
  emptyCells: number;
  essenceTotals: Record<string, number>;

  gearOutputs: GearOutputPreview[];
}

const props = defineProps<{
  preview: WaferInfoPreview;
  shouldFlashFailure: boolean;
}>();

const creditsSpec = getResourceSpec('credits');
const chronotracesSpec = getResourceSpec('chronotraces');
const timeFluxSpec = getResourceSpec('timeFlux');

const showSignatureTabs = computed(() => uiState.hasDiscoveredSignatures);
const infoTab = ref<'wafer' | 'signatures'>('wafer');

const showYield = computed(() => {
  uiState.discoveryCounter;
  const gs = getGameState();
  return gs?.discoveries?.[DISCOVERY.UI_REFINE_YIELD] === true;
});

const moleculesSource = atlasStorage.getMoleculesSource()!;

const waferSignatureIds = computed(() => {
  return props.preview.newSignatureMatches.map(m => m.id);
});

function signatureInlineStyle(id: string): Record<string, string> {
  const src = moleculesSource;
  const f = atlasStorage.getMoleculesFrame(`sig:inline:${id}`)!;
  const targetSize = 24;
  const scale = targetSize / f.w;
  const atlasW = src.naturalWidth;
  const atlasH = src.naturalHeight;
  return {
    width: `${targetSize}px`,
    height: `${targetSize}px`,
    backgroundImage: `url(${src.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

const creditsEssenceKeys = computed(() => {
  return props.preview.creditsEssences > 0 ? ['red'] : [];
});

const chronoEssenceKeys = computed(() => {
  return props.preview.chronoEssences > 0 ? ['blue'] : [];
});

const fluxEssenceKeys = computed(() => {
  return props.preview.fluxEssences > 0 ? ['green'] : [];
});

const cyanEssences = computed(() => {
  return props.preview.essenceTotals.cyan || 0;
});

const cyanEssenceKeys = computed(() => {
  return cyanEssences.value > 0 ? ['cyan'] : [];
});

const cyanReduction = computed(() => {
  return cyanEssences.value * CYAN_SUCCESS_BONUS_PCT;
});

const magentaEssences = computed(() => {
  return props.preview.essenceTotals.magenta || 0;
});

const magentaEssenceKeys = computed(() => {
  return magentaEssences.value > 0 ? ['magenta'] : [];
});

const magentaPenalty = computed(() => {
  return magentaEssences.value * MAGENTA_SUCCESS_PENALTY_PCT;
});

const failureClass = computed(() => {
  const pct = props.preview.failureChancePct;
  if (pct === 0) return 'success';
  if (pct <= 25) return 'warning';
  return 'danger';
});

const source = atlasStorage.getItemsSource();

function essenceIconStyle(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k)!;
  return atlasSpriteStyle(source, f, { size: 16, mode: 'fixed' });
}

function gearIconStyle(gearId: string): Record<string, string> {
  const gs = getGameState();
  const gearDef = gs!.lib.gear.get(gearId);
  const f = atlasStorage.getItemsFrame(gearDef.image)!;
  return atlasSpriteStyle(source, f, { size: 20, mode: 'fixed' });
}

const shouldFlashSignaturesTab = computed(() => {
  return uiState.hasDiscoveredSignatures && !uiState.hasDiscoveredSignatureInfo;
});

function cycleInfoTab() {
  if (!showSignatureTabs.value) return;
  const newTab = infoTab.value === 'wafer' ? 'signatures' : 'wafer';
  infoTab.value = newTab;
  if (newTab === 'signatures' && !uiState.hasDiscoveredSignatureInfo) {
    globalInputQueue.push(new CmdDiscover({ discoveryId: DISCOVERY.UI_SIGNATURE_INFO }));
  }
}
</script>

<style scoped>
.info-panel {
  background: var(--panel-bg);
  border-radius: 6px;
  padding: 16px;
  width: 772px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--panel-border);
  margin: -16px -16px 0 -16px;
  padding: 0;
}

.info-tab {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 500;
  padding: 12px 16px;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
  text-align: center;
}

.info-tab:hover {
  color: var(--text-primary);
}

.info-tab.active {
  color: #4fd1c5;
  border-bottom-color: #4fd1c5;
}

.info-body {
  flex: 1;
  overflow: visible;
}

.info-panel.clickable {
  cursor: pointer;
}

.stats-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.sig-inline {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: -4px 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
}

.gear-output {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gear-icon {
  display: inline-block;
  vertical-align: middle;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
  width: 20px;
  height: 20px;
}

.gear-count {
  font-weight: 700;
  color: #c084fc;
}

.hl {
  color: var(--accent);
  font-weight: 600;
}

.success {
  color: #4fd1c5;
  font-weight: 500;
}

.yield-bonus {
  color: #22d3d1;
  font-weight: 600;
}

.warning {
  color: #fbbf24;
  font-weight: 500;
}

.danger {
  color: #ef4444;
  font-weight: 500;
}

/* Red highlight for high failure warning on hover */
.stat-row.flash-red {
  background: rgba(239, 68, 68, 0.25);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
  border-radius: 4px;
}

/* Flashing animation for Signatures tab when newly discovered */
.info-tab.flashing {
  animation: tab-flash 1.2s ease-in-out infinite;
}

@keyframes tab-flash {
  0%, 100% {
    color: var(--text-secondary);
    background: transparent;
  }
  50% {
    color: #4fd1c5;
    background: rgba(79, 209, 197, 0.2);
    text-shadow: 0 0 10px rgba(79, 209, 197, 0.8);
  }
}
</style>
