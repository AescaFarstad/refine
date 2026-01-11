import type { ResearchArchetypeDef } from '../logic/ResearchLib';
import { DISCOVERY } from '../logic/DiscoveryLib';

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

  disc_damage_breakdown: {
    type: 'discovery',
    title: 'Damage breakdown',
    description: 'Shows per monster damage received in the raid simulation.',
    icon: { kind: 'glyph', glyph: 'ⓘ' },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.DAMAGE_BREAKDOWN }],
  },
  disc_time_breakdown: {
    type: 'discovery',
    title: 'Time breakdown',
    description: 'Shows per activity time taken in the raid simulation.',
    icon: { kind: 'glyph', glyph: 'ⓘ' },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.TIME_BREAKDOWN }],
  },
  disc_essence_anomaly: {
    type: 'discovery',
    title: 'Essence anomaly',
    description: 'A mysterious essence mutation of unclear nature.',
    ownedTitle: 'Cyan anomaly',
    ownedDescription: 'Cyan essence now gives 10% bonus yield.',
    icon: { kind: 'glyph', glyph: '?', scale: 2.2, offset: { x: 0, y: 8 }},
    ownedIcon: { kind: 'itemImage', key: 'cyan' },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.CYAN_YIELD }],
  },
  disc_maze_navigation: {
    type: 'discovery',
    title: 'A crack in the fabric of continuity',
    description: 'A mysterious opportunity of unclear nature.',
    ownedTitle: 'Maze navigation',
    ownedDescription: 'You are now able to enter the maze of time.',
    icon: { kind: 'glyph', glyph: '?', scale: 1.2, offset: { x: 0, y: 0 }},
    ownedIcon: { kind: 'itemImage', key: 'maze_out', scale: 1.5, offset: { x: 0, y: 0 } },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.MAZE_NAVIGATION }],
  },

  // Gear archetypes are auto-generated from gear definitions in ResearchLib.load()
};
