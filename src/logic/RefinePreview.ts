import type { Wafer } from './Wafer';
import { ESSENCE_CREDITS, ESSENCE_CHRONOTRACES, ESSENCE_TEMPORAL_FLUX, REFINE_TIME, FAILURE_PER_EMPTY_CELL } from './Const';

export interface RefinePreviewChem {
    timeSec: number;
    failureChancePct: number;
    baseYieldPct: number;

    signatureYieldBonus: number;
    signatureSpeedBonus: number;

    totalYieldPct: number;

    expectedCredits: number;
    expectedChrono: number;
    expectedFlux: number;

    essenceTotals: Record<string, number>;

    emptyCount: number;
    enabledCount: number;
}

export function computeRefinePreviewChem(wafer: Wafer): RefinePreviewChem {

    const failureChancePct = Math.min(100, Math.max(0, wafer.emptyCount * FAILURE_PER_EMPTY_CELL));

    const baseYieldPct = 100;

    const signatureYieldBonus = 0;
    const signatureSpeedBonus = 0;

    const totalYieldPct = baseYieldPct + signatureYieldBonus;

    const red = wafer.essenceTotals['red'] || 0;
    const green = wafer.essenceTotals['green'] || 0;
    const blue = wafer.essenceTotals['blue'] || 0;

    const yieldMultiplier = totalYieldPct / 100;
    const expectedCredits = Math.round(red * yieldMultiplier * ESSENCE_CREDITS);
    const expectedChrono = Math.round(blue * yieldMultiplier * ESSENCE_CHRONOTRACES);
    const expectedFlux = Math.round(green * yieldMultiplier * ESSENCE_TEMPORAL_FLUX);

    return {
        timeSec: REFINE_TIME,
        failureChancePct,
        baseYieldPct,
        signatureYieldBonus,
        signatureSpeedBonus,
        totalYieldPct,
        expectedCredits,
        expectedChrono,
        expectedFlux,
        essenceTotals: { ...wafer.essenceTotals },
        emptyCount: wafer.emptyCount,
        enabledCount: wafer.enabledCount,
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
