<template>
  <div v-if="open" class="modal-backdrop" @click.self="closeAll">
    <div class="modal" :class="{ full: hasFullscreen }">
      <section class="modal-body" v-if="!hasFullscreen">
        <div class="window-btn-row">
          <button v-for="k in atlasKeys" :key="k" class="btn atlas-btn" @click="openAtlas(k)">
            {{ k.toUpperCase() }}
          </button>
          <button class="btn primary" type="button" @click="openMoleculeEditor">
            Molecule Editor
          </button>
          <button class="btn primary" type="button" @click="openEditResearchPane">
            Edit Research Pane
          </button>
        </div>

        <div class="window-btn-row" style="margin-top: 6px;">
          <button
            v-for="uiKey in REWARD_UI_KEYS"
            :key="uiKey"
            class="btn primary"
            type="button"
            @click="triggerUIModal(uiKey)"
          >
            {{ formatUILabel(uiKey) }}
          </button>
        </div>

        <h4 class="section-title">Time</h4>
        <div class="time-cheat-row">
          <span class="time-cheat-label">{{ timeDisplay }}</span>
          <button
            v-for="step in TIME_STEPS"
            :key="'back-' + step.sec"
            class="btn time-cheat-btn"
            type="button"
            @click="rewindTime(step.sec)"
          >
            -{{ step.label }}
          </button>
          <span class="time-cheat-divider" />
          <button
            v-for="step in TIME_STEPS"
            :key="'fwd-' + step.sec"
            class="btn primary time-cheat-btn"
            type="button"
            :disabled="!canAdvanceTime"
            @click="advanceTime(step.sec)"
          >
            +{{ step.label }}
          </button>
        </div>

        <h4 class="section-title">Grant Resources</h4>
        <div class="resource-and-discovery">
          <div class="resource-grid">
            <div v-for="res in resources" :key="res.key" class="resource-row">
              <span class="resource-label" :style="{ color: res.color }">
                <span class="resource-glyph">{{ res.glyph }}</span>
                {{ res.name }}
              </span>
              <button class="btn" @click="setResource(res.key, 0)">0</button>
              <button class="btn" @click="grantResource(res.key, 10)">+10</button>
              <button class="btn" @click="grantResource(res.key, 100)">+100</button>
              <button class="btn" @click="grantResource(res.key, 1000)">+1k</button>
              <button class="btn" @click="grantResource(res.key, 100000)">+100k</button>
            </div>
            <div class="resource-row">
              <span class="resource-label">Nexus</span>
              <button class="btn" type="button" @click="setNexusUpgradeOpportunities(0)">0</button>
              <button class="btn" type="button" @click="grantNexusUpgradeOpportunities(1)">+1</button>
              <button class="btn" type="button" @click="grantNexusUpgradeOpportunities(10)">+10</button>
              <button class="btn primary" type="button" @click="unlockAllNexusUpgrades">Unlock all</button>
            </div>
            <div v-for="cg in countableGearEntries" :key="cg.id" class="resource-row">
              <span class="resource-label">{{ cg.name }}</span>
              <button class="btn" type="button" @click="setCountableGear(cg.id, 0)">0</button>
              <button class="btn" type="button" @click="grantCountableGear(cg.id, 1)">+1</button>
              <button class="btn" type="button" @click="grantCountableGear(cg.id, 10)">+10</button>
              <button class="btn" type="button" @click="grantCountableGear(cg.id, 100)">+100</button>
            </div>
          </div>

          <div class="discovery-area">
            <div class="discovery-panel">
              <button
                class="btn discovery-toggle-all"
                :class="{ primary: allDiscovered }"
                type="button"
                @click="toggleAllDiscoveries"
              >
                {{ allDiscovered ? 'ALL ON' : 'ALL OFF' }}
              </button>
              <div class="discovery-grid">
                <button
                  v-for="id in tabDiscoveryIds"
                  :key="id"
                  class="btn discovery-btn"
                  :class="{ primary: isDiscovered(id) }"
                  type="button"
                  @click="toggleDiscovery(id)"
                >
                  {{ formatDiscoveryLabel(id) }}
                </button>
              </div>
              <hr class="discovery-separator" />
              <div class="discovery-grid">
                <button
                  v-for="id in uiDiscoveryIds"
                  :key="id"
                  class="btn discovery-btn"
                  :class="{ primary: isDiscovered(id) }"
                  type="button"
                  @click="toggleDiscovery(id)"
                >
                  {{ formatDiscoveryLabel(id) }}
                </button>
              </div>
              <hr class="discovery-separator" />
              <div class="discovery-grid">
                <button
                  v-for="id in otherDiscoveryIds"
                  :key="id"
                  class="btn discovery-btn"
                  :class="{ primary: isDiscovered(id) }"
                  type="button"
                  @click="toggleDiscovery(id)"
                >
                  {{ formatDiscoveryLabel(id) }}
                </button>
              </div>
              <hr class="discovery-separator" />
              <div class="discovery-grid">
                <button
                  v-for="id in refineEssenceIds"
                  :key="id"
                  class="btn discovery-btn"
                  :class="{ primary: isDiscovered(id) }"
                  type="button"
                  @click="toggleDiscovery(id)"
                >
                  {{ formatDiscoveryLabel(id) }}
                </button>
              </div>
            </div>

          </div>

          <div class="raid-cheat-column">
            <button
              v-for="raid in raidDefs"
              :key="raid.id"
              class="btn raid-cheat-btn"
              :class="{ primary: isRaidUnlocked(raid.id), active: isRaidActive(raid.id) }"
              :disabled="isRaidActive(raid.id)"
              type="button"
              @click="toggleRaidUnlock(raid.id)"
            >
              {{ raid.name }}
            </button>
            <button v-if="activeMazeOracleNodeId >= 0" class="btn primary discovery-action-btn" type="button" @click="solveOracle">
              Solve oracle
            </button>
          </div>
        </div>

        <div class="signature-cheat-grid" :style="atlasVars">
          <button class="btn sig-all-btn" @click="cycleAllSignatures">ALL</button>
          <div
            v-for="sig in allSignatures"
            :key="sig.id"
            class="sig-cheat-entry"
            :class="signatureEntryClass(sig.id)"
            @click="cycleSignatureState(sig.id)"
          >
            <div class="sig-cheat-sprite" :style="sigCheatSpriteStyle(sig.id)" />
            <div class="sig-cheat-name">{{ sig.name }}</div>
          </div>
        </div>
      </section>

      <section v-else class="viewer" :class="{ fill: hasFullscreen }">
        <DevAtlasView
          v-if="selectedAtlas"
          :atlas="selectedAtlas"
          @close="closeAll"
        />
        <DevMoleculeEditor
          v-else-if="devMoleculeEditorOpen"
          @close="closeAll"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getGameState, uiState, getGameStateMutable, timeDisplay } from '../logic/UIState';
