import { type GameState, Raid } from '../GameState';
import type { CheatInput } from './CheatCommands';
import { CheatAddRaidItems, CheatUnlockAllGear, CheatAddResources, CheatUnlockAllRaids, CheatLoadResearchState, CheatUnlockAllQuests, CheatDisableQuestPrereqs, CheatGrantDiscoveries, CheatGrantRewards, CheatLearnSignatures, CheatCompleteSignatures, CheatAddItemBans, CheatUnlockAllNexusUpgrades } from './CheatCommands';
import type { EncounterDef } from '../RaidLib';
import { applyResearchNodeEffect, axialToIndex, calculateVisibility } from '../Research';
import { setEnableQuestPrereqs } from '../Const';
import { discover } from '../Discover';
import { applyReward } from '../Reward';
import { undoRewards } from '../RewardsUndo';
import { MAZE_NEXUS_NO_UPGRADE_OFFER_SEED } from '../MazeNexusUpgradeProgress';

type Handler = (gs: GameState, cheat: CheatInput) => void;
const handlersByName = new Map<string, Handler>();

handlersByName.set('CheatAddRaidItems', (gs, cheat) => {
  const c = cheat as CheatAddRaidItems;
  let raidId = c.id;
  let def = gs.lib.raids.get(raidId || '');
  if (!def) {
    const firstId = Array.from(gs.lib.raids.keys())[0];
    if (!firstId) return;
    raidId = firstId;
    def = gs.lib.raids.get(firstId)!;
  }
  const count = Math.max(0, c.count || 0);
  if (count <= 0) return;

  const ids = new Set<string>();
  const raidItems = Array.isArray(def.allPotentialItems) ? def.allPotentialItems : [];
  for (const id of raidItems) {
    ids.add(id);
  }

  for (const step of def.encounters || []) {
    const enc = step.encounter as EncounterDef;
    if (enc.type === 'FightEncounter' || enc.type === 'MonsterLootEncounter') {
      const monsterId = (enc as any).monsterId as string;
      const monster = gs.lib.monsters.get(monsterId);
      if (monster && monster.lootItemId) {
        ids.add(monster.lootItemId);
      }
    }
  }

  function addToInventory(id: string, qty: number): void {
    const essence = gs.lib.getItem(id).essence;
    for (const [k, v] of Object.entries(essence)) {
      if (!v) continue;
      gs.encounteredEssences[k] = true;
    }
    gs.items[id] = (gs.items[id] ?? 0) + qty;
  }

  for (const id of ids) {
    addToInventory(id, count);
  }
});

handlersByName.set('CheatUnlockAllGear', (gs, cheat) => {
  const allGearIds = Array.from(gs.lib.gear.keys());
  gs.unlockedGear = allGearIds;
});

handlersByName.set('CheatAddResources', (gs, cheat) => {
  const c = cheat as CheatAddResources;
  gs.credits += c.credits;
  gs.chronotraces += c.chronotraces;
  gs.timeFlux += c.timeFlux;
  gs.shardDust += c.shardDust;
  gs.skillPoints += c.skillPoints;
});

handlersByName.set('CheatUnlockAllRaids', (gs, cheat) => {
  const allRaidIds = Array.from(gs.lib.raids.keys());
  gs.unlockedRaids = allRaidIds.map(id => new Raid(id));
});

