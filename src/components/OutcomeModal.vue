<template>
  <div v-if="visible" class="modal-backdrop">
    <div class="modal">
      <header class="modal-header">
        <h3>Raid status: <span :class="{ ok: outcome?.success, fail: !outcome?.success }">{{ statusText }}</span></h3>
      </header>

      <section class="modal-body" v-if="outcome">
        <div class="advance">Quest advanced by <strong>{{ advPct }}%</strong></div>
        <div class="quest-progress">
          <div class="bar">
            <div class="fill" :style="{ width: progressPct + '%' }" />
            <div class="label">Quest {{ currentProgress }} / {{ target }}</div>
          </div>
        </div>
        <div v-if="unlockedName" class="unlock-banner">Unlocked: {{ unlockedName }}</div>

        <div class="loot-section" v-if="hasAnyLoot">
          <h4>
            Items Looted
            <span class="vol-summary">Volume: {{ usedVolume }} / {{ startVolume }}</span>
            <span v-if="essenceSummary.length" class="ess-summary">
              <span class="ess-s-label">Total essenses:</span>
              <template v-for="(e, idx) in essenceSummary" :key="e.key">
                <span class="ess-s-num">{{ e.value }}</span>
                <span v-if="getEssenceFrame(e.key) && source" class="ess-s-icon" :style="essenceIconStyle(e.key)" />
                <span v-if="idx < essenceSummary.length - 1" class="ess-s-sp" />
              </template>
            </span>
          </h4>
          <ItemGrid :items="lootedRaw" />

          <div v-if="discardedByLuckRaw.length" class="discard-group">
            <div class="discard-title">Discarded by luck</div>
            <ItemGrid :items="discardedByLuckRaw" :minor="true" />
          </div>

          <div v-if="discardedByVolumeRaw.length" class="discard-group">
            <div class="discard-title">Discarded by volume (Your bags were full)</div>
            <ItemGrid :items="discardedByVolumeRaw" :minor="true" />
          </div>
        </div>
      </section>

      <footer class="modal-actions">
        <button class="btn primary" @click="raidMore">Raid more</button>
        <button class="btn primary" @click="goRefine">Refine</button>
        <button v-if="hasLevelups" class="btn primary" @click="levelUp">Level up</button>
      </footer>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiState } from '../logic/UIState';
import { QUEST_POINTS } from '../logic/GameState';
import { globalInputQueue } from '../logic/Model';
import { CmdAknowledgeOutcome } from '../logic/input/InputCommands';
import ItemGrid from './ItemGrid.vue';
import itemsData from '../data/items';
import atlasStorage from '../logic/AtlasStorage';

const visible = computed(() => !!uiState.lastOutcome);
const outcome = computed(() => uiState.lastOutcome);
const statusText = computed(() => outcome.value?.success ? 'SUCCESS' : 'FAILURE');
const advPct = computed(() => Math.max(0, Math.round(outcome.value?.questDeltaPct || 0)));

const unlockedName = computed(() => {
  const id = outcome.value?.unlockedRaidId || '';
  if (!id) return '';
  const def = uiState.raids.find(r => r.id === id);
  return def?.name || id;
});

const currentProgress = computed(() => {
  if (!outcome.value) return 0;
  return Math.max(0, Math.round(uiState.questProgressById[outcome.value.id] || 0));
});
const target = computed(() => {
  if (!outcome.value) return QUEST_POINTS;
  const done = Math.max(0, outcome.value.questsDone || 0);
  return Math.round(QUEST_POINTS * Math.pow(2, done));
});
const progressPct = computed(() => {
  const t = Math.max(1, target.value);
  const pct = (currentProgress.value / t) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
});

const hasLevelups = computed(() => (uiState.levelupsAvailable || 0) > 0);

const lootedRaw = computed(() => outcome.value?.looted || []);
const discardedByLuckRaw = computed(() => outcome.value?.discardedByLuck || []);
const discardedByVolumeRaw = computed(() => outcome.value?.discardedByVolume || []);
const hasAnyLoot = computed(() => lootedRaw.value.length > 0 || discardedByLuckRaw.value.length > 0 || discardedByVolumeRaw.value.length > 0);

