import type { GameState, TimelineScheduledEvent } from './GameState';
import { TIMELINE_MIN_SEPARATION_SEC, TIMELINE_VISIBLE_SPAN_SEC } from './Const';
import type { Reward } from './Reward';
import { applyReward } from './Reward';
import { describeMutation } from './RaidMutation';
import type { TimelineArchetypeDefinition, TimelineEventDefinition } from './TimelineLib';

const TIMELINE_GENERATION_LOOKAHEAD_SEC = TIMELINE_VISIBLE_SPAN_SEC + 24 * 3600;

function isTimelineRewardAffordable(gs: GameState, reward: Reward): boolean {
  if (reward.kind !== 'resource') return true;
  if (reward.amount >= 0) return true;
  return gs[reward.resource] >= -reward.amount;
}

function selectTimelineRewardIndex(gs: GameState, entry: TimelineScheduledEvent, archetype: TimelineArchetypeDefinition): number {
  const options = archetype.options;
  const preferredIndex = entry.preferredOptionIndex;
  if (preferredIndex >= 0 && preferredIndex < options.length && isTimelineRewardAffordable(gs, options[preferredIndex]!)) {
    return preferredIndex;
  }
  if (
    preferredIndex < 0
    && archetype.forcedDefaultOptionIndex >= 0
    && archetype.forcedDefaultOptionIndex < options.length
    && isTimelineRewardAffordable(gs, options[archetype.forcedDefaultOptionIndex]!)
  ) {
    return archetype.forcedDefaultOptionIndex;
  }
  for (let i = 0; i < options.length; i++) {
    if (isTimelineRewardAffordable(gs, options[i]!)) {
      return i;
    }
  }
  return -1;
}

function insertTimelineEventSorted(gs: GameState, entry: TimelineScheduledEvent): void {
  let idx = gs.timelineEvents.length;
  for (let i = 0; i < gs.timelineEvents.length; i++) {
    if (gs.timelineEvents[i]!.at <= entry.at) continue;
    idx = i;
    break;
  }
  gs.timelineEvents.splice(idx, 0, entry);
  gs.timelineVersion++;
  if (idx < gs.timelineCursor) {
    gs.timelineCursor++;
  }
}

function resolveTimelineEventAt(gs: GameState, requestedAt: number): number {
  let at = requestedAt;
  for (const existing of gs.timelineEvents) {
    if (Math.abs(existing.at - at) >= TIMELINE_MIN_SEPARATION_SEC) continue;
    at = existing.at + TIMELINE_MIN_SEPARATION_SEC;
  }
  return at;
}

function createTimelineScheduledEvent(eventDef: TimelineEventDefinition, requestedAt: number, at: number): TimelineScheduledEvent {
  return {
    eventId: eventDef.id,
    archetypeId: eventDef.type,
    requestedAt,
    at,
    repeat: eventDef.repeat,
    executed: false,
    resolvedOptionIndex: -1,
    resolvedDescription: '',
    preferredOptionIndex: -1,
  };
}

function scheduleTimelineEvent(gs: GameState, eventDef: TimelineEventDefinition, requestedAt: number): void {
  const at = resolveTimelineEventAt(gs, requestedAt);
  insertTimelineEventSorted(gs, createTimelineScheduledEvent(eventDef, requestedAt, at));
}

function hasTimelineOccurrence(gs: GameState, eventDef: TimelineEventDefinition, requestedAt: number): boolean {
  return gs.timelineEvents.some(entry =>
    entry.eventId === eventDef.id
    && entry.archetypeId === eventDef.type
    && entry.repeat === eventDef.repeat
    && entry.requestedAt === requestedAt
  );
}

function scheduleTimelineOccurrenceIfMissing(gs: GameState, eventDef: TimelineEventDefinition, requestedAt: number): void {
  if (hasTimelineOccurrence(gs, eventDef, requestedAt)) return;
  scheduleTimelineEvent(gs, eventDef, requestedAt);
}

function firstRepeatingOccurrenceAfter(eventDef: TimelineEventDefinition, timeSec: number): number {
  if (eventDef.time > timeSec) return eventDef.time;
  return eventDef.time + Math.floor((timeSec - eventDef.time) / eventDef.repeat + 1) * eventDef.repeat;
}

