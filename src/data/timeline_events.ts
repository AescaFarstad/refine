import type { RawTimelineEventDefinition } from '../logic/TimelineLib';

export const timelineEvents: RawTimelineEventDefinition[] = [
  {
    id: 'credits_or_deterioration_1',
    type: 'credits_or_deterioration',
    time: [0, 8, 0],
    repeat: [1, 0, 0],
  },
  {
    id: 'chronotraces_or_mass_deterioration_1',
    type: 'chronotraces_or_mass_deterioration',
    time: [0, 16, 0],
    repeat: [1, 12, 0],
  },
  {
    id: 'all_monsters_get_hp_1',
    type: 'all_monsters_get_hp',
    time: [1, 2, 0],
    repeat: [2, 0, 0],
  },
  {
    id: 'timeline_discovery_1',
    type: 'timeline_discovery',
    time: [2, 0, 0],
  },
];
