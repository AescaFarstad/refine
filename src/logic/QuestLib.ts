import type { RaidMutation } from './RaidMutation';
import type { Reward } from './Reward';

export interface QuestDefinition {
  id: string;
  name: string;
  raidRestriction: string[];
  autoaccept: boolean;
  requiresRaidSuccesses: number;
  requiresRaidQuestCompletions: number;
  requiresQuestIds: string[];
  rewards: Reward[];
  encounterLine: string;
  description: string;
  encounterTimeMin: number;
  encounters: RaidMutation[];
  showAddedItems: boolean;
}

export interface RawQuestDefinition {
  name?: string;
  raidRestriction?: string[];
  autoaccept?: boolean;
  requiresRaidSuccesses?: number;
  requiresRaidQuestCompletions?: number;
  requiresQuestIds?: string[];
  rewards?: Reward[];
  encounterLine?: string;
  description?: string;
  encounterTimeMin?: number;
  encounters?: RaidMutation[];
  showAddedItems?: boolean;
}

export function normalizeQuestDefinition(id: string, raw: RawQuestDefinition): QuestDefinition {
  return {
    id,
    name: raw.name ?? id,
    raidRestriction: raw.raidRestriction ?? [],
    autoaccept: raw.autoaccept ?? false,
    requiresRaidSuccesses: raw.requiresRaidSuccesses ?? 0,
    requiresRaidQuestCompletions: raw.requiresRaidQuestCompletions ?? 0,
    requiresQuestIds: raw.requiresQuestIds ?? [],
    rewards: raw.rewards ?? [],
    encounterLine: raw.encounterLine ?? '',
    description: raw.description ?? '',
    encounterTimeMin: raw.encounterTimeMin ?? 0,
    encounters: raw.encounters ?? [],
    showAddedItems: raw.showAddedItems ?? false,
  };
}

export function buildQuestMapFromSources(
  sources: Array<Record<string, RawQuestDefinition>>
): Map<string, QuestDefinition> {
  const merged: Record<string, RawQuestDefinition> = Object.assign({}, ...sources);
  const map = new Map<string, QuestDefinition>();
  for (const id in merged) {
    if (!Object.prototype.hasOwnProperty.call(merged, id)) continue;
    map.set(id, normalizeQuestDefinition(id, merged[id]));
  }
  return map;
}
