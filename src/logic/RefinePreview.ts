import type { Molecule } from './ItemLib';
import type { Wafer, ReadonlyWafer } from './Wafer';
import { getCell } from './Wafer';
import { axialNeighbors } from './HexMath';
import {
    CYAN_SUCCESS_BONUS_PCT,
    CYAN_YIELD_BONUS_PCT,
    MAGENTA_YIELD_BONUS_PCT,
    MAGENTA_CRYSTAL_YIELD_PER_ESSENCE,
    BLACK_FRACTAL_YIELD_PER_ESSENCE,
    WHITE_SPICE_YIELD_PER_ESSENCE,
    ESSENCE_CREDITS,
    ESSENCE_CHRONOTRACES,
    ESSENCE_TEMPORAL_FLUX,
    FAILURE_PER_EMPTY_CELL,
    BLACK_YIELD_PENALTY_PCT,
    MAGENTA_SUCCESS_PENALTY_PCT,
    REFINE_TIME,
    WAFER_CHARGE_BONUS_PCT,
} from './Const';
import { getWaferBuffAt } from './waferLayout';
import { scanWaferForNewSignatures, sumSignatureRefiningRewards } from './Signatures';
import { DISCOVERY, getMonochromeEssenceBehavior } from './DiscoveryLib';
import type { ReadonlyGameState } from './UIState';
import {
    convertFamilyEssence,
    getEssenceColorFamily,
    isYellowFamilyEssence,
} from './Essence';

export interface GearOutput {
    gearId: string;
    count: number;
    fromEssence: string;
}

export interface RefinePreviewChem {
    timeSec: number;
    failureChancePct: number;
    adaptiveModifierPct: number;
    effectiveFailureChancePct: number;
    baseYieldPct: number;
    waferCharge: number;
    waferChargeYieldBonus: number;
    waferChargeSuccessChanceBonus: number;

    signatureYieldBonus: number;
    newSignatureYieldBonus: number;
    signatureSuccessChanceBonus: number;
    newSignatureSuccessChanceBonus: number;
    signatureSpeedBonus: number;
    newSignatureSpeedBonus: number;
    cyanYieldBonus: number;
    magentaYieldBonus: number;
    blackYieldPenalty: number;
    yieldPenaltyEssence: 'black' | 'white';
    uniqueItemsYieldBonus: number;

    totalYieldPct: number;

    expectedCredits: number;
    expectedChrono: number;
    expectedFlux: number;

    essenceTotals: Record<string, number>;

    // Per-cell effective counts for cells that contribute directly to refining totals.
    // Key: "x,y" axial coordinates. Only cells with effectiveCount > 1 are stored.
    cellEffectiveCounts: Record<string, number>;

    emptyCount: number;
    enabledCount: number;

    newlyCompletedSignatureIds: string[];
    newSignatureMatches: Array<{ id: string; offset: { x: number; y: number } }>;

    gearOutputs: GearOutput[];
}


// Color-changing essences and their target colors.
export const COLOR_CHANGER_TARGET: Record<string, string> = {
    indigo: 'blue',
    crimson: 'red',
    emerald: 'green',
    gold: 'yellow',
};

const DIRECT_COUNT_ESSENCES = new Set(['red', 'green', 'blue', 'cyan', 'magenta']);

export interface ColorChangeAffectedCell {
    x: number;
    y: number;
    essence: string;
}

function buildBaseEssenceContext(wafer: ReadonlyWafer): {
    baseEssenceByKey: Record<string, string>;
    enabledKeys: Set<string>;
} {
    const baseEssenceByKey: Record<string, string> = {};
    const enabledKeys = new Set<string>();

    for (const cell of wafer.cells.values()) {
        if (!cell.enabled) continue;
        const key = `${cell.x},${cell.y}`;
        enabledKeys.add(key);
        if (cell.essence) {
            baseEssenceByKey[key] = cell.essence;
        }
    }

    return { baseEssenceByKey, enabledKeys };
}

function applyPlacementToBaseEssence(
    baseEssenceByKey: Record<string, string>,
    enabledKeys: Set<string>,
    placement: Molecule
): Set<string> {
    const placementChangerKeys = new Set<string>();

    for (const atom of placement.atoms) {
        const key = `${atom.x},${atom.y}`;
        if (!enabledKeys.has(key)) continue;
        baseEssenceByKey[key] = atom.color;
        if (COLOR_CHANGER_TARGET[atom.color]) {
            placementChangerKeys.add(key);
        }
    }

    return placementChangerKeys;
}

