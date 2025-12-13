export type ResearchEffect =
  | 'giveStrength'
  | 'giveLooting'
  | 'giveVolume'
  | 'recipeUpgrade'
  | 'giveRecipe'
  | 'unlockGear';

export type ResearchNode =
  | { effect: 'giveStrength' | 'giveLooting' | 'giveVolume'; amount: number }
  | { effect: 'recipeUpgrade'; upgradeId: string }
  | { effect: 'giveRecipe'; upgradeId: string }
  | { effect: 'unlockGear'; gearIds: string[] };

export type ResearchTier = Record<string, ResearchNode>;

export type ResearchDataFile = Record<string, ResearchTier>;

export function parseResearchTiers(data: ResearchDataFile): ResearchTier[] {
  const keys = Object.keys(data).filter(k => k.startsWith('tier_'));

  const indices = keys
    .map(k => {
      const n = Number(k.split('_')[1]);
      return Number.isFinite(n) ? n : NaN;
    })
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => a - b);

  if (indices.length !== keys.length) {
    throw new Error('Research data contains invalid tier keys');
  }

  const tiers: ResearchTier[] = [];
  if (indices.length === 0) return tiers;

  const max = indices[indices.length - 1];
  // Ensure contiguous tiers from 0..max
  for (let i = 0; i <= max; i++) {
    const key = `tier_${i}`;
    const tier = data[key];
    if (!tier) {
      throw new Error(`Missing research tier: ${key}`);
    }
    // Basic validation of nodes
    for (const nid of Object.keys(tier)) {
      const node = (tier as any)[nid] as ResearchNode | undefined;
      if (!node || typeof node !== 'object') {
        throw new Error(`Invalid research node at ${key}.${nid}`);
      }
      switch ((node as any).effect) {
        case 'giveStrength':
        case 'giveLooting':
        case 'giveVolume': {
          if (typeof (node as any).amount !== 'number') {
            throw new Error(`Research node ${key}.${nid} requires numeric amount`);
          }
          break;
        }
        case 'recipeUpgrade':
        case 'giveRecipe': {
          if (typeof (node as any).upgradeId !== 'string' || !(node as any).upgradeId) {
            throw new Error(`Research node ${key}.${nid} requires upgradeId`);
          }
          break;
        }
        case 'unlockGear': {
          const ids = (node as any).gearIds;
          if (!Array.isArray(ids) || !ids.length) {
            throw new Error(`Research node ${key}.${nid} requires non-empty gearIds array`);
          }
          for (const gid of ids) {
            if (typeof gid !== 'string' || !gid.trim()) {
              throw new Error(`Research node ${key}.${nid} has invalid gear id`);
            }
          }
          break;
        }
        default:
          throw new Error(`Unknown research effect at ${key}.${nid}`);
      }
    }
    tiers[i] = tier;
  }

  return tiers;
}
