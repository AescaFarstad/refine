<template>
  <div v-if="visible" class="modal-backdrop">
    <div class="modal">
      <header class="modal-header">
        <h3>Refinery status: <span :class="{ ok: outcome?.success, fail: !outcome?.success }">{{ statusText }}</span></h3>
      </header>

      <section class="modal-body" v-if="outcome">
        <div class="recipe-row" v-if="recipeName">
          <div class="recipe-title">
            <span class="label">Recipe:</span>
            <span class="quality-badge" v-if="qualityName">{{ qualityName }}</span>
          </div>
          <div class="ess-need" v-if="essList.length">
            <div class="ess-unit" v-for="e in essList" :key="e.key">
              <span v-if="getEssenceFrame(e.key) && source" class="ess-icon32" :style="essenceIconStyle32(e.key)" />
              <span v-else class="ess-letter32">{{ essenceLetter(e.key) }}</span>
              <span class="ess-num32">{{ e.value }}</span>
            </div>
          </div>
        </div>
        <div class="result-line">
          <span class="label">Credits:</span>
          <span class="value">{{ credits }}</span>
        </div>
        <div class="result-line">
          <span class="label">Time Flux:</span>
          <span class="value">{{ flux }}</span>
        </div>
        <div class="result-line">
          <span class="label">Chronotraces:</span>
          <span class="value">{{ chrono }}</span>
        </div>
      </section>

      <footer class="modal-actions">
        <button
          v-if="canContinue"
          class="time-advance-btn btn-left"
          type="button"
          @click="continueFlow"
        >
          <span class="btn-label">Continue</span>
          <span class="icon-play" aria-hidden="true">▶</span>
        </button>
        <button v-if="showLoadRefinery" class="btn primary" @click="goRefine">Load refinery</button>
        <button class="btn primary" @click="ack">OK</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAcknowledgeRefineryOutcome, CmdAdvanceTime } from '../logic/input/InputCommands';
import { getGameLib } from '../logic/UIState';
import atlasStorage from '../logic/AtlasStorage';

const visible = computed(() => !!uiState.lastRefineryOutcome);
const outcome = computed(() => uiState.lastRefineryOutcome);
const statusText = computed(() => outcome.value?.success ? 'SUCCESS' : 'FAILURE');
const credits = computed(() => Math.max(0, outcome.value?.creditsGained || 0));
const flux = computed(() => Math.max(0, outcome.value?.timeFluxGained || 0));
const chrono = computed(() => Math.max(0, outcome.value?.chronotracesGained || 0));
const showLoadRefinery = computed(() => uiState.activeTab !== 'refine');
const canContinue = computed(() => !!uiState.canAdvanceTime);

// Recipe/quality derived from outcome
const recipeId = computed(() => outcome.value?.recipeId || '');
const recipe = computed(() => {
  // Depend on recipesVersion so upgrades reflect immediately
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.recipesVersion;
  const lib = getGameLib();
  return recipeId.value && lib ? lib.recipes.get(recipeId.value) : undefined;
});
const recipeName = computed(() => ((recipe.value as any)?.name || recipeId.value || ''));
const qualityId = computed(() => (((recipe.value as any)?.quality || 'standard') as string));
const qualityName = computed(() => {
  const lib = getGameLib();
  return (lib?.recipeQualities.get(qualityId.value)?.name || qualityId.value);
});

// Essence list for display
const orderedKeys: string[] = ['red', 'green', 'blue', 'yellow'];
const essList = computed<Array<{ key: string; value: number }>>(() => {
  const ing = (recipe.value?.ingredients || {}) as Record<string, number>;
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(ing)]));
  return keys
    .map(k => ({ key: k, value: Math.max(0, ing[k] || 0) }))
    .filter(x => x.value > 0);
});

// Atlas-driven essence icons (fallback to letters if atlas not ready)
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try { await atlasStorage.loadItemsAtlas(); } catch (_e) {/* ignore */}
    ready.value = atlasStorage.isItemsAtlasLoaded();
    source.value = atlasStorage.getItemsSource();
  }
});
function getEssenceFrame(k: string) { return atlasStorage.getItemsFrame(k); }
function essenceIconStyle32(k: string): Record<string, string> {
  const f = atlasStorage.getItemsFrame(k);
  if (!source.value || !f) return {} as Record<string, string>;
  const scale = 32 / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: '32px', height: '32px',
    backgroundImage: `url(${source.value.src})`, backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}
function essenceLetter(k: string): string {
  const m: Record<string, string> = { red: 'R', green: 'G', blue: 'B', yellow: 'Y' };
  return m[k] || k[0]?.toUpperCase() || '?';
}

function ack() {
  globalInputQueue.push(new CmdAcknowledgeRefineryOutcome());
}

function goRefine() {
  uiState.activeTab = 'refine';
  ack();
}

function continueFlow() {
  // Acknowledge current outcome and immediately advance time to next event
  ack();
  globalInputQueue.push(new CmdAdvanceTime());
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: 10000; }
.modal { width: min(460px, 92vw); background: linear-gradient(180deg, rgba(20,28,40,0.98), rgba(10,15,26,0.94)); border: 1px solid var(--panel-border); border-radius: 6px; box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine); padding: 16px; }
.modal-header h3 { margin: 0 0 8px 0; font-size: 18px; letter-spacing: 0.02em; }
.ok { color: var(--accent); }
.fail { color: #ef4444; }
.recipe-row { margin: 6px 0 12px 0; }
.recipe-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.quality-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 800; background: rgba(79, 209, 197, 0.12); border: 1px solid rgba(79, 209, 197, 0.35); color: var(--accent-hover); }
.ess-need { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ess-unit { display: inline-flex; align-items: center; gap: 8px; }
.ess-icon32 { display: inline-block; width: 32px; height: 32px; }
.ess-letter32 { display: inline-grid; place-items: center; width: 32px; height: 32px; font-weight: 900; font-size: 18px; opacity: 0.9; border-radius: 4px; background: rgba(255,255,255,0.04); }
.ess-num32 { font-weight: 900; font-size: 28px; line-height: 28px; letter-spacing: -0.02em; }
.result-line { display: flex; align-items: baseline; gap: 8px; margin: 8px 0; }
.label { opacity: 0.85; }
.value { font-weight: 900; color: var(--accent-hover); }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
.btn { padding: 10px 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px; border: 1px solid var(--panel-border); cursor: pointer; }
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }

/* Match TopPanel advance-time button styling */
.time-advance-btn {
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
.time-advance-btn:hover { background: rgba(34,197,94,0.28); }
.time-advance-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
.time-advance-btn:disabled:hover { background: rgba(34,197,94,0.10); }
.time-advance-btn .icon-play { display: inline-block; font-size: 18px; line-height: 1; transform: translateY(-2px); }
.btn-left { margin-right: auto; }
</style>
