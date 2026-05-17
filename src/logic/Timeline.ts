import type { GameState, TimelineScheduledEvent } from './GameState';
import { TIMELINE_MIN_SEPARATION_SEC, TIMELINE_VISIBLE_SPAN_SEC } from './Const';
import type { Reward } from './Reward';
import { applyReward } from './Reward';
import { describeMutation } from './RaidMutation';
import type { TimelineEventDefinition } from './TimelineLib';

const TIMELINE_GENERATION_LOOKAHEAD_SEC = TIMELINE_VISIBLE_SPAN_SEC + 24 * 3600;

function isTimelineRewardAffordable(gs: GameState, reward: Reward): boolean {
  if (reward.kind !== 'resource') return true;
  if (reward.amount >= 0) return true;
  return gs[reward.resource] >= -reward.amount;
}

function selectTimelineRewardIndex(gs: GameState, entry: TimelineScheduledEvent, options: Reward[]): number {
  const preferredIndex = entry.preferredOptionIndex;
  if (preferredIndex >= 0 && preferredIndex < options.length && isTimelineRewardAffordable(gs, options[preferredIndex]!)) {
    return preferredIndex;
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
  if (idx <= gs.timelineCursor) {
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

function createTimelineScheduledEvent(eventDef: TimelineEventDefinition, at: number): TimelineScheduledEvent {
  return {
    eventId: eventDef.id,
    archetypeId: eventDef.type,
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
  insertTimelineEventSorted(gs, createTimelineScheduledEvent(eventDef, at));
}

export function ensureTimelineEventsGenerated(gs: GameState): void {
  const horizon = gs.gameTime + TIMELINE_GENERATION_LOOKAHEAD_SEC;
  for (const eventDef of gs.lib.timeline.events) {
    let generatedCount = 0;
    for (const entry of gs.timelineEvents) {
      if (entry.eventId === eventDef.id) generatedCount++;
    }

    if (eventDef.repeat <= 0) {
      if (generatedCount === 0 && eventDef.time <= horizon) {
        scheduleTimelineEvent(gs, eventDef, eventDef.time);
      }
      continue;
    }

    let requestedAt = eventDef.time + generatedCount * eventDef.repeat;
    while (requestedAt <= horizon) {
      scheduleTimelineEvent(gs, eventDef, requestedAt);
      generatedCount++;
      requestedAt = eventDef.time + generatedCount * eventDef.repeat;
    }
  }
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

  return '';
}

function executeTimelineEvent(gs: GameState, entry: TimelineScheduledEvent): void {
  const archetype = gs.lib.timeline.archetypes.get(entry.archetypeId)!;
  const selectedRewardIndex = selectTimelineRewardIndex(gs, entry, archetype.options);
  entry.resolvedOptionIndex = selectedRewardIndex;
  if (selectedRewardIndex >= 0) {
    entry.resolvedDescription = applyTimelineReward(gs, archetype.options[selectedRewardIndex]!);
  }
  gs.timelineVersion++;
}

export function processDueTimelineEvents(gs: GameState): void {
  ensureTimelineEventsGenerated(gs);

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
