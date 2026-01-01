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

      <section class="modal-body" ref="bodyRef">
        <ul class="log-list">
          <li
            v-for="(entry, idx) in visibleEntries"
            :key="idx"
            class="log-item appear"
            :class="{ 'no-details': entry.kind === 'WalkEncounter' && ((entry as any).hpAfter || 0) <= ((entry as any).hpBefore || 0) }"
          >
            <!-- Left column: type + time -->
            <div class="col-left enc-col">
              <div class="enc-name">
                <template v-if="entry.kind === 'WalkEncounter'">Walking</template>
                <template v-else-if="entry.kind === 'LootEncounter'">
                  <template v-if="(entry as any).source === 'monster'">Dissecting the corpse</template>
                  <template v-else>Looting</template>
                </template>
                <template v-else-if="entry.kind === 'FightEncounter'">
                  <div class="enc-type">Fighting</div>
                  <div class="enc-monster">{{ (entry as any).monsterName }}</div>
                </template>
                <template v-else-if="entry.kind === 'QuestEncounter'">Quest</template>
                <template v-else>Encounter</template>
              </div>
              <div class="enc-time">{{ formatHMS((entry as any).timeSpentSec) }}</div>
            </div>

            <!-- Right column: details -->
            <div class="col-right details-col">
              <!-- Walking: no details -->
              <template v-if="entry.kind === 'WalkEncounter'">
                <div class="walk-row" v-if="(entry as any).hpAfter > (entry as any).hpBefore">
                  Regenerated health: {{ (entry as any).hpBefore }} -> <b>{{ (entry as any).hpAfter }}</b>
                </div>
              </template>

              <!-- Looting details -->
              <template v-else-if="entry.kind === 'LootEncounter'">
                <template v-if="(entry as any).skipped">
                  <div class="note-row">Bags are full. Skipping search.</div>
                </template>
                <template v-else>
                  <!-- Biopsy failure: full-width message -->
                  <template v-if="(entry as any).source === 'monster' && (entry as any).biopsyChance > 0 && !(entry as any).biopsySuccess && (subShownSteps[idx] || 0) >= 1">
                    <div class="note-row dimmed">The monster's remains were scattered and spoiled (<b>{{ (entry as any).biopsyChance }}</b> vs {{ (entry as any).biopsyRoll }})</div>
                  </template>
                  <!-- Regular loot layout (for successful biopsy or regular loot) -->
                  <template v-else>
                    <!-- Independent 3-column layout: text stack | item volume | image -->
                    <div class="loot-cols" :class="{ hasItem: !!(entry as any).itemId && (subShownSteps[idx] || 0) >= 1 }">
                      <!-- Column 1: outcome + bags volume (stacked) -->
                      <div class="lc col1">
                        <template v-if="(subShownSteps[idx] || 0) >= 1">
                          <!-- Monster loot with biopsy mechanic (success only) -->
                          <template v-if="(entry as any).source === 'monster' && (entry as any).biopsyChance > 0">
                            <div class="line outcome">Found <b>{{ itemName((entry as any).itemId) }}</b>! (<b>{{ (entry as any).biopsyChance }}</b> vs {{ (entry as any).biopsyRoll }})</div>
                          </template>
                          <!-- Regular loot -->
                          <template v-else>
                            <template v-if="(entry as any).itemId">
                              <div class="line outcome">Found <b>{{ itemName((entry as any).itemId) }}</b>!</div>
                            </template>
                            <template v-else>
                              <div class="line outcome dimmed">No valuables here</div>
                            </template>
                          </template>
                        </template>

                        <!-- Bags volume appears at step 2 (or step 1 for monster loot) when item is found -->
                        <template v-if="(entry as any).itemId && ((entry as any).source === 'monster' ? (subShownSteps[idx] || 0) >= 1 : (subShownSteps[idx] || 0) >= 2)">
                          <div class="line bags">
                            <template v-if="!(entry as any).discarded">
                              Bags volume: <b>{{ (entry as any).volumeAfter }} / {{ (entry as any).capacity }}</b>
                            </template>
                            <template v-else>
                              Bags volume: <b>{{ (entry as any).volumeBefore }} / {{ (entry as any).capacity }}</b>. Need {{ (entry as any).requiredVolume }} more. Discarded.
                            </template>
                          </div>
                        </template>
                        <!-- Reserve space to avoid layout jump before the bags line is revealed -->
                        <template v-else-if="(entry as any).itemId">
                          <div class="line bags placeholder">&nbsp;</div>
                        </template>
                      </div>

                      <!-- Column 4: combined volume + image, aligned with fight HP column -->
                      <div class="lc colR" v-if="(entry as any).itemId">
                        <div class="colR-grid" :class="{ notyet: (subShownSteps[idx] || 0) < 1 }">
                          <div class="vol" v-if="(subShownSteps[idx] || 0) >= 1">Volume: {{ itemVolume((entry as any).itemId) }}</div>
                          <div class="icon-wrap">
                            <ItemDisplay :id="(entry as any).itemId" :minor="true" :class="{ 'loot-kept': !(entry as any).discarded }" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </template>
              </template>

              <!-- Fighting details -->
              <template v-else-if="entry.kind === 'FightEncounter'">
                <div class="fight-rows">
                  <template v-for="(ev, j) in ((entry as any).fightLog || [])" :key="'fe-'+j">
                    <template v-if="(subShownSteps[idx] || 0) >= (Number(j) + 1)">
                      <!-- Player row for this round (independent grid) -->
                      <div class="fr-grid">
                        <div class="cell who">You</div>
                        <div class="cell outcome" :class="ev.hitLanded ? 'hit-you' : 'miss-you'"><strong>{{ ev.hitLanded ? 'HIT!' : 'MISS!' }}</strong></div>
                        <div class="cell roll">
                          <span class="roll-target">{{ ev.theirDodgeValue }}</span>
                          <span class="roll-vs">vs</span>
                          <span class="roll-self">{{ ev.myHitRoll }}</span>
                        </div>
                        <div class="cell after" v-html="ev.hitLanded ? hpChange('their', ev.theirHpBefore, ev.theirHpAfter) : ''"></div>
                      </div>

                      <!-- Stun note as a separate row when stun triggers -->
                      <div class="note-row stun-note" v-if="ev.stunTriggered" v-html="stunLine(ev)"></div>

                      <!-- Monster counter only when we miss (independent grid) -->
                      <template v-if="!ev.hitLanded">
                        <div class="fr-grid">
                          <div class="cell who">They</div>
                          <div class="cell outcome" :class="(!ev.blocked && ev.damageReceived > 0) ? 'hit-they' : 'miss-they'"><strong>{{ (!ev.blocked && ev.damageReceived > 0) ? 'HIT!' : 'MISS!' }}</strong></div>
                          <div class="cell roll">
                            <span class="roll-target">{{ ev.myBlockRoll }}</span>
                            <span class="roll-vs">vs</span>
                            <span class="roll-self">{{ ev.theirHitValue }}</span>
                          </div>
                          <div class="cell after" v-html="(!ev.blocked && ev.damageReceived > 0) ? hpChange('your', ev.myHpBefore, ev.myHpAfter) : ''"></div>
                        </div>

                        <!-- Reflection note as a separate row -->
                        <div class="note-row reflect-note" v-if="ev.reflectedDamage > 0" v-html="reflectLine(ev)"></div>
                      </template>
                    </template>
                  </template>
                </div>
                <div class="note-row regen-note" v-if="(entry as any).hpAfterRegen > (entry as any).hpBeforeRegen && (subShownSteps[idx] || 0) >= (((entry as any).fightLog?.length || 0) + 1)">
                  Regenerated health: {{ (entry as any).hpBeforeRegen }} → <b>{{ (entry as any).hpAfterRegen }}</b>
                </div>
                <div class="note-row" v-show="(entry as any).dieFromOvertime && (subShownSteps[idx] || 0) >= (((entry as any).fightLog?.length || 0) + ((entry as any).hpAfterRegen > (entry as any).hpBeforeRegen ? 2 : 1))">You die of overexertion.</div>
                <div class="note-row aspirator-note" v-show="aspiratorUsed(entry as any) && (subShownSteps[idx] || 0) >= (((entry as any).fightLog?.length || 0) + ((entry as any).dieFromOvertime ? (((entry as any).hpAfterRegen > (entry as any).hpBeforeRegen ? 3 : 2)) : ((entry as any).hpAfterRegen > (entry as any).hpBeforeRegen ? 2 : 1)))">You examine their body...</div>
              </template>

              <!-- Quest details -->
              <template v-else-if="entry.kind === 'QuestEncounter'">
                <div class="note-row">{{ questLine((entry as any).questId) }}</div>
              </template>

              <template v-else>
                <div class="note-row">Encounter: {{ (entry as any).kind || 'Encounter' }}</div>
              </template>
            </div>
          </li>
        </ul>
        <!-- Summary and mutation info moved to footer (non-scroll area) -->
      </section>
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
            >Raid Again</button>
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { uiState, getGameState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdAknowledgeOutcome, CmdStartRaid } from '../logic/input/InputCommands';
import type { RaidEventLogEntry, WalkEncounterLogEntry } from '../logic/RaidLog';
import { DEFAULT_SPEED } from '../logic/GameState';
import ItemDisplay from './ItemDisplay.vue';
import { formatDurationHM } from '../logic/StringUtils';
import { getGameLib } from '../logic/UIState';

