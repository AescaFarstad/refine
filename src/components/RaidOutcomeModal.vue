<template>
  <div v-if="visible" class="modal-backdrop">
    <div class="modal">
      <header class="modal-header">
        <h3 class="modal-title"><span class="raiding">Raiding</span> {{ raidTitle }} <span class="time">  {{ formatHMS(displayedTimeSec) }}</span></h3>
        <div class="progress" v-if="totalEncounters > 0">
          <span
            v-for="(_, i) in totalEncounters"
            :key="i"
            class="dot"
            :class="{ done: i < shownCount }"
          >{{ i < shownCount ? '◉' : '◌' }}</span>
        </div>
      </header>

      <RaidOutcomeLogPlayback
        ref="playbackRef"
        :entries="logEntries"
        @update:shownCount="onShownCount"
        @update:timelineComplete="onTimelineComplete"
        @update:displayedTimeSec="onDisplayedTimeSec"
      />
      <!-- Footer-like info: only revealed after full log playback -->
      <section class="modal-footer-info" v-if="timelineComplete">
        <div class="summary" v-if="raidSuccess && (gainedItems.length || discardedItems.length)">
          <div class="summary-row" v-if="gainedItems.length">
            <div class="summary-cap">Gained</div>
            <div class="summary-items">
              <ItemDisplay v-for="it in gainedItems" :key="'g-'+it.id" :id="it.id" :quantity="it.quantity" />
            </div>
          </div>
          <div class="summary-row" v-if="discardedItems.length">
            <div class="summary-cap">Discarded</div>
            <div class="summary-items dim">
              <ItemDisplay v-for="it in discardedItems" :key="'d-'+it.id" :id="it.id" :quantity="it.quantity" :minor="true" />
            </div>
          </div>
        </div>
        <section class="final-state" v-if="raidSuccess">
          <div class="fs-item">Bags: <b>{{ finalBagsUsed }} / {{ finalBagsCapacity }}</b></div>
          <div class="fs-item">Health: <b>{{ finalHp }} / {{ finalMaxHp }}</b></div>
        </section>
        <section class="barely-in-time" v-if="raidSuccess && barelyInTime">
          <div class="bt">You have barely escaped the collapsing zone.</div>
        </section>
        <section class="zone-change" v-if="zoneChangeText">
          <div class="zc">Your activity has changed the zone: <strong>{{ zoneChangeText }}</strong>.</div>
        </section>
      </section>
      <section class="death-note" v-if="timelineComplete && !raidSuccess">
        <div class="zc">You died. The time loop resets.</div>
      </section>

      <footer class="modal-actions">
        <button v-if="!timelineComplete" class="btn" @click="fastForward">Fast-forward</button>
        <template v-else>
          <span class="btn-wrap" :class="{ 'has-tooltip': !canRaidAgain }">
            <button
              class="btn green"
              :class="{ disabled: !canRaidAgain }"
              :disabled="!canRaidAgain"
              @click="raidAgain"
            >{{ raidAgainButtonLabel }}</button>
            <span class="tooltip" v-if="!canRaidAgain">{{ raidAgainDisabledReason }}</span>
          </span>
          <button class="btn primary" @click="changeSetup">Change Setup</button>
          <button class="btn primary" @click="goRefine">Refine</button>
        </template>
      </footer>
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { uiState, getGameLib } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAknowledgeOutcome } from '../logic/input/InputCommands';
import ItemDisplay from './ItemDisplay.vue';
import { formatDurationHM } from '../logic/StringUtils';
import { useRaidAgain } from '../logic/useRaidAgain';
import type { RaidEventLogEntry } from '../logic/RaidLog';
import RaidOutcomeLogPlayback from './raidOutcome/RaidOutcomeLogPlayback.vue';

const visible = computed(() => !!uiState.lastOutcome);
const logEntries = computed<RaidEventLogEntry[]>(() => {
  const o: any = uiState.lastOutcome as any;
  return (o && o.log && Array.isArray(o.log.entries)) ? (o.log.entries as RaidEventLogEntry[]) : [];
});

const shownCount = ref(0);
const timelineComplete = ref(false);
const displayedTimeSec = ref(0);
const playbackRef = ref<{ fastForward?: () => void } | null>(null);

function onShownCount(v: number) { shownCount.value = v; }
function onTimelineComplete(v: boolean) { timelineComplete.value = v; }
function onDisplayedTimeSec(v: number) { displayedTimeSec.value = v; }

const totalEncounters = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return Math.max(0, o?.plannedEncounters || 0);
});

// Header helpers
const raidTitle = computed(() => {
  const o: any = uiState.lastOutcome as any;
  const id: string = (o?.id || '').trim();
  const lib = getGameLib();
  const name = id ? (lib?.raids.get(id)?.name || '') : '';
  return name || (id || '');
});

const raidSuccess = computed(() => !!((uiState.lastOutcome as any)?.success));

