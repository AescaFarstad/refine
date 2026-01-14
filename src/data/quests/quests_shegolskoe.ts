import type { RawQuestDefinition } from '../../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  shegolskoe_explore_loot_locations: {
    name: 'Explore new loot locations',
    encounterLine: 'A number of buildings in Shegolskoe attract zone inhabitants. Preliminary scouting will show what awaits inside and who might we ran into along the way.',
    raidRestriction: ['shegolskoe'],
    requiresRaidSuccesses: 1,
    encounters: [
      { kind: 'WalkMutation', count: 3 },
    ],
  },
  shegolskoe_break_spikder: {
    name: 'Investigate the artist\'s dacha',
    encounterLine: 'A powerful spikder is crawling around a spacious dacha of a famous artist. Weed them out and claim the territory.',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'spikder', count: 1 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 5 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 1 } },
    ],
  },
  shegolskoe_break_flower: {
    name: 'Clear the well',
    encounterLine: 'There is a giant flower in the form of a human, growing around the village well. It blocks the way to a two-story dacha and a picknick spot. Weed them out and claim the territory.',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 1 },
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 3 } },
    ],
  },
  shegolskoe_break_distorted_pack: {
    name: 'Visit the shop',
    encounterLine: 'A pack of distorted humanoids are sleeping next to the village shop entrance. Weed them out and gain access to the shop\'s contents.',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 3 },
    ],
    rewards: [
      { kind: 'raid_add_item', itemId: 'red_rubber_ball' },
      { kind: 'raid_rarity_buff', delta: 10 },
    ],
  },
  shegolskoe_locate_next_zone: {
    name: 'Locate another zone',
    encounterLine: 'The resources are deplete while monsters multiply. Climb the water tower and take a bearing on the nearby zones.',
    requiresRaidQuestCompletions: 3,
    raidRestriction: ['shegolskoe'],
    encounterTimeMin: 50,
    encounters: [
      { kind: 'WalkMutation', count: 5 },
      { kind: 'AddMonsterMutation', monsterId: 'spikder', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 1 },
    ],
    rewards: [
      { kind: 'unlock_raid', raidId: 'ozernoye' },
    ],
  },
};

export default quests;