import { Raid } from '../logic/GameState';
import { EvtTimeAdvance } from '../logic/evt/Evt';
import DevAtlasView from './DevAtlasView.vue';
import DevMoleculeEditor from './DevMoleculeEditor.vue';
import { listAtlasKeys, type AtlasKey } from '../logic/AtlasStorage';
import { RESOURCE_SPECS, type ResourceKey } from '../logic/Resources';
import { DISCOVERY, type DiscoveryId } from '../logic/DiscoveryLib';
import { discover } from '../logic/Discover';
import { REWARD_UI_KEYS } from './rewardUI/RewardUIRegistry';
import { CheatCompleteSignatures, CheatUnlockAllNexusUpgrades } from '../logic/cheat/CheatCommands';
import gearData from '../data/gear';
import { processCheats } from '../logic/cheat/CheatProcessor';
import { getMazeOracleNodeIdAtCell } from '../logic/Maze';
import { getOracleSealSolutionCellColors } from '../logic/Oracle';
import { getSignatureAtlasVars, getSignatureSpriteStyle } from '../logic/signatureVisuals';

const open = computed(() => uiState.cheatOpen);

const atlasVars = getSignatureAtlasVars();

// All signatures from lib
const allSignatures = computed(() => {
  const lib = uiState.lib;
  if (!lib) return [];
  return Array.from(lib.signatures.values());
});

const learnedIdSet = computed(() => new Set(uiState.learnedSignatureIds));
const completedIdSet = computed(() => new Set(uiState.completedSignatureIds));

function signatureEntryClass(id: string): Record<string, boolean> {
  const learned = learnedIdSet.value.has(id);
  const completed = completedIdSet.value.has(id);
  return {
    unknown: !learned,
    incomplete: learned && !completed,
    complete: completed,
  };
}

