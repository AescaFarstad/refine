import type { GameState } from './GameState';
import SeededRandom from './core/SeededRandom';
import { axialToIndex } from './Research';

const ORACLE_RANDOMIZATION_SEED_XOR = 0x85ebca6b;

function getOracleSlotNodeIds(gs: GameState): number[] {
  return Array.from(gs.lib.research.nodes.values())
    .filter(node => node.oracleSlot)
    .map(node => node.nodeId)
    .sort((a, b) => a - b);
}

export function randomizeOracles(gs: GameState): void {
  const slotNodeIds = getOracleSlotNodeIds(gs);
  const oracleIds = Array.from(gs.lib.oracles.keys());
  if (slotNodeIds.length !== oracleIds.length) {
    throw new Error(`Oracle slot count ${slotNodeIds.length} does not match oracle definition count ${oracleIds.length}`);
  }

  const random = new SeededRandom((gs.seed ^ ORACLE_RANDOMIZATION_SEED_XOR) >>> 0);
  random.shuffleInPlace(oracleIds);

  for (const cell of gs.researchCells) {
    cell.oracleId = '';
  }

  for (let i = 0; i < slotNodeIds.length; i++) {
    const nodeId = slotNodeIds[i]!;
    const oracleId = oracleIds[i]!;
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
