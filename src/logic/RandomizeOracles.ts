import type { GameState } from './GameState';
import SeededRandom from './core/SeededRandom';
import { axialDistance } from './HexMath';
import { axialToIndex } from './Research';

const ORACLE_RANDOMIZATION_SEED_XOR = 0x85ebca6b;
const ORACLE_BUCKET_COUNT = 4;
const ORACLE_ACCEPTABLE_SCORE = 24;
const ORACLE_MAX_STALLED_ATTEMPTS = 4096;

interface OracleSlotInfo {
  nodeId: number;
  bucketIndex: number;
}

function getOracleSlots(gs: GameState): OracleSlotInfo[] {
  const slots = Array.from(gs.lib.research.nodes.values())
    .filter(node => node.oracleSlot)
    .sort((a, b) => {
      const aCenter = a.centerCell ?? a.cells[0]!;
      const bCenter = b.centerCell ?? b.cells[0]!;
      const distanceDiff = axialDistance({ x: 0, y: 0 }, aCenter) - axialDistance({ x: 0, y: 0 }, bCenter);
      return distanceDiff !== 0 ? distanceDiff : a.nodeId - b.nodeId;
    });

  if (slots.length % ORACLE_BUCKET_COUNT !== 0) {
    throw new Error(`Oracle slot count ${slots.length} is not divisible by ${ORACLE_BUCKET_COUNT}`);
  }

  const bucketSize = slots.length / ORACLE_BUCKET_COUNT;
  return slots.map((slot, index) => ({
    nodeId: slot.nodeId,
    bucketIndex: Math.floor(index / bucketSize),
  }));
}

function getOracleDifficulty(gs: GameState, oracleId: string): number {
  const oracle = gs.lib.oracles.get(oracleId)!;
  return gs.lib.signatures.get(oracle.signatureId)!.difficulty;
}

function getOracleScore(difficulty: number, bucketIndex: number): number {
  const diff = difficulty - bucketIndex;
  return diff * diff;
}

function getSwapScoreDelta(
  gs: GameState,
  slotOracleIds: readonly string[],
  slots: readonly OracleSlotInfo[],
  slotIndexA: number,
  slotIndexB: number,
): number {
  const oracleIdA = slotOracleIds[slotIndexA]!;
  const oracleIdB = slotOracleIds[slotIndexB]!;
  const difficultyA = getOracleDifficulty(gs, oracleIdA);
  const difficultyB = getOracleDifficulty(gs, oracleIdB);
  const bucketA = slots[slotIndexA]!.bucketIndex;
  const bucketB = slots[slotIndexB]!.bucketIndex;
  const scoreBefore = getOracleScore(difficultyA, bucketA) + getOracleScore(difficultyB, bucketB);
  const scoreAfter = getOracleScore(difficultyB, bucketA) + getOracleScore(difficultyA, bucketB);
  return scoreBefore - scoreAfter;
}

function getRandomCandidateIndex(random: SeededRandom, count: number, excludedA: number, excludedB: number): number {
  if (count < 3) {
    throw new Error(`Need at least 3 oracle slots to choose two swap candidates; got ${count}`);
  }

  let index = Math.floor(random.get() * count);
  while (index === excludedA || index === excludedB) {
    index = Math.floor(random.get() * count);
  }
  return index;
}

function logOracleBuckets(gs: GameState, slotOracleIds: readonly string[], slots: readonly OracleSlotInfo[], initialScore: number, totalScore: number, swapCount: number): void {
  const bucketSize = slots.length / ORACLE_BUCKET_COUNT;
  const lines: string[] = [];
  for (let bucketIndex = 0; bucketIndex < ORACLE_BUCKET_COUNT; bucketIndex++) {
    const start = bucketIndex * bucketSize;
    const bucketDifficulties = slotOracleIds
      .slice(start, start + bucketSize)
      .map((oracleId) => String(getOracleDifficulty(gs, oracleId) + 1));
    lines.push(`bucket ${bucketIndex}: ${bucketDifficulties.join(', ')}`);
  }
  lines.push(`score: ${totalScore}`);
  lines.push(`initial score: ${initialScore}`);
  lines.push(`total improvement swaps: ${swapCount}`);
  console.log(lines.join('\n'));
}

