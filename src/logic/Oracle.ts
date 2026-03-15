import type { ReadonlyGameState } from './UIState';
import type { GameState } from './GameState';
import { axialDistance, axialRange } from './HexMath';
import type { Point2 } from './core/math';
import type { ReadonlySignatureDefinition } from './SignatureLib';
import { findBestSignatureFit, type BestSignatureFit } from './findBestSignatureFit';
import { axialToIndex } from './Research';

export const ORACLE_VALIDATE_COST = 100;

export const ORACLE_SEAL_COLORS = ['red', 'green', 'blue', 'gray', 'yellow', 'magenta'] as const;
export type OracleSealColor = (typeof ORACLE_SEAL_COLORS)[number];
export type OracleSealCellColors = Record<string, OracleSealColor | null | undefined>;

const ORACLE_WAFER_RADIUS = 4;
const ORACLE_WAFER_CELLS = axialRange({ x: 0, y: 0 }, ORACLE_WAFER_RADIUS).map((cell) => ({ x: cell.x, y: cell.y }));
const ORACLE_WAFER_CELL_KEYS = new Set(ORACLE_WAFER_CELLS.map((cell) => getOracleWaferCellKey(cell)));

export interface OracleSealEvaluation {
  signature: ReadonlySignatureDefinition;
  fit: BestSignatureFit;
  success: boolean;
}

export interface OracleSealSubmissionResult extends OracleSealEvaluation {
  submitted: boolean;
}

export interface OracleSealAttempt {
  cellColors: Record<string, OracleSealColor>;
  mismatchMarkerKeys: string[];
}

export function getOracleWaferCells(): Point2[] {
  return ORACLE_WAFER_CELLS.map((cell) => ({ x: cell.x, y: cell.y }));
}

export function getOracleWaferCellKey(point: Point2): string {
  return `${point.x},${point.y}`;
}

export function compactOracleSealColors(
  cellColors: Readonly<Record<string, OracleSealColor | null | undefined>>
): Record<string, OracleSealColor> {
  const compact: Record<string, OracleSealColor> = {};
  for (const [key, color] of Object.entries(cellColors)) {
    if (!color) continue;
    compact[key] = color;
  }
  return compact;
}

export function createOracleSealAttempt(
  cellColors: Readonly<Record<string, OracleSealColor | null | undefined>>,
  fit: Pick<BestSignatureFit, 'wrongColorCellKeys' | 'extraLitCellKeys'>
): OracleSealAttempt {
  return {
    cellColors: compactOracleSealColors(cellColors),
    mismatchMarkerKeys: [...fit.wrongColorCellKeys, ...fit.extraLitCellKeys],
  };
}

function toOracleSealColor(color: string): OracleSealColor {
  switch (color) {
    case 'red':
    case 'green':
    case 'blue':
    case 'gray':
    case 'yellow':
    case 'magenta':
      return color;
    default:
      throw new Error(`Unsupported oracle seal color: ${color}`);
  }
}

function getBestOracleSealSolutionOffset(signature: Pick<ReadonlySignatureDefinition, 'molecule'>): Point2 {
  const candidateOffsets = new Map<string, Point2>();

  for (const offset of ORACLE_WAFER_CELLS) {
    candidateOffsets.set(getOracleWaferCellKey(offset), { x: offset.x, y: offset.y });
    for (const atom of signature.molecule.atoms) {
      const translatedOffset = {
        x: offset.x - atom.x,
        y: offset.y - atom.y,
      };
      candidateOffsets.set(getOracleWaferCellKey(translatedOffset), translatedOffset);
    }
  }

  let bestOffset: Point2 | null = null;
  let bestOnboardCount = -1;
  let bestDistanceScore = Number.POSITIVE_INFINITY;
  let bestMaxDistance = Number.POSITIVE_INFINITY;

  for (const offset of candidateOffsets.values()) {
    let onboardCount = 0;
    let distanceScore = 0;
    let maxDistance = 0;

    for (const atom of signature.molecule.atoms) {
      const cell = {
        x: atom.x + offset.x,
        y: atom.y + offset.y,
      };
      const key = getOracleWaferCellKey(cell);
      if (!ORACLE_WAFER_CELL_KEYS.has(key)) continue;
      onboardCount++;
      const distance = axialDistance({ x: 0, y: 0 }, cell);
      distanceScore += distance;
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    }

    if (onboardCount > bestOnboardCount) {
      bestOffset = offset;
      bestOnboardCount = onboardCount;
      bestDistanceScore = distanceScore;
      bestMaxDistance = maxDistance;
      continue;
    }
    if (onboardCount < bestOnboardCount) continue;

    if (distanceScore < bestDistanceScore) {
      bestOffset = offset;
      bestDistanceScore = distanceScore;
      bestMaxDistance = maxDistance;
      continue;
    }
    if (distanceScore > bestDistanceScore) continue;

    if (maxDistance < bestMaxDistance) {
      bestOffset = offset;
      bestMaxDistance = maxDistance;
      continue;
    }
    if (maxDistance > bestMaxDistance) continue;

    if (bestOffset === null || offset.x < bestOffset.x || (offset.x === bestOffset.x && offset.y < bestOffset.y)) {
      bestOffset = offset;
    }
  }

  if (bestOffset === null) {
    throw new Error('Unable to place oracle seal solution inside wafer');
  }

  return bestOffset;
}

