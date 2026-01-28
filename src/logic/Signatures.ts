import type { Wafer, ReadonlyWafer } from './Wafer';
import { getCell } from './Wafer';
import type { SignatureDefinition, SignatureMolecule } from './SignatureLib';
import type { Point2 } from './ItemLib';

export interface WaferSignatureScanResult {
  newlyCompletedSignatureIds: string[];
  newSignatureMatches: Array<{ id: string; offset: Point2 }>;
}

const essenceEquivalents: Record<string, string> = {
  indigo: 'blue',
  crimson: 'red',
  emerald: 'green',
  gold: 'yellow',
};

function essenceMatchesForSignature(essence: string, targetColor: string): boolean {
  if (essence === targetColor) return true;
  return essenceEquivalents[essence] === targetColor;
}

function signatureMatchesAtOffset(wafer: ReadonlyWafer, molecule: SignatureMolecule, offset: { x: number; y: number }): boolean {
  for (const atom of molecule.atoms) {
    const cell = getCell(wafer, { x: atom.x + offset.x, y: atom.y + offset.y });
    if (!cell || !cell.enabled) return false;
    const effEssence = cell.effectiveEssence ?? cell.essence;
    if (!effEssence || !essenceMatchesForSignature(effEssence, atom.color)) return false;
  }
  return true;
}

export function scanWaferForNewSignatures(
  wafer: ReadonlyWafer,
  signatureDefs: SignatureDefinition[],
  completedSignatureIds: Set<string>
): WaferSignatureScanResult {
  const newlyCompletedSignatureIds: string[] = [];
  const newSignatureMatches: Array<{ id: string; offset: Point2 }> = [];

  for (const sig of signatureDefs) {
    if (completedSignatureIds.has(sig.id)) continue;

    let foundOffset: Point2 | null = null;
    for (const cell of wafer.cells.values()) {
      if (signatureMatchesAtOffset(wafer, sig.molecule, { x: cell.x, y: cell.y })) {
        foundOffset = { x: cell.x, y: cell.y };
        break;
      }
    }

    if (foundOffset) {
      newlyCompletedSignatureIds.push(sig.id);
      newSignatureMatches.push({
        id: sig.id,
        offset: foundOffset,
      });
    }
  }

  return { newlyCompletedSignatureIds, newSignatureMatches };
}
