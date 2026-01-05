<template>
  <section class="modal-body raid-outcome-playback" ref="bodyRef">
    <ul class="log-list">
      <li
        v-for="(entry, idx) in visibleEntries"
        :key="idx"
        class="log-item appear"
      >
        <div class="col-left enc-col">
          <div class="enc-header">
            <div class="enc-title-time" :class="{ dimmed: isSkipped(entry) }">
              <div class="enc-name-text">
                <template v-if="entry.kind === 'PreparationEncounter'">Preparation</template>
                <template v-else-if="entry.kind === 'WalkEncounter'">Walking</template>
                <template v-else-if="entry.kind === 'LootEncounter'">Scavenging</template>
                <template v-else-if="entry.kind === 'MonsterLootEncounter'">Dissecting the corpse</template>
                <template v-else-if="entry.kind === 'FightEncounter'">
                  <div class="enc-type">Fighting</div>
                  <div class="enc-monster">{{ entry.monsterName }}</div>
                </template>
                <template v-else-if="entry.kind === 'QuestEncounter'">Quest</template>
                <template v-else-if="entry.kind === 'ZoneCollapse'">Zone collapsing</template>
                <template v-else>Encounter</template>
              </div>
              <div class="enc-time">{{ formatHMS(entry.timeSpentSec) }}</div>
            </div>
            <div class="enc-icon-col">
              <div v-if="itemsAtlasReady" class="enc-icon" :class="{ dimmed: isSkipped(entry) }" :style="encounterIconStyle(entry)" />
            </div>
          </div>
        </div>

        <div class="col-right details-col">
          <PreparationEncounterDetails v-if="entry.kind === 'PreparationEncounter'" :entry="entry" />
          <WalkEncounterDetails v-else-if="entry.kind === 'WalkEncounter'" :entry="entry" />
          <LootEncounterDetails v-else-if="entry.kind === 'LootEncounter' || entry.kind === 'MonsterLootEncounter'" :entry="entry" :shown-step="subShownSteps[idx] || 0" />
          <FightEncounterDetails v-else-if="entry.kind === 'FightEncounter'" :entry="entry" :shown-step="subShownSteps[idx] || 0" />
          <QuestEncounterDetails v-else-if="entry.kind === 'QuestEncounter'" :entry="entry" />
          <div class="note-row zone-collapse-msg" v-else-if="entry.kind === 'ZoneCollapse'">The zone caught up to you and you were disintegrated</div>
          <div class="note-row" v-else>Encounter</div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RaidEventLogEntry, WalkEncounterLogEntry } from '../../logic/RaidLog';
import { DEFAULT_SPEED } from '../../logic/GameState';
import { formatDurationHM } from '../../logic/StringUtils';
import atlasStorage from '../../logic/AtlasStorage';
import WalkEncounterDetails from './WalkEncounterDetails.vue';
import PreparationEncounterDetails from './PreparationEncounterDetails.vue';
import LootEncounterDetails from './LootEncounterDetails.vue';
import FightEncounterDetails from './FightEncounterDetails.vue';
import QuestEncounterDetails from './QuestEncounterDetails.vue';

const props = defineProps<{
  entries: RaidEventLogEntry[];
}>();

const emit = defineEmits<{
  (e: 'update:shownCount', value: number): void;
  (e: 'update:timelineComplete', value: boolean): void;
  (e: 'update:displayedTimeSec', value: number): void;
}>();

const shownCount = ref(0);
const visibleEntries = computed(() => (props.entries || []).slice(0, shownCount.value));

const timerId = ref<number | null>(null);
const bodyRef = ref<HTMLElement | null>(null);
const speedScale = ref(1);

const itemsAtlasSource = ref<HTMLImageElement | null>(atlasStorage.getItemsSource());
const itemsAtlasReady = ref<boolean>(atlasStorage.isItemsAtlasLoaded());
onMounted(async () => {
  if (itemsAtlasReady.value) return;
  try {
    await atlasStorage.loadItemsAtlas();
  } catch (_e) { /* noop */ }
  itemsAtlasReady.value = atlasStorage.isItemsAtlasLoaded();
  itemsAtlasSource.value = atlasStorage.getItemsSource();
});

