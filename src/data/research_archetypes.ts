import type { ResearchArchetypeDef } from '../logic/ResearchLib';

export const researchArchetypes: Record<string, ResearchArchetypeDef> = {
  hub: { type: 'empty' },
  obs: { type: 'obstacle' },
  empty: { type: 'empty' },
  void: { type: 'void' },
  res_credits: { type: 'resource', resource: 'credits', amount: 1000, covert: true },
  stat_dmg: { type: 'stat', stat: 'damage', value: 1 },
  stat_hp: { type: 'stat', stat: 'health', value: 2 },
  stat_volume: { type: 'stat', stat: 'volume', value: 1 },
  stat_weight: { type: 'stat', stat: 'baseMaxWeight', value: 2 },
  gear_laser_sight: { type: 'gear', gearId: 'laser_sight' },
  gear_kevlar_helmet: { type: 'gear', gearId: 'kevlar_helmet' },
  gear_spiked_armor: { type: 'gear', gearId: 'spiked_armor' },
  gear_cargo_harness: { type: 'gear', gearId: 'cargo_harness' },
};
