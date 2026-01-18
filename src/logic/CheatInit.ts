import { Raid, type GameState } from './GameState';
import { setIsDebug } from './Const';
import { uiState } from './UIState';
import { DISCOVERY } from './DiscoveryLib';
import { CheatAddResources, CheatLoadResearchState, CheatUnlockAllRaids, CheatDisableQuestPrereqs, CheatGrantDiscoveries, CheatAddRaidItems, CheatUnlockAllGear, CheatGrantRewards, CheatLearnSignatures, CheatCompleteSignatures } from './cheat/CheatCommands';
import signatures from '../data/signatures';
import { recomputeActiveRaidEstimates, recomputeActiveRaidParams } from './Raid';

export function initDebug(gameState: GameState): void {
  // return;
  setIsDebug(true);

  uiState.editResearchOpen = true;

  // gameState.unlockedRaids = Array.from(gameState.lib.raids.keys()).map(id => new Raid(id));
  // if (!gameState.lib.raids.has('ozernoye')) {
  //   throw new Error('[initDebug] expected raid id "ozernoye"');
  // }
  // recomputeActiveRaidParams(gameState, 'ozernoye');
  // recomputeActiveRaidEstimates(gameState, 100);

  const raidItemCheats = Array.from(gameState.lib.raids.keys()).map(
    id => new CheatAddRaidItems({ id, count: 10 })
  );

  gameState.cheats = [
    new CheatAddResources({ credits: 100000, chronotraces: 100000, timeFlux: 0, shardDust: 10000, skillPoints: 100 }),
    new CheatGrantDiscoveries({ discoveryIds: Object.values(DISCOVERY) }),
    new CheatLoadResearchState({ ownedCells: [{ x: 0, y: 0 }] }),
    new CheatUnlockAllRaids(),
    new CheatUnlockAllGear(),
    new CheatDisableQuestPrereqs({ disabled: true }),
    new CheatGrantRewards({ rewards: [{ kind: 'countable_gear', gearId: 'xeno_bait', amount: 10 }] }),
    new CheatLearnSignatures({ signatureIds: Object.keys(signatures) }),
    new CheatCompleteSignatures({ signatureIds: Object.keys(signatures) }),
    // raidItemCheats[0],
    ...raidItemCheats,
    // new CheatLoadResearchState({
    //   ownedCells: [
    //     { x: 0, y: -7 }, { x: 1, y: -7 }, { x: -3, y: -6 }, { x: -1, y: -6 }, { x: 0, y: -6 }, { x: 1, y: -6 },
    //     { x: 6, y: -6 }, { x: 7, y: -6 }, { x: -3, y: -5 }, { x: -2, y: -5 }, { x: -1, y: -5 }, { x: 0, y: -5 },
    //     { x: 5, y: -5 }, { x: 6, y: -5 }, { x: 7, y: -5 }, { x: -4, y: -4 }, { x: -3, y: -4 }, { x: -1, y: -4 },
    //     { x: 5, y: -4 }, { x: 6, y: -4 }, { x: -2, y: -3 }, { x: 4, y: -3 }, { x: -2, y: -2 }, { x: 3, y: -2 },
    //     { x: -2, y: -1 }, { x: 3, y: -1 }, { x: 6, y: -1 }, { x: 7, y: -1 }, { x: -2, y: 0 }, { x: 0, y: 0 },
    //     { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: -2, y: 1 },
    //     { x: -1, y: 1 }, { x: 2, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: -3, y: 2 }, { x: -1, y: 2 },
    //     { x: 1, y: 2 }, { x: -4, y: 3 }, { x: -1, y: 3 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: -6, y: 4 },
    //     { x: -5, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: -7, y: 5 }, { x: -6, y: 5 }, { x: -5, y: 5 },
    //     { x: -4, y: 5 }, { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: -7, y: 6 }, { x: -6, y: 6 },
    //     { x: -4, y: 6 }, { x: 0, y: 6 }, { x: 1, y: 6 }, { x: -4, y: 7 }, { x: -3, y: 7 }, { x: -3, y: 8 },
    //   ],
    // }),
  ];
}