// Volume summary
const usedVolume = computed(() => {
  let total = 0;
  for (const it of lootedRaw.value) {
    const def = (itemsData as any)[it.id] as { volume?: number } | undefined;
    const vol = def?.volume ?? 0;
    const qty = Math.max(1, it.quantity || 1);
    total += vol * qty;
  }
  return total;
});
const startVolume = computed(() => Math.max(0, uiState.volume || 0));

// Essence summary over looted items only
type EssenceKey = 'red' | 'green' | 'blue' | 'yellow' | string;
const orderedKeys: EssenceKey[] = ['red', 'green', 'blue', 'yellow'];
const essenceTotals = computed<Record<string, number>>(() => {
  const totals: Record<string, number> = {};
  for (const it of lootedRaw.value) {
    const def = (itemsData as any)[it.id] as { essence?: Record<string, number> } | undefined;
    const e = def?.essence || {};
    const qty = Math.max(1, it.quantity || 1);
    for (const [k, v] of Object.entries(e)) {
      if (!v) continue;
      totals[k] = (totals[k] || 0) + v * qty;
    }
  }
  return totals;
});
const essenceSummary = computed(() => {
  // Depend on atlas source so this recomputes once icons are ready
  const _src = source.value;
  const keys = Array.from(new Set([...orderedKeys, ...Object.keys(essenceTotals.value)]));
  return keys
    .filter(k => !!atlasStorage.getItemsFrame(k) && !!_src)
    .map(k => ({ key: k, value: essenceTotals.value[k] || 0 }))
    .filter(x => x.value > 0);
});

// Atlas state for essence icons
const source = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const ready = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (!ready.value) {
    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) { /* noop */ }
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
  const scale = 14 / Math.max(f.w, f.h);
  const atlasW = source.value.naturalWidth;
  const atlasH = source.value.naturalHeight;
  return {
    width: '14px',
    height: '14px',
    backgroundImage: `url(${source.value.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  } as Record<string, string>;
}

function ack() {
  globalInputQueue.push(new CmdAknowledgeOutcome());
}

function raidMore() {
  uiState.activeTab = 'raid';
  ack();
}

function goRefine() {
  uiState.activeTab = 'refine';
  ack();
}

function levelUp() {
  if (!hasLevelups.value) return;
  ack();
  uiState.levelUpOpen = true;
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 10000;
}
.modal {
  width: min(560px, 92vw);
  background: linear-gradient(180deg, rgba(20, 28, 40, 0.98), rgba(10, 15, 26, 0.94));
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine);
  padding: 16px;
}
.modal-header h3 { margin: 0 0 8px 0; font-size: 18px; letter-spacing: 0.02em; }
.ok { color: var(--accent); }
.fail { color: #ef4444; }

.advance { margin-bottom: 10px; font-weight: 700; }
.quest-progress .bar {
  position: relative;
  height: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 3px;
  background: rgba(255,255,255,0.04);
  overflow: hidden;
}
.quest-progress .fill { height: 100%; background: var(--accent-warm); }
.bar .label { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 700; font-size: 12px; }

.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
.unlock-banner { margin-top: 10px; font-weight: 800; color: var(--accent); }
.btn {
  padding: 10px 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
}
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }

.loot-section { margin-top: 16px; }
.loot-section h4 { margin: 0 0 8px 0; font-size: 14px; letter-spacing: 0.04em; opacity: 0.9; display: flex; align-items: baseline; gap: 8px; }
.vol-summary { font-weight: 700; font-size: 12px; opacity: 0.9; }
.ess-summary { display: inline-flex; align-items: center; gap: 6px; opacity: 0.9; }
.ess-s-label { font-size: 12px; opacity: 0.85; }
.ess-s-num { font-weight: 800; margin-right: 1px; }
.ess-s-icon { display: inline-block; vertical-align: middle; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.4)); }
.ess-s-sp { width: 8px; display: inline-block; }
.discard-group { margin-top: 12px; }
.discard-title { margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.8; }
</style>
