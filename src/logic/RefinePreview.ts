import type { Wafer } from './Wafer';
import { getCell } from './Wafer';
import { axialNeighbors } from './HexMath';
import {
    CYAN_SUCCESS_BONUS_PCT,
    CYAN_YIELD_BONUS_PCT,
    ESSENCE_CREDITS,
    ESSENCE_CHRONOTRACES,
    ESSENCE_TEMPORAL_FLUX,
    FAILURE_PER_EMPTY_CELL,
    MAGENTA_SUCCESS_PENALTY_PCT,
    REFINE_TIME,
} from './Const';
import { getWaferBuffAt } from './waferLayout';
import { scanWaferForNewSignatures, SIGNATURE_YIELD_BONUS_PCT } from './Signatures';
import type { SignatureDefinition } from './SignatureLib';

export interface RefinePreviewChem {
    timeSec: number;
    failureChancePct: number;
    baseYieldPct: number;

    signatureYieldBonus: number;
    newSignatureYieldBonus: number;
    signatureSpeedBonus: number;
    cyanYieldBonus: number;
    uniqueItemsYieldBonus: number;

    totalYieldPct: number;

    expectedCredits: number;
    expectedChrono: number;
    expectedFlux: number;

    essenceTotals: Record<string, number>;

    // Per-cell effective counts for standard essences (red/green/blue) after buffs.
    // Key: "x,y" axial coordinates. Only cells with effectiveCount > 1 are stored.
    cellEffectiveCounts: Record<string, number>;

    emptyCount: number;
    enabledCount: number;

    newlyCompletedSignatureIds: string[];
    newSignatureMatches: Array<{ id: string; offset: { x: number; y: number } }>;
}

export interface SignatureContext {
    signatures: Map<string, SignatureDefinition>;
    signatureLevel: number;
    completedSignatureIds: string[];
}

export interface RefineContext extends SignatureContext {
    uniqueItemsYieldBonus: number;
}

// Color-changing essences and their target colors.
const COLOR_CHANGER_TARGET: Record<string, string> = {
    indigo: 'blue',
    crimson: 'red',
    emerald: 'green',
    gold: 'yellow',
};

const BUFFABLE_ESSENCES = new Set(['red', 'green', 'blue', 'cyan', 'magenta']);

export function computeUniqueItemsYieldBonusPct(
    refinedUniqueItemIds: Record<string, true>,
    waferItems: Array<{ id: string } | null>
): number {
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

    return uniqueCount;
}

