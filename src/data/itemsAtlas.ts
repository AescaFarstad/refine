import rawItemsAtlas from '../../public/images/items.json';
import type { AtlasFrame, AtlasMeta } from '../logic/AtlasStorage';

type RawAtlas = {
  __meta?: { w: number; h: number; padding?: number };
} & Record<string, unknown>;

const raw = rawItemsAtlas as unknown as RawAtlas;

export const itemsAtlasMeta: AtlasMeta | null = raw.__meta
  ? {
      w: raw.__meta.w,
      h: raw.__meta.h,
      padding: raw.__meta.padding,
    }
  : null;

export const itemsAtlasFrames: Record<string, AtlasFrame> = (() => {
  const frames: Record<string, AtlasFrame> = {};
  for (const key of Object.keys(raw)) {
    if (key === '__meta') continue;
    const entry = raw[key] as any;
    if (entry && typeof entry.x === 'number' && typeof entry.y === 'number' && typeof entry.w === 'number' && typeof entry.h === 'number') {
      frames[key] = { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
    }
  }
  return frames;
})();
