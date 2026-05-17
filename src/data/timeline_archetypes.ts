import type { RawTimelineArchetypeDefinition } from '../logic/TimelineLib';

export const timelineArchetypes: Record<string, RawTimelineArchetypeDefinition> = {
  credits_or_deterioration: {
    options: [
      { kind: 'resource', resource: 'credits', amount: -100 },
      { kind: 'timeline_deteriorate_random_raid' },
    ],
    icon: { kind: 'itemImage', key: 'cyan', scale: 1, offset: { x: 0, y: 0 } },
  },
};