function getOracleId(gs: ReadonlyGameState, nodeId: number): string {
  const node = gs.lib.research.nodes.get(nodeId)!;
  const firstCell = node.cells[0]!;
  const idx = axialToIndex(firstCell.x, firstCell.y);
  if (idx === -1) {
    throw new Error(`Oracle node ${nodeId} has out-of-bounds cell (${firstCell.x}, ${firstCell.y})`);
  }
  return gs.researchCells[idx]!.oracleId;
}

export function getOracleSignature(gs: ReadonlyGameState, nodeId: number): ReadonlySignatureDefinition {
  const oracleId = getOracleId(gs, nodeId);
  return gs.lib.signatures.get(gs.lib.oracles.get(oracleId)!.signatureId)!;
}

export function getOracleRiddle(gs: ReadonlyGameState, nodeId: number): string {
  const oracleId = getOracleId(gs, nodeId);
  return gs.lib.oracles.get(oracleId)!.riddle;
}

export function getOracleSealSolutionCellColors(gs: ReadonlyGameState, nodeId: number): Record<string, OracleSealColor> {
  const signature = getOracleSignature(gs, nodeId);
  const offset = getBestOracleSealSolutionOffset(signature);
  const cellColors: Record<string, OracleSealColor> = {};

  for (const atom of signature.molecule.atoms) {
    const key = getOracleWaferCellKey({
      x: atom.x + offset.x,
      y: atom.y + offset.y,
    });
    if (!ORACLE_WAFER_CELL_KEYS.has(key)) continue;
    cellColors[key] = toOracleSealColor(atom.color);
  }

  return cellColors;
}

export function evaluateOracleSeal(
  gs: ReadonlyGameState,
  nodeId: number,
  cellColors: Readonly<Record<string, OracleSealColor | null | undefined>>
): OracleSealEvaluation {
  const signature = getOracleSignature(gs, nodeId);
  const fit = findBestSignatureFit(signature, cellColors, ORACLE_WAFER_CELLS, ORACLE_WAFER_CELL_KEYS);
  return {
    signature,
    fit,
    success: fit.exact,
  };
}

export function submitOracleSeal(
  gs: GameState,
  nodeId: number,
  cellColors: Readonly<Record<string, OracleSealColor | null | undefined>>
): OracleSealSubmissionResult {
  const evaluation = evaluateOracleSeal(gs, nodeId, cellColors);
  const oracleState = gs.mazeOracleStateByNodeId[String(nodeId)];
  if (oracleState !== 'riddling' || gs.chronotraces < ORACLE_VALIDATE_COST) {
    return { ...evaluation, submitted: false };
  }

  gs.chronotraces -= ORACLE_VALIDATE_COST;
  if (evaluation.success) {
    gs.mazeOracleStateByNodeId[String(nodeId)] = 'riddlePassed';
  } else {
    gs.mazeOracleLastFailedSealAttemptByNodeId[String(nodeId)] = createOracleSealAttempt(cellColors, evaluation.fit);
  }

  return { ...evaluation, submitted: true };
}
