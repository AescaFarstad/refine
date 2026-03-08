import type { GameState } from '../GameState';
import { globalInputQueue } from '../Model';
import type { CmdInput } from './InputCommands';
import { CmdStartRaid, CmdAdvanceTime, CmdAcknowledgeOutcome, CmdConsumeOutcomeRewards, CmdAcknowledgeSignatureLearn, CmdAcknowledgeSignaturePlacementDiscovery, CmdPreviewSignature, CmdStartRefining, CmdSelectRaid, CmdToggleGear, CmdToggleQuest, CmdReviewQuest, CmdGrowWafer, CmdResearchNode, CmdUpgradeGearCategory, CmdPlaceMolecule, CmdRemoveMolecule, CmdOpenGearUpgradeModal, CmdDiscover, CmdMarkEssencesSeen, CmdSwitchTab, CmdDismissUIModal, CmdToggleItemBan, CmdDismissIntro, CmdPickupShard, CmdSpeedUpRefining, CmdClearShardPickupGrace, CmdMazeMoveTo, CmdMazePrepareUpgradeOffer, CmdMazeSelectNexusUpgrade, CmdMazePlaceNexusItem, CmdMazeActivateNexusSpecialUpgrade, CmdMazeResetHighMovement } from './InputCommands';
import { SHARD_PICKUP_DELAY_SEC } from '../Model';
import { discover, discoverRefineTab, ensureSignatureDiscoveryFromWafer } from '../Discover';
import { DISCOVERY } from '../DiscoveryLib';
import { computeEffectiveEssences } from '../RefinePreview';
import { runRaid, recomputeActiveRaidParams, toggleGearForRaid, recomputeActiveRaidEstimates, getEffectiveRaidDefinition, accumulateRaidResources, getLoadoutPassiveCreditsPerHour, getLoadoutResourceStorageBonus } from '../Raid';
import { pickAndApplyRaidSuccessMutation, describeMutation, questIsAvailable } from '../RaidMutation';
import { getRaidGearCost, getRaidStartFailureReason } from '../useRaidAgain';
import { placeMolecule, removeMolecule, enableCellWithFloodfill, computeWaferUpgradePrice } from '../Wafer';
import { applyResearchPurchase } from '../Research';
import { startRefining } from '../Refine';
import { applyReward } from '../Reward';
import { saveAutosave } from '../SaveLoad';
import { handleMazeMoveTo, computeMazeResourceSpawns, syncMazeResetEntranceCell, placeMazeNexusItem, isMazeEntranceCell } from '../Maze';
import { prepareMazeNexusUpgradeOffer, selectMazeNexusUpgrade, onMazeNexusUpgradePlaced, activateMazeNexusSpecialUpgrade } from '../MazeNexusUpgradeProgress';
import { uiState } from '../UIState';


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


  const startFailureReason = getRaidStartFailureReason(gs, c.id);
  if (startFailureReason) return;

  const gearCost = getRaidGearCost(gs, c.id);
  if (gearCost > 0) {
    gs.credits -= gearCost;
  }

  // Consume countable gear items
  const loadout = gs.loadouts[c.id] || [];
  const gearToRemove: string[] = [];
  for (const gearId of [...loadout]) {
    const gearDef = gs.lib.gear.get(gearId);
    if (gearDef?.countable) {
      const currentCount = gs.countableGear[gearId] || 0;
      if (currentCount > 0) {
        gs.countableGear[gearId] = currentCount - 1;
        // Mark for removal if depleted, but don't remove yet
        if (gs.countableGear[gearId] <= 0) {
          gearToRemove.push(gearId);
        }
      }
    }
  }

  const result = runRaid(gs, def, false, c.materializationItemId);

  if (result.reimbursedCredits) {
    gs.credits += result.reimbursedCredits;
  }

  const raidEntry = gs.unlockedRaids.find(r => r.id === c.id)!;
  const loadoutPassiveCreditsPerHour = getLoadoutPassiveCreditsPerHour(gs, c.id);
  const loadoutResourceStorageBonus = getLoadoutResourceStorageBonus(gs, c.id);
  gs.gameTime += result.timeSpentSec;
  accumulateRaidResources(gs, result.timeSpentSec);

  if (result.success && loadoutPassiveCreditsPerHour > 0) {
    raidEntry.passiveCreditsPerHour += loadoutPassiveCreditsPerHour;
  }
  if (result.success && loadoutResourceStorageBonus > 0) {
    raidEntry.maxStoredCredits += loadoutResourceStorageBonus;
  }

  // cleanup empty countable gear from loadout
  for (const gid of gearToRemove) {
    const idx = loadout.indexOf(gid);
    if (idx !== -1) loadout.splice(idx, 1);
  }

  raidEntry.tmpLootBuff = gs.raid.tmpLootBuffNextRaidPct;

  {
    const found = new Set<string>(raidEntry.foundItemIds);
    for (const [id, qty] of Object.entries(result.bagItemCounts)) {
      if ((qty | 0) > 0) found.add(id);
    }
    for (const [id, qty] of Object.entries(result.discardedItemCounts)) {
      if ((qty | 0) > 0) found.add(id);
    }
    const next = Array.from(found);
    next.sort((a, b) => {
      const ao = gs.lib.getItem(a).order;
      const bo = gs.lib.getItem(b).order;
      if (ao !== bo) return ao - bo;
      return a.localeCompare(b);
    });
    const prev = raidEntry.foundItemIds;
    let changed = prev.length !== next.length;
    if (!changed) {
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== prev[i]) { changed = true; break; }
      }
    }
    if (changed) {
      raidEntry.foundItemIds = next;
      gs.raidFoundItemsVersion++;
    }
  }

  if (result.success) {
    let hasLootedItems = false;
    for (const [id, qty] of Object.entries(result.bagItemCounts)) {
      const q = qty | 0;
      if (q <= 0) continue;
      hasLootedItems = true;
      const essence = gs.lib.getItem(id).essence;
      for (const [k, v] of Object.entries(essence)) {
        if (!v) continue;
        gs.encounteredEssences[k] = true;
      }
      const prevQty = gs.items[id] ?? 0;
      gs.items[id] = prevQty + q;
    }
    if (hasLootedItems) {
      discoverRefineTab(gs);
    }
  }

  let zoneChange: { label: string; value: string } | null = null;
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
    rewardsConsumed: false,
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
    reimbursedCredits: result.reimbursedCredits || 0,
    zoneCollapseSec: def.zoneCollapseSec,
  };

  recomputeActiveRaidParams(gs, c.id);
  recomputeActiveRaidEstimates(gs, 100);
  saveAutosave(gs);
});

