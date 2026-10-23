import type { RawTimelineArchetypeDefinition } from '../logic/TimelineLib';
import { DISCOVERY } from '../logic/DiscoveryLib';

export const timelineArchetypes: Record<string, RawTimelineArchetypeDefinition> = {
  credits_or_deterioration: {
    sentiment: 'negative',
    severity: 1,
    options: [
      { kind: 'resource', resource: 'credits', amount: -100 },
      { kind: 'timeline_deteriorate_random_raid' },
    ],
    icon: { kind: 'glyph', glyph: '✦', scale: 1, offset: { x: 0, y: 1 } },
  },
  credits_or_deterioration_2: {
    sentiment: 'negative',
    severity: 2,
    options: [
      { kind: 'resource', resource: 'credits', amount: -300 },
      { kind: 'timeline_deteriorate_random_raid' },
    ],
    icon: { kind: 'glyph', glyph: '✦', scale: 1, offset: { x: 0, y: 1 } },
  },
  credits_or_deterioration_3: {
    sentiment: 'negative',
    severity: 3,
    options: [
      { kind: 'resource', resource: 'credits', amount: -1000 },
      { kind: 'timeline_deteriorate_random_raid' },
    ],
    icon: { kind: 'glyph', glyph: '✦', scale: 1, offset: { x: 0, y: 1 } },
  },
  credits_or_deterioration_4: {
    sentiment: 'negative',
    severity: 4,
    options: [
      { kind: 'resource', resource: 'credits', amount: -2000 },
      { kind: 'timeline_deteriorate_random_raid' },
    ],
    icon: { kind: 'glyph', glyph: '✦', scale: 1, offset: { x: 0, y: 1 } },
  },

  chronotraces_or_mass_deterioration: {
    sentiment: 'negative',
    severity: 1,
    options: [
      { kind: 'resource', resource: 'chronotraces', amount: -100 },
      { kind: 'timeline_deteriorate_all_raids' },
    ],
    icon: { kind: 'glyph', glyph: '⧖', scale: 1, offset: { x: 0, y: 1 } },
  },
  time_flux_or_die: {
    sentiment: 'negative',
    severity: 5,
    forcedDefaultOptionIndex: 0,
    options: [
      { kind: 'resource', resource: 'timeFlux', amount: -100 },
      { kind: 'death_due_touniversecollapse' },
    ],
    icon: { kind: 'glyph', glyph: '∿', scale: 1.4, offset: { x: 0, y: 1 } },
  },
  all_monsters_get_hp: {
    sentiment: 'negative',
    severity: 1,
    options: [
      { kind: 'global_monsters_buff_hp', amount: 1 },
    ],
    icon: { kind: 'glyph', glyph: '❤︎', scale: 1, offset: { x: 0, y: 2 } },
  },
  kilava_octopus_add: {
    sentiment: 'negative',
    severity: 2,
    options: [
      {
        kind: 'raid_mutation',
        targetRaidId: 'kilava',
        mutation: { kind: 'AddMonsterMutation', monsterId: 'octopus', count: 1 },
      },
    ],
    icon: { kind: 'glyph', glyph: '⌁', scale: 1, offset: { x: 0, y: 1 } },
  },
  kilava_octopus_remove: {
    sentiment: 'positive',
    severity: 0,
    options: [
      {
        kind: 'raid_mutation',
        targetRaidId: 'kilava',
        mutation: { kind: 'AddMonsterMutation', monsterId: 'octopus', count: -1 },
      },
    ],
    icon: { kind: 'glyph', glyph: '⌁', scale: 1, offset: { x: 0, y: 1 } },
  },
  timeline_discovery: {
    sentiment: 'positive',
    severity: 0,
    options: [
      { kind: 'discovery', discoveryId: DISCOVERY.TIMELINE_DISCOVERY },
    ],
    icon: { kind: 'glyph', glyph: '⧗', scale: 1, offset: { x: 0, y: 1 } },
  },
  shegolskoe_zone_time_or_loot_chance: {
    sentiment: 'positive',
    severity: 0,
    options: [
      {
        kind: 'raid_mutation',
        targetRaidId: 'shegolskoe',
        mutation: { kind: 'ZoneCollapseTimeMutation', amount: 600 },
      },
      {
        kind: 'raid_mutation',
        targetRaidId: 'shegolskoe',
        mutation: { kind: 'LootDifficultyMutation', amount: 5 },
      },
    ],
    icon: { kind: 'glyph', glyph: '?', scale: 1, offset: { x: 0, y: 1 } },
  },
  shegolskoe_zone_time_or_arch_hounds: {
    sentiment: 'positive',
    severity: 0,
    options: [
      {
        kind: 'raid_mutation',
        targetRaidId: 'shegolskoe',
        mutation: { kind: 'ZoneCollapseTimeMutation', amount: 600 },
      },
      {
        kind: 'raid_mutation',
        targetRaidId: 'shegolskoe',
        mutation: { kind: 'AddMonsterMutation', monsterId: 'arch_hound', count: -2 },
      },
    ],
    icon: { kind: 'glyph', glyph: '?', scale: 1, offset: { x: 0, y: 1 } },
  },
  kilava_raid_access: {
    sentiment: 'positive',
    severity: 0,
    options: [
      { kind: 'unlock_raid', raidId: 'kilava' },
    ],
    icon: { kind: 'glyph', glyph: '⌖', scale: 1.5, offset: { x: 0, y: 1 } },
  },
};
