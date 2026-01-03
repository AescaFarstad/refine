import type { RaidMutation } from './RaidMutation';
export interface QuestRewards {
  // Skill points awarded to the player
  skillPoints?: number;
  unlocks?: string[];
}

export interface QuestDefinition {
  id: string;
  name: string;
  raidRestriction?: string[];
  autoaccept?: boolean;
  rewards?: QuestRewards;
  encounterLine?: string;
  encounterTimeMin: number;
  encounters?: RaidMutation[];
}