export function randomizeOracles(gs: GameState): void {
  const slots = getOracleSlots(gs);
  const oracleIds = Array.from(gs.lib.oracles.keys());
  if (slots.length !== oracleIds.length) {
    throw new Error(`Oracle slot count ${slots.length} does not match oracle definition count ${oracleIds.length}`);
  }

  const random = new SeededRandom((gs.seed ^ ORACLE_RANDOMIZATION_SEED_XOR) >>> 0);
  const slotOracleIds = [...oracleIds];
  random.shuffleInPlace(slotOracleIds);

  const slotScores = slotOracleIds.map((oracleId, slotIndex) => getOracleScore(getOracleDifficulty(gs, oracleId), slots[slotIndex]!.bucketIndex));
  const initialScore = slotScores.reduce((sum, score) => sum + score, 0);
  let totalScore = initialScore;
  let totalImprovementSwaps = 0;
  let stalledAttempts = 0;

  while (totalScore > ORACLE_ACCEPTABLE_SCORE) {
    let offenderIndex = 0;
    for (let i = 1; i < slotScores.length; i++) {
      if (slotScores[i]! > slotScores[offenderIndex]!) {
        offenderIndex = i;
      }
    }

    const candidateIndexA = getRandomCandidateIndex(random, slotOracleIds.length, offenderIndex, -1);
    const candidateIndexB = getRandomCandidateIndex(random, slotOracleIds.length, offenderIndex, candidateIndexA);
    const deltaA = getSwapScoreDelta(gs, slotOracleIds, slots, offenderIndex, candidateIndexA);
    const deltaB = getSwapScoreDelta(gs, slotOracleIds, slots, offenderIndex, candidateIndexB);

    let chosenCandidateIndex = -1;
    let chosenDelta = 0;
    if (deltaA > 0 || deltaB > 0) {
      if (deltaB > deltaA) {
        chosenCandidateIndex = candidateIndexB;
        chosenDelta = deltaB;
      } else {
        chosenCandidateIndex = candidateIndexA;
        chosenDelta = deltaA;
      }
    }

    if (chosenCandidateIndex === -1) {
      stalledAttempts++;
      if (stalledAttempts > ORACLE_MAX_STALLED_ATTEMPTS) {
        throw new Error(`Unable to reduce oracle randomization score to ${ORACLE_ACCEPTABLE_SCORE}; stuck at ${totalScore}`);
      }
      continue;
    }

    stalledAttempts = 0;
    const offenderOracleId = slotOracleIds[offenderIndex]!;
    slotOracleIds[offenderIndex] = slotOracleIds[chosenCandidateIndex]!;
    slotOracleIds[chosenCandidateIndex] = offenderOracleId;

    slotScores[offenderIndex] = getOracleScore(getOracleDifficulty(gs, slotOracleIds[offenderIndex]!), slots[offenderIndex]!.bucketIndex);
    slotScores[chosenCandidateIndex] = getOracleScore(getOracleDifficulty(gs, slotOracleIds[chosenCandidateIndex]!), slots[chosenCandidateIndex]!.bucketIndex);
    totalScore -= chosenDelta;
    totalImprovementSwaps++;
  }

  // logOracleBuckets(gs, slotOracleIds, slots, initialScore, totalScore, totalImprovementSwaps);

  for (const cell of gs.researchCells) {
    cell.oracleId = '';
  }

  for (let i = 0; i < slots.length; i++) {
    const nodeId = slots[i]!.nodeId;
    const oracleId = slotOracleIds[i]!;
    const node = gs.lib.research.nodes.get(nodeId)!;
    for (const point of node.cells) {
      const idx = axialToIndex(point.x, point.y);
      if (idx === -1) {
        throw new Error(`Oracle node ${nodeId} has out-of-bounds cell (${point.x}, ${point.y})`);
      }
      gs.researchCells[idx]!.oracleId = oracleId;
    }
  }
}
