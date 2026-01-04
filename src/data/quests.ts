import type { RawQuestDefinition } from '../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  sheg_1: {
    name: 'Explore new locations',
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'WalkMutation', count: 3 },
    ],
  },
  sheg_2_1: {
    name: 'Break through a spikder',
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'spikder', count: 1 },
    ],
    rewards: { skillPoints: 1 },
  },
  q_sp_training_1: {
    name: 'Basic Field Training',
    encounterTimeMin: 20,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 1 },
    ],
  },
  q_sp_training_2: {
    name: 'Improvised Tactics',
    encounterTimeMin: 20,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 3 },
    ],
  },
  q_reach_oz_boost_2: {
    name: 'Survey the Lakefront',
    encounterTimeMin: 10,
    raidRestriction: ['ozernoye'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 2 },
    ],
  },
  q_sp_oz_advance: {
    name: 'Advanced Anomalous Techniques',
    encounterTimeMin: 30,
    raidRestriction: ['ozernoye'],
    rewards: { skillPoints: 2 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 4 },
    ],
  },
  q_combo_oz: {
    name: 'Push the Boundary',
    encounterTimeMin: 20,
    raidRestriction: ['ozernoye'],
    rewards: { skillPoints: 2 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 1 },
    ],
  },
  q_soil_sample: {
    name: 'Anomaly Soil Sample',
    encounterLine: 'Gathering anomaly soil',
    encounterTimeMin: 12,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
  },
  q_add_rat_to_shegolskoe: {
    name: 'Infestation in Shegolskoe',
    encounterTimeMin: 0,
    raidRestriction: ['shegolskoe'],
    rewards: { skillPoints: 1 },
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 1 },
    ],
  },
};

export default quests;