function cycleSignatureState(id: string): void {
  const gs = getGameStateMutable();
  const learnedIdx = gs.learnedSignatureIds.indexOf(id);
  const isLearned = learnedIdx >= 0;
  const isCompleted = gs.completedSignatureIds.includes(id);

  if (!isLearned && !isCompleted) {
    // unknown → learned
    gs.learnedSignatureIds.push(id);
  } else if (isLearned && !isCompleted) {
    // learned → completed
    setCompletedSignatures([...gs.completedSignatureIds, id]);
  } else {
    // completed → unknown
    if (learnedIdx !== -1) gs.learnedSignatureIds.splice(learnedIdx, 1);
    setCompletedSignatures(gs.completedSignatureIds.filter(sigId => sigId !== id));
  }
}

function cycleAllSignatures(): void {
  const gs = getGameStateMutable();
  const ids = allSignatures.value.map(s => s.id);
  const allLearned = ids.every(id => gs.learnedSignatureIds.includes(id));
  const allCompleted = ids.every(id => gs.completedSignatureIds.includes(id));

  if (!allLearned) {
    // not all learned → make all learned
    for (const id of ids) {
      if (!gs.learnedSignatureIds.includes(id)) {
        gs.learnedSignatureIds.push(id);
      }
    }
  } else if (!allCompleted) {
    // all learned but not all completed → make all completed
    setCompletedSignatures(ids);
  } else {
    // all completed → reset all to unknown
    gs.learnedSignatureIds.length = 0;
    setCompletedSignatures([]);
  }
}

function setCompletedSignatures(signatureIds: string[]): void {
  const gs = getGameStateMutable();
  gs.cheats.push(new CheatCompleteSignatures({ signatureIds }));
  processCheats(gs);
}

function sigCheatSpriteStyle(id: string): Record<string, string> {
  const isLearned = learnedIdSet.value.has(id);
  const isCompleted = completedIdSet.value.has(id);
  if (!isLearned) return getSignatureSpriteStyle(id, 'hidden');
  return getSignatureSpriteStyle(id, isCompleted ? 'completed' : 'revealed');
}

const resources = Object.values(RESOURCE_SPECS);
const REFINE_ESSENCE_IDS = new Set<string>([
  DISCOVERY.UI_REFINE_YIELD,
  DISCOVERY.UNIQUE_ITEMS_YIELD,
  DISCOVERY.CYAN_YIELD,
  DISCOVERY.MAGENTA_YIELD,
  DISCOVERY.ESSENCE_RESEARCH_KNOWLEDGE,
  DISCOVERY.MAGENTA_CRYSTALS,
  DISCOVERY.FRACTAL_ESSENCE_YIELD,
  DISCOVERY.SPICE_ESSENCE_YIELD,
  DISCOVERY.WHITE_BLACK_ESSENCE_SWAP,
  DISCOVERY.REFINEMENT_FAILED,
]);

const tabDiscoveryIds = computed<DiscoveryId[]>(() =>
  Object.values(DISCOVERY).filter(id => String(id).startsWith('TAB_'))
);
const uiDiscoveryIds = computed<DiscoveryId[]>(() =>
  Object.values(DISCOVERY).filter(id => String(id).startsWith('UI_') && !REFINE_ESSENCE_IDS.has(id))
);
const otherDiscoveryIds = computed<DiscoveryId[]>(() =>
  Object.values(DISCOVERY).filter(id => !String(id).startsWith('TAB_') && !String(id).startsWith('UI_') && !REFINE_ESSENCE_IDS.has(id))
);
const refineEssenceIds = computed<DiscoveryId[]>(() =>
  Object.values(DISCOVERY).filter(id => REFINE_ESSENCE_IDS.has(id))
);
const activeMazeOracleNodeId = computed(() => {
  uiState.activeTab;
  uiState.mazeVersion;
  if (uiState.activeTab !== 'maze') return -1;
  const gs = getGameState();
  return getMazeOracleNodeIdAtCell(gs, gs.maze.avatarCell);
});

function grantResource(key: ResourceKey, amount: number) {
  getGameStateMutable()[key] += amount;
}

function setResource(key: ResourceKey, amount: number) {
  getGameStateMutable()[key] = amount;
}

function unlockAllNexusUpgrades(): void {
  const gs = getGameStateMutable();
  gs.cheats.push(new CheatUnlockAllNexusUpgrades());
  processCheats(gs);
}

function grantNexusUpgradeOpportunities(amount: number): void {
  const gs = getGameStateMutable();
  gs.mazeNexusUpgradeOpportunityCount += amount;
}