function createClusterResolver(
    baseEssenceByKey: Record<string, string>,
    enabledKeys: Set<string>
): (startKey: string, essence: string) => string[] {
    const clusterCache = new Map<string, string[]>();

    return function getCluster(startKey: string, essence: string): string[] {
        const cacheKey = `${essence}|${startKey}`;
        const cached = clusterCache.get(cacheKey);
        if (cached) return cached;

        const result: string[] = [];
        const queue: string[] = [startKey];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const key = queue.shift()!;
            if (visited.has(key)) continue;
            visited.add(key);

            const baseEssence = baseEssenceByKey[key];
            if (getEssenceColorFamily(baseEssence) !== getEssenceColorFamily(essence)) continue;

            result.push(key);

            const [sx, sy] = key.split(',');
            const x = Number(sx);
            const y = Number(sy);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            for (const n of axialNeighbors({ x, y })) {
                const nKey = `${n.x},${n.y}`;
                if (!enabledKeys.has(nKey)) continue;
                if (getEssenceColorFamily(baseEssenceByKey[nKey]!) !== getEssenceColorFamily(essence)) continue;
                if (!visited.has(nKey)) {
                    queue.push(nKey);
                }
            }
        }

        for (const key of result) {
            clusterCache.set(`${essence}|${key}`, result);
        }

        return result;
    };
}

