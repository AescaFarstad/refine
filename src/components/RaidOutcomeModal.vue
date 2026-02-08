<template>
  <div class="modal-backdrop" @click.self="closeModal">
    <div class="modal">
      <header class="modal-header">
        <div class="header-top">
          <h3 class="modal-title"><span class="raiding">Raiding</span> {{ raidTitle }}</h3>
          <div class="progress" v-if="totalEncounters > 0">
            <span
              v-for="(_, i) in totalEncounters"
              :key="i"
              class="dot"
              :class="{ done: i < shownNonSummonedCount }"
            >{{ i < shownNonSummonedCount ? '◉' : '◌' }}</span>
          </div>
        </div>
        <div class="header-bars" :class="{ 'no-transition': suppressBarTransition }">
          <div class="bar-panel time-bar" :class="{ flashing: timeBarFlashing }" :style="{ '--bar-pct': timeBarPct + '%', '--danger': timeDangerLevel }">
            <div class="bar-label">{{ formatHMS(displayedTimeSec) }}<span class="bar-max" v-if="zoneCollapseSec > 0"> / {{ formatHMS(zoneCollapseSec) }}</span></div>
          </div>
          <div class="bar-panel health-bar" :class="{ flashing: healthBarFlashing }" :style="{ '--bar-pct': healthBarPct + '%', '--danger': healthDangerLevel }">
            <div class="bar-label">{{ currentHp }} / {{ currentMaxHp }} HP</div>
          </div>
          <div class="bar-panel bags-bar" :style="{ '--bar-pct': bagsBarPct + '%' }">
            <div class="bar-label">{{ currentBagsCapacity - currentBagsUsed }} / {{ currentBagsCapacity }} free volume</div>
          </div>
        </div>
      </header>

      <RaidOutcomeLogPlayback
        ref="playbackRef"
        :entries="logEntries"
        :instant="readonlyView"
        @update:shownCount="onShownCount"
        @update:timelineComplete="onTimelineComplete"
        @update:displayedTimeSec="onDisplayedTimeSec"
        @update:currentHp="onCurrentHp"
        @update:currentMaxHp="onCurrentMaxHp"
        @update:bagsUsed="onBagsUsed"
        @update:bagsCapacity="onBagsCapacity"
        @initialValuesReady="onInitialValuesReady"
      />
      <!-- Footer-like info: only revealed after full log playback -->
      <RaidOutcomeSummary v-if="timelineComplete" :outcome="outcome" />

      <footer class="modal-actions">
        <template v-if="readonlyView">
          <button class="btn primary" @click="closeModal">Close</button>
        </template>
        <button v-else-if="!timelineComplete" class="btn primary" @click="fastForward">Fast-forward</button>
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
          <button class="btn primary" @click="closeModal">{{ newQuestsAvailableCount > 0 ? 'Review unlocked objectives' : 'Change Setup' }}</button>
          <button v-if="gainedItemsCount > 0 && uiState.hasDiscoveredRefineTab" class="btn primary" @click="goRefine">Refine</button>
        </template>
      </footer>
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { uiState, getGameLib } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAcknowledgeOutcome, CmdConsumeOutcomeRewards, CmdSwitchTab } from '../logic/input/InputCommands';
import { formatDurationHM } from '../logic/StringUtils';
import { useRaidAgain } from '../logic/useRaidAgain';
import type { RaidEventLogEntry } from '../logic/RaidLog';
import type { RaidOutcome } from '../logic/GameState';
import RaidOutcomeLogPlayback from './raidOutcome/RaidOutcomeLogPlayback.vue';
import RaidOutcomeSummary from './raidOutcome/RaidOutcomeSummary.vue';

const props = withDefaults(defineProps<{
  outcome?: RaidOutcome | null;
  readonlyView?: boolean;
}>(), {
  outcome: null,
  readonlyView: false,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const readonlyView = computed(() => props.readonlyView);
const outcome = computed(() => props.outcome ?? uiState.lastOutcome!);
const logEntries = computed<RaidEventLogEntry[]>(() => outcome.value.log.entries);

const shownCount = ref(0);
const timelineComplete = ref(false);
const displayedTimeSec = ref(0);
const currentHp = ref(0);
const currentMaxHp = ref(0);
const currentBagsUsed = ref(0);
const currentBagsCapacity = ref(0);
const playbackRef = ref<{ fastForward?: () => void } | null>(null);
const suppressBarTransition = ref(false);

function onShownCount(v: number) { shownCount.value = v; }
function onTimelineComplete(v: boolean) { timelineComplete.value = v; }
function onDisplayedTimeSec(v: number) { displayedTimeSec.value = v; }

watch(timelineComplete, (complete) => {
  if (complete && !readonlyView.value) {
    globalInputQueue.push(new CmdConsumeOutcomeRewards());
  }
});
function onCurrentHp(v: number) { currentHp.value = v; }
function onCurrentMaxHp(v: number) { currentMaxHp.value = v; }
function onBagsUsed(v: number) { currentBagsUsed.value = v; }
function onBagsCapacity(v: number) { currentBagsCapacity.value = v; }
function onInitialValuesReady() {
  // Re-enable transitions after initial values have been painted.
  // Use double requestAnimationFrame: first one schedules after layout,
  // second one ensures the paint has occurred before re-enabling transitions.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      suppressBarTransition.value = false;
    });
  });
}