handlersByName.set('CmdStartRefining', (gs, cmd) => {
  startRefining(gs);
});

handlersByName.set('CmdAcknowledgeOutcome', (gs, cmd) => {
  // Safety net
  if (gs.lastRaidOutcome && !gs.lastRaidOutcome.rewardsConsumed) {
    const outcome = gs.lastRaidOutcome;
    const raidId = outcome.id;
    const raidEntry = gs.unlockedRaids.find(r => r.id === raidId);
    for (const reward of outcome.rewardsApplied) {
      applyReward(gs, reward, { activeRaidId: raidId, raidEntry });
    }
    outcome.rewardsConsumed = true;
  }
  gs.acknowledgedRaidOutcome = gs.lastRaidOutcome;
  gs.lastRaidOutcome = null;
  saveAutosave(gs);
});

handlersByName.set('CmdConsumeOutcomeRewards', (gs, cmd) => {
  const outcome = gs.lastRaidOutcome;
  if (!outcome || outcome.rewardsConsumed) return;

  const raidId = outcome.id;
  const raidEntry = gs.unlockedRaids.find(r => r.id === raidId);
  for (const reward of outcome.rewardsApplied) {
    applyReward(gs, reward, { activeRaidId: raidId, raidEntry });
  }
  outcome.rewardsConsumed = true;
  saveAutosave(gs);
});

