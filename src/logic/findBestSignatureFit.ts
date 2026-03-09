import type { Point2 } from './core/math';
import type { ReadonlySignatureDefinition } from './SignatureLib';

export interface BestSignatureFit {
  offset: Point2;
  matchedCellKeys: string[];
  wrongColorCellKeys: string[];
  extraLitCellKeys: string[];
  missingCount: number;
  exact: boolean;
  score: number;
  markedMismatchCount: number;
}

interface SignatureFitCandidate extends BestSignatureFit {
  matchedCount: number;
}

function isBetterFit(candidate: SignatureFitCandidate, best: SignatureFitCandidate): boolean {
  if (candidate.score !== best.score) return candidate.score < best.score;
  if (candidate.markedMismatchCount !== best.markedMismatchCount) return candidate.markedMismatchCount < best.markedMismatchCount;
  if (candidate.matchedCount !== best.matchedCount) return candidate.matchedCount > best.matchedCount;
  if (candidate.extraLitCellKeys.length !== best.extraLitCellKeys.length) {
    return candidate.extraLitCellKeys.length < best.extraLitCellKeys.length;
  }
  if (candidate.wrongColorCellKeys.length !== best.wrongColorCellKeys.length) {
    return candidate.wrongColorCellKeys.length < best.wrongColorCellKeys.length;
  }
  if (candidate.missingCount !== best.missingCount) return candidate.missingCount < best.missingCount;
  if (candidate.offset.x !== best.offset.x) return candidate.offset.x < best.offset.x;
  return candidate.offset.y < best.offset.y;
}

function normalizeLitCellColors(
  cellColors: Readonly<Record<string, string | null | undefined>>
): Record<string, string> {
  const litCellColors: Record<string, string> = {};
  for (const [key, color] of Object.entries(cellColors)) {
    if (!color) continue;
    litCellColors[key] = color;
  }
  return litCellColors;
}

export function findBestSignatureFit(
  signature: Pick<ReadonlySignatureDefinition, 'molecule'>,
  cellColors: Readonly<Record<string, string | null | undefined>>,
  searchOffsets: readonly Point2[],
  validCellKeys: ReadonlySet<string>
): BestSignatureFit {
  const litCellColors = normalizeLitCellColors(cellColors);
  const candidateOffsets = new Map<string, Point2>();

  for (const offset of searchOffsets) {
    candidateOffsets.set(`${offset.x},${offset.y}`, { x: offset.x, y: offset.y });
    for (const atom of signature.molecule.atoms) {
      const translatedOffset = {
        x: offset.x - atom.x,
        y: offset.y - atom.y,
      };
      candidateOffsets.set(`${translatedOffset.x},${translatedOffset.y}`, translatedOffset);
    }
  }

  let bestFit: SignatureFitCandidate | null = null;

  for (const offset of candidateOffsets.values()) {
    const requiredColorsByKey = new Map<string, string>();
    let missingCount = 0;

    for (const atom of signature.molecule.atoms) {
      const key = `${atom.x + offset.x},${atom.y + offset.y}`;
      if (!validCellKeys.has(key)) {
        missingCount++;
        continue;
      }
      requiredColorsByKey.set(key, atom.color);
    }

    const matchedCellKeys: string[] = [];
    const wrongColorCellKeys: string[] = [];

    for (const [key, requiredColor] of requiredColorsByKey.entries()) {
      const actualColor = litCellColors[key];
      if (!actualColor) {
        missingCount++;
        continue;
      }
      if (actualColor === requiredColor) {
        matchedCellKeys.push(key);
        continue;
      }
      wrongColorCellKeys.push(key);
    }

    const extraLitCellKeys: string[] = [];
    for (const key of Object.keys(litCellColors)) {
      if (!requiredColorsByKey.has(key)) {
        extraLitCellKeys.push(key);
      }
    }

    const markedMismatchCount = wrongColorCellKeys.length + extraLitCellKeys.length;
    const score = markedMismatchCount + missingCount;
    const candidate: SignatureFitCandidate = {
      offset: { x: offset.x, y: offset.y },
      matchedCellKeys,
      wrongColorCellKeys,
      extraLitCellKeys,
      missingCount,
      exact: score === 0,
      score,
      markedMismatchCount,
      matchedCount: matchedCellKeys.length,
    };

    if (bestFit === null || isBetterFit(candidate, bestFit)) {
      bestFit = candidate;
    }
  }

  if (bestFit === null) {
    throw new Error('Cannot search for a signature fit without oracle wafer cells');
  }

  return bestFit;
}
