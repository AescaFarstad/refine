export interface QuestRewards {
  reach?: number;
  // Skill points awarded to the player
  skillPoints?: number;
  unlocks?: string[];
}

export interface QuestDefinition {
  id: string;
  name: string;
  // If present, quest only applies to these raids
  raidRestriction?: string[];
  // For Stage 8, we only support auto-accepted quests and basic rewards
  autoaccept?: boolean;
  rewards?: QuestRewards;
  // Display line for QuestEncounter in logs (fallback to name if absent)
  encounterLine?: string;
  // Duration for QuestEncounter in minutes
  encounterTimeMin: number;
  // While active (autoaccepted and not completed), apply these mutations
  // to the restricted raid(s)
  encounters?: import('./RaidMutation').RaidMutation[];
}
