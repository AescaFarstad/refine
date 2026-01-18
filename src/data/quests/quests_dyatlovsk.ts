import type { RawQuestDefinition } from '../../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  dyatlovsk_explore_hospital: {
    name: 'Hospital',
    raidRestriction: ['dyatlovsk'],
    requiresRaidSuccesses: 1,
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 2 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 5 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 2 } },
      { kind: 'raid_mutation', mutation: { kind: 'WalkMutation', count: 1 } },
    ],
  },
  dyatlovsk_explore_morgue: {
    name: 'Morgue',
    raidRestriction: ['dyatlovsk'],
    requiresQuestIds: ['dyatlovsk_explore_hospital'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 3 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 5 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 2 } },
      { kind: 'raid_mutation', mutation: { kind: 'WalkMutation', count: 1 } },
    ],
  },
  dyatlovsk_explore_department_store: {
    name: 'Department store',
    raidRestriction: ['dyatlovsk'],
    requiresQuestIds: ['dyatlovsk_explore_morgue'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 4 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 5 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 2 } },
      { kind: 'raid_mutation', mutation: { kind: 'WalkMutation', count: 1 } },
    ],
  },
  dyatlovsk_raise_the_dome: {
    name: 'Raise the dome',
    raidRestriction: ['dyatlovsk'],
    requiresRaidSuccesses: 1,
    encounterTimeMin: 80,
    encounters: [
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'ZoneCollapseTimeMutation', amount: 2400 } },
    ],
  },
  dyatlovsk_raise_the_dome_even_higher: {
    name: 'Raise the dome even higher',
    raidRestriction: ['dyatlovsk'],
    encounterTimeMin: 120,
    requiresQuestIds: ['dyatlovsk_raise_the_dome'],
    encounters: [
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'ZoneCollapseTimeMutation', amount: 2400 } },
    ],
  },
};

export default quests;
