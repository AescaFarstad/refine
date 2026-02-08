import type { ResearchArchetypeDef } from '../logic/ResearchLib';
import { DISCOVERY } from '../logic/DiscoveryLib';
import { CYAN_YIELD_BONUS_PCT, MAGENTA_YIELD_BONUS_PCT } from '../logic/Const';

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
  stat_speed: { type: 'stat', rewards: [{ kind: 'stat', stat: 'speed', value: 1 }] },
  stat_itemBans: { type: 'stat', rewards: [{ kind: 'stat', stat: 'itemBans', value: 1 }] },
  stat_vision: { type: 'stat', rewards: [{ kind: 'stat', stat: 'researchRevealRadius', value: 1 }] },

  disc_damage_breakdown: {
    type: 'discovery',
    title: 'Damage breakdown',
    description: 'Shows per monster damage received in the raid simulation.',
    icon: { kind: 'glyph', glyph: 'ⓘ' },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.UI_DAMAGE_BREAKDOWN }],
  },
  disc_time_breakdown: {
    type: 'discovery',
    title: 'Time breakdown',
    description: 'Shows per activity time taken in the raid simulation.',
    icon: { kind: 'glyph', glyph: 'ⓘ' },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.UI_TIME_BREAKDOWN }],
  },
  disc_unique_items_yield: {
    type: 'discovery',
    title: 'Unique item recycling',
    description: 'Gain +1% refining yield for each unique item you have ever successfully refined.',
    icon: { kind: 'itemImage', key: 'recycle_3', scale: 1.3, offset: { x: 0, y: 3 } },
    rewards: [{ kind: 'discovery', discoveryId: DISCOVERY.UNIQUE_ITEMS_YIELD }],
  },
  disc_essence_anomaly_cyan: {
    type: 'discovery',
    title: 'Essence anomaly',
    description: 'A mysterious essence mutation of unclear nature.',
    ownedTitle: 'Cyan anomaly',
    ownedDescription: `Cyan essence now gives ${CYAN_YIELD_BONUS_PCT}% bonus yield.`,
    revealingDiscovery: DISCOVERY.ESSENCE_RESEARCH_KNOWLEDGE,
    revealedTitle: 'Cyan anomaly',
    revealedDescription: `Cyan essence will give ${CYAN_YIELD_BONUS_PCT}% bonus yield.`,
    icon: { kind: 'glyph', glyph: '?', scale: 2.2, offset: { x: 0, y: 8 }},
    ownedIcon: { kind: 'itemImage', key: 'cyan', scale: 1.3, offset: { x: 0, y: 4 } },
    revealedIcon: { kind: 'itemImage', key: 'cyan', scale: 1.3, offset: { x: 0, y: 4 } },
    rewards: [
      { kind: 'discovery', discoveryId: DISCOVERY.CYAN_YIELD },
      {
        kind: 'show_ui', ui: 'RUIEssenceYieldBonus',
        params: { bonusPct: CYAN_YIELD_BONUS_PCT, color: 'cyan' },
      },
    ],
  },
  disc_essence_anomaly_magenta: {
    type: 'discovery',
    title: 'Essence anomaly',
    description: 'A mysterious essence mutation of unclear nature.',
    ownedTitle: 'Magenta anomaly',
    ownedDescription: `Magenta essence now gives ${MAGENTA_YIELD_BONUS_PCT}% bonus yield.`,
    revealingDiscovery: DISCOVERY.ESSENCE_RESEARCH_KNOWLEDGE,
    revealedTitle: 'Magenta anomaly',
    revealedDescription: `Magenta essence will give ${MAGENTA_YIELD_BONUS_PCT}% bonus yield.`,
    icon: { kind: 'glyph', glyph: '?', scale: 2.2, offset: { x: 0, y: 8 }},
    ownedIcon: { kind: 'itemImage', key: 'magenta', scale: 1.3, offset: { x: 0, y: 4 } },
    revealedIcon: { kind: 'itemImage', key: 'magenta', scale: 1.3, offset: { x: 0, y: 4 } },
    rewards: [
      { kind: 'discovery', discoveryId: DISCOVERY.MAGENTA_YIELD },
      {
        kind: 'show_ui', ui: 'RUIEssenceYieldBonus',
        params: { bonusPct: MAGENTA_YIELD_BONUS_PCT, color: 'magenta' },
      },
    ],
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

  gear_zone_crystal: {
    type: 'gear',
    rewards: [{ kind: 'countable_gear', gearId: 'zone_crystal', amount: 5 }],
  },

  // Gear archetypes are auto-generated from gear definitions in ResearchLib.load()
};
