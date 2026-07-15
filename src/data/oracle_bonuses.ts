import type { RawOracleBonusDefinition } from '../logic/OracleBonusLib';
import { CYAN_YIELD_BONUS_PCT, MAGENTA_YIELD_BONUS_PCT } from '../logic/Const';

const oracleBonuses: Record<string, RawOracleBonusDefinition> = {
  red_essence: {
    tier: 1,
    count: 6,
    label: 'Red essence +1',
    reward: { kind: 'refining_red_essence_resource_bonus', amount: 1 },
  },
  blue_essence_1: {
    tier: 1,
    count: 1,
    label: 'Blue essence +1',
    reward: { kind: 'refining_blue_essence_resource_bonus', amount: 1 },
  },
  blue_essence_2: {
    tier: 2,
    count: 4,
    label: 'Blue essence +1',
    reward: { kind: 'refining_blue_essence_resource_bonus', amount: 1 },
  },
  gold_neighbor_1: {
    tier: 1,
    count: 2,
    label: 'Gold (yellow) neighbor +1',
    reward: { kind: 'refining_yellow_neighbor_bonus', amount: 1 },
  },
  gold_neighbor_2: {
    tier: 2,
    count: 2,
    label: 'Gold (yellow) neighbor +1',
    reward: { kind: 'refining_yellow_neighbor_bonus', amount: 1 },
  },
  green_essence: {
    tier: 2,
    count: 1,
    label: 'Green essence +1',
    reward: { kind: 'refining_green_essence_resource_bonus', amount: 1 },
  },
  cyan_yield: {
    tier: 1,
    count: 1,
    label: `Cyan +${CYAN_YIELD_BONUS_PCT}% yield`,
    // TODO(oracle-bonus): cyan yield is essence-specific in RefinePreview; no dedicated
    // additive Reward kind exists yet, so this maps to the global refining yield bonus.
    reward: { kind: 'refining_yield_pct_bonus', amount: CYAN_YIELD_BONUS_PCT },
  },
  magenta_yield: {
    tier: 2,
    count: 1,
    label: `Magenta +${MAGENTA_YIELD_BONUS_PCT}% yield`,
    // TODO(oracle-bonus): same as cyan — mapped to global refining yield for now.
    reward: { kind: 'refining_yield_pct_bonus', amount: MAGENTA_YIELD_BONUS_PCT },
  },
  unique_items_yield: {
    tier: 1,
    count: 3,
    label: 'Unique item yield +1%',
    reward: { kind: 'stat', stat: 'uniqueItemsBonusYield', value: 1 },
  },
  charge_bonus: {
    tier: 2,
    count: 1,
    label: 'Charge bonus x2',
    // TODO(oracle-bonus): "x2" is a multiplier with no matching Reward kind; placeholder
    // stat until a dedicated charge-multiplier reward/field is added.
    reward: { kind: 'stat', stat: 'waferChargeBonusMult', value: 2 },
  },
  refining_chance: {
    tier: 2,
    count: 2,
    label: 'Refining chance +5%',
    reward: { kind: 'refining_success_chance_bonus', amount: 5 },
  },
};

export default oracleBonuses;