function computeDisarmedColorChangerKeys(
    baseEssenceByKey: Record<string, string>,
    enabledKeys: Set<string>,
    onDisarmPair?: (key: string, neighborKey: string) => void
): Set<string> {
    const disarmedKeys = new Set<string>();

    for (const [key, baseEssence] of Object.entries(baseEssenceByKey)) {
        const target = COLOR_CHANGER_TARGET[baseEssence];
        if (!target) continue;

        const [sx, sy] = key.split(',');
        const x = Number(sx);
        const y = Number(sy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        for (const n of axialNeighbors({ x, y })) {
            const neighborKey = `${n.x},${n.y}`;
            if (!enabledKeys.has(neighborKey)) continue;
            const neighborEssence = baseEssenceByKey[neighborKey];
            if (!neighborEssence) continue;
            const neighborTarget = COLOR_CHANGER_TARGET[neighborEssence];
            if (!neighborTarget) continue;
            if (neighborTarget !== target) {
                disarmedKeys.add(key);
                disarmedKeys.add(neighborKey);
                onDisarmPair?.(key, neighborKey);
            }
        }
    }

    return disarmedKeys;
}

function computeEffectiveEssenceByKey(
    baseEssenceByKey: Record<string, string>,
    enabledKeys: Set<string>
): Record<string, string> {
    const getCluster = createClusterResolver(baseEssenceByKey, enabledKeys);

    // First pass: detect color-changing atoms that are directly "touching"
    // atoms with a different target color. Those pairs both become gray and
    // stop affecting other cells.
    const disarmedKeys = computeDisarmedColorChangerKeys(baseEssenceByKey, enabledKeys);

    // Accumulate desired target colors for each cell based on *active* color-changers.
    const desiredTargetsByKey: Record<string, string[]> = {};

    for (const [key, changerEssence] of Object.entries(baseEssenceByKey)) {
        const target = COLOR_CHANGER_TARGET[changerEssence];
        if (!target) continue;
        if (disarmedKeys.has(key)) continue;

        const [sx, sy] = key.split(',');
        const x = Number(sx);
        const y = Number(sy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        for (const n of axialNeighbors({ x, y })) {
            const neighborKey = `${n.x},${n.y}`;
            if (!enabledKeys.has(neighborKey)) continue;
            const neighborBaseEssence = baseEssenceByKey[neighborKey];
            if (!neighborBaseEssence) continue;

            // These atoms affect all colors (including ones already equal to their
            // target color) so that overlapping influences of different colors can
            // correctly resolve to gray.
            const cluster = getCluster(neighborKey, neighborBaseEssence);
            for (const clusterKey of cluster) {
                const clusterEssence = baseEssenceByKey[clusterKey]!;
                const desiredEssence = convertFamilyEssence(clusterEssence, target as 'red' | 'green' | 'blue' | 'yellow');
                if (!desiredTargetsByKey[clusterKey]) {
                    desiredTargetsByKey[clusterKey] = [desiredEssence];
                } else {
                    desiredTargetsByKey[clusterKey].push(desiredEssence);
                }
            }
        }
    }

    const effectiveEssenceByCell: Record<string, string> = {};

    for (const key of enabledKeys) {
        const baseEssence = baseEssenceByKey[key];
        // Disarmed color-changing atoms always become gray and provide no effects,
        // regardless of any incoming desires from other atoms.
        if (baseEssence && COLOR_CHANGER_TARGET[baseEssence] && disarmedKeys.has(key)) {
            effectiveEssenceByCell[key] = 'gray';
            continue;
        }
        const desired = desiredTargetsByKey[key];

        if (!desired || desired.length === 0) {
            if (baseEssence) {
                effectiveEssenceByCell[key] = baseEssence;
            }
            continue;
        }

        const uniqueTargets = Array.from(new Set(desired));
        if (uniqueTargets.length === 1) {
            effectiveEssenceByCell[key] = uniqueTargets[0]!;
        } else {
            // Conflicting target colors: result is gray.
            effectiveEssenceByCell[key] = 'gray';
        }
    }

    return effectiveEssenceByCell;
}

export function computeEffectiveEssenceByCellForPlacement(
    wafer: ReadonlyWafer,
    placement: Molecule
): Record<string, string> {
    const { baseEssenceByKey, enabledKeys } = buildBaseEssenceContext(wafer);
    applyPlacementToBaseEssence(baseEssenceByKey, enabledKeys, placement);
    return computeEffectiveEssenceByKey(baseEssenceByKey, enabledKeys);
}

export function computeColorChangeAffectedCellsForPlacement(
    wafer: ReadonlyWafer,
    placement: Molecule
): ColorChangeAffectedCell[] {
    const { baseEssenceByKey, enabledKeys } = buildBaseEssenceContext(wafer);
    const placementChangerKeys = applyPlacementToBaseEssence(baseEssenceByKey, enabledKeys, placement);

    if (placementChangerKeys.size === 0) return [];

    const disarmedPreviewKeys = new Set<string>();
    const disarmedKeys = computeDisarmedColorChangerKeys(
        baseEssenceByKey,
        enabledKeys,
        (key, neighborKey) => {
            if (placementChangerKeys.has(key) || placementChangerKeys.has(neighborKey)) {
                disarmedPreviewKeys.add(key);
                disarmedPreviewKeys.add(neighborKey);
            }
        }
    );
    const getCluster = createClusterResolver(baseEssenceByKey, enabledKeys);

    const affectedByKey: Record<string, string> = {};
    for (const changerKey of placementChangerKeys) {
        if (disarmedKeys.has(changerKey)) continue;

        const [sx, sy] = changerKey.split(',');
        const x = Number(sx);
        const y = Number(sy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        for (const n of axialNeighbors({ x, y })) {
            const neighborKey = `${n.x},${n.y}`;
            if (!enabledKeys.has(neighborKey)) continue;
            const neighborEssence = baseEssenceByKey[neighborKey];
            if (!neighborEssence) continue;

            const cluster = getCluster(neighborKey, neighborEssence);
            for (const key of cluster) {
                affectedByKey[key] = baseEssenceByKey[key]!;
            }
        }
    }

    const out: ColorChangeAffectedCell[] = [];
    for (const key of disarmedPreviewKeys) {
        const essence = baseEssenceByKey[key];
        if (!essence) continue;
        affectedByKey[key] = essence;
    }
    for (const [key, essence] of Object.entries(affectedByKey)) {
        const [sx, sy] = key.split(',');
        const x = Number(sx);
        const y = Number(sy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out.push({ x, y, essence });
    }
    return out;
}

export function computeUniqueItemsYieldBonusPct(
    refinedUniqueItemIds: Readonly<Record<string, true>>,
    waferItems: readonly ({ id: string } | null)[],
    bonusPerUniqueItemPct: number,
): number {
    if (bonusPerUniqueItemPct <= 0) return 0;

    const baseUniqueCount = Object.keys(refinedUniqueItemIds).length;
    const newlyCounted = new Set<string>();
    let uniqueCount = baseUniqueCount;

    for (const it of waferItems) {
        if (!it) continue;
        if (refinedUniqueItemIds[it.id]) continue;
        if (newlyCounted.has(it.id)) continue;
        newlyCounted.add(it.id);
        uniqueCount++;
    }

    return uniqueCount * bonusPerUniqueItemPct;
}

export function computeEffectiveEssences(wafer: Wafer): void {
    const { baseEssenceByKey, enabledKeys } = buildBaseEssenceContext(wafer);
    const effectiveEssenceByCell = computeEffectiveEssenceByKey(baseEssenceByKey, enabledKeys);

    // Copy result into wafer cells so it can be used by rendering and other logic.
    for (const cell of wafer.cells.values()) {
        if (!cell.enabled) {
            cell.effectiveEssence = null;
            continue;
        }
        const key = `${cell.x},${cell.y}`;
        const eff = effectiveEssenceByCell[key];
        if (eff) {
            cell.effectiveEssence = eff;
        } else {
            cell.effectiveEssence = cell.essence ?? null;
        }
    }
}

function computeEffectiveEssenceTotals(wafer: ReadonlyWafer, yellowNeighborBonus: number): {
    essenceTotals: Record<string, number>;
    cellEffectiveCounts: Record<string, number>;
} {
    const effectiveTotals: Record<string, number> = {};
    const cellEffectiveCounts: Record<string, number> = {};

    // Count raw totals from effective essences (after color-changing atoms).
    for (const cell of wafer.cells.values()) {
        if (!cell.enabled) continue;
        const effEssence = cell.effectiveEssence ?? cell.essence;
        if (!effEssence) continue;
        effectiveTotals[effEssence] = (effectiveTotals[effEssence] || 0) + 1;
    }

    effectiveTotals.red = 0;
    effectiveTotals.green = 0;
    effectiveTotals.blue = 0;
    effectiveTotals.cyan = 0;
    effectiveTotals.magenta = 0;

    const redBonus = effectiveTotals.red_s || 0;
    const greenBonus = effectiveTotals.green_s || 0;
    const blueBonus = effectiveTotals.blue_s || 0;
    const yellowSplit = effectiveTotals.yellow_s || 0;

    for (const cell of wafer.cells.values()) {
        if (!cell.enabled) continue;
        const key = `${cell.x},${cell.y}`;
        const effEssence = cell.effectiveEssence ?? cell.essence;
        if (!effEssence) continue;

        const pos = { x: cell.x, y: cell.y };

        let yellowNeighbors = 0;
        let orangeNeighbors = 0;

        for (const n of axialNeighbors(pos)) {
            const neighbor = getCell(wafer, n);
            if (!neighbor || !neighbor.enabled) continue;
            const neighborEffEssence = neighbor.effectiveEssence ?? neighbor.essence;
            if (!neighborEffEssence) continue;
            if (isYellowFamilyEssence(neighborEffEssence)) {
                yellowNeighbors++;
            } else if (neighborEffEssence === 'orange') {
                orangeNeighbors++;
            }
        }

        const waferBuff = getWaferBuffAt(cell.x, cell.y);

        const yellowNeighborStrength = 1 + yellowNeighborBonus;
        const base = 1 + yellowNeighbors * yellowNeighborStrength + waferBuff.additive; // Yellow + built-in additive buffs
        const multiplier = Math.pow(2, orangeNeighbors) * waferBuff.multiplier; // Orange + built-in multiplicative buffs

        if (DIRECT_COUNT_ESSENCES.has(effEssence)) {
            let directBase = base;
            if (effEssence === 'red') {
                directBase += redBonus;
            } else if (effEssence === 'green') {
                directBase += greenBonus;
            } else if (effEssence === 'blue') {
                directBase += blueBonus;
            }
            const effectiveCount = directBase * multiplier;
            effectiveTotals[effEssence] = (effectiveTotals[effEssence] || 0) + effectiveCount;
            if (effectiveCount > 1) {
                cellEffectiveCounts[key] = Math.max(cellEffectiveCounts[key] || 0, effectiveCount);
            }
            continue;
        }

        if (isYellowFamilyEssence(effEssence) && yellowSplit > 0) {
            const effectiveCount = base * multiplier * yellowSplit;
            effectiveTotals.red += effectiveCount;
            effectiveTotals.green += effectiveCount;
            effectiveTotals.blue += effectiveCount;
            if (effectiveCount > 1) {
                cellEffectiveCounts[key] = Math.max(cellEffectiveCounts[key] || 0, effectiveCount);
            }
        }
    }

    return {
        essenceTotals: effectiveTotals,
        cellEffectiveCounts,
    };
}

export function computeRefinePreviewChem(gs: ReadonlyGameState): RefinePreviewChem {
    const completedIdSet = new Set(gs.completedSignatureIds);
    const signatureDefsForLevel = Array.from(gs.lib.signatures.values()).filter(s => s.level === gs.signatureLevel);
    const { newlyCompletedSignatureIds, newSignatureMatches } = scanWaferForNewSignatures(
        gs.wafer,
        signatureDefsForLevel,
        completedIdSet
    );

    const newlyCompletedSignatures = newlyCompletedSignatureIds.map(id => gs.lib.getSignature(id));
    const newSignatureRewards = sumSignatureRefiningRewards(newlyCompletedSignatures);

    const signatureYieldBonus = gs.refiningYieldPctBonus;
    const newSignatureYieldBonus = newSignatureRewards.refiningYieldPctBonus;
    const signatureSuccessChanceBonus = gs.refiningSuccessChanceBonus;
    const newSignatureSuccessChanceBonus = newSignatureRewards.refiningSuccessChanceBonus;
    const signatureSpeedBonus = gs.refiningSpeedPctBonus;
    const newSignatureSpeedBonus = newSignatureRewards.refiningSpeedPctBonus;
    const redEssenceResourceBonus = gs.refiningRedEssenceResourceBonus + newSignatureRewards.refiningRedEssenceResourceBonus;
    const greenEssenceResourceBonus = gs.refiningGreenEssenceResourceBonus + newSignatureRewards.refiningGreenEssenceResourceBonus;
    const blueEssenceResourceBonus = gs.refiningBlueEssenceResourceBonus + newSignatureRewards.refiningBlueEssenceResourceBonus;
    const yellowNeighborBonus = gs.refiningYellowNeighborBonus + newSignatureRewards.refiningYellowNeighborBonus;

    const { essenceTotals, cellEffectiveCounts } = computeEffectiveEssenceTotals(gs.wafer, yellowNeighborBonus);
    const monochromeBehavior = getMonochromeEssenceBehavior(gs.discoveries);

    const cyanCount = essenceTotals['cyan'] || 0;
    const cyanReduction = cyanCount * CYAN_SUCCESS_BONUS_PCT;
    const magentaCount = essenceTotals['magenta'] || 0;
    const magentaPenalty = magentaCount * MAGENTA_SUCCESS_PENALTY_PCT;
    const waferCharge = gs.waferCharge || 0;
    const waferChargeYieldBonus = waferCharge * WAFER_CHARGE_BONUS_PCT;
    const waferChargeSuccessChanceBonus = waferCharge * WAFER_CHARGE_BONUS_PCT;

    const baseFailureChance = gs.wafer.emptyCount * FAILURE_PER_EMPTY_CELL;
    const failureChancePct = Math.min(
        100,
        Math.max(0, baseFailureChance + magentaPenalty - cyanReduction - signatureSuccessChanceBonus - newSignatureSuccessChanceBonus - waferChargeSuccessChanceBonus)
    );

    const modifierFraction = gs.refiningFailureRoll.getModifier(failureChancePct / 100);
    const adaptiveModifierPct = Math.round(modifierFraction * 100);
    const effectiveFailureChancePct = Math.min(100, Math.max(0, failureChancePct + adaptiveModifierPct));

    const totalSpeedBonusPct = signatureSpeedBonus + newSignatureSpeedBonus;
    const timeSec = REFINE_TIME / (1 + totalSpeedBonusPct / 100);

    const baseYieldPct = 100;

    // Yield bonuses that require discovery to be unlocked
    const cyanYieldBonus = gs.discoveries[DISCOVERY.CYAN_YIELD]
        ? cyanCount * CYAN_YIELD_BONUS_PCT
        : 0;
    const magentaYieldBonus = gs.discoveries[DISCOVERY.MAGENTA_YIELD]
        ? magentaCount * MAGENTA_YIELD_BONUS_PCT
        : 0;
    const yieldPenaltyCount = essenceTotals[monochromeBehavior.yieldPenaltyEssence] || 0;
    const blackYieldPenalty = yieldPenaltyCount * BLACK_YIELD_PENALTY_PCT;
    const uniqueItemsYieldBonus = computeUniqueItemsYieldBonusPct(
        gs.refinedUniqueItemIds,
        gs.wafer.items,
        gs.uniqueItemsBonusYield,
    );

    const totalYieldPct = Math.max(
        0,
        baseYieldPct
        + waferChargeYieldBonus
        + signatureYieldBonus
        + newSignatureYieldBonus
        + cyanYieldBonus
        + magentaYieldBonus
        + uniqueItemsYieldBonus
        - blackYieldPenalty
    );

    const red = essenceTotals['red'] || 0;
    const green = essenceTotals['green'] || 0;
    const blue = essenceTotals['blue'] || 0;

    const yieldMultiplier = totalYieldPct / 100;
    const creditsPerRed = ESSENCE_CREDITS + redEssenceResourceBonus;
    const chronoPerBlue = ESSENCE_CHRONOTRACES + blueEssenceResourceBonus;
    const fluxPerGreen = ESSENCE_TEMPORAL_FLUX + greenEssenceResourceBonus;
    const expectedCredits = Math.round(red * yieldMultiplier * creditsPerRed);
    const expectedChrono = Math.round(blue * yieldMultiplier * chronoPerBlue);
    const expectedFlux = Math.round(green * yieldMultiplier * fluxPerGreen);

    const gearOutputs: GearOutput[] = [];

    if (gs.discoveries[DISCOVERY.MAGENTA_CRYSTALS] && magentaCount > 0) {
        gearOutputs.push({
            gearId: 'zone_crystal',
            count: Math.floor(magentaCount * MAGENTA_CRYSTAL_YIELD_PER_ESSENCE * yieldMultiplier),
            fromEssence: 'magenta',
        });
    }
    const fractalCount = essenceTotals[monochromeBehavior.fractalYieldEssence] || 0;
    if (gs.discoveries[DISCOVERY.FRACTAL_ESSENCE_YIELD] && fractalCount > 0) {
        gearOutputs.push({
            gearId: 'fractal',
            count: Math.floor(fractalCount * BLACK_FRACTAL_YIELD_PER_ESSENCE * yieldMultiplier),
            fromEssence: monochromeBehavior.fractalYieldEssence,
        });
    }
    const spiceCount = essenceTotals[monochromeBehavior.spiceYieldEssence] || 0;
    if (gs.discoveries[DISCOVERY.SPICE_ESSENCE_YIELD] && spiceCount > 0) {
        gearOutputs.push({
            gearId: 'spice',
            count: Math.floor(spiceCount * WHITE_SPICE_YIELD_PER_ESSENCE * yieldMultiplier),
            fromEssence: monochromeBehavior.spiceYieldEssence,
        });
    }

    return {
        timeSec,
        failureChancePct,
        adaptiveModifierPct,
        effectiveFailureChancePct,
        baseYieldPct,
        waferCharge,
        waferChargeYieldBonus,
        waferChargeSuccessChanceBonus,
        signatureYieldBonus,
        newSignatureYieldBonus,
        signatureSuccessChanceBonus,
        newSignatureSuccessChanceBonus,
        signatureSpeedBonus,
        newSignatureSpeedBonus,
        cyanYieldBonus,
        magentaYieldBonus,
        blackYieldPenalty,
        yieldPenaltyEssence: monochromeBehavior.yieldPenaltyEssence,
        uniqueItemsYieldBonus,
        totalYieldPct,
        expectedCredits,
        expectedChrono,
        expectedFlux,
        essenceTotals,
        cellEffectiveCounts,
        emptyCount: gs.wafer.emptyCount,
        enabledCount: gs.wafer.enabledCount,
        newlyCompletedSignatureIds,
        newSignatureMatches,
        gearOutputs,
    };
}

export function calculateOutputs(
    preview: RefinePreviewChem,
    succeeded: boolean
): { credits: number; chrono: number; flux: number } {
    if (!succeeded) {
        return { credits: 0, chrono: 0, flux: 0 };
    }

    return {
        credits: preview.expectedCredits,
        chrono: preview.expectedChrono,
        flux: preview.expectedFlux,
    };
}
