import type { GameState } from './GameState';
import type { RaidDefinition } from './RaidLib';

export type EquipmentType = 'light' | 'medium' | 'overprice';

const equipmentStrength = {
  light: 0.5,
  medium: 1.0,
  overprice: 1.2,
};

const equipmentPrice = {
  light: 1.2,
  medium: 1.0,
  overprice: 1.5,
};

export interface RaidCalcOutput {
  strength: number;
  survivalChancePct: number;
  lootRatePct: number;
  questDeltaPct: number;
  price: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function cvt(x: number, min: number, max: number, minOut: number, maxOut: number): number {
  const inVal = clamp(x, min, max);
  return minOut + (maxOut - minOut) * (inVal - min) / (max - min);
}

export function computeRaidStats(
  gs: GameState,
  raid: RaidDefinition,
  questWeight: number,
  surviveWeight: number,
  lootWeight: number,
  equipment: EquipmentType,
): RaidCalcOutput {
  // Sum of raw weights (sliders). If zero, default to neutral 100/100/100.
  let Wraw = surviveWeight + lootWeight + questWeight;
  if (Wraw === 0) {
    surviveWeight += 100;
    lootWeight += 100;
    questWeight += 100;
    Wraw = 300;
  }

  const baseStrength = gs.strength * equipmentStrength[equipment];
  const difficulty = raid.difficulty;

  // Determine effective distribution with survival saturation.
  const otherSum = questWeight + lootWeight; // weights excluding survival

  // Required multiplier to reach 100% survival (cap at 1.5 range top)
  const tRequired = baseStrength > 0 ? (difficulty / baseStrength) : Number.POSITIVE_INFINITY;

  let surviveEff = surviveWeight; // effective survival weight actually used
  let Wcalc = Wraw;               // denominator used for weight mapping
  let strM: number;               // survival multiplier from weights

  if (otherSum > 0) {
    if (tRequired <= 0.5) {
      // Even the minimum survival (leftmost) is enough: ignore survival weight entirely
      surviveEff = 0;
    } else if (tRequired < 1.5) {
      // Compute minimum survival weight needed to reach tRequired:
      // solve for x in: 0.5 + x/(otherSum + x) = tRequired => x = ((t-0.5)/(1.5 - t)) * otherSum
      const numerator = Math.max(0, tRequired - 0.5);
      const denom = 1.5 - tRequired;
      if (denom > 1e-9) {
        const needed = (numerator / denom) * otherSum;
        // If the actual survival weight exceeds what's needed, cap it (unused portion redistributes to others)
        surviveEff = Math.min(surviveWeight, Math.max(0, needed));
      }
      // else: tRequired >= 1.5, handled below
    }
    // Effective denominator excludes the unused survival portion
    Wcalc = otherSum + surviveEff;
    strM = 0.5 + (surviveEff / Wcalc);
    // Ensure we never exceed the required multiplier to hit 100% survival
    if (tRequired < 1.5) strM = Math.min(strM, tRequired);
  } else {
    // No other weights; keep original mapping and only clamp survival effect to not grow past 100%
    strM = cvt(surviveWeight, 0, Wraw, 0.5, 1.5);
    if (tRequired < 1.5) strM = Math.min(strM, tRequired);
    Wcalc = Wraw;
  }

  const effectiveStrength = baseStrength * strM;
  const extraStr1 = Math.max(0, baseStrength - difficulty * 0.5);
  const extraStr2 = Math.max(0, baseStrength - difficulty);

  const questM = cvt(
    questWeight,
    0,
    Wcalc,
    0,
    baseStrength / difficulty * 0.25 + extraStr1 / difficulty * 0.5 + extraStr2 / difficulty + 0.1,
  );

  const lootM = cvt(lootWeight, 0, Wcalc, 0.5, 1.5);

  const survivalChancePct = clamp(Math.round(effectiveStrength / difficulty * 100), 0, 100);
  const lootRatePct = Math.round(raid.itemDropRate * lootM);
  const questDeltaPct = Math.round(questM * 100);
  const outStrength = Math.max(baseStrength, effectiveStrength);
  const price = Math.round(equipmentPrice[equipment] * outStrength);
  return { strength: outStrength, survivalChancePct, lootRatePct, questDeltaPct, price };
}
