import type { RawQuestDefinition } from '../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  explore_loot_locations: {
    name: 'Explore new loot locations',
    raidRestriction: ['shegolskoe'],
    requiresRaidSuccesses: 1,
    encounters: [
      { kind: 'WalkMutation', count: 3 },
    ],
  },
  break_spikder: {
    name: 'Break through a spikder',
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
  break_flower: {
    name: 'Break through a flower human',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 1 },
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 3 } },
    ],
  },
  break_distorted_pack: {
    name: 'Break through a pack of distorted',
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
  locate_next_zone: {
    name: 'Locate another zone',
    requiresRaidQuestCompletions: 3,
    raidRestriction: ['shegolskoe'],
    encounterTimeMin: 50,
    encounters: [
      { kind: 'WalkMutation', count: 5 },
    ],
    rewards: [
      { kind: 'unlock_raid', raidId: 'ozernoye' },
    ],
  },
};

export default quests;
