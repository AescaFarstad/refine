import type { MazeResourceSpawn } from '../GameState';

export type MazeResourceKey = MazeResourceSpawn['resourceKey'];

export interface MazeResourceTotals {
  credits: number;
  chronotraces: number;
  shardDust: number;
  zone_crystal: number;
}

export interface MazeResourceHoverHint {
  resourceKey: MazeResourceKey;
  amount: number;
  screenX: number;
  screenY: number;
}

export const MAZE_RESOURCE_KEYS: MazeResourceKey[] = ['credits', 'chronotraces', 'shardDust', 'zone_crystal'];
