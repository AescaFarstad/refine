const ids = [
  'UI_GEAR',
  'UI_GEAR_UPGRADE_MODAL_OPENED',
  'UI_SHARDS',
  'UI_DAMAGE_BREAKDOWN',
  'UI_TIME_BREAKDOWN',
  'UI_REFINE_YIELD',
  'UNIQUE_ITEMS_YIELD',
  'CYAN_YIELD',
  'MAZE_NAVIGATION',
  'SIGNATURES',
  'TAB_REFINE',
  'TAB_RESEARCH',
  'TAB_MAZE',
  'TAB_REFINE_VISITED',
  'TAB_RESEARCH_VISITED',
  'TAB_MAZE_VISITED',
  'UI_RAID_MONSTERS',
  'UI_RAID_LOOT',
  'UI_RAID_SPEED',
  'UI_RAID_SELECTION',
  'UI_WAFER_INFO',
  'UI_SIGNATURE_INFO',
] as const;

type DiscoveryKey = (typeof ids)[number];

export const DISCOVERY = ids.reduce((acc, id) => {
  acc[id] = id;
  return acc;
}, {} as any) as { [K in DiscoveryKey]: K };

// Prefer using `DISCOVERY.*` literals, but allow ad-hoc string ids too.
export type DiscoveryId = (typeof DISCOVERY)[keyof typeof DISCOVERY] | string;
