import type { RawTimelineEventDefinition } from '../logic/TimelineLib';

export const timelineEvents: RawTimelineEventDefinition[] = [
  {
    id: 'timeline_discovery_1',
    type: 'timeline_discovery',
    time: [1, 12, 0],
  },
  {
    id: 'credits_or_deterioration_1_1',
    type: 'credits_or_deterioration',
    time: [2, 8, 0],
  },
  {
    id: 'kilava_raid_access_1',
    type: 'kilava_raid_access',
    time: [3, 11, 0],
  },
  {
    id: 'credits_or_deterioration_1_2',
    type: 'credits_or_deterioration',
    time: [4, 8, 0],
  },
  {
    id: 'credits_or_deterioration_2_1',
    type: 'credits_or_deterioration_2',
    time: [5, 6, 0],
  },
  {
    id: 'credits_or_deterioration_2_2',
    type: 'credits_or_deterioration_2',
    time: [6, 12, 0],
  },
  {
    id: 'credits_or_deterioration_2_3',
    type: 'credits_or_deterioration_2',
    time: [6, 18, 0],
  },
  {
    id: 'credits_or_deterioration_3_1',
    type: 'credits_or_deterioration_3',
    time: [7, 10, 0],
  },
  {
    id: 'chronotraces_or_mass_deterioration_1',
    type: 'chronotraces_or_mass_deterioration',
    time: [8, 16, 0],
    repeat: [3, 3, 0],
  },
  {
    id: 'all_monsters_get_hp_1',
    type: 'all_monsters_get_hp',
    time: [8, 20, 0],
    repeat: [4, 12, 0],
  },
  {
    id: 'credits_or_deterioration_3_2',
    type: 'credits_or_deterioration_3',
    time: [10, 4, 0],
  },
  {
    id: 'time_flux_or_die',
    type: 'time_flux_or_die',
    time: [12, 10, 0],
  },
  {
    id: 'credits_or_deterioration_3_3',
    type: 'credits_or_deterioration_3',
    time: [12, 12, 0],
  },
  {
    id: 'credits_or_deterioration_4_1',
    type: 'credits_or_deterioration_4',
    time: [15, 6, 0],
    repeat: [2, 7, 0],
  },
  {
    id: 'credits_or_deterioration_4_2',
    type: 'credits_or_deterioration_4',
    time: [21, 6, 0],
    repeat: [1, 19, 0],
  },
];
