import type { GameState } from '../GameState';
import { globalInputQueue } from '../Model';
import type { CmdInput } from './InputCommands';
import { CmdStartRaid, CmdAdvanceTime, CmdAknowledgeOutcome, CmdStartRefining, CmdMazeMove, CmdMazeReset, type MazeDir, CmdMazeRestart, CmdSelectRaid, CmdToggleGear, CmdToggleQuest, CmdGrowWafer, CmdResearchNode, CmdUpgradeGearCategory, CmdPlaceMolecule, CmdRemoveMolecule, CmdOpenGearUpgradeModal, CmdMarkEssencesSeen } from './InputCommands';
import { discover } from '../Discover';
import { DISCOVERY } from '../DiscoveryLib';
import { EvtRefineryDone } from '../evt/Evt';
import { computeRefinePreviewChem, computeEffectiveEssences } from '../RefinePreview';
import type { Point2 } from '../core/math';
import { runRaid, recomputeActiveRaidParams, toggleGearForRaid, recomputeActiveRaidEstimates, getEffectiveRaidDefinition } from '../Raid';
import { pickAndApplyRaidSuccessMutation, describeMutation, questIsAvailable } from '../RaidMutation';
import { placeMolecule, removeMolecule, enableCellWithFloodfill, computeWaferUpgradePrice } from '../Wafer';
import { applyResearchPurchase } from '../Research';

type Handler = (gs: GameState, cmd: CmdInput) => void;
const handlersByName = new Map<string, Handler>();

handlersByName.set('CmdAdvanceTime', (gs, cmd) => {
  gs.timeActive = true;
});

handlersByName.set('CmdMarkEssencesSeen', (gs, cmd) => {
  for (const k of Object.keys(gs.encounteredEssences)) {
    gs.seenEssences[k] = true;
  }
});

handlersByName.set('CmdStartRaid', (gs, cmd) => {
  const c = cmd as CmdStartRaid;
  const def = getEffectiveRaidDefinition(gs, c.id);
  if (!gs.unlockedRaids.some(r => r.id === c.id))
    return;

  gs.activeQuests = gs.activeQuests.filter(qid => !gs.completedQuests.includes(qid));

  recomputeActiveRaidParams(gs, c.id);

  const listAvailableQuestIdsAllRaids = (): string[] => {
    const raidIds = gs.unlockedRaids.map(r => r.id);
    const out: string[] = [];
    gs.lib.quests.forEach((q) => {
      for (const raidId of raidIds) {
        if (questIsAvailable(gs, q, raidId)) {
          out.push(q.id);
          break;
        }
      }
    });
    return out.sort();
  };

  const availableQuestIdsBefore = listAvailableQuestIdsAllRaids();

  const gearCost = Math.floor(gs.selectedGearPrice);
  if (gearCost > 0) {
    if (gs.credits < gearCost) return;
    gs.credits -= gearCost;
  }

  const result = runRaid(gs, def);

  gs.gameTime += result.timeSpentSec;

  const raidEntry = gs.unlockedRaids.find(r => r.id === c.id)!;
  raidEntry.tmpLootBuff = gs.raid.tmpLootBuffNextRaidPct;

  if (result.success) {
    for (const [id, qty] of Object.entries(result.bagItemCounts)) {
      const q = qty | 0;
      if (q <= 0) continue;
      const essence = gs.lib.getItem(id).essence;
      for (const [k, v] of Object.entries(essence)) {
        if (!v) continue;
        gs.encounteredEssences[k] = true;
      }
      const existing = gs.items.find(x => x.id === id);
      if (existing) existing.quantity += q;
      else gs.items.push({ id, quantity: q });
    }
  }

  let zoneChange: string | null = null;
  if (result.success) {
    const chosen = pickAndApplyRaidSuccessMutation(gs, c.id);
    if (chosen) {
      zoneChange = describeMutation(gs, chosen.mutation);
    }
  }

  const availableQuestIdsAfter = result.success ? listAvailableQuestIdsAllRaids() : availableQuestIdsBefore;
  const newQuestsAvailable = availableQuestIdsAfter.filter(id => !availableQuestIdsBefore.includes(id));

  gs.lastRaidOutcome = {
    id: c.id,
    questsDone: result.questsCompleted.length,
    success: result.success,
    questDeltaPct: 0,
    unlockedRaidId: null,
    log: result.log,
    timeSpentSec: result.timeSpentSec,
    plannedEncounters: result.plannedEncounters,
    looted: Object.entries(result.bagItemCounts)
      .map(([id, quantity]) => ({ id, quantity: quantity | 0 }))
      .filter(it => it.quantity > 0),
    discarded: Object.entries(result.discardedItemCounts)
      .map(([id, quantity]) => ({ id, quantity: quantity | 0 }))
      .filter(it => it.quantity > 0),
    questsCompleted: result.questsCompleted,
    rewardsApplied: result.rewardsApplied,
    raidMutationsApplied: result.raidMutationsApplied,
    raidItemsAdded: result.raidItemsAdded,
    lootChanceDeltaApplied: result.lootChanceDeltaApplied,
    lootingRarityBuffDeltaApplied: result.lootingRarityBuffDeltaApplied,
    newQuestsAvailable,
    zoneChange,
    finalHp: gs.raid.hp,
    finalMaxHp: gs.raid.maxHp,
    finalBagsUsed: gs.raid.usedVolume,
    finalBagsCapacity: gs.raid.bagsVolume,
    barelyInTime: result.barelyInTime,
  };

  recomputeActiveRaidParams(gs, c.id);
  recomputeActiveRaidEstimates(gs, 100);
});

