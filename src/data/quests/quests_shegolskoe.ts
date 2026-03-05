import type { RawQuestDefinition } from '../../logic/QuestLib';

const quests: Record<string, RawQuestDefinition> = {
  shegolskoe_explore_loot_locations: {
    name: 'Explore new loot locations',
    description: 'A number of buildings in Shegolskoe attract zone inhabitants. Preliminary scouting will show what awaits inside and who we might run into along the way.',
    raidRestriction: ['shegolskoe'],
    requiresRaidSuccesses: 1,
    encounters: [
      { kind: 'WalkMutation', count: 3 },
    ],
  },
  shegolskoe_break_spikder: {
    name: 'Artist\'s dacha',
    description: 'A powerful spikder is crawling around a spacious dacha of a famous artist.',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'spikder', count: 1 },
    ],
    rewards: [
      { kind: 'raid_loot_chance', delta: 20 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 2 } },
      { kind: 'raid_add_item', itemIds: ['paint', 'brush'] },
    ],
  },
  shegolskoe_break_flower: {
    name: 'Well',
    description: 'There is a giant flower in the form of a human, growing around the village well. It blocks the way to a two-story dacha and a picnic spot.',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'flower', count: 1 },
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 4 } },
    ],
  },
  shegolskoe_break_distorted_pack: {
    name: 'Shop',
    description: 'A pack of distorted humanoids are sleeping next to the village shop entrance.',
    requiresRaidQuestCompletions: 1,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 4 },
    ],
    rewards: [
      { kind: 'raid_add_item', itemIds: ['red_rubber_ball', 'red_christmas_ball', 'ruined_ammo_cartridge', 'vintage_camera'] },
      { kind: 'raid_rarity_buff', delta: 20 },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 2 } },
    ],
  },
  shegolskoe_locate_next_zone: {
    name: 'Locate another zone',
    description: 'The resources are depleting while monsters multiply. Climb the water tower and take a bearing on the nearby zones.',
    encounterLine: 'There is a larger settlement nearby - Ozernoye.',
    requiresRaidQuestCompletions: 3,
    raidRestriction: ['shegolskoe'],
    encounterTimeMin: 45,
    encounters: [
      { kind: 'WalkMutation', count: 5 },
      { kind: 'AddMonsterMutation', monsterId: 'spikder', count: 5 },
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 3 },
    ],
    rewards: [
      { kind: 'unlock_raid', raidId: 'ozernoye' },
      { kind: 'raid_loot_chance', delta: 5 },
    ],
  },
  shegolskoe_forest: {
    name: 'Forester\'s house',
    description: 'The forest consumed this one before the burdock could.',
    requiresRaidQuestCompletions: 3,
    requiresRaidSuccesses: 18,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'WalkMutation', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'burdock', count: 15 },
    ],
    rewards: [
      { kind: 'raid_rarity_buff', delta: 10 },
      { kind: 'raid_loot_chance', delta: 10 },
      { kind: 'raid_add_item', itemIds: ['pine_cone', 'pine_toy'] },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'hound', count: 3 } },
    ],
  },
  shegolskoe_powerstation: {
    name: 'Power station',
    description: 'The step-down transformer is sparking there just before the zone collapse.',
    requiresRaidQuestCompletions: 4,
    requiresRaidSuccesses: 22,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'WalkMutation', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 7 },
    ],
    rewards: [
      { kind: 'raid_mutation', mutation: { kind: 'ZoneCollapseTimeMutation', amount: 1200 } },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'hound', count: 3 } },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 3 } },
      { kind: 'raid_add_item', itemIds: ['electrical_wire'] },
    ],
  },
  shegolskoe_poet: {
    name: 'Poet\'s house',
    description: 'He was more than a poet, he warned about the perils of regret even before USSR had collapsed. His texts might be worth studying.',
    encounterLine: 'Decyphering the poetry...',
    requiresRaidQuestCompletions: 4,
    requiresRaidSuccesses: 22,
    encounterTimeMin: 20,
    raidRestriction: ['shegolskoe'],
    encounters: [
      { kind: 'WalkMutation', count: 1 },
      { kind: 'AddMonsterMutation', monsterId: 'distorted', count: 7 },
    ],
    rewards: [
      { kind: 'show_ui', ui: 'poets_scribbles' },
      { kind: 'raid_mutation', mutation: { kind: 'LootMutation', count: 3 } },
      { kind: 'raid_loot_chance', delta: 10 },
      { kind: 'raid_mutation', mutation: { kind: 'AddMonsterMutation', monsterId: 'hound', count: 3 } },
      { kind: 'raid_add_item', itemIds: ['tall_glass', 'soviet_champagne', 'vodka_bottle', 'corkscrew', 'poetry_book'] },
    ],
  },
};

export default quests;
