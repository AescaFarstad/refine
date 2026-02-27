import { Raid, type GameState } from './GameState';
import { uiState } from './UIState';
import { DISCOVERY } from './DiscoveryLib';
import { CheatAddResources, CheatLoadResearchState, CheatUnlockAllRaids, CheatDisableQuestPrereqs, CheatGrantDiscoveries, CheatAddRaidItems, CheatUnlockAllGear, CheatGrantRewards, CheatLearnSignatures, CheatCompleteSignatures, CheatAddItemBans, CheatMaxGearSlots, CheatAddResearchVision, CheatSelectFirstRaid } from './cheat/CheatCommands';
import signatures from '../data/signatures';
import { recomputeActiveRaidEstimates, recomputeActiveRaidParams } from './Raid';
import { readURLSettings } from '../URLSettings';

export function initQuickstart(gameState: GameState): void {
  if (!readURLSettings().quickstart) return;

  gameState.cheats = [
    ...gameState.cheats,
    new CheatGrantDiscoveries({ discoveryIds: [
      DISCOVERY.INTRO_SEEN,
      DISCOVERY.TAB_REFINE, DISCOVERY.TAB_RESEARCH, DISCOVERY.TAB_MAZE,
      DISCOVERY.TAB_REFINE_VISITED, DISCOVERY.TAB_RESEARCH_VISITED, DISCOVERY.TAB_MAZE_VISITED,
      DISCOVERY.UI_GEAR, DISCOVERY.UI_RAID_MONSTERS,
      DISCOVERY.UI_RAID_LOOT, DISCOVERY.UI_RAID_SPEED, DISCOVERY.UI_RAID_SELECTION,
      DISCOVERY.UI_DAMAGE_BREAKDOWN, DISCOVERY.UI_TIME_BREAKDOWN,
      DISCOVERY.UI_WAFER_INFO, DISCOVERY.UI_SIGNATURE_INFO,
      DISCOVERY.DEV,DISCOVERY.ESSENCE_RESEARCH_KNOWLEDGE,
    ]}),
    new CheatSelectFirstRaid(),
  ];
}

export function initDebug(gameState: GameState): void {
  if (!readURLSettings().cheat) return;
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
    // new CheatAddResearchVision({ amount: 1000 }),
    new CheatAddResources({ credits: 100000, chronotraces: 100000, timeFlux: 100000, shardDust: 10000, skillPoints: 0 }),
    // new CheatAddItemBans({ amount: 5 }),
    // new CheatGrantDiscoveries({ discoveryIds: Object.values(DISCOVERY) }),
    new CheatGrantDiscoveries({ discoveryIds: [
      DISCOVERY.INTRO_SEEN, DISCOVERY.DEV,
      DISCOVERY.TAB_REFINE, DISCOVERY.TAB_RESEARCH, DISCOVERY.TAB_MAZE,
      DISCOVERY.TAB_REFINE_VISITED, DISCOVERY.TAB_RESEARCH_VISITED, DISCOVERY.TAB_MAZE_VISITED,
      DISCOVERY.UI_GEAR, DISCOVERY.UI_SHARDS, DISCOVERY.UI_RAID_MONSTERS,
      DISCOVERY.UI_RAID_LOOT, DISCOVERY.UI_RAID_SPEED, DISCOVERY.UI_RAID_SELECTION,
      DISCOVERY.UI_DAMAGE_BREAKDOWN, DISCOVERY.UI_TIME_BREAKDOWN,
      DISCOVERY.UI_WAFER_INFO, DISCOVERY.UI_SIGNATURE_INFO,
      DISCOVERY.ESSENCE_RESEARCH_KNOWLEDGE,
    ]}),
    new CheatUnlockAllRaids(),
    new CheatSelectFirstRaid(),
    new CheatUnlockAllGear(),
    new CheatMaxGearSlots(),
    new CheatDisableQuestPrereqs({ disabled: true }),
    new CheatGrantRewards({ rewards: [{ kind: 'countable_gear', gearId: 'xeno_bait', amount: 10 }] }),
    new CheatGrantRewards({ rewards: [{ kind: 'countable_gear', gearId: 'zone_crystal', amount: 10 }] }),
    // new CheatLearnSignatures({ signatureIds: Object.keys(signatures) }),
    // new CheatCompleteSignatures({ signatureIds: Object.keys(signatures) }),
    // raidItemCheats[0],
    // ...raidItemCheats,
  ];
}