handlersByName.set('CmdAcknowledgeSignatureLearn', (gs, cmd) => {
  if (gs.signatureLearnQueue.length > 0) {
    gs.signatureLearnQueue.shift();
  }
});

handlersByName.set('CmdAcknowledgeSignaturePlacementDiscovery', (gs, cmd) => {
  gs.signaturePlacementDiscoveryId = '';
});

handlersByName.set('CmdPreviewSignature', (gs, cmd) => {
  const c = cmd as CmdPreviewSignature;
  gs.lib.signatures.get(c.id)!;
  gs.signatureLearnQueue.push(c.id);
});

handlersByName.set('CmdAcknowledgeRefineryOutcome', (gs, cmd) => {
  gs.lastRefineryOutcome = null;
});

handlersByName.set('CmdSelectRaid', (gs, cmd) => {
  const c = cmd as CmdSelectRaid;
  if (!gs.lib.raids.has(c.id)) throw new Error(`CmdSelectRaid: unknown raid id "${c.id}"`);
  if (!gs.unlockedRaids.some(r => r.id === c.id)) return;
  discover(gs, DISCOVERY.UI_RAID_SELECTION);

  // Show "You Won" popup when switching to the fourth raid for the first time
  const raidIndex = gs.unlockedRaids.findIndex(r => r.id === c.id);
  if (raidIndex === 3 && !gs.discoveries[DISCOVERY.YOU_WON_SEEN]) {
    gs.discoveries[DISCOVERY.YOU_WON_SEEN] = true;
    gs.pendingUIModals.push({ ui: 'you_won' });
  }

  recomputeActiveRaidParams(gs, c.id);
  recomputeActiveRaidEstimates(gs, 100);
  saveAutosave(gs);
});

handlersByName.set('CmdToggleGear', (gs, cmd) => {
  const c = cmd as CmdToggleGear;
  toggleGearForRaid(gs, c.raidId, c.gearId, c.selected);
  recomputeActiveRaidEstimates(gs, 100);
  saveAutosave(gs);
});

handlersByName.set('CmdToggleQuest', (gs, cmd) => {
  const c = cmd as CmdToggleQuest;
  const id = c.id;
  const q = gs.lib.quests.get(id)!;
  if (q.autoaccept) return;
  if (gs.completedQuests.includes(id)) return;
  const list = gs.activeQuests;
  const i = list.indexOf(id);
  let changed = false;
  if (c.active) {
    if (i === -1) {
      list.push(id);
      changed = true;
    }
  } else {
    if (i !== -1) {
      list.splice(i, 1);
      changed = true;
    }
  }
  if (changed) {
    recomputeActiveRaidEstimates(gs, 100);
    saveAutosave(gs);
  }
});

handlersByName.set('CmdReviewQuest', (gs, cmd) => {
  const c = cmd as CmdReviewQuest;
  if (!gs.reviewedQuestIds.includes(c.id)) {
    gs.reviewedQuestIds.push(c.id);
  }
});

handlersByName.set('CmdPlaceMolecule', (gs, cmd) => {
  const c = cmd as CmdPlaceMolecule;
  const itemId = c.itemId;

  const invQty = gs.items[itemId] ?? 0;
  if (invQty <= 0) return;

  const placed = placeMolecule(gs.wafer, itemId, c.molecule, c.rotation);
  if (!placed) return;

  const nextQty = invQty - 1;
  if (nextQty <= 0) {
    delete gs.items[itemId];
  } else {
    gs.items[itemId] = nextQty;
  }

  computeEffectiveEssences(gs.wafer);
  ensureSignatureDiscoveryFromWafer(gs);
  discover(gs, DISCOVERY.UI_WAFER_INFO);
  saveAutosave(gs);
});

