import type { RaidMutation } from './RaidMutation';
export interface QuestResourceRewards {
  credits: number;
  chronotraces: number;
  timeFlux: number;
  shardDust: number;
}

export interface QuestRewards {
  skillPoints: number;
  unlocks: string[];
  raidMutations: RaidMutation[];
  lootChanceDelta: number;
  lootingRarityBuffDelta: number;
  resources: QuestResourceRewards;
  addRaidItems: string[];
}

export interface QuestDefinition {
  id: string;
  name: string;
  raidRestriction: string[];
  autoaccept: boolean;
  requiresRaidSuccesses: number;
  requiresRaidQuestCompletions: number;
  rewards: QuestRewards;
  encounterLine: string;
  encounterTimeMin: number;
  encounters: RaidMutation[];
  showAddedItems: boolean;
}

export type RawQuestResourceRewards = Partial<QuestResourceRewards>;
export interface RawQuestRewards extends Partial<Omit<QuestRewards, 'resources'>> {
  resources?: RawQuestResourceRewards;
}

export interface RawQuestDefinition {
  name?: string;
  raidRestriction?: string[];
  autoaccept?: boolean;
  requiresRaidSuccesses?: number;
  requiresRaidQuestCompletions?: number;
  rewards?: RawQuestRewards;
  encounterLine?: string;
  encounterTimeMin?: number;
  encounters?: RaidMutation[];
  showAddedItems?: boolean;
}

export function normalizeQuestDefinition(id: string, raw: RawQuestDefinition): QuestDefinition {
  const rewardsRaw = raw.rewards ?? {};
  const rewards: QuestRewards = {
    skillPoints: rewardsRaw.skillPoints ?? 0,
    unlocks: rewardsRaw.unlocks ?? [],
    raidMutations: rewardsRaw.raidMutations ?? [],
    lootChanceDelta: rewardsRaw.lootChanceDelta ?? 0,
    lootingRarityBuffDelta: rewardsRaw.lootingRarityBuffDelta ?? 0,
    resources: {
      credits: rewardsRaw.resources?.credits ?? 0,
      chronotraces: rewardsRaw.resources?.chronotraces ?? 0,
      timeFlux: rewardsRaw.resources?.timeFlux ?? 0,
      shardDust: rewardsRaw.resources?.shardDust ?? 0,
    },
    addRaidItems: rewardsRaw.addRaidItems ?? [],
  };

  return {
    id,
    name: raw.name ?? id,
    raidRestriction: raw.raidRestriction ?? [],
    autoaccept: raw.autoaccept ?? false,
    requiresRaidSuccesses: raw.requiresRaidSuccesses ?? 0,
    requiresRaidQuestCompletions: raw.requiresRaidQuestCompletions ?? 0,
    rewards,
    encounterLine: raw.encounterLine ?? '',
    encounterTimeMin: raw.encounterTimeMin ?? 0,
    encounters: raw.encounters ?? [],
    showAddedItems: raw.showAddedItems ?? false,
  };
}
