import type { RaidDefinition } from '../logic/RaidLib';

const raids: Record<string, Omit<RaidDefinition, 'id'>> = {
  shegolskoe: {
    name: 'Shegolskoe',
    reachRequired: 0,
    baseLootChance: 55,
    items: [
      'vinyl_record',
      'mechanical_clock',
      'porcelain_figurine',
      'wrench',
      'soviet_watch',
      'vintage_camera',
      'iodine_bottle',
      'lucky_coin',
      'gas_mask_gp5',
      'canvas_tent',
      'vintage_camera',
      'window_latch',
      'door_handle',
      'padlock',
      'chain_link',
      'insulation_tape',
      'inventory_keys',
      'ruined_ammo_box',
      'portable_radio',
    ],
    encounters: [
      { count: 1, encounter: { type: 'WalkEncounter' } },
      { count: 3, encounter: { type: 'FightEncounter', monsterId: 'rat' } },
      { count: 1, encounter: { type: 'FightEncounter', monsterId: 'soldier' } },
      { count: 4, encounter: { type: 'LootEncounter' } }
    ],
  },
  ozernoye: {
    name: 'Ozernoye',
    reachRequired: 5,
    baseLootChance: 30,
    items: [
      'vinyl_record',
      'soviet_watch',
      'vintage_camera',
      'iodine_bottle',
      'geiger_counter',
      'gas_mask_gp5',
      'chemical_kit',
      'portable_radio',
      'door_handle',
    ],
    encounters: [
      { count: 14, encounter: { type: 'WalkEncounter' } },
      { count: 13, encounter: { type: 'LootEncounter' } }
    ],
  },
};

export default raids;
