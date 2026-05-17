import type { Point2 } from './core/math';
import type { Reward } from './Reward';

export type TimelineArchetypeIcon =
  | { kind: 'none' }
  | { kind: 'glyph'; glyph: string; scale: number; offset: Point2 }
  | { kind: 'itemImage'; key: string; scale: number; offset: Point2 };

export interface TimelineArchetypeDefinition {
  id: string;
  sentiment: 'positive' | 'negative';
  options: Reward[];
  icon: TimelineArchetypeIcon;
}

export interface TimelineEventDefinition {
  id: string;
  type: string;
  time: number;
  repeat: number;
}

export interface RawTimelineArchetypeDefinition {
  sentiment?: 'positive' | 'negative';
  options?: Reward[];
  icon?: {
    kind?: 'none' | 'glyph' | 'itemImage';
    glyph?: string;
    key?: string;
    scale?: number;
    offset?: Point2;
  };
}

export interface RawTimelineEventDefinition {
  id?: string;
  type: string;
  time?: [number, number, number];
  repeat?: [number, number, number];
}

function normalizeTriplet(value: [number, number, number] | undefined): [number, number, number] {
  if (!value) return [0, 0, 0];
  return value;
}

function parseTimelineOffset(input?: Point2): Point2 {
  return { x: input?.x ?? 0, y: input?.y ?? 0 };
}

function parseTimelineIcon(input?: RawTimelineArchetypeDefinition['icon']): TimelineArchetypeIcon {
  const kind = input?.kind ?? 'none';
  if (kind === 'none') {
    return { kind: 'none' };
  }
  if (kind === 'glyph') {
    return {
      kind: 'glyph',
      glyph: input?.glyph ?? '',
      scale: input?.scale ?? 1,
      offset: parseTimelineOffset(input?.offset),
    };
  }
  return {
    kind: 'itemImage',
    key: input?.key ?? '',
    scale: input?.scale ?? 1,
    offset: parseTimelineOffset(input?.offset),
  };
}

export function parseTimelineTimeToSeconds(input: [number, number, number] | undefined): number {
  const [days, hours, minutes] = normalizeTriplet(input);
  return days * 24 * 3600 + hours * 3600 + minutes * 60;
}

export function parseTimelineArchetypeDefinitions(
  raw: Record<string, RawTimelineArchetypeDefinition>
): Map<string, TimelineArchetypeDefinition> {
  const map = new Map<string, TimelineArchetypeDefinition>();
  for (const [id, input] of Object.entries(raw)) {
    map.set(id, {
      id,
      sentiment: input.sentiment ?? 'negative',
      options: [...(input.options ?? [])],
      icon: parseTimelineIcon(input.icon),
    });
  }
  return map;
}

export function parseTimelineEventDefinitions(raw: RawTimelineEventDefinition[]): TimelineEventDefinition[] {
  const events: TimelineEventDefinition[] = [];
  for (let i = 0; i < raw.length; i++) {
    const input = raw[i]!;
    events.push({
      id: input.id ?? `timeline_event_${i}`,
      type: input.type,
      time: parseTimelineTimeToSeconds(input.time),
      repeat: parseTimelineTimeToSeconds(input.repeat),
    });
  }
  return events;
}

export class TimelineLib {
  public archetypes: Map<string, TimelineArchetypeDefinition> = new Map();
  public events: TimelineEventDefinition[] = [];

  public load(
    rawArchetypes: Record<string, RawTimelineArchetypeDefinition>,
    rawEvents: RawTimelineEventDefinition[]
  ): void {
    this.archetypes = parseTimelineArchetypeDefinitions(rawArchetypes);
    this.events = parseTimelineEventDefinitions(rawEvents);
  }
}
