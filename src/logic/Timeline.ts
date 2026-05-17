import type { GameState, TimelineScheduledEvent } from './GameState';
import type { Reward } from './Reward';
import { applyReward } from './Reward';

function isTimelineRewardAffordable(gs: GameState, reward: Reward): boolean {
  if (reward.kind !== 'resource') return true;
  if (reward.amount >= 0) return true;
  return gs[reward.resource] >= -reward.amount;
}

function selectTimelineReward(gs: GameState, options: Reward[]): Reward | null {
  for (let i = 0; i < options.length; i++) {
    if (isTimelineRewardAffordable(gs, options[i]!)) {
      return options[i]!;
    }
  }
  return null;
}

function insertTimelineEventSorted(gs: GameState, entry: TimelineScheduledEvent): void {
  let idx = gs.timelineEvents.length;
  for (let i = 0; i < gs.timelineEvents.length; i++) {
    if (gs.timelineEvents[i]!.at <= entry.at) continue;
    idx = i;
    break;
  }
  gs.timelineEvents.splice(idx, 0, entry);
  if (idx <= gs.timelineCursor) {
    gs.timelineCursor++;
  }
}

function scheduleTimelineRepeatEvent(gs: GameState, source: TimelineScheduledEvent, nextAt: number): void {
  const repeated: TimelineScheduledEvent = {
    eventId: source.eventId,
    archetypeId: source.archetypeId,
    at: nextAt,
    repeat: source.repeat,
    executed: false,
  };
  insertTimelineEventSorted(gs, repeated);
}

function executeTimelineEvent(gs: GameState, entry: TimelineScheduledEvent): void {
  const archetype = gs.lib.timeline.archetypes.get(entry.archetypeId)!;
  const selectedReward = selectTimelineReward(gs, archetype.options);
  if (selectedReward) {
    applyReward(gs, selectedReward);
  }
}

export function processDueTimelineEvents(gs: GameState): void {
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

    if (entry.repeat > 0) {
      scheduleTimelineRepeatEvent(gs, entry, entry.at + entry.repeat);
    }
    gs.timelineCursor++;
  }
}