handlersByName.set('CmdRemoveMolecule', (gs, cmd) => {
  const c = cmd as CmdRemoveMolecule;

  const existing = gs.wafer.items[c.itemIdx]!;
  removeMolecule(gs.wafer, c.itemIdx);
  computeEffectiveEssences(gs.wafer);
  ensureSignatureDiscoveryFromWafer(gs);

  const itemId = existing.id;

  const essence = gs.lib.getItem(itemId).essence;
  for (const [k, v] of Object.entries(essence)) {
    if (!v) continue;
    gs.encounteredEssences[k] = true;
  }
  gs.items[itemId] = (gs.items[itemId] ?? 0) + 1;
  saveAutosave(gs);
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
  ensureSignatureDiscoveryFromWafer(gs);
  saveAutosave(gs);
});

handlersByName.set('CmdResearchNode', (gs, cmd) => {
  const c = cmd as CmdResearchNode;
  const lib = gs.lib.research;
  const hadMazeEntrance = isMazeEntranceCell(gs, gs.mazeResetEntranceCell);
  const result = applyResearchPurchase(gs, lib, c.pos.x, c.pos.y);
  if (result.success && gs.raid.id) {
    recomputeActiveRaidParams(gs, gs.raid.id);
    recomputeActiveRaidEstimates(gs, 100);
  }
  if (result.success) {
    computeMazeResourceSpawns(gs, lib);
    syncMazeResetEntranceCell(gs);
    if (!hadMazeEntrance && isMazeEntranceCell(gs, gs.mazeResetEntranceCell)) {
      gs.maze.avatarCell = { x: gs.mazeResetEntranceCell.x, y: gs.mazeResetEntranceCell.y };
    }
    saveAutosave(gs);
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
  saveAutosave(gs);
});

handlersByName.set('CmdOpenGearUpgradeModal', (gs) => {
  discover(gs, DISCOVERY.UI_GEAR_UPGRADE_MODAL_OPENED);
});

handlersByName.set('CmdDiscover', (gs, cmd) => {
  const c = cmd as CmdDiscover;
  discover(gs, c.discoveryId);
});

handlersByName.set('CmdSwitchTab', (gs, cmd) => {
  const c = cmd as CmdSwitchTab;
  if (!gs.timeActive) {
    gs.activeTab = c.tab;
    // Mark tab as visited
    if (c.tab === 'refine') {
      discover(gs, DISCOVERY.TAB_REFINE_VISITED);
    } else if (c.tab === 'research') {
      discover(gs, DISCOVERY.TAB_RESEARCH_VISITED);
    } else if (c.tab === 'maze') {
      discover(gs, DISCOVERY.TAB_MAZE_VISITED);
    }
  }
});

handlersByName.set('CmdDismissUIModal', (gs, cmd) => {
  const c = cmd as CmdDismissUIModal;
  const idx = gs.pendingUIModals.findIndex(m => m.ui === c.ui);
  if (idx !== -1) {
    gs.pendingUIModals.splice(idx, 1);
  }
  for (const reward of c.rewards) {
    applyReward(gs, reward);
  }
});

handlersByName.set('CmdToggleItemBan', (gs, cmd) => {
  const c = cmd as CmdToggleItemBan;
  const raidEntry = gs.unlockedRaids.find(r => r.id === c.raidId);
  if (!raidEntry) return;

  let changed = false;
  const idx = raidEntry.bannedItemIds.indexOf(c.itemId);
  if (c.banned) {
    if (idx === -1 && raidEntry.bannedItemIds.length < gs.itemBans) {
      raidEntry.bannedItemIds.push(c.itemId);
      changed = true;
    }
  } else {
    if (idx !== -1) {
      raidEntry.bannedItemIds.splice(idx, 1);
      changed = true;
    }
  }
  if (changed) {
    saveAutosave(gs);
  }
});

handlersByName.set('CmdDismissIntro', (gs) => {
  gs.discoveries[DISCOVERY.INTRO_SEEN] = true;
});

handlersByName.set('CmdPickupShard', (gs, cmd) => {
  const c = cmd as CmdPickupShard;
  if (gs.shardPickupGraceSec > 0) return;
  const shard = gs.shards.find(s => s && s.id === c.shardId);
  if (!shard || shard.triggered) return;
  shard.triggered = true;
  shard.pickupDelaySec = SHARD_PICKUP_DELAY_SEC;
  // Physics (vel) is managed in UIState.shardPhysics, not here
});

handlersByName.set('CmdSpeedUpRefining', (gs) => {
  if (!gs.nextEvt || gs.nextEvt.name !== 'EvtRefineryDone') return;
  gs.timeSpeed = (gs.timeSpeed || 1) * 2;
  gs.timeSpeedMaxBoost = (gs.timeSpeedMaxBoost || 1) * 1.2;
});

handlersByName.set('CmdClearShardPickupGrace', (gs) => {
  gs.shardPickupGraceSec = 0;
});

handlersByName.set('CmdMazeMoveTo', (gs, cmd) => {
  const c = cmd as CmdMazeMoveTo;
  const moveResult = handleMazeMoveTo(gs, c.target);
  if (moveResult.success) {
    uiState.mazeNexusMenuOpen = moveResult.nexusReached;
    uiState.mazeTransmutationMenuOpen = moveResult.transmutationReached;
    uiState.mazeOracleMenuOpen = moveResult.oracleReached;
    uiState.mazeVisitedOracleNodeId = moveResult.oracleReached ? moveResult.oracleNodeId : -1;
    if (moveResult.forcedReset) {
      uiState.mazeResetReason = 'warped';
    } else if (moveResult.payout) {
      uiState.mazeResetReason = 'banked';
    }
  }
  saveAutosave(gs);
});

handlersByName.set('CmdMazePrepareUpgradeOffer', (gs) => {
  const prepared = prepareMazeNexusUpgradeOffer(gs);
  if (!prepared) return;
  saveAutosave(gs);
});

handlersByName.set('CmdMazeSelectNexusUpgrade', (gs, cmd) => {
  const c = cmd as CmdMazeSelectNexusUpgrade;
  const selected = selectMazeNexusUpgrade(gs, c.nexusItemId);
  if (!selected) return;
  saveAutosave(gs);
});

handlersByName.set('CmdMazePlaceNexusItem', (gs, cmd) => {
  const c = cmd as CmdMazePlaceNexusItem;
  const placed = placeMazeNexusItem(gs, c.nexusItemId, c.target);
  if (!placed) {
    return;
  }
  onMazeNexusUpgradePlaced(gs, c.nexusItemId);
  gs.maze.version++;
  uiState.mazeVersion = gs.maze.version;
  saveAutosave(gs);
});

handlersByName.set('CmdMazeActivateNexusSpecialUpgrade', (gs, cmd) => {
  const c = cmd as CmdMazeActivateNexusSpecialUpgrade;
  const activated = activateMazeNexusSpecialUpgrade(gs, c.nexusItemId);
  if (!activated) return;
  gs.maze.version++;
  uiState.mazeVersion = gs.maze.version;
  saveAutosave(gs);
});

handlersByName.set('CmdMazeResetHighMovement', (gs) => {
  gs.mazeHighMovementUsed = 0;
  uiState.mazeVersion++;
  saveAutosave(gs);
});

export function processInputs(gameState: GameState): void {
  for (const command of globalInputQueue) {
    const handler = handlersByName.get(command.name);
    if (!handler) throw new Error(`[InputProcessor] No handler for command: ${command.name}`);
    handler(gameState, command);
  }
  globalInputQueue.length = 0;
}
