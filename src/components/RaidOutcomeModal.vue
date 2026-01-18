<template>
  <div class="modal-backdrop">
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
            <div class="bar-label">{{ currentBagsUsed }} / {{ currentBagsCapacity }} Bags</div>
          </div>
        </div>
      </header>

      <RaidOutcomeLogPlayback
        ref="playbackRef"
        :entries="logEntries"
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
        <section class="quest-rewards" v-if="raidSuccess && rewardChips.length">
          <div class="qr-chips">
            <span v-for="(chip, i) in rewardChips" :key="i" class="chip" :class="chip.class" :style="chip.style">{{ chip.text }}</span>
          </div>
        </section>
        <section class="raid-changes" v-if="raidChangesPills.length || zoneChangeText">
          <div class="rc-row" v-if="raidChangesPills.length">
            <div class="rc-pills">
              <span v-for="(pill, i) in raidChangesPills" :key="i" class="rc-pill" :class="pill.positive ? 'positive' : 'negative'">{{ pill.text }}</span>
            </div>
          </div>
          <div class="rc-row inline" v-if="zoneChangeText">
            <div class="rc-cap">Zone deterioration: </div>
            <span class="rc-pill negative">{{ zoneChangeText }}</span>
          </div>
        </section>
        <section class="barely-in-time" v-if="raidSuccess && barelyInTime">
          <div class="bt">You have barely escaped the collapsing zone.</div>
        </section>
        <section class="new-quests" v-if="raidSuccess && newQuests.length">
          <div class="nq" v-for="(quest, i) in newQuests" :key="i">
            <span class="nq-text">New investigation available: <strong class="nq-quest-name">{{ quest.name }}</strong></span>
            <div class="nq-hint" role="tooltip">
              <QuestHint :quest="quest" />
            </div>
          </div>
        </section>
      </section>
      <section class="death-note" v-if="timelineComplete && !raidSuccess">
        <div class="zc">You died. The time loop resets.</div>
        <div class="reimbursed" v-if="reimbursedCredits > 0">
          Insurance Reimbursed: <strong>{{ reimbursedCredits }} CR</strong>
        </div>
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
          <button class="btn primary" @click="changeSetup">{{ newQuests.length > 0 ? 'Review unlocked investigations' : 'Change Setup' }}</button>
          <button v-if="gainedItems.length > 0 && uiState.hasDiscoveredRefineTab" class="btn primary" @click="goRefine">Refine</button>
        </template>
      </footer>
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { uiState, getGameLib, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAcknowledgeOutcome, CmdConsumeOutcomeRewards, CmdSwitchTab } from '../logic/input/InputCommands';
import ItemDisplay from './ItemDisplay.vue';
import QuestHint from './QuestHint.vue';
import { formatDurationHM } from '../logic/StringUtils';
import { useRaidAgain } from '../logic/useRaidAgain';
import type { RaidEventLogEntry } from '../logic/RaidLog';
import RaidOutcomeLogPlayback from './raidOutcome/RaidOutcomeLogPlayback.vue';
import { describeMutation, type RaidMutation } from '../logic/RaidMutation';
import { getResourceSpec, type ResourceKey } from '../logic/Resources';