// Summary: aggregate gained and discarded items across the entire log
function aggregateItems(filter: (e: any) => boolean): Array<{ id: string; quantity: number }> {
  const counts: Record<string, number> = {};
  for (const e of logEntries.value as any[]) {
    if (!e || e.kind !== 'LootEncounter') continue;
    if (!filter(e)) continue;
    const id = e.itemId as string;
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return Object.entries(counts).map(([id, quantity]) => ({ id, quantity }));
}
const gainedItems = computed(() => aggregateItems((e) => !!e.itemId && !e.discarded));
const discardedItems = computed(() => aggregateItems((e) => !!e.itemId && !!e.discarded));

const zoneChangeText = computed(() => {
  const o: any = uiState.lastOutcome as any;
  const s = (o && typeof o.zoneChange === 'string') ? (o.zoneChange as string) : '';
  return s || '';
});

const finalHp = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return Math.max(0, o?.finalHp ?? 0);
});

const finalMaxHp = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return Math.max(0, o?.finalMaxHp ?? 0);
});

const finalBagsUsed = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return Math.max(0, o?.finalBagsUsed ?? 0);
});

const finalBagsCapacity = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return Math.max(0, o?.finalBagsCapacity ?? 0);
});

const barelyInTime = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return !!o?.barelyInTime;
});

// Watch the outcome object itself to catch new raids starting
watch(() => uiState.lastOutcome, (newOutcome, oldOutcome) => {
  if (newOutcome) {
    // Prevent background page scroll when modal is open
    try { document.body.style.overflow = 'hidden'; } catch (_) {}
    shownCount.value = 0;
    displayedTimeSec.value = 0;
    timelineComplete.value = false;
  } else {
    shownCount.value = 0;
    displayedTimeSec.value = 0;
    timelineComplete.value = false;
    // Restore background scroll
    try { document.body.style.overflow = ''; } catch (_) {}
  }
});

onBeforeUnmount(() => {
  // Ensure we restore body scroll if component unmounts while open
  try { document.body.style.overflow = ''; } catch (_) {}
});

function fastForward() {
  playbackRef.value?.fastForward?.();
}

const { raidAgain, canRaidAgain, raidAgainButtonLabel, raidAgainDisabledReason } = useRaidAgain();

function changeSetup() {
  globalInputQueue.push(new CmdAknowledgeOutcome());
}

function goRefine() {
  globalInputQueue.push(new CmdAknowledgeOutcome());
  uiState.activeTab = 'refine';
}

function formatHMS(totalSec?: number): string { return formatDurationHM(totalSec); }
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: 10000; }
.modal { width: 780px; max-width: 96vw; background: linear-gradient(180deg, rgba(20,28,40,0.98), rgba(10,15,26,0.94)); border: 1px solid var(--panel-border); border-radius: 6px; box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine); padding: 16px; height: min(1000px, 95vh); display: grid; grid-template-rows: auto 1fr auto; }
.modal-header { display: grid; grid-template-rows: auto auto; align-items: start; gap: 8px; }
.modal-title { margin: 0; font-size: 18px; letter-spacing: 0.02em; display: flex; align-items: baseline; gap: 10px; }
.modal-title .raiding { font-weight: 400; }
.modal-title .time { opacity: 0.8; font-size: 0.95em; }
.progress { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; }
.dot { color: var(--text-secondary); }
.dot.done { color: var(--accent-hover); }
.modal-footer-info { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--panel-border); }
.summary { margin-top: 16px; margin-bottom: 12px; display: grid; gap: 8px; }
.summary-row { display: grid; gap: 6px; }
.summary-cap { font-weight: 900; letter-spacing: 0.04em; opacity: 0.95; }
.summary-items { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
.summary-items.dim { filter: grayscale(0.9); }
.summary-items.dim :deep(.item-cell) { opacity: 0.55; }

.zone-change { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(255,255,255,0.03); }
.zone-change .zc { font-weight: 400; }
.barely-in-time { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(251, 146, 60, 0.10); border: 1px solid rgba(251, 146, 60, 0.3); }
.barely-in-time .bt { font-weight: 500; color: #fb923c; font-style: italic; }
.final-state { margin-top: 10px; display: flex; gap: 10px; }
.final-state .fs-item { padding: 8px 10px; border: none; border-radius: 6px; background: rgba(255,255,255,0.03); font-weight: 400; opacity: 0.9; }
.death-note { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(255,255,255,0.03); }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
.btn-wrap { display: inline-block; position: relative; }
.btn-wrap .tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 8px 12px;
  background: rgba(10, 14, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #f0c070;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: none;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.btn-wrap .tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(10, 14, 20, 0.95);
}
.btn-wrap:hover .tooltip { opacity: 1; }
.btn { padding: 10px 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 4px; border: 1px solid var(--panel-border); cursor: pointer; background: rgba(255,255,255,0.03); color: inherit; }
.btn:hover { background: rgba(255,255,255,0.08); }
.btn.primary { background: rgba(79, 209, 197, 0.14); color: var(--accent); }
.btn.primary:hover { background: rgba(79, 209, 197, 0.22); }
.btn.green { background: rgba(34, 197, 94, 0.18); color: #86efac; border-color: rgba(34, 197, 94, 0.35); }
.btn.green:hover { background: rgba(34, 197, 94, 0.28); }
.btn.disabled, .btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.disabled:hover, .btn:disabled:hover { background: rgba(34, 197, 94, 0.10); border-color: rgba(34, 197, 94, 0.22); }
/* Ensure tooltips are always fully opaque when visible, even for dimmed items */
.summary-items.dim :deep(.tooltip-panel) {
  filter: none !important;
}
</style>