const timelineReady = ref(false);
const subShownSteps = ref<Record<number, number>>({});
type TimelineToken =
  | { kind: 'entry'; index: number }
  | { kind: 'loot_sub'; index: number; step: 1 | 2 }
  | { kind: 'fight_sub'; index: number; step: number };
const timeline: TimelineToken[] = [];
const timelinePos = ref(0);
const timelineComplete = computed(() => timelineReady.value && (timelinePos.value >= timeline.length));

const displayedTimeSec = computed(() => {
  let pos = Math.max(0, Math.min(timelinePos.value - 1, timeline.length - 1));
  while (pos >= 0) {
    const tok = timeline[pos] as any;
    if (!tok) break;
    if (tok.kind === 'entry') {
      const e: any = props.entries[tok.index];
      const v = Math.max(0, e?.elapsedTotalSec || 0);
      if (v > 0 || e) return v;
    } else if (tok.kind === 'fight_sub') {
      const e: any = props.entries[tok.index];
      const j = Math.max(0, (tok.step || 0) - 1);
      const ev = (e?.fightLog || [])[j];
      const v = Math.max(0, ev?.elapsedTotalSec || 0);
      if (v > 0 && ev) return v;
    }
    pos--;
  }
  return 0;
});

watch(shownCount, (v) => emit('update:shownCount', v), { immediate: true });
watch(timelineComplete, (v) => emit('update:timelineComplete', v), { immediate: true });
watch(displayedTimeSec, (v) => emit('update:displayedTimeSec', v), { immediate: true });

function clearMainTimer() {
  if (timerId.value !== null) {
    clearTimeout(timerId.value);
    timerId.value = null;
  }
}

