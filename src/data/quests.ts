import type { QuestDefinition } from '../logic/QuestLib';

// Minimal quests to drive reach gating via end-of-raid completion (Stage 8)
const quests: Record<string, Omit<QuestDefinition, 'id'>> = {
  // Completing Shegolskoe increases reach by 5
  q_reach_5: {
    name: 'Stretch Your Reach',
    encounterTimeMin: 10,
    raidRestriction: ['shegolskoe'],
    rewards: { reach: 5 },
  },
  q_sp_training_1: {
    name: 'Basic Field Training',
    encounterTimeMin: 20,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'rat', count: 1 },
    ],
  },
  q_sp_training_2: {
    name: 'Improvised Tactics',
    encounterTimeMin: 20,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'rat', count: 3 },
    ],
  },
  // Ozernoye completion rewards
  q_reach_oz_boost_2: {
    name: 'Survey the Lakefront',
    encounterTimeMin: 10,
    raidRestriction: ['ozernoye'],
    rewards: { reach: 2 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'rat', count: 2 },
    ],
  },
  q_sp_oz_advance: {
    name: 'Advanced Anomalous Techniques',
    encounterTimeMin: 30,
    raidRestriction: ['ozernoye'],
    rewards: { skillPoints: 2 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'rat', count: 4 },
    ],
  },
  q_combo_oz: {
    name: 'Push the Boundary',
    encounterTimeMin: 20,
    raidRestriction: ['ozernoye'],
    rewards: { skillPoints: 1, reach: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'soldier', count: 1 },
    ],
  },
  // Quest that injects a timed QuestEncounter into Shegolskoe
  q_soil_sample: {
    name: 'Anomaly Soil Sample',
    encounterLine: 'Gathering anomaly soil',
    encounterTimeMin: 12,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
  },
  // While active, adds a rat encounter to Shegolskoe
  q_add_rat_to_shegolskoe: {
    name: 'Infestation in Shegolskoe',
    encounterTimeMin: 0,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'rat', count: 1 },
    ],
  },
};

export default quests;
