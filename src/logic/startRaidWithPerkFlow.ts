import { getGameState, uiState } from './UIState';
import { globalInputQueue } from './Model';
import { CmdAcknowledgeOutcome, CmdStartRaid } from './input/InputCommands';
import Perks from './Perks';

function hasMaterializationPerk(raidId: string): boolean {
  const gs = getGameState();
  const loadout = gs.loadouts[raidId] ?? [];
  return loadout.some(gearId => gs.lib.gear.get(gearId)!.perk === Perks.MATERIALIZATION);
}

function getKnownRaidItemIds(raidId: string): string[] {
  const gs = getGameState();
  const raidEntry = gs.unlockedRaids.find(r => r.id === raidId)!;
  return [...raidEntry.foundItemIds];
}

export function clearChooseItemToLootModalState(): void {
  uiState.chooseItemToLootModalOpen = false;
  uiState.chooseItemToLootRaidId = '';
  uiState.chooseItemToLootKnownItemIds = [];
  uiState.chooseItemToLootSelectedItemId = '';
}

export function startRaidWithPerkFlow(raidId: string, acknowledgeOutcome: boolean = false): void {
  if (!raidId) return;

  if (acknowledgeOutcome) {
    globalInputQueue.push(new CmdAcknowledgeOutcome());
  }

  if (!hasMaterializationPerk(raidId)) {
    globalInputQueue.push(new CmdStartRaid({ id: raidId }));
    return;
  }

  const knownItemIds = getKnownRaidItemIds(raidId);
  if (knownItemIds.length === 0) {
    globalInputQueue.push(new CmdStartRaid({ id: raidId }));
    return;
  }

  uiState.chooseItemToLootRaidId = raidId;
  uiState.chooseItemToLootKnownItemIds = knownItemIds;
  uiState.chooseItemToLootSelectedItemId = '';
  uiState.chooseItemToLootModalOpen = true;
}