export function computeEffectiveEssences(wafer: Wafer): void {
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

    // Helper to flood-fill a cluster of the same base essence.
    const clusterCache = new Map<string, string[]>();
    function getCluster(startKey: string, essence: string): string[] {
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
            if (baseEssence !== essence) continue;

            result.push(key);

            const [sx, sy] = key.split(',');
            const x = Number(sx);
            const y = Number(sy);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            for (const n of axialNeighbors({ x, y })) {
                const nKey = `${n.x},${n.y}`;
                if (!enabledKeys.has(nKey)) continue;
                if (baseEssenceByKey[nKey] !== essence) continue;
                if (!visited.has(nKey)) {
                    queue.push(nKey);
                }
            }
        }

        for (const key of result) {
            clusterCache.set(`${essence}|${key}`, result);
        }

        return result;
    }

    // First pass: detect color-changing atoms that are directly "touching"
    // atoms with a different target color. Those pairs both become gray and
    // stop affecting other cells.
    const disarmedKeys = new Set<string>();
    for (const cell of wafer.cells.values()) {
        if (!cell.enabled || !cell.essence) continue;
        const baseEssence = cell.essence;
        const target = COLOR_CHANGER_TARGET[baseEssence];
        if (!target) continue;

        const cellKeyStr = `${cell.x},${cell.y}`;
        const pos = { x: cell.x, y: cell.y };
        for (const n of axialNeighbors(pos)) {
            const neighborKey = `${n.x},${n.y}`;
            if (!enabledKeys.has(neighborKey)) continue;
            const neighborEssence = baseEssenceByKey[neighborKey];
            if (!neighborEssence) continue;
            const neighborTarget = COLOR_CHANGER_TARGET[neighborEssence];
            if (!neighborTarget) continue;
            if (neighborTarget !== target) {
                disarmedKeys.add(cellKeyStr);
                disarmedKeys.add(neighborKey);
            }
        }
    }

    // Accumulate desired target colors for each cell based on *active* color-changers.
    const desiredTargetsByKey: Record<string, string[]> = {};

    for (const cell of wafer.cells.values()) {
        if (!cell.enabled || !cell.essence) continue;
        const changerEssence = cell.essence;
        const target = COLOR_CHANGER_TARGET[changerEssence];
        if (!target) continue;

        const cellKeyStr = `${cell.x},${cell.y}`;
        if (disarmedKeys.has(cellKeyStr)) continue;

        const pos = { x: cell.x, y: cell.y };
        for (const n of axialNeighbors(pos)) {
            const neighborKey = `${n.x},${n.y}`;
            if (!enabledKeys.has(neighborKey)) continue;
            const neighborBaseEssence = baseEssenceByKey[neighborKey];
            if (!neighborBaseEssence) continue;
            // These atoms affect all colors (including ones already equal to their
            // target color) so that overlapping influences of different colors can
            // correctly resolve to gray.

            const cluster = getCluster(neighborKey, neighborBaseEssence);
            for (const key of cluster) {
                if (!desiredTargetsByKey[key]) {
                    desiredTargetsByKey[key] = [target];
                } else {
                    desiredTargetsByKey[key].push(target);
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
            effectiveEssenceByCell[key] = uniqueTargets[0];
        } else {
            // Conflicting target colors: result is gray.
            effectiveEssenceByCell[key] = 'gray';
        }
    }

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

function computeEffectiveEssenceTotals(wafer: Wafer): {
    essenceTotals: Record<string, number>;
    cellEffectiveCounts: Record<string, number>;
} {
    // First compute and write effective essences into wafer cells.
    computeEffectiveEssences(wafer);

    const effectiveTotals: Record<string, number> = {};
    const cellEffectiveCounts: Record<string, number> = {};

    // Count totals from effective essences (after color-changing atoms).
    for (const cell of wafer.cells.values()) {
        if (!cell.enabled) continue;
        const effEssence = cell.effectiveEssence ?? cell.essence;
        if (!effEssence) continue;
        effectiveTotals[effEssence] = (effectiveTotals[effEssence] || 0) + 1;
    }

    // Initialize totals for buffable essences: they will be recomputed with yellow/orange buffs.
    for (const k of Object.keys(effectiveTotals)) {
        if (BUFFABLE_ESSENCES.has(k)) {
            effectiveTotals[k] = 0;
        }
    }

    // Compute effective counts for buffable essences with yellow/orange buffs
    // and built-in wafer cell buffs, based on the already transformed colors.
    for (const cell of wafer.cells.values()) {
        if (!cell.enabled) continue;
        const key = `${cell.x},${cell.y}`;
        const effEssence = cell.effectiveEssence ?? cell.essence;
        if (!effEssence || !BUFFABLE_ESSENCES.has(effEssence)) continue;

        const pos = { x: cell.x, y: cell.y };

        let yellowNeighbors = 0;
        let orangeNeighbors = 0;

        for (const n of axialNeighbors(pos)) {
            const neighbor = getCell(wafer, n);
            if (!neighbor || !neighbor.enabled) continue;
            const neighborEffEssence = neighbor.effectiveEssence ?? neighbor.essence;
            if (!neighborEffEssence) continue;
            if (neighborEffEssence === 'yellow') {
                yellowNeighbors++;
            } else if (neighborEffEssence === 'orange') {
                orangeNeighbors++;
            }
        }

        const waferBuff = getWaferBuffAt(cell.x, cell.y);

        const base = 1 + yellowNeighbors + waferBuff.additive; // Yellow + built-in additive buffs
        const multiplier = Math.pow(2, orangeNeighbors) * waferBuff.multiplier; // Orange + built-in multiplicative buffs
        const effectiveCount = base * multiplier;

        effectiveTotals[effEssence] = (effectiveTotals[effEssence] || 0) + effectiveCount;

        if (effectiveCount > 1) {
            cellEffectiveCounts[key] = effectiveCount;
        }
    }

    return {
        essenceTotals: effectiveTotals,
        cellEffectiveCounts,
    };
}

export function computeRefinePreviewChem(wafer: Wafer, sig: RefineContext): RefinePreviewChem {

    const { essenceTotals, cellEffectiveCounts } = computeEffectiveEssenceTotals(wafer);

    const cyanCount = essenceTotals['cyan'] || 0;
    const cyanReduction = cyanCount * CYAN_SUCCESS_BONUS_PCT;
    const magentaCount = essenceTotals['magenta'] || 0;
    const magentaPenalty = magentaCount * MAGENTA_SUCCESS_PENALTY_PCT;

    const baseFailureChance = wafer.emptyCount * FAILURE_PER_EMPTY_CELL;
    const failureChancePct = Math.min(100, Math.max(0, baseFailureChance + magentaPenalty - cyanReduction));

    const baseYieldPct = 100;

    const completedIdSet = new Set(sig.completedSignatureIds);
    const signatureDefsForLevel = Array.from(sig.signatures.values()).filter(s => s.level === sig.signatureLevel);
    const { newlyCompletedSignatureIds, newSignatureMatches } = scanWaferForNewSignatures(wafer, signatureDefsForLevel, completedIdSet);

    const signatureYieldBonus = sig.completedSignatureIds.length * SIGNATURE_YIELD_BONUS_PCT;
    const newSignatureYieldBonus = newlyCompletedSignatureIds.length * SIGNATURE_YIELD_BONUS_PCT;
    const signatureSpeedBonus = 0;
    const cyanYieldBonus = cyanCount * CYAN_YIELD_BONUS_PCT;
    const uniqueItemsYieldBonus = sig.uniqueItemsYieldBonus;

    const totalYieldPct = baseYieldPct + signatureYieldBonus + newSignatureYieldBonus + cyanYieldBonus + uniqueItemsYieldBonus;

    const red = essenceTotals['red'] || 0;
    const green = essenceTotals['green'] || 0;
    const blue = essenceTotals['blue'] || 0;

    const yieldMultiplier = totalYieldPct / 100;
    const expectedCredits = Math.round(red * yieldMultiplier * ESSENCE_CREDITS);
    const expectedChrono = Math.round(blue * yieldMultiplier * ESSENCE_CHRONOTRACES);
    const expectedFlux = Math.round(green * yieldMultiplier * ESSENCE_TEMPORAL_FLUX);

    return {
        timeSec: REFINE_TIME,
        failureChancePct,
        baseYieldPct,
        signatureYieldBonus,
        newSignatureYieldBonus,
        signatureSpeedBonus,
        cyanYieldBonus,
        uniqueItemsYieldBonus,
        totalYieldPct,
        expectedCredits,
        expectedChrono,
        expectedFlux,
        essenceTotals,
        cellEffectiveCounts,
        emptyCount: wafer.emptyCount,
        enabledCount: wafer.enabledCount,
        newlyCompletedSignatureIds,
        newSignatureMatches,
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

export function rollSuccess(failureChancePct: number): boolean {
    const roll = Math.random() * 100;
    return roll >= failureChancePct;
}