function setNexusUpgradeOpportunities(amount: number): void {
  const gs = getGameStateMutable();
  gs.mazeNexusUpgradeOpportunityCount = amount;
}

const countableGearEntries = Object.entries(gearData)
  .filter(([, d]) => d.countable)
  .map(([id, d]) => ({ id, name: d.name }));

function grantCountableGear(id: string, amount: number): void {
  const gs = getGameStateMutable();
  gs.countableGear[id] = (gs.countableGear[id] || 0) + amount;
  if (!gs.unlockedGear.includes(id)) gs.unlockedGear.push(id);
}

function setCountableGear(id: string, amount: number): void {
  const gs = getGameStateMutable();
  gs.countableGear[id] = amount;
}

function isDiscovered(id: DiscoveryId): boolean {
  // Touch discoveryCounter to react to discovery changes
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.discoveryCounter;
  return getGameStateMutable().discoveries[id] === true;
}

function toggleDiscovery(id: DiscoveryId): void {
  const gs = getGameStateMutable();
  if (gs.discoveries[id] === true) {
    delete gs.discoveries[id];
    gs.discoveryCounter++;
    return;
  }
  discover(gs, id);
}

const allDiscoveryIds = computed<DiscoveryId[]>(() => Object.values(DISCOVERY));
const allDiscovered = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.discoveryCounter;
  const gs = getGameStateMutable();
  return allDiscoveryIds.value.every(id => gs.discoveries[id] === true);
});

function toggleAllDiscoveries(): void {
  const gs = getGameStateMutable();
  if (allDiscovered.value) {
    for (const id of allDiscoveryIds.value) {
      delete gs.discoveries[id];
    }
  } else {
    for (const id of allDiscoveryIds.value) {
      discover(gs, id);
    }
  }
  gs.discoveryCounter++;
}

const raidDefs = computed(() => {
  const lib = uiState.lib;
  if (!lib) return [];
  return Array.from(lib.raids.values()).sort((a, b) => a.order - b.order);
});

function isRaidUnlocked(id: string): boolean {
  return uiState.unlockedRaidIds.includes(id);
}

function isRaidActive(id: string): boolean {
  return getGameState().raid.id === id;
}

const TIME_STEPS: Array<{ label: string; sec: number }> = [
  { label: '1m', sec: 60 },
  { label: '10m', sec: 600 },
  { label: '1h', sec: 3600 },
  { label: '6h', sec: 6 * 3600 },
  { label: '1d', sec: 24 * 3600 },
  { label: '1w', sec: 7 * 24 * 3600 },
];

const canAdvanceTime = computed(() => !uiState.hasPendingEvt);

function rewindTime(deltaSec: number): void {
  const gs = getGameStateMutable();
  gs.gameTime = Math.max(0, gs.gameTime - deltaSec);
}

function advanceTime(deltaSec: number): void {
  const gs = getGameStateMutable();
  if (gs.nextEvt) return;
  gs.nextEvt = new EvtTimeAdvance({ at: gs.gameTime + deltaSec });
  gs.timeActive = true;
}

function toggleRaidUnlock(id: string): void {
  const gs = getGameStateMutable();
  if (gs.raid.id === id) return;
  const idx = gs.unlockedRaids.findIndex(r => r.id === id);
  if (idx >= 0) {
    gs.unlockedRaids.splice(idx, 1);
  } else {
    gs.unlockedRaids.push(new Raid(id));
  }
}

function solveOracle(): void {
  const nodeId = activeMazeOracleNodeId.value;
  if (nodeId < 0) return;
  const gs = getGameState();
  uiState.mazeVisitedOracleNodeId = nodeId;
  uiState.mazeOracleMenuOpen = true;
  uiState.mazeOracleSealMismatchMarkerKeys = [];
  uiState.mazeOracleSealCellColors = getOracleSealSolutionCellColors(gs, nodeId);
}

function formatDiscoveryLabel(id: DiscoveryId): string {
  return String(id).replaceAll('_', ' ');
}

const selectedAtlas = computed(() => uiState.devAtlasKey as AtlasKey | '');
const devMoleculeEditorOpen = computed(() => uiState.devMoleculeEditorOpen);
const hasFullscreen = computed(() => !!selectedAtlas.value || devMoleculeEditorOpen.value);
const atlasKeys = computed<AtlasKey[]>(() => listAtlasKeys());

function openAtlas(key: AtlasKey) {
  uiState.devAtlasKey = key;
  uiState.devMoleculeEditorOpen = false;
}