const visible = computed(() => !!uiState.lastOutcome);
const logEntries = computed<RaidEventLogEntry[]>(() => {
  const o: any = uiState.lastOutcome as any;
  return (o && o.log && Array.isArray(o.log.entries)) ? (o.log.entries as RaidEventLogEntry[]) : [];
});

const shownCount = ref(0);
// Main timer that controls revealing the next log entry
const timerId = ref<number | null>(null);
const bodyRef = ref<HTMLElement | null>(null);
// Playback speed scale: 1 = normal, 0.2 = 5x faster
const speedScale = ref(1);
const totalEncounters = computed(() => {
  const o: any = uiState.lastOutcome as any;
  return Math.max(0, o?.plannedEncounters || 0);
});
const visibleEntries = computed(() => logEntries.value.slice(0, shownCount.value));
const allShown = computed(() => shownCount.value >= totalEncounters.value);
// Consider the playback complete only when the unified timeline finishes
// Guard with readiness to avoid flicker on initial open before timeline is built
const timelineReady = ref(false);
const timelineComplete = computed(() => timelineReady.value && (timelinePos.value >= timeline.length));
// Per-entry substep visibility for LootEncounter and FightEncounter; value is how many sublines are revealed
const subShownSteps = ref<Record<number, number>>({});
// Global timeline: reveals exactly one thing (entry or sub-step) per tick
type TimelineToken = { kind: 'entry'; index: number } | { kind: 'loot_sub'; index: number; step: 1 | 2 } | { kind: 'fight_sub'; index: number; step: number };
const timeline: TimelineToken[] = [];
const timelinePos = ref(0);
// Header helpers
const raidTitle = computed(() => {
  const o: any = uiState.lastOutcome as any;
  const id: string = (o?.id || '').trim();
  const lib = getGameLib();
  const name = id ? (lib?.raids.get(id)?.name || '') : '';
  return name || (id || '');
});

