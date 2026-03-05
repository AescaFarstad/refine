import type { MazeResourceSpawn } from './GameState';
import { RESOURCE_SPECS } from './Resources';

export type MazeResourceVisualKey = MazeResourceSpawn['resourceKey'];

export interface MazeResourceVisualSpec {
  key: MazeResourceVisualKey;
  name: string;
  glyph: string;
  color: string;
  bgColor: string;
  pillRow: number;
  iconImage: string;
}

export const MAZE_RESOURCE_SPECS: Record<MazeResourceVisualKey, MazeResourceVisualSpec> = {
  credits: {
    ...RESOURCE_SPECS.credits,
    key: 'credits' as const,
    pillRow: 0,
    iconImage: '',
  },
  chronotraces: {
    ...RESOURCE_SPECS.chronotraces,
    key: 'chronotraces' as const,
    pillRow: 0,
    iconImage: '',
  },
  shardDust: {
    ...RESOURCE_SPECS.shardDust,
    key: 'shardDust' as const,
    pillRow: 0,
    iconImage: '',
  },
  zone_crystal: {
    key: 'zone_crystal',
    name: 'Zone Crystal',
    glyph: '◈',
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.10)',
    pillRow: 1,
    iconImage: 'quartz',
  },
  fractal: {
    key: 'fractal',
    name: 'Fractal',
    glyph: '⬡',
    color: '#f0abfc',
    bgColor: 'rgba(240, 171, 252, 0.10)',
    pillRow: 1,
    iconImage: 'bismuth',
  },
};
