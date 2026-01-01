import type { ResearchArchetypeDef } from '../logic/ResearchLib';

export const researchArchetypes: Record<string, ResearchArchetypeDef> = {
  hub: { type: 'empty' },
  obs: { type: 'obstacle' },
  empty: { type: 'empty' },
  void: { type: 'void' },

  res_credits: { type: 'resource', resource: 'credits', amount: 1000 },
  res_chronotraces: { type: 'resource', resource: 'chronotraces', amount: 100 },
  res_timeFlux: { type: 'resource', resource: 'timeFlux', amount: 50 },
  res_shards: { type: 'resource', resource: 'shards', amount: 100 },

  // Stats
  stat_dmg: { type: 'stat', stat: 'damage', value: 1 },
  stat_hp: { type: 'stat', stat: 'health', value: 2 },
  stat_volume: { type: 'stat', stat: 'volume', value: 1 },
  stat_weight: { type: 'stat', stat: 'baseMaxWeight', value: 2 },
  stat_vision: { type: 'stat', stat: 'researchRevealRadius', value: 1 },
  stat_skillPoint: { type: 'stat', stat: 'skillPoints', value: 1 },

  // Gear
  gear_laser_sight: { type: 'gear', gearId: 'laser_sight' },
  gear_kevlar_helmet: { type: 'gear', gearId: 'kevlar_helmet' },
  gear_spiked_armor: { type: 'gear', gearId: 'spiked_armor' },
  gear_cargo_harness: { type: 'gear', gearId: 'cargo_harness' },
};