handlersByName.set('CmdStartRefining', (gs, cmd) => {
  if (gs.nextEvt && gs.nextEvt.name === 'EvtRefineryDone') return;

  // Items are removed from inventory as they are placed onto the wafer.
  let hasAny = false;
  for (const placed of gs.wafer.items) {
    if (placed) { hasAny = true; break; }
  }
  if (!hasAny) return;

  const preview = computeRefinePreviewChem(gs.wafer);
  gs.refiningDuration = Math.max(0, Math.round(preview.timeSec));

  const duration = gs.refiningDuration;
  gs.nextEvt = new EvtRefineryDone({ at: gs.gameTime + duration });
  gs.timeActive = true;
});

handlersByName.set('CmdAknowledgeOutcome', (gs, cmd) => {
  gs.lastRaidOutcome = null;
});

handlersByName.set('CmdAcknowledgeRefineryOutcome', (gs, cmd) => {
  gs.lastRefineryOutcome = null;
});

handlersByName.set('CmdMazeMove', (gs, cmd) => {
  const c = cmd as CmdMazeMove;
  const deltaByDir: Record<MazeDir, Point2> = {
    up: { x: 0, y: -1 },
    left: { x: -1, y: 0 },
    down: { x: 0, y: 1 },
    right: { x: 1, y: 0 },
  };
  const maze = gs.maze!;
  maze.timeFluxAvailable = Math.floor(gs.timeFlux);
  maze.tryMove(deltaByDir[c.dir], c.dir);
  gs.timeFlux = maze.timeFluxAvailable;
});

handlersByName.set('CmdMazeReset', (gs, cmd) => {
  gs.labirinthResetRequested = true;
});

handlersByName.set('CmdMazeRestart', (gs, cmd) => {
  // Restart current level without regenerating layout (same seed/settings)
  const maze = gs.maze!;
  gs.timeFlux += maze.movesMade;
  maze.timeFluxAvailable = Math.floor(gs.timeFlux);
  maze.reset();
});

handlersByName.set('CmdSelectRaid', (gs, cmd) => {
  const c = cmd as CmdSelectRaid;
  if (!gs.lib.raids.has(c.id)) throw new Error(`CmdSelectRaid: unknown raid id "${c.id}"`);
  if (!gs.unlockedRaids.some(r => r.id === c.id)) return;
  recomputeActiveRaidParams(gs, c.id);
  recomputeActiveRaidEstimates(gs, 100);
});

handlersByName.set('CmdToggleGear', (gs, cmd) => {
  const c = cmd as CmdToggleGear;
  toggleGearForRaid(gs, c.raidId, c.gearId, c.selected);
  recomputeActiveRaidEstimates(gs, 100);
});

