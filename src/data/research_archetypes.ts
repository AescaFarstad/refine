import type { ResearchArchetypeDef } from '../logic/ResearchLib';

export const researchArchetypes: Record<string, ResearchArchetypeDef> = {
  hub: { type: 'empty', rewards: [] },
  obs: { type: 'obstacle', rewards: [] },
  empty: { type: 'empty', rewards: [] },
  void: { type: 'void', rewards: [] },

  res_credits: { type: 'resource', rewards: [{ kind: 'resource', resource: 'credits', amount: 1000 }] },
  res_chronotraces: { type: 'resource', rewards: [{ kind: 'resource', resource: 'chronotraces', amount: 100 }] },
  res_timeFlux: { type: 'resource', rewards: [{ kind: 'resource', resource: 'timeFlux', amount: 50 }] },
  res_shards: { type: 'resource', rewards: [{ kind: 'resource', resource: 'shardDust', amount: 100 }] },
  res_skillPoint: { type: 'resource', rewards: [{ kind: 'resource', resource: 'skillPoints', amount: 1 }] },

  // Stats
  stat_dmg: { type: 'stat', rewards: [{ kind: 'stat', stat: 'damage', value: 1 }] },
  stat_hp: { type: 'stat', rewards: [{ kind: 'stat', stat: 'health', value: 1 }] },
  stat_volume: { type: 'stat', rewards: [{ kind: 'stat', stat: 'volume', value: 1 }] },
  stat_weight: { type: 'stat', rewards: [{ kind: 'stat', stat: 'baseMaxWeight', value: 1 }] },
  stat_vision: { type: 'stat', rewards: [{ kind: 'stat', stat: 'researchRevealRadius', value: 1 }] },
  stat_speed: { type: 'stat', rewards: [{ kind: 'stat', stat: 'speed', value: 1 }] },

  // Gear archetypes are auto-generated from gear definitions in ResearchLib.load()
};