const totalEncounters = computed(() => {
  return outcome.value.plannedEncounters;
});


const shownNonSummonedCount = computed(() => {
  const entries = logEntries.value.slice(0, shownCount.value);
  let count = 0;
  for (const e of entries) {
    if (e.injected) continue;
    count++;
  }
  return count;
});

// Header helpers
const raidTitle = computed(() => {
  const id = outcome.value.id;
  const lib = getGameLib()!;
  return lib.raids.get(id)!.name;
});

const zoneCollapseSec = computed(() => outcome.value.zoneCollapseSec);

const timeBarPct = computed(() => {
  const max = zoneCollapseSec.value;
  if (max <= 0) return 100; // No collapse limit = full bar
  const remaining = Math.max(0, max - displayedTimeSec.value);
  return Math.min(100, (remaining / max) * 100);
});

const healthBarPct = computed(() => {
  const max = currentMaxHp.value;
  if (max <= 0) return 0;
  return Math.min(100, (currentHp.value / max) * 100);
});

const bagsBarPct = computed(() => {
  const max = currentBagsCapacity.value;
  if (max <= 0) return 100; // No capacity = full bar
  const remaining = Math.max(0, max - currentBagsUsed.value);
  return Math.min(100, (remaining / max) * 100);
});

// Color intensity for danger states (0 = safe, 1 = critical)
const timeDangerLevel = computed(() => {
  const max = zoneCollapseSec.value;
  if (max <= 0) return 0;
  return Math.min(1, displayedTimeSec.value / max);
});

const healthDangerLevel = computed(() => {
  const max = currentMaxHp.value;
  if (max <= 0) return 1;
  return 1 - Math.min(1, currentHp.value / max);
});

const healthBarFlashingCondition = computed(() => currentHp.value <= 0);
const timeBarFlashingCondition = computed(() => {
  const max = zoneCollapseSec.value;
  if (max <= 0) return false;
  return displayedTimeSec.value >= max && !outcome.value.success;
});

const healthBarFlashing = ref(false);
const timeBarFlashing = ref(false);
let healthFlashTimeout: ReturnType<typeof setTimeout> | null = null;
let timeFlashTimeout: ReturnType<typeof setTimeout> | null = null;

watch(healthBarFlashingCondition, (shouldFlash) => {
  if (shouldFlash) {
    healthBarFlashing.value = true;
    if (healthFlashTimeout) clearTimeout(healthFlashTimeout);
    healthFlashTimeout = setTimeout(() => { healthBarFlashing.value = false; }, 1000);
  } else {
    healthBarFlashing.value = false;
    if (healthFlashTimeout) { clearTimeout(healthFlashTimeout); healthFlashTimeout = null; }
  }
});

watch(timeBarFlashingCondition, (shouldFlash) => {
  if (shouldFlash) {
    timeBarFlashing.value = true;
    if (timeFlashTimeout) clearTimeout(timeFlashTimeout);
    timeFlashTimeout = setTimeout(() => { timeBarFlashing.value = false; }, 1000);
  } else {
    timeBarFlashing.value = false;
    if (timeFlashTimeout) { clearTimeout(timeFlashTimeout); timeFlashTimeout = null; }
  }
});

const newQuestsAvailableCount = computed(() => outcome.value.newQuestsAvailable.length);
const gainedItemsCount = computed(() => outcome.value.looted.filter(it => it.quantity > 0).length);

function clearFlashTimeouts() {
  if (healthFlashTimeout) { clearTimeout(healthFlashTimeout); healthFlashTimeout = null; }
  if (timeFlashTimeout) { clearTimeout(timeFlashTimeout); timeFlashTimeout = null; }
  healthBarFlashing.value = false;
  timeBarFlashing.value = false;
}

