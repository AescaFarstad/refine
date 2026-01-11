import type { RawQuestDefinition } from '../../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  ozernoye_explore_fire_station: {
    name: 'Explore the fire station',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 1,
    encounters: [
      { kind: 'WalkMutation', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 3 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 5 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 5 } },
      { kind: 'raid_mutation', mutation: { kind: 'WalkMutation', count: 1 } },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 1 } },
    ],
  },
  ozernoye_explore_bus_station_: {
    name: 'Explore the bus station',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 1,
    encounters: [
      { kind: 'WalkMutation', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 3 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 10 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 3 } },
      { kind: 'raid_mutation', mutation: { kind: 'WalkMutation', count: 2 } },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 1 } },
    ],
  },
  ozernoye_study_church_signatures: {
    name: 'Study church inscriptions',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 1,
    encounterTimeMin: 40,
    encounters: [
    ],
    rewards: [
      { kind: 'discovery', discoveryId: 'signatures' },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 2 } },
    ],
  },
  ozernoye_raise_the_dome: {
    name: 'Raise the dome',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 1,
    encounterTimeMin: 80,
    encounters: [
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'ZoneCollapseTimeMutation', amount: 1200 } },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 3 } },
    ],
  },
  ozernoye_study_the_dome: {
    name: 'Study the dome',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 1,
    requiresQuestIds: ['ozernoye_raise_the_dome'],
    encounterTimeMin: 80,
    encounters: [
    ],
    rewards: [
      { kind: 'unlock_gear', gearId: 'stabilizer_beacon' },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 3 } },
    ],
  },
  anywhere_summon_hounds: {
    name: 'Summon hounds',
    raidRestriction: [],
    requiresRaidSuccesses: 5,
    encounters: [
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'hound', count: 5 } },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'arch_hound', count: 5 } },
    ],
  },
};

export default quests;