const displayedTimeSec = computed(() => {
  // Read pre-computed cumulative time stored on entries/rounds by the runner
  let pos = Math.max(0, Math.min(timelinePos.value - 1, timeline.length - 1));
  while (pos >= 0) {
    const tok = timeline[pos] as any;
    if (!tok) break;
    if (tok.kind === 'entry') {
      const e: any = logEntries.value[tok.index];
      const v = Math.max(0, e?.elapsedTotalSec || 0);
      if (v > 0 || e) return v;
    } else if (tok.kind === 'fight_sub') {
      const e: any = logEntries.value[tok.index];
      const j = Math.max(0, (tok.step || 0) - 1);
      const ev = (e?.fightLog || [])[j];
      const v = Math.max(0, ev?.elapsedTotalSec || 0);
      if (v > 0 && ev) return v;
    }
    pos--;
  }
  return 0;
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

function clearMainTimer() {
  if (timerId.value !== null) {
    clearTimeout(timerId.value);
    timerId.value = null;
  }
}

function clearTimer() {
  // Clears both main and sub-step timers — use when resetting/closing
  clearMainTimer();
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function entryDelayMs(entry: RaidEventLogEntry): number {
  if ((entry as WalkEncounterLogEntry).kind === 'WalkEncounter') {
    const speed = Math.max(0.1, (entry as WalkEncounterLogEntry).speedKmH || DEFAULT_SPEED);
    const mul = clamp(DEFAULT_SPEED / speed, 1, 2);
    // 2x faster for main entries: halve the base delay
    return Math.round(mul * 500 * Math.max(0.05, speedScale.value));
  }
  // 2x faster for main entries: halve the base delay
  return Math.round(500 * Math.max(0.05, speedScale.value));
}

function substepDelayMs(step: 1 | 2): number {
  // Step 1 (roll outcome) is quicker, step 2 (volume) slightly longer
  // 4x faster for sub-items: quarter the base durations
  const base = step === 1 ? 125 : 250;
  return Math.round(base * Math.max(0.05, speedScale.value));
}

function buildTimeline() {
  timeline.length = 0;
  timelinePos.value = 0;
  const len = logEntries.value.length;
  for (let i = 0; i < len; i++) {
    const e: any = logEntries.value[i];
    // Always reveal the entry first
    timeline.push({ kind: 'entry', index: i });
    // LootEncounter reveals sub-steps afterwards
    if (e && e.kind === 'LootEncounter' && !e.skipped) {
      if (e.source !== 'monster') {
        // Step 1: roll result
        timeline.push({ kind: 'loot_sub', index: i, step: 1 });
        if (e.itemId) timeline.push({ kind: 'loot_sub', index: i, step: 2 });
      } else {
        // Monster loot: always show step 1 (either failure message or success + volume)
        timeline.push({ kind: 'loot_sub', index: i, step: 1 });
      }
    }
    // FightEncounter: reveal each round and possibly regen/overtime/aspirator lines
    if (e && e.kind === 'FightEncounter') {
      const rounds = Math.max(0, (e.fightLog?.length || 0));
      for (let j = 1; j <= rounds; j++) timeline.push({ kind: 'fight_sub', index: i, step: j });
      let step = rounds;
      // Regen line (if HP was regenerated)
      const hasRegen = (e as any).hpAfterRegen > (e as any).hpBeforeRegen;
      if (hasRegen) timeline.push({ kind: 'fight_sub', index: i, step: ++step });
      // Overtime death line
      if (e.dieFromOvertime) timeline.push({ kind: 'fight_sub', index: i, step: ++step });
      // Aspirator line (when any event marks encounterCreated)
      const useAsp = !!(e.fightLog || []).find((ev: any) => !!ev.encounterCreated);
      if (useAsp) timeline.push({ kind: 'fight_sub', index: i, step: ++step });
    }
  }
}

function scheduleNextTick() {
  clearMainTimer();
  if (timelinePos.value >= timeline.length) return;
  const token = timeline[timelinePos.value];
  const delay = token.kind === 'entry'
    ? entryDelayMs(logEntries.value[token.index])
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

// Reset and start animation when a new outcome appears
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

// Watch the outcome object itself to catch new raids starting
watch(() => uiState.lastOutcome, (newOutcome, oldOutcome) => {
  clearTimer();
  if (newOutcome) {
    // Prevent background page scroll when modal is open
    try { document.body.style.overflow = 'hidden'; } catch (_) {}
    // Reset animation state for new outcome (handles both fresh open and "raid again")
    resetAndStartAnimation();
  } else {
    shownCount.value = 0;
    subShownSteps.value = {};
    timelineReady.value = false;
    // Restore background scroll
    try { document.body.style.overflow = ''; } catch (_) {}
  }
});

onBeforeUnmount(() => {
  clearTimer();
  // Ensure we restore body scroll if component unmounts while open
  try { document.body.style.overflow = ''; } catch (_) {}
});

function fastForward() {
  clearMainTimer();
  // Increase playback speed by 5x (scale delays to 0.2 of normal)
  speedScale.value = 0.2;
  const { scrollable: prevScrollable, atBottom: prevAtBottom } = getScrollState();
  // Continue timeline at faster speed
  scheduleNextTick();
  stickToBottomAfterUpdate(prevScrollable, prevAtBottom);
}

// Compute the gear price for the completed raid
const raidGearPrice = computed(() => {
  const o: any = uiState.lastOutcome as any;
  const raidId = (o?.id || '').trim();
  if (!raidId) return 0;
  const gs = getGameState();
  if (!gs) return 0;
  const gearIds: string[] = (gs.loadouts && gs.loadouts[raidId]) ? gs.loadouts[raidId] : [];
  let total = 0;
  for (const gid of gearIds) {
    const g = gs.lib.gear.get(gid);
    if (g) total += g.price;
  }
  return total;
});

// Check if a quest was completed during this raid (would change encounter composition)
const questWasCompleted = computed(() => {
  const o: any = uiState.lastOutcome as any;
  const completed = o?.questsCompleted;
  return Array.isArray(completed) && completed.length > 0;
});

// Check if player can afford to raid again with the same gear
const canAffordRaidAgain = computed(() => {
  return uiState.credits >= raidGearPrice.value;
});

// Combined check: can we raid again with identical settings?
const canRaidAgain = computed(() => {
  // Only allow if raid was successful, no quest was completed, and we can afford the gear
  if (!raidSuccess.value) return false;
  if (questWasCompleted.value) return false;
  if (!canAffordRaidAgain.value) return false;
  return true;
});

// Tooltip explaining why raid again is disabled
const raidAgainDisabledReason = computed(() => {
  if (!raidSuccess.value) return 'You died';
  if (questWasCompleted.value) return 'Quest completed - zone encounters have changed';
  if (!canAffordRaidAgain.value) return `Not enough credits (need ${raidGearPrice.value})`;
  return '';
});

function raidAgain() {
  const o: any = uiState.lastOutcome as any;
  const raidId = (o?.id || '').trim();
  if (!raidId || !canRaidAgain.value) return;
  // Clear the outcome and start a new raid with the same settings
  globalInputQueue.push(new CmdAknowledgeOutcome());
  globalInputQueue.push(new CmdStartRaid({ id: raidId }));
}

function changeSetup() {
  globalInputQueue.push(new CmdAknowledgeOutcome());
}

function goRefine() {
  globalInputQueue.push(new CmdAknowledgeOutcome());
  uiState.activeTab = 'refine';
}

function formatHMS(totalSec?: number): string { return formatDurationHM(totalSec); }

function itemName(id?: string): string {
  const lib = getGameLib();
  const name = id ? (lib?.items.get(id)?.name || '') : '';
  return name || (id || '');
}

function itemVolume(id?: string): number {
  const lib = getGameLib();
  return id ? (lib?.items.get(id)?.volume || 0) : 0;
}

function monsterName(id?: string): string {
  const lib = getGameLib();
  const name = id ? (lib?.monsters.get(id)?.name || '') : '';
  return name || (id || '');
}

function questLine(id?: string): string {
  const lib = getGameLib();
  const q = id ? (lib?.quests.get(id)) : undefined;
  const s = (q?.encounterLine || q?.name || '');
  return s || (id || '');
}

function hpChange(who: 'their' | 'your', before: number, after: number, terse = false): string {
  const label = who === 'your' ? 'Your hp' : 'Their hp';
  const b = Math.max(0, before || 0);
  const a = Math.max(0, after || 0);
  const arrow = '→';
  const cls = who === 'your' ? 'hp-your' : 'hp-their';
  const afterSpan = who === 'your' ? `<b>${a}</b>` : `<span class="hl"><b>${a}</b></span>`;
  const line = `${label} ${b} ${arrow} ${afterSpan}`;
  // Use same rendering for terse/non-terse for now
  return `<span class="${cls}">${line}</span>`;
}

function reflectLine(ev: any): string {
  const on = ev.blocked ? 'miss' : 'hit';
  return `They receive damage reflection on ${on}. ${hpChange('their', ev.theirHpBefore, ev.theirHpAfter, true)}`;
}

function stunLine(ev: any): string {
  const before = ev.hitChanceBefore;
  const after = ev.hitChanceAfter;
  return `You stun the target. Chance to hit them: <b>${before}</b> → <b>${after}</b>`;
}

function aspiratorUsed(entry: any): boolean {
  return !!(entry?.fightLog || []).find((ev: any) => !!ev.encounterCreated);
}

// Scroll helpers: keep the view pinned to bottom when appropriate
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
    // Second pass to catch animations/content that enlarge after initial paint
    window.setTimeout(() => {
      const el2 = bodyRef.value;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
    }, 260);
  });
}

// Sub-steps now driven by the global timeline; no per-entry timers needed

// Ensure we reveal and scroll to the summary immediately when it appears
watch([timelineComplete, gainedItems, discardedItems, zoneChangeText], () => {
  const { scrollable, atBottom } = getScrollState();
  stickToBottomAfterUpdate(scrollable, atBottom);
});
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
.modal-body { margin-top: 10px; overflow-y: auto; overflow-x: hidden; min-height: 0; scrollbar-gutter: stable; }

/* Custom scrollbar styling */
.modal-body::-webkit-scrollbar { width: 10px; }
.modal-body::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 5px; }
.modal-body::-webkit-scrollbar-thumb { background: rgba(79, 209, 197, 0.3); border-radius: 5px; border: 2px solid rgba(0, 0, 0, 0.2); }
.modal-body::-webkit-scrollbar-thumb:hover { background: rgba(79, 209, 197, 0.5); }
.modal-body::-webkit-scrollbar-thumb:active { background: rgba(79, 209, 197, 0.6); }
/* Firefox scrollbar styling */
.modal-body { scrollbar-width: thin; scrollbar-color: rgba(79, 209, 197, 0.3) rgba(0, 0, 0, 0.2); }
.modal-footer-info { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--panel-border); }
.summary { margin-top: 16px; margin-bottom: 12px; display: grid; gap: 8px; }
.summary-row { display: grid; gap: 6px; }
.summary-cap { font-weight: 900; letter-spacing: 0.04em; opacity: 0.95; }
.summary-items { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
.summary-items.dim { opacity: 0.55; filter: grayscale(0.9); }
.log-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.log-item { border: none; border-radius: 6px; padding: 0; display: grid; grid-template-columns: 170px 1fr; gap: 4px; align-items: stretch; }
.enc-col { background: rgba(255,255,255,0.04); border-radius: 6px 0 0 6px; padding: 10px; display: grid; align-content: center; }
.details-col { background: rgba(255,255,255,0.04); border-radius: 0 6px 6px 0; padding: 10px; }
.col-left { display: grid; grid-auto-rows: min-content; gap: 2px; }
.enc-name { font-weight: 800; }
.enc-type { font-weight: 800; }
.enc-monster { font-weight: 400; }
.enc-time { font-size: 12px; opacity: 0.85; }

/* Hide right column and expand left when there are no details (e.g., walking with no regen) */
.log-item.no-details { grid-template-columns: 1fr; }
.log-item.no-details .enc-col { border-radius: 6px; }
.log-item.no-details .details-col { display: none; }

/* Loot layout */
.loot-cols { display: grid; grid-template-columns: 64px 72px minmax(0,1fr) minmax(0,1.4fr); grid-auto-rows: min-content; gap: 6px 10px; align-items: start; }
.loot-cols .lc.col1 { display: grid; gap: 4px; align-content: start; grid-column: 1 / 4; }
.loot-cols .lc.colR { grid-column: 4; }
.loot-cols .lc.colR .colR-grid { display: grid; grid-template-columns: minmax(0,auto) 48px; align-items: start; column-gap: 10px; }
.loot-cols .lc.colR .colR-grid.notyet { visibility: hidden; }
.loot-cols .lc.colR .icon-wrap { width: 48px; height: 48px; }
.loot-cols .line.outcome { font-weight: 400; }
.loot-cols .line.outcome.dimmed { opacity: 0.65; }
.loot-cols .line.bags { opacity: 0.95; }
.loot-cols .line.placeholder { visibility: hidden; }
.note-row.dimmed { opacity: 0.65; }
.hl { color: var(--accent); font-weight: 800; }

/* Fight layout */
.fight-rows { display: grid; gap: 6px; }
.fr-grid { display: grid; grid-template-columns: 64px 72px minmax(0,1fr) minmax(0,1.4fr); gap: 6px 10px; align-items: center; }
.fr-grid .cell.who { font-weight: 400; opacity: 0.95; }
.reflect-note { opacity: 0.95; }
.hit-you { color: #7fd17f; }
.miss-you { color: #7f8790; opacity: 0.8; }
.hit-they { color: #f36d7b; }
.miss-they { color: #7fd17f; }

/* HP change lines (inserted via v-html, use deep selector) */
:deep(.hp-your) { color: #f36d7b; }
:deep(.hp-their) { color: inherit; }

/* Regen note spacing */
.regen-note { margin-top: 12px; }

/* Rolls styling */
.roll { white-space: nowrap; }
.roll-self { font-size: 0.85em; opacity: 0.6; }
.roll-vs { margin: 0 4px; font-size: 0.85em; opacity: 0.6; }
.roll-target { font-size: 0.85em; opacity: 0.95; }

.note-row { grid-column: 1 / -1; opacity: 0.95; }
.aspirator-note { margin-top: 10px; }

/* Walk layout */
.walk-row { opacity: 0.95; }

.zone-change { margin-top: 10px; padding: 8px 10px; border: none; border-radius: 6px; background: rgba(255,255,255,0.03); }
.zone-change .zc { font-weight: 400; }
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

/* simple appear animation */
.appear { animation: fadeInUp 220ms ease; }
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

:deep(.loot-kept .item-cell.minor .sprite) {
  filter: none;
}
:deep(.loot-kept .item-cell.minor .sprite.sprite-dimmed) {
  filter: brightness(0.5);
}
</style>
