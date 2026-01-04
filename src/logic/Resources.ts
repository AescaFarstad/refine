export type ResourceKey = 'credits' | 'chronotraces' | 'timeFlux' | 'shardDust' | 'skillPoints';

export interface ResourceSpec {
  key: ResourceKey;
  name: string;
  glyph: string;
  color: string;
  bgColor: string;
  description: string;
  aliases: string[];
}

export const RESOURCE_KEYS: ResourceKey[] = [
  'credits',
  'chronotraces',
  'timeFlux',
  'shardDust',
  'skillPoints',
];

export const RESOURCE_SPECS: Record<ResourceKey, ResourceSpec> = {
  credits: {
    key: 'credits',
    name: 'Credits',
    glyph: '✦',
    color: '#f56565',
    bgColor: 'rgba(245, 101, 101, 0.10)',
    description: 'Used to purchase gear',
    aliases: [],
  },
  chronotraces: {
    key: 'chronotraces',
    name: 'Chronotraces',
    glyph: '⧖',
    color: '#4299e1',
    bgColor: 'rgba(66, 153, 225, 0.10)',
    description: 'Used for research',
    aliases: [],
  },
  timeFlux: {
    key: 'timeFlux',
    name: 'Time Flux',
    glyph: '∿',
    color: '#48bb78',
    bgColor: 'rgba(72, 187, 120, 0.10)',
    description: 'Used for maze traversal',
    aliases: [],
  },
  shardDust: {
    key: 'shardDust',
    name: 'Shards',
    glyph: '⌁',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.10)',
    description: 'Used to upgrade wafer size',
    aliases: ['shards'],
  },
  skillPoints: {
    key: 'skillPoints',
    name: 'Skill Points',
    glyph: '◌',
    color: '#22d3ee',
    bgColor: 'rgba(34, 211, 238, 0.10)',
    description: 'Used to equip more gear items from a category',
    aliases: [],
  },
};

const RESOURCE_BY_ANY_KEY: Record<string, ResourceSpec> = (() => {
  const out: Record<string, ResourceSpec> = {};
  for (const k of RESOURCE_KEYS) {
    const spec = RESOURCE_SPECS[k];
    out[k] = spec;
    for (const a of spec.aliases) out[a] = spec;
  }
  return out;
})();

export function getResourceSpec(key: ResourceKey): ResourceSpec {
  return RESOURCE_SPECS[key];
}

export function getResourceSpecByAnyKey(key: string): ResourceSpec {
  return RESOURCE_BY_ANY_KEY[key]!;
}