handlersByName.set('CmdToggleQuest', (gs, cmd) => {
  const c = cmd as CmdToggleQuest;
  const id = c.id;
  const q = gs.lib.quests.get(id)!;
  if (q.autoaccept) return;
  if (gs.completedQuests.includes(id)) return;
  const list = gs.activeQuests;
  const i = list.indexOf(id);
  if (c.active) {
    if (i === -1) list.push(id);
  } else {
    if (i !== -1) list.splice(i, 1);
  }
  recomputeActiveRaidEstimates(gs, 100);
});

handlersByName.set('CmdPlaceMolecule', (gs, cmd) => {
  const c = cmd as CmdPlaceMolecule;
  const itemId = c.itemId;

  const invEntry = gs.items.find(x => x.id === itemId);
  if (!invEntry || invEntry.quantity <= 0) return;

  const placed = placeMolecule(gs.wafer, itemId, c.molecule, c.rotation);
  if (!placed) return;

  invEntry.quantity -= 1;
  if (invEntry.quantity <= 0) {
    const idx = gs.items.indexOf(invEntry);
    if (idx !== -1) gs.items.splice(idx, 1);
  }

  computeEffectiveEssences(gs.wafer);
});

  handlersByName.set('CmdRemoveMolecule', (gs, cmd) => {
    const c = cmd as CmdRemoveMolecule;

  const existing = gs.wafer.items[c.itemIdx]!;
  removeMolecule(gs.wafer, c.itemIdx);
  computeEffectiveEssences(gs.wafer);

  const itemId = existing.id;

  const essence = gs.lib.getItem(itemId).essence;
  for (const [k, v] of Object.entries(essence)) {
    if (!v) continue;
    gs.encounteredEssences[k] = true;
  }
  const invEntry = gs.items.find(x => x.id === itemId);
  if (invEntry) invEntry.quantity += 1;
  else gs.items.push({ id: itemId, quantity: 1 });
});

handlersByName.set('CmdGrowWafer', (gs, cmd) => {
  const c = cmd as CmdGrowWafer;

  const upgradesPurchased = gs.waferUpgradesPurchased;
  const price = computeWaferUpgradePrice(upgradesPurchased);
  const currentShards = gs.shardDust;
  if (currentShards < price) return;

  const added = enableCellWithFloodfill(gs.wafer, c.pos);
  if (added <= 0) return;

  gs.shardDust = currentShards - price;
  gs.waferUpgradesPurchased = upgradesPurchased + 1;
  computeEffectiveEssences(gs.wafer);
});

handlersByName.set('CmdResearchNode', (gs, cmd) => {
  const c = cmd as CmdResearchNode;
  const lib = gs.lib.research;
  const result = applyResearchPurchase(gs, lib, c.pos.x, c.pos.y);
  if (result.success && gs.raid.id) {
    recomputeActiveRaidParams(gs, gs.raid.id);
    recomputeActiveRaidEstimates(gs, 100);
  }
});

handlersByName.set('CmdUpgradeGearCategory', (gs, cmd) => {
  const c = cmd as CmdUpgradeGearCategory;
  const catId = c.categoryId;

  const def = gs.lib.gearCategories.get(catId)!;

  if (def.hidden || def.unlimited) return;

  const costs = def.unlockCost;
  const currentSlots = gs.gearLevels[catId] ?? 0;
  const nextIndex = currentSlots - 1; // costs[0] is for 2nd slot (from 1 to 2)

  if (nextIndex < 0 || nextIndex >= costs.length) return;

  const cost = costs[nextIndex] || 0;
  const currentSP = gs.skillPoints;

  if (currentSP < cost) return;

  gs.skillPoints = currentSP - cost;
  gs.gearLevels[catId] = currentSlots + 1;
});

handlersByName.set('CmdOpenGearUpgradeModal', (gs) => {
  discover(gs, DISCOVERY.GEAR_UPGRADE_MODAL_OPENED);
});


export function processInputs(gameState: GameState): void {
  for (const command of globalInputQueue) {
    const handler = handlersByName.get(command.name);
    if (!handler) throw new Error(`[InputProcessor] No handler for command: ${command.name}`);
    handler(gameState, command);
  }
  globalInputQueue.length = 0;
}
