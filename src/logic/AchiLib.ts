import type { Reward } from './Reward';

export type AchiType = 'earn' | 'pay';
export type AchiRewardTiming = 'acknowledge' | 'complete';

export interface AchiDefinition {
  id: string;
  order: number;
  type: AchiType;
  rewardTiming: AchiRewardTiming;
  handler: string;
  tier: number;
  paramNum: number;
  paramStr: string;
  symbol: string;
  symbolColor: string;
  color: string;
  description: string;
  // Rewards granted when the achievement enters rewardTiming's state.
  rewards: readonly Reward[];
}

export type RawAchiDefinition = Omit<AchiDefinition, 'id' | 'order' | 'rewardTiming' | 'paramStr' | 'symbol' | 'symbolColor' | 'color' | 'rewards'> & { rewardTiming?: AchiRewardTiming; paramStr?: string; symbol?: string; symbolColor?: string; color?: string; rewards?: readonly Reward[] };

export function parseAchiDefinitions(raw: Record<string, RawAchiDefinition>): Map<string, AchiDefinition> {
  const map = new Map<string, AchiDefinition>();
  let order = 0;
  for (const [id, def] of Object.entries(raw)) {
    map.set(id, {
      id,
      order: order++,
      type: def.type,
      rewardTiming: def.rewardTiming ?? 'acknowledge',
      handler: def.handler,
      tier: def.tier,
      paramNum: def.paramNum,
      paramStr: def.paramStr ?? '',
      symbol: def.symbol ?? '',
      symbolColor: def.symbolColor ?? '',
      color: def.color ?? '',
      description: def.description,
      rewards: def.rewards ?? [],
    });
  }
  return map;
}

export class AchiLib {
  public items: Map<string, AchiDefinition> = new Map();

  public load(raw: Record<string, RawAchiDefinition>): void {
    this.items = parseAchiDefinitions(raw);
  }
}