function openMoleculeEditor() {
  uiState.devAtlasKey = '';
  uiState.devMoleculeEditorOpen = true;
}

function openEditResearchPane() {
  uiState.activeTab = 'research';
  uiState.editResearchOpen = true;
  uiState.cheatOpen = false;
}

function triggerUIModal(uiKey: string) {
  const gs = getGameStateMutable();
  if (!gs.pendingUIModals.some(m => m.ui === uiKey)) {
    gs.pendingUIModals.push({ ui: uiKey });
  }
  uiState.cheatOpen = false;
}

function formatUILabel(key: string): string {
  return key.replaceAll('_', ' ');
}

function closeAll() {
  uiState.cheatOpen = false;
  uiState.devAtlasKey = '';
  uiState.devMoleculeEditorOpen = false;
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  display: grid;
  place-items: center;
  z-index: 20000; /* above other modals */
}
.modal {
  width: fit-content;
  max-width: 95vw;
  max-height: 90vh;
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine);
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.modal.full {
  width: 100vw;
  height: 100vh;
  max-height: none;
  border-radius: 0;
  padding: 0;
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.modal-header h3 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }
.spacer { flex: 1; }

.modal-body { margin-top: 4px; overflow-y: auto; flex: 1; min-height: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 4px; }
.window-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 720px;
}
.window-btn-row .btn { flex: 0 0 auto; }

.viewer { margin-top: 4px; overflow: auto; }
.viewer.fill { margin-top: 0; flex: 1; min-height: 0; }

.btn {
  padding: 4px 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
}
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }
.btn.atlas-btn { background: rgba(251, 191, 36, 0.18); color: rgb(251, 191, 36); }
.btn.atlas-btn:hover { background: rgba(251, 191, 36, 0.28); }

.section-title {
  margin: 8px 0 4px;
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}
.time-cheat-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.time-cheat-label {
  min-width: 100px;
  font-size: 12px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.time-cheat-btn {
  min-width: 44px;
  padding: 3px 6px;
  font-size: 11px;
}
.time-cheat-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.time-cheat-divider {
  width: 1px;
  height: 18px;
  background: var(--panel-border);
  margin: 0 2px;
}
.resource-and-discovery {
  display: grid;
  grid-template-columns: max-content max-content max-content;
  gap: 8px;
  align-items: start;
  justify-content: start;
}
.raid-cheat-column {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 140px;
}
.raid-cheat-btn {
  text-align: left;
  font-size: 11px;
  padding: 3px 6px;
}
.raid-cheat-btn.active {
  outline: 1px solid var(--accent);
  cursor: default;
  opacity: 0.85;
}
.discovery-area {
  display: grid;
  grid-template-columns: max-content;
  gap: 8px;
}
.discovery-panel {
  min-width: 0;
}
.discovery-action-btn {
  width: 100%;
}
.resource-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.resource-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.resource-label {
  min-width: 100px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.resource-glyph {
  font-size: 13px;
}
.discovery-title {
  margin: 0 0 4px;
}
.discovery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
.discovery-btn {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.06em;
}
.discovery-toggle-all {
  margin-bottom: 4px;
  width: 100%;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.discovery-separator {
  border: none;
  border-top: 1px solid var(--panel-border);
  margin: 6px 0;
}

@media (max-width: 820px) {
  .resource-and-discovery {
    grid-template-columns: 1fr;
  }

  .discovery-area {
    grid-template-columns: 1fr;
  }

  .raid-cheat-column {
    min-width: 0;
  }
}

.signature-cheat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 6px;
}

.sig-cheat-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  border: none;
  transition: background 0.12s;
  min-width: 48px;
}

.sig-cheat-entry:hover {
  background: rgba(255, 255, 255, 0.06);
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

.sig-cheat-entry.complete {
  background: rgba(79, 209, 197, 0.08);
}

.sig-cheat-entry.complete .sig-cheat-name {
  color: var(--accent);
}

.sig-cheat-entry.incomplete .sig-cheat-sprite {
  opacity: 0.7;
}

.sig-cheat-entry.unknown .sig-cheat-sprite {
  opacity: 0.5;
}

.sig-all-btn {
  align-self: center;
  min-width: 52px;
  height: 54px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(251, 191, 36, 0.18);
  color: rgb(251, 191, 36);
}
.sig-all-btn:hover {
  background: rgba(251, 191, 36, 0.28);
}

</style>