// Watch the outcome object itself to catch modal open/close/reset
watch(() => outcome.value, (newOutcome) => {
  if (newOutcome) {
    document.body.style.overflow = 'hidden';
    // Suppress bar transitions so initial values appear instantly
    // (will be re-enabled by onInitialValuesReady event from child)
    suppressBarTransition.value = true;
    shownCount.value = 0;
    displayedTimeSec.value = 0;
    timelineComplete.value = false;
    currentHp.value = 0;
    currentMaxHp.value = 0;
    currentBagsUsed.value = 0;
    currentBagsCapacity.value = 0;
    clearFlashTimeouts();
  } else {
    shownCount.value = 0;
    displayedTimeSec.value = 0;
    timelineComplete.value = false;
    currentHp.value = 0;
    currentMaxHp.value = 0;
    currentBagsUsed.value = 0;
    currentBagsCapacity.value = 0;
    clearFlashTimeouts();
    document.body.style.overflow = '';
  }
});

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  clearFlashTimeouts();
});

function fastForward() {
  playbackRef.value!.fastForward!();
}

const raidAgainApi = props.readonlyView ? null : useRaidAgain();
const raidAgain = () => {
  raidAgainApi!.raidAgain();
};
const canRaidAgain = computed(() => raidAgainApi?.canRaidAgain.value ?? false);
const raidAgainButtonLabel = computed(() => raidAgainApi?.raidAgainButtonLabel.value ?? '');
const raidAgainDisabledReason = computed(() => raidAgainApi?.raidAgainDisabledReason.value ?? '');

function closeModal() {
  if (readonlyView.value) {
    emit('close');
    return;
  }
  globalInputQueue.push(new CmdAcknowledgeOutcome());
}

function goRefine() {
  globalInputQueue.push(new CmdAcknowledgeOutcome());
  globalInputQueue.push(new CmdSwitchTab({ tab: 'refine' }));
}

function formatHMS(totalSec?: number): string { return formatDurationHM(totalSec); }
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: 10000; }
.modal { width: 880px; max-width: 96vw; background: linear-gradient(180deg, rgba(20,28,40,0.98), rgba(10,15,26,0.94)); border: 1px solid var(--panel-border); border-radius: 6px; box-shadow: 0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--panel-shine); padding: 16px; height: min(1000px, 95vh); display: grid; grid-template-rows: auto 1fr auto; }
.modal-header { display: grid; grid-template-rows: auto auto; align-items: start; gap: 8px; }
.header-top { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.modal-title { margin: 0; font-size: 18px; letter-spacing: 0.02em; display: flex; align-items: baseline; gap: 10px; }
.modal-title .raiding { font-weight: 400; }
.progress { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; flex-wrap: wrap; }
.dot { color: var(--text-secondary); }
.dot.done { color: var(--accent-hover); }

/* Header progress bars */
.header-bars { display: flex; gap: 12px; flex-wrap: wrap; }
.bar-panel {
  position: relative;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.08);
  min-width: 140px;
  flex: 1;
  overflow: hidden;
}
.bar-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  width: var(--bar-pct, 0%);
  transition: width 0.15s ease-out;
  border-radius: 5px;
}
.bar-panel.time-bar::before { background: color-mix(in srgb, rgba(239, 68, 68, 0.4) calc(var(--danger, 0) * 100%), rgba(79, 209, 197, 0.3)); }
.bar-panel.health-bar::before { background: color-mix(in srgb, rgba(239, 68, 68, 0.4) calc(var(--danger, 0) * 100%), rgba(104, 211, 145, 0.3)); }
.bar-panel.bags-bar::before { background: rgba(246, 173, 85, 0.3); }
.bar-panel.flashing {
  animation: erratic-flash 0.15s infinite;
}
@keyframes erratic-flash {
  0% { background: rgba(239, 68, 68, 0.5); box-shadow: 0 0 12px rgba(239, 68, 68, 0.6); }
  25% { background: rgba(0, 0, 0, 0.5); box-shadow: none; }
  50% { background: rgba(239, 68, 68, 0.7); box-shadow: 0 0 18px rgba(239, 68, 68, 0.8); }
  75% { background: rgba(0, 0, 0, 0.3); box-shadow: 0 0 6px rgba(239, 68, 68, 0.3); }
  100% { background: rgba(239, 68, 68, 0.4); box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
}
.header-bars.no-transition .bar-panel::before { transition: none; }
.bar-label { position: relative; z-index: 1; font-size: 12px; font-weight: 600; opacity: 0.9; }
.bar-label .bar-max { opacity: 0.6; }
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
</style>
