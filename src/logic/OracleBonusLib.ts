import type { Reward } from './Reward';

export interface OracleBonusDefinition {
  id: string;
  tier: number;
  count: number;
  label: string;
  reward: Reward;
}

export type RawOracleBonusDefinition = Omit<OracleBonusDefinition, 'id'>;

export function parseOracleBonusDefinitions(
  raw: Record<string, RawOracleBonusDefinition>
): Map<string, OracleBonusDefinition> {
  const result = new Map<string, OracleBonusDefinition>();
  for (const [id, def] of Object.entries(raw)) {
    result.set(id, {
      id,
      tier: def.tier,
      count: def.count,
      label: def.label,
      reward: def.reward,
    });
  }
  return result;
}