function clearTimer() {
  clearMainTimer();
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function entryDelayMs(entry: RaidEventLogEntry): number {
  if ((entry as WalkEncounterLogEntry).kind === 'WalkEncounter') {
    const speed = Math.max(0.1, (entry as WalkEncounterLogEntry).speedKmH || DEFAULT_SPEED);
    const mul = clamp(DEFAULT_SPEED / speed, 1, 2);
    return Math.round(mul * 500 * Math.max(0.05, speedScale.value));
  }
  return Math.round(500 * Math.max(0.05, speedScale.value));
}

function substepDelayMs(step: 1 | 2): number {
  const base = step === 1 ? 125 : 250;
  return Math.round(base * Math.max(0.05, speedScale.value));
}

function buildTimeline() {
  timeline.length = 0;
  timelinePos.value = 0;
  const len = (props.entries || []).length;
  for (let i = 0; i < len; i++) {
    const e = props.entries[i]!;
    timeline.push({ kind: 'entry', index: i });
    if ((e.kind === 'LootEncounter' || e.kind === 'MonsterLootEncounter') && !e.skipped) {
      timeline.push({ kind: 'loot_sub', index: i, step: 1 });
      if (e.kind === 'LootEncounter' && e.itemId) timeline.push({ kind: 'loot_sub', index: i, step: 2 });
    }
    if (e.kind === 'FightEncounter') {
      const rounds = Math.max(0, (e.fightLog?.length || 0));
      for (let j = 1; j <= rounds; j++) timeline.push({ kind: 'fight_sub', index: i, step: j });
      let step = rounds;
      const hasRegen = e.hpAfterRegen > e.hpBeforeRegen;
      if (hasRegen) timeline.push({ kind: 'fight_sub', index: i, step: ++step });
      if (e.dieFromOvertime) timeline.push({ kind: 'fight_sub', index: i, step: ++step });
      const hasBiopsy = !!(e.fightLog || []).find((ev: any) => !!ev.biopsyTriggered);
      if (hasBiopsy) timeline.push({ kind: 'fight_sub', index: i, step: ++step });
    }
  }
}

function scheduleNextTick() {
  clearMainTimer();
  if (timelinePos.value >= timeline.length) return;
  const token = timeline[timelinePos.value];
  const delay = token.kind === 'entry'
    ? entryDelayMs((props.entries || [])[token.index])
    : substepDelayMs((token as any).step as any);
  timerId.value = window.setTimeout(() => {
    const { scrollable: wasScrollable, atBottom: wasAtBottom } = getScrollState();
    if (token.kind === 'entry') {
      shownCount.value += 1;
    } else {
      const prev = subShownSteps.value[token.index] || 0;
      const step = (token as any).step as number;
      if (step > prev) subShownSteps.value[token.index] = step;
    }
    timelinePos.value += 1;
    stickToBottomAfterUpdate(wasScrollable, wasAtBottom);
    scheduleNextTick();
  }, delay);
}

function resetAndStartAnimation() {
  clearTimer();
  shownCount.value = 0;
  speedScale.value = 1;
  subShownSteps.value = {};
  timelineReady.value = false;
  buildTimeline();
  timelineReady.value = true;
  scheduleNextTick();
}

function getScrollState() {
  const el = bodyRef.value;
  const scrollable = !!el && (el.scrollHeight > el.clientHeight + 1);
  const atBottom = !!el && (el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  return { scrollable, atBottom };
}

function stickToBottomAfterUpdate(prevScrollable: boolean, prevAtBottom: boolean) {
  const shouldStick = !prevScrollable || prevAtBottom;
  if (!shouldStick) return;
  nextTick(() => {
    const el = bodyRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    window.setTimeout(() => {
      const el2 = bodyRef.value;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
    }, 260);
  });
}

function fastForward() {
  clearMainTimer();
  speedScale.value = 0.1;
  const { scrollable: prevScrollable, atBottom: prevAtBottom } = getScrollState();
  scheduleNextTick();
  stickToBottomAfterUpdate(prevScrollable, prevAtBottom);
}

defineExpose({ fastForward });

watch(() => props.entries, () => {
  resetAndStartAnimation();
}, { immediate: true });

watch(timelineComplete, () => {
  const { scrollable, atBottom } = getScrollState();
  stickToBottomAfterUpdate(scrollable, atBottom);
});

onBeforeUnmount(() => {
  clearTimer();
});

function formatHMS(totalSec?: number): string { return formatDurationHM(totalSec); }

function isSkipped(entry: RaidEventLogEntry): boolean {
  if (entry.kind === 'LootEncounter' || entry.kind === 'MonsterLootEncounter') {
    return entry.skipped && entry.skipReason !== 'zone_collapsing';
  }
  return false;
}

const ENCOUNTER_ICON_KEYS: Record<RaidEventLogEntry['kind'], string> = {
  PreparationEncounter: 'canvas_tent',
  WalkEncounter: 'winding_road',
  FightEncounter: 'swords_crossed',
  QuestEncounter: 'questions',
  ZoneCollapse: 'desintegration',
  LootEncounter: 'rummaging',
  MonsterLootEncounter: 'bone_saw',
};

function encounterIconStyle(entry: RaidEventLogEntry): Record<string, string> {
  const source = itemsAtlasSource.value!;
  const f = atlasStorage.getItemsFrame(ENCOUNTER_ICON_KEYS[entry.kind])!;
  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;
  const containerSize = 60;
  const scale = Math.min(containerSize / f.w, containerSize / f.h, 1);
  const displayW = f.w * scale;
  const displayH = f.h * scale;
  return {
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${f.x * scale}px -${f.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
}
</script>

<style>
.raid-outcome-playback { margin-top: 10px; overflow-y: auto; overflow-x: hidden; min-height: 0; scrollbar-gutter: stable; }

.raid-outcome-playback::-webkit-scrollbar { width: 10px; }
.raid-outcome-playback::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 5px; }
.raid-outcome-playback::-webkit-scrollbar-thumb { background: rgba(79, 209, 197, 0.3); border-radius: 5px; border: 2px solid rgba(0, 0, 0, 0.2); }
.raid-outcome-playback::-webkit-scrollbar-thumb:hover { background: rgba(79, 209, 197, 0.5); }
.raid-outcome-playback::-webkit-scrollbar-thumb:active { background: rgba(79, 209, 197, 0.6); }
.raid-outcome-playback { scrollbar-width: thin; scrollbar-color: rgba(79, 209, 197, 0.3) rgba(0, 0, 0, 0.2); }

.raid-outcome-playback .log-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.raid-outcome-playback .log-item { border: none; border-radius: 6px; padding: 0; display: grid; grid-template-columns: 200px 1fr; gap: 4px; align-items: stretch; }
.raid-outcome-playback .enc-col { background: rgba(255,255,255,0.04); border-radius: 6px 0 0 6px; padding: 10px 10px 10px 10px; display: grid; align-content: center; }
.raid-outcome-playback .details-col { background: rgba(255,255,255,0.04); border-radius: 0 6px 6px 0; padding: 10px; }
.raid-outcome-playback .col-left { display: grid; grid-auto-rows: min-content; gap: 2px; }
.raid-outcome-playback .enc-header { display: grid; grid-template-columns: minmax(0, 1fr) 60px; column-gap: 10px; align-items: stretch; }
.raid-outcome-playback .enc-title-time { display: flex; flex-direction: column; justify-content: space-between; min-height: 50px; padding-bottom: 4px; padding-top: 4px;}
.raid-outcome-playback .enc-name-text { min-width: 0; font-weight: 800; }
.raid-outcome-playback .enc-icon-col { width: 60px; height: 60px; display: grid; place-items: center; }
.raid-outcome-playback .enc-icon { image-rendering: auto; filter: grayscale(1) brightness(0.95); opacity: 0.85; }
.raid-outcome-playback .enc-type { font-weight: 800; }
.raid-outcome-playback .enc-monster { font-weight: 400; }
.raid-outcome-playback .enc-time { font-size: 12px; opacity: 0.85; }

.raid-outcome-playback .enc-title-time.dimmed { opacity: 0.5; }
.raid-outcome-playback .enc-icon.dimmed { opacity: 0.4; filter: grayscale(1) brightness(0.7); }

.raid-outcome-playback .log-item.no-details { grid-template-columns: 1fr; }
.raid-outcome-playback .log-item.no-details .enc-col { border-radius: 6px; }
.raid-outcome-playback .log-item.no-details .details-col { display: none; }

.raid-outcome-playback .loot-cols { --loot-icon-size: 58px; --loot-icon-gap: 6px; }
.raid-outcome-playback .loot-cols { display: grid; grid-template-columns: 64px 72px minmax(0,1fr) minmax(0,1.4fr); grid-auto-rows: min-content; gap: 6px 10px; align-items: start; }
.raid-outcome-playback .loot-cols .lc.col1 { display: grid; gap: 4px; align-content: start; grid-column: 1 / 4; }
.raid-outcome-playback .loot-cols .lc.colR { grid-column: 4; }
.raid-outcome-playback .loot-cols .lc.colR .colR-grid { display: grid; grid-template-columns: 1fr auto; align-items: start; column-gap: 10px; }
.raid-outcome-playback .loot-cols .lc.colR .colR-grid.notyet { visibility: hidden; }
.raid-outcome-playback .loot-cols .lc.colR .icon-wrap {
  width: calc(var(--loot-icon-size) * 2 + var(--loot-icon-gap));
  height: var(--loot-icon-size);
  display: grid;
  grid-template-columns: var(--loot-icon-size) var(--loot-icon-size);
  column-gap: var(--loot-icon-gap);
  align-items: center;
  justify-items: center;
}
.raid-outcome-playback .loot-cols .lc.colR .replaced-item-wrap { width: var(--loot-icon-size); height: var(--loot-icon-size); position: relative; }
.raid-outcome-playback .loot-cols .lc.colR .replaced-item-wrap:not(.empty)::before,
.raid-outcome-playback .loot-cols .lc.colR .replaced-item-wrap:not(.empty)::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  top: 50%;
  height: 2px;
  background: rgba(255, 95, 110, 0.95);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.35);
  transform-origin: center;
  pointer-events: none;
  z-index: 2;
}
.raid-outcome-playback .loot-cols .lc.colR .replaced-item-wrap:not(.empty)::before { transform: translateY(-50%) rotate(45deg); }
.raid-outcome-playback .loot-cols .lc.colR .replaced-item-wrap:not(.empty)::after { transform: translateY(-50%) rotate(-45deg); }
.raid-outcome-playback .loot-cols .lc.colR .replaced-item { position: relative; z-index: 1; }
.raid-outcome-playback .loot-cols .lc.colR .replaced-item .item-cell { opacity: 0.88; filter: grayscale(1) brightness(0.7); }
.raid-outcome-playback .loot-cols .lc.colR .loot-discarded .item-cell { opacity: 0.88; filter: grayscale(1) brightness(0.7); }
.raid-outcome-playback .loot-cols .lc.colR .item-cell.minor { width: var(--loot-icon-size); height: var(--loot-icon-size); }
.raid-outcome-playback .loot-cols .lc.colR .item-cell.minor .sprite { transform: translate(-50%, -50%) scale(0.6); }
.raid-outcome-playback .loot-cols .line.outcome { font-weight: 400; }
.raid-outcome-playback .loot-cols .line.outcome.dimmed { opacity: 0.65; }
.raid-outcome-playback .loot-cols .line.bags { opacity: 0.95; }
.raid-outcome-playback .loot-cols .line.placeholder { visibility: hidden; }
.raid-outcome-playback .note-row.dimmed { opacity: 1; color: var(--text-secondary); }
.raid-outcome-playback .zone-collapse-msg { font-size: 1.2em; font-weight: 800; color: #e74c3c; }
.raid-outcome-playback .hl { color: var(--accent); font-weight: 800; }

.raid-outcome-playback .fight-rows { display: grid; gap: 6px; }
.raid-outcome-playback .fr-grid { display: grid; grid-template-columns: 64px 72px minmax(0,1fr) minmax(0,1.4fr); gap: 6px 10px; align-items: center; }
.raid-outcome-playback .fr-grid .cell.who { font-weight: 400; opacity: 0.95; }
.raid-outcome-playback .reflect-note { opacity: 0.95; }
.raid-outcome-playback .summon-note { color: #f36d7b; margin-top: 6px; }
.raid-outcome-playback .hit-you { color: #7fd17f; }
.raid-outcome-playback .miss-you { color: #7f8790; opacity: 0.8; }
.raid-outcome-playback .hit-they { color: #f36d7b; }
.raid-outcome-playback .miss-they { color: #7fd17f; }

.raid-outcome-playback .hp-your { color: #f36d7b; }
.raid-outcome-playback .hp-their { color: inherit; }
.raid-outcome-playback .regen-note { margin-top: 12px; }

.raid-outcome-playback .roll { white-space: nowrap; }
.raid-outcome-playback .roll-self { font-size: 0.85em; opacity: 0.6; }
.raid-outcome-playback .roll-vs { margin: 0 4px; font-size: 0.85em; opacity: 0.6; }
.raid-outcome-playback .roll-target { font-size: 0.85em; opacity: 0.95; }

.raid-outcome-playback .note-row { grid-column: 1 / -1; opacity: 0.95; }
.raid-outcome-playback .biopsy-note { margin-top: 10px; }
.raid-outcome-playback .walk-row { opacity: 0.95; }

.raid-outcome-playback .appear { animation: fadeInUp 220ms ease; }
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.raid-outcome-playback .loot-kept .item-cell.minor .sprite { filter: none; }
.raid-outcome-playback .loot-kept .item-cell.minor .sprite.sprite-dimmed { filter: brightness(0.5); }
</style>
