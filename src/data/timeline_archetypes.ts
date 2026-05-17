import type { RawTimelineArchetypeDefinition } from '../logic/TimelineLib';
import { DISCOVERY } from '../logic/DiscoveryLib';

export const timelineArchetypes: Record<string, RawTimelineArchetypeDefinition> = {
  credits_or_deterioration: {
    sentiment: 'negative',
    options: [
      { kind: 'resource', resource: 'credits', amount: -100 },
      { kind: 'timeline_deteriorate_random_raid' },
    ],
    icon: { kind: 'glyph', glyph: '✦', scale: 1, offset: { x: 0, y: 1 } },
  },
  chronotraces_or_mass_deterioration: {
    sentiment: 'negative',
    options: [
      { kind: 'resource', resource: 'chronotraces', amount: -100 },
      { kind: 'timeline_deteriorate_all_raids' },
    ],
    icon: { kind: 'glyph', glyph: '⧖', scale: 1, offset: { x: 0, y: 1 } },
  },
  all_monsters_get_hp: {
    sentiment: 'negative',
    options: [
      { kind: 'global_monsters_buff_hp', amount: 1 },
    ],
    icon: { kind: 'glyph', glyph: '❤︎', scale: 1, offset: { x: 0, y: 2 } },
  },
  timeline_discovery: {
    sentiment: 'positive',
    options: [
      { kind: 'discovery', discoveryId: DISCOVERY.TIMELINE_DISCOVERY },
    ],
    icon: { kind: 'glyph', glyph: '⧗', scale: 1, offset: { x: 0, y: 1 } },
  },
  kilifi_raid_access: {
    sentiment: 'positive',
    options: [
      { kind: 'unlock_raid', raidId: 'kilifi' },
    ],
    icon: { kind: 'glyph', glyph: '⌖', scale: 1, offset: { x: 0, y: 1 } },
  },
};
