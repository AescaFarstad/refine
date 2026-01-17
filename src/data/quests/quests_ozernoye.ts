import type { RawQuestDefinition } from '../../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  ozernoye_explore_fire_station: {
    name: 'Explore the fire station',
    description: 'There is a fire station which could use some actual fire to get rid of its cornivorous inhabitants. Opening it might cause long-term flower trouble, but there must be some useful equipment in there.',
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
    encounterLine: 'Disturb the carnivorous flora inhabiting the bus station. This will spread the pollen, but you can’t make a salad without cutting some veggies.',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 2,
    encounters: [
      { kind: 'WalkMutation', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 4 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 10 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 3 } },
      { kind: 'raid_mutation', mutation: { kind: 'WalkMutation', count: 2 } },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 2 } },
    ],
  },
  ozernoye_study_church_signatures: {
    name: 'Study church inscriptions',
    encounterLine: 'The church walls are covered in glowing signs that do not match common orthodox inscriptions. These must be left with a purpose. Perhaps even by yourself in another life.',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 6,
    encounterTimeMin: 40,
    encounters: [
    ],
    rewards: [
      { kind: 'discovery', discoveryId: 'signatures' },
      { kind: 'learn_n_signatures', count: 6 },
    ],
  },
  ozernoye_raise_the_dome: {
    name: 'Raise the zone\'s dome',
    encounterLine: 'Hooking up the batteries...',
    description: 'Collect accumulators from the abandoned cars and focus their power to push away the zone boundary via magnetic induction.',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 4,
    encounterTimeMin: 80,
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 3 },
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'ZoneCollapseTimeMutation', amount: 1200 } },
    ],
  },
  ozernoye_study_the_dome: {
    name: 'Study the zone\'s dome',
    encounterLine: 'Sketching out the stabilizer circuit...',
    description: 'Experiment with electricity and design a device that would prolong the zone\'s stability.',
    raidRestriction: ['ozernoye'],
    requiresQuestIds: ['ozernoye_raise_the_dome'],
    encounterTimeMin: 80,
    encounters: [
    ],
    rewards: [
      { kind: 'unlock_gear', gearId: 'stabilizer_beacon' },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'flower', count: 3 } },
    ],
  },
  asummon_hounds: {
    name: 'Gather hounds bait',
    encounterLine: 'Picking up the meat...',
    description: 'Collect the spoilage which attracts these pesky beasts.',
    raidRestriction: ['ozernoye'],
    requiresRaidSuccesses: 7,
    requiresRaidQuestCompletions: 3,
    encounterTimeMin: 30,
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'hound', count: 10 },
    ],
    rewards: [
      { kind: 'countable_gear', gearId: 'xeno_bait', amount: 10 },
    ],
  },
};

export default quests;