function scheduleTimelineOccurrencesInWindow(gs: GameState, startExclusiveSec: number, endInclusiveSec: number): void {
  for (const eventDef of gs.lib.timeline.events) {
    if (eventDef.repeat <= 0) {
      if (eventDef.time > startExclusiveSec && eventDef.time <= endInclusiveSec) {
        scheduleTimelineOccurrenceIfMissing(gs, eventDef, eventDef.time);
      }
      continue;
    }

    let requestedAt = firstRepeatingOccurrenceAfter(eventDef, startExclusiveSec);
    while (requestedAt <= endInclusiveSec) {
      scheduleTimelineOccurrenceIfMissing(gs, eventDef, requestedAt);
      requestedAt += eventDef.repeat;
    }
  }
}

function syncTimelineCursor(gs: GameState): void {
  gs.timelineCursor = gs.timelineEvents.findIndex(entry => !entry.executed);
  if (gs.timelineCursor === -1) {
    gs.timelineCursor = gs.timelineEvents.length;
  }
}

export function ensureTimelineEventsGenerated(gs: GameState): void {
  scheduleTimelineOccurrencesInWindow(
    gs,
    gs.gameTime,
    gs.gameTime + TIMELINE_GENERATION_LOOKAHEAD_SEC
  );
  syncTimelineCursor(gs);
}

function formatTimelineRaidMutation(gs: GameState, raidId: string): string {
  const raidName = gs.lib.raidSources.get(raidId)!.name;
  const mutationResult = gs.lastAppliedRaidMutations.find(entry => entry.raidId === raidId)!;
  if (!mutationResult.mutation) return `${raidName}: no deterioration available`;
  const desc = describeMutation(gs, mutationResult.mutation);
  return `${raidName}: ${desc.label}${desc.value ? ` ${desc.value}` : ''}`;
}

function applyTimelineReward(gs: GameState, reward: Reward): string {
  applyReward(gs, reward);

  if (reward.kind === 'timeline_deteriorate_random_raid') {
    const mutationResult = gs.lastAppliedRaidMutations[0];
    if (!mutationResult) return 'No unlocked raids to deteriorate';
    return formatTimelineRaidMutation(gs, mutationResult.raidId);
  }

  if (reward.kind === 'timeline_deteriorate_all_raids') {
    const changedCount = gs.lastAppliedRaidMutations.filter(entry => entry.mutation).length;
    if (changedCount === 0) return 'No raid zones could deteriorate';
    return 'All raid zones deteriorated';
  }

  if (reward.kind === 'unlock_raid') {
    return `Unlocked raid: ${gs.lib.raidSources.get(reward.raidId)!.name}`;
  }

  return '';
}

function executeTimelineEvent(gs: GameState, entry: TimelineScheduledEvent): void {
  const archetype = gs.lib.timeline.archetypes.get(entry.archetypeId)!;
  const selectedRewardIndex = selectTimelineRewardIndex(gs, entry, archetype);
  entry.resolvedOptionIndex = selectedRewardIndex;
  if (selectedRewardIndex >= 0) {
    entry.resolvedDescription = applyTimelineReward(gs, archetype.options[selectedRewardIndex]!);
  } else {
    entry.resolvedDescription = 'No affordable option';
    console.error('[Timeline] Failed to resolve timeline event: no affordable option.', {
      event: entry,
      archetype,
      resources: {
        credits: gs.credits,
        chronotraces: gs.chronotraces,
        timeFlux: gs.timeFlux,
        shardDust: gs.shardDust,
        skillPoints: gs.skillPoints,
      },
    });
  }
  gs.timelineVersion++;
}

export function processDueTimelineEvents(gs: GameState): void {
  ensureTimelineEventsGenerated(gs);

  for (const entry of gs.timelineEvents) {
    if (!entry.executed) continue;
    if (entry.at > gs.gameTime) continue;
    if (entry.resolvedOptionIndex >= 0 || entry.resolvedDescription) continue;
    console.error('[Timeline] Reprocessing previously unresolved timeline event.', { event: entry });
    executeTimelineEvent(gs, entry);
  }

  while (gs.timelineCursor < gs.timelineEvents.length) {
    const entry = gs.timelineEvents[gs.timelineCursor]!;
    if (entry.executed) {
      gs.timelineCursor++;
      continue;
    }
    if (entry.at > gs.gameTime) {
      break;
    }

    executeTimelineEvent(gs, entry);
    entry.executed = true;

    gs.timelineCursor++;
  }

  ensureTimelineEventsGenerated(gs);
}

export function rebuildTimelineEventsAfterRewind(gs: GameState, timeSec: number): void {
  gs.timelineEvents = gs.timelineEvents.filter(entry => entry.at <= timeSec);
  syncTimelineCursor(gs);
  scheduleTimelineOccurrencesInWindow(gs, timeSec, timeSec + TIMELINE_GENERATION_LOOKAHEAD_SEC);
  syncTimelineCursor(gs);
  gs.timelineVersion++;
}
