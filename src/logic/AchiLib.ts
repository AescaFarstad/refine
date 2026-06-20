import type { Reward } from './Reward';

export type AchiType = 'earn' | 'pay';

export interface AchiDefinition {
  id: string;
  order: number;
  type: AchiType;
  handler: string;
  tier: number;
  paramNum: number;
  paramStr: string;
  symbol: string;
  symbolColor: string;
  color: string;
  description: string;
  // Rewards granted when the achievement is acknowledged (see acknowledgeAchi / payAchi).
  rewards: readonly Reward[];
}

export type RawAchiDefinition = Omit<AchiDefinition, 'id' | 'order' | 'paramStr' | 'symbol' | 'symbolColor' | 'color' | 'rewards'> & { paramStr?: string; symbol?: string; symbolColor?: string; color?: string; rewards?: readonly Reward[] };

export function parseAchiDefinitions(raw: Record<string, RawAchiDefinition>): Map<string, AchiDefinition> {
  const map = new Map<string, AchiDefinition>();
  let order = 0;
  for (const [id, def] of Object.entries(raw)) {
    map.set(id, {
      id,
      order: order++,
      type: def.type,
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