handlersByName.set('CheatLoadResearchState', (gs, cheat) => {
  const c = cheat as CheatLoadResearchState;
  const previouslyOwnedNodes = new Set<number>();
  for (const cell of gs.researchCells) {
    if (cell.owned && cell.nodeId >= 0) {
      previouslyOwnedNodes.add(cell.nodeId);
    }
  }

  const ownedCellIdx = new Set<number>();
  for (const p of c.ownedCells) {
    const idx = axialToIndex(p.x, p.y);
    if (idx < 0) {
      throw new Error(`[CheatLoadResearchState] Out-of-bounds cell: (${p.x}, ${p.y})`);
    }
    if (gs.researchCells[idx].blocked) {
      throw new Error(`[CheatLoadResearchState] Cannot own blocked cell: (${p.x}, ${p.y})`);
    }
    ownedCellIdx.add(idx);
  }

  const nowOwnedNodes = new Set<number>();
  let ownedPaidCells = 0;
  for (let idx = 0; idx < gs.researchCells.length; idx++) {
    const cell = gs.researchCells[idx];
    const isOwned = ownedCellIdx.has(idx) && !cell.blocked;
    cell.owned = isOwned;
    if (isOwned && cell.cost > 0) ownedPaidCells++;
    if (isOwned && cell.nodeId >= 0) nowOwnedNodes.add(cell.nodeId);
  }

  gs.researchOwnedCount = ownedPaidCells;
  for (const nodeId of nowOwnedNodes) {
    if (!previouslyOwnedNodes.has(nodeId)) {
      applyResearchNodeEffect(gs, gs.lib.research, nodeId);
    }
  }
  calculateVisibility(gs, gs.lib.research);
});

handlersByName.set('CheatUnlockAllQuests', (gs, cheat) => {
  const allQuestIds = Array.from(gs.lib.quests.keys());
  gs.completedQuests = allQuestIds;
});

handlersByName.set('CheatDisableQuestPrereqs', (gs, cheat) => {
  const c = cheat as CheatDisableQuestPrereqs;
  setEnableQuestPrereqs(!c.disabled);
});

handlersByName.set('CheatGrantDiscoveries', (gs, cheat) => {
  const c = cheat as CheatGrantDiscoveries;
  for (const id of c.discoveryIds) {
    discover(gs, id);
  }
});

handlersByName.set('CheatGrantRewards', (gs, cheat) => {
  const c = cheat as CheatGrantRewards;
  for (const reward of c.rewards) {
    applyReward(gs, reward);
  }
});

handlersByName.set('CheatLearnSignatures', (gs, cheat) => {
  const c = cheat as CheatLearnSignatures;
  for (const id of c.signatureIds) {
    if (!gs.learnedSignatureIds.includes(id)) {
      gs.learnedSignatureIds.push(id);
    }
  }
});

handlersByName.set('CheatCompleteSignatures', (gs, cheat) => {
  const c = cheat as CheatCompleteSignatures;
  const nextCompleted: string[] = [];
  const nextCompletedSet = new Set<string>();
  for (const id of c.signatureIds) {
    if (nextCompletedSet.has(id)) continue;
    nextCompletedSet.add(id);
    nextCompleted.push(id);
  }

  const previousCompletedSet = new Set<string>(gs.completedSignatureIds);
  for (const id of gs.completedSignatureIds) {
    if (!nextCompletedSet.has(id)) {
      const signature = gs.lib.getSignature(id);
      undoRewards(gs, signature.rewards);
    }
  }

  for (const id of nextCompleted) {
    if (!previousCompletedSet.has(id)) {
      const signature = gs.lib.getSignature(id);
      for (const reward of signature.rewards) {
        applyReward(gs, reward);
      }
    }
  }

  gs.completedSignatureIds = nextCompleted;
});

handlersByName.set('CheatAddItemBans', (gs, cheat) => {
  const c = cheat as CheatAddItemBans;
  gs.itemBans += c.amount;
});

handlersByName.set('CheatUnlockAllNexusUpgrades', (gs) => {
  gs.mazeNexusAvailableUpgradeIds = Array.from(gs.lib.nexusItems.keys());
  gs.mazeNexusUpgradeOpportunityCount = 0;
  gs.mazeNexusUpgradeOfferSeed = MAZE_NEXUS_NO_UPGRADE_OFFER_SEED;
});

export function processCheats(gs: GameState): void {
  // Process and clear queued cheats
  while (gs.cheats.length > 0) {
    const cheat = gs.cheats.shift()!;
    const handler = handlersByName.get(cheat.name);
    if (handler) {
      handler(gs, cheat);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[CheatProcessor] No handler for cheat: ${cheat.name}`);
    }
  }
}