const outcome = computed(() => uiState.lastOutcome!);
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
  if (complete) {
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
    if (e.kind === 'FightEncounter' && e.summoned) continue;
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

const zoneCollapseSec = computed(() => outcome.value.zoneCollapseSec || 0);

// Progress bar percentages
// Bars decrease: show remaining time/hp/bags as percentage
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

// Flashing states for critical conditions
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

const raidSuccess = computed(() => outcome.value.success);

const gainedItems = computed(() => (outcome.value.looted || []).filter(it => (it.quantity || 0) > 0));
const discardedItems = computed(() => (outcome.value.discarded || []).filter(it => (it.quantity || 0) > 0));

const zoneChangeText = computed(() => {
  return outcome.value.zoneChange || '';
});

const newQuests = computed(() => {
  const ids = outcome.value.newQuestsAvailable;
  const lib = getGameLib()!;
  return ids.map(id => lib.quests.get(id)!);
});

const barelyInTime = computed(() => {
  return outcome.value.barelyInTime;
});

const reimbursedCredits = computed(() => {
  return outcome.value.reimbursedCredits || 0;
});

type RewardChip = { text: string; class: string; style?: Record<string, string> };

const rewardChips = computed<RewardChip[]>(() => {
  const out: RewardChip[] = [];
  const rewards = outcome.value.rewardsApplied || [];
  const lib = getGameLib()!;

  const resourceTotals: Record<string, number> = {};
  const gearTotals: Record<string, number> = {};
  const unlockedRaidIds: string[] = [];
  for (const r of rewards) {
    if (r.kind === 'resource') {
      resourceTotals[r.resource] = (resourceTotals[r.resource] || 0) + r.amount;
    } else if (r.kind === 'countable_gear') {
      gearTotals[r.gearId] = (gearTotals[r.gearId] || 0) + r.amount;
    } else if (r.kind === 'unlock_raid') {
      unlockedRaidIds.push(r.raidId);
    }
  }

  const resourceKeys = ['skillPoints', 'credits', 'chronotraces', 'timeFlux', 'shardDust'] as const;
  for (const k of resourceKeys) {
    const v = resourceTotals[k] || 0;
    if (v > 0) out.push({ text: `+${v}${getResourceSpec(k).glyph}`, class: 'res', style: resourceChipStyle(k) });
  }

  for (const [gearId, amount] of Object.entries(gearTotals)) {
    const gearName = lib.gear.get(gearId)?.name ?? gearId;
    out.push({ text: `+${amount} ${gearName}`, class: 'gear' });
  }

  for (const raidId of unlockedRaidIds) {
    const raidName = lib.raids.get(raidId)?.name ?? raidId;
    out.push({ text: `Unlocked: ${raidName}`, class: 'raid-unlock' });
  }

  return out;
});

function resourceChipStyle(key: ResourceKey): Record<string, string> {
  const spec = getResourceSpec(key);
  return { color: spec.color, background: spec.bgColor };
}

type RaidChangePill = { text: string; positive: boolean };

function isMutationPositive(m: RaidMutation): boolean {
  switch (m.kind) {
    case 'LootMutation': return m.count > 0; // more loot sites = good
    case 'WalkMutation': return m.count < 0; // less walking = good
    case 'AddMonsterMutation': return m.count < 0; // fewer monsters = good
    case 'LootDifficultyMutation': return m.amount > 0; // higher loot chance = good
    case 'UpgradeMonsterMutation': return false; // stronger monsters = bad
    case 'QuestMutation': return m.count > 0; // more quests = good
    case 'ZoneCollapseTimeMutation': return m.amount > 0; // more time = good
  }
}

const raidChangesPills = computed<RaidChangePill[]>(() => {
  const out: RaidChangePill[] = [];
  const lc = outcome.value.lootChanceDeltaApplied || 0;
  if (lc) out.push({ text: `Loot chance ${lc >= 0 ? '+' : ''}${lc}%`, positive: lc > 0 });
  const rb = outcome.value.lootingRarityBuffDeltaApplied || 0;
  if (rb) out.push({ text: `Loot rarity ${rb >= 0 ? '+' : ''}${rb}`, positive: rb > 0 });
  if (outcome.value.raidMutationsApplied.length) {
    const gs = getGameState()!;
    for (const m of outcome.value.raidMutationsApplied) {
      const desc = describeMutation(gs, m);
      if (desc) out.push({ text: desc, positive: isMutationPositive(m) });
    }
  }
  if (outcome.value.raidItemsAdded.length) {
    const lib = getGameLib()!;
    for (const id of outcome.value.raidItemsAdded) {
      out.push({ text: `New drop: ${lib.getItem(id).name}`, positive: true });
    }
  }
  return out;
});

function clearFlashTimeouts() {
  if (healthFlashTimeout) { clearTimeout(healthFlashTimeout); healthFlashTimeout = null; }
  if (timeFlashTimeout) { clearTimeout(timeFlashTimeout); timeFlashTimeout = null; }
  healthBarFlashing.value = false;
  timeBarFlashing.value = false;
}

// Watch the outcome object itself to catch new raids starting
watch(() => uiState.lastOutcome, (newOutcome) => {
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

const { raidAgain, canRaidAgain, raidAgainButtonLabel, raidAgainDisabledReason } = useRaidAgain();

function changeSetup() {
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
.progress { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; }
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
.modal-footer-info { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--panel-border); }
.summary { margin-top: 16px; margin-bottom: 12px; display: grid; gap: 8px; }
.summary-row { display: grid; gap: 6px; }
.summary-cap { font-weight: 900; letter-spacing: 0.04em; opacity: 0.95; }
.summary-items { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
.summary-items.dim { filter: grayscale(0.9); }
.summary-items.dim :deep(.item-cell) { opacity: 0.55; }

.new-quests { margin-top: 10px; display: grid; gap: 6px; }
.new-quests .nq { padding: 8px 10px; border-radius: 6px; background: rgba(250, 204, 21, 0.08); border: 1px solid rgba(250, 204, 21, 0.25); font-weight: 500; color: rgba(250, 204, 21, 0.95); position: relative; }
.nq-text { display: block; }
.nq-hint {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  display: none;
  z-index: 20;
  background: var(--hint-bg);
  border: 1px solid var(--hint-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-width: 160px;
  width: max-content;
  max-width: 75vw;
  box-shadow: inset 0 1px 0 var(--panel-shine), 0 8px 24px rgba(0,0,0,0.5);
  pointer-events: none;
}
.nq-hint::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 12px;
  width: 10px;
  height: 10px;
  background: var(--hint-bg);
  border-right: 1px solid var(--hint-border);
  border-bottom: 1px solid var(--hint-border);
  transform: rotate(45deg);
}
.nq:hover .nq-hint { display: block; }
.barely-in-time { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(251, 146, 60, 0.10); border: 1px solid rgba(251, 146, 60, 0.3); }
.barely-in-time .bt { font-weight: 500; color: #fb923c; font-style: italic; }
.quest-rewards { margin-top: 10px; }
.qr-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { display: inline-flex; align-items: baseline; padding: 4px 10px; border-radius: 4px; background: rgba(255,255,255,0.06); font-size: 13px; font-weight: 600; }
.chip.gear { color: #c4b5fd; background: rgba(139, 92, 246, 0.18); }
.chip.raid-unlock { color: #fcd34d; background: rgba(251, 191, 36, 0.18); }

/* Raid changes section */
.raid-changes { margin-top: 10px; display: grid; gap: 8px; }
.rc-row { display: grid; gap: 8px; }
.rc-row.inline { display: flex; align-items: center; gap: 10px; }
.rc-cap { font-weight: 900; letter-spacing: 0.04em; font-size: 11px; text-transform: uppercase; color: rgba(79, 209, 197, 0.8); }
.rc-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.rc-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.rc-pill.positive {
  background: rgba(79, 209, 197, 0.12);
  color: #5eead4;
}
.rc-pill.negative {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}
.death-note { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(255,255,255,0.03); }
.reimbursed { margin-top: 6px; color: #86efac; font-size: 0.95em; }
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
