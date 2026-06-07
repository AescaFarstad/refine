import type { GameState, RaidOutcome } from './GameState';
import type { AchiDefinition } from './AchiLib';
import type { MazeResourceKey } from './pane/MazeOverlayState';
import type { GameNotif, NotifMazeMoveCommitted, NotifMazeRunDone, NotifNexusUpgradePlaced, NotifNexusUpgradesRefunded, NotifRefiningComplete, NotifRaidComplete } from './GameNotif';
import type { FightEncounterLogEntry } from './RaidLog';

export const ACHI_STATE_UNTRACKED = 0;
export const ACHI_STATE_TRACKED = 1;
export const ACHI_STATE_COMPLETE = 2;
export const ACHI_STATE_ACKNOWLEDGED = 3;

export type AchiProgressState =
  | typeof ACHI_STATE_TRACKED
  | typeof ACHI_STATE_COMPLETE
  | typeof ACHI_STATE_ACKNOWLEDGED;

export interface AchiState {
  state: AchiProgressState;
  best: number;
  projectedValue: number;
}

export function trackAchi(gs: GameState, id: string): boolean {
  if (gs.achi[id]) return false;
  gs.achi[id] = {
    state: ACHI_STATE_TRACKED,
    best: 0,
    projectedValue: 0,
  };
  gs.achiVersion++;
  return true;
}

export function getAchiPayTarget(def: AchiDefinition): MazeResourceKey {
  return def.paramStr as MazeResourceKey;
}

export function getAchiPayOwned(gs: GameState, def: AchiDefinition): number {
  const target = getAchiPayTarget(def);
  switch (target) {
    case 'credits':
      return gs.credits;
    case 'chronotraces':
      return gs.chronotraces;
    case 'shardDust':
      return gs.shardDust;
    case 'zone_crystal':
    case 'fractal':
    case 'spice':
    case 'philosophers_stone':
      return gs.countableGear[target] ?? 0;
  }
}

function deductAchiPayTarget(gs: GameState, def: AchiDefinition): void {
  const target = getAchiPayTarget(def);
  switch (target) {
    case 'credits':
      gs.credits -= def.paramNum;
      return;
    case 'chronotraces':
      gs.chronotraces -= def.paramNum;
      return;
    case 'shardDust':
      gs.shardDust -= def.paramNum;
      return;
    case 'zone_crystal':
    case 'fractal':
    case 'spice':
    case 'philosophers_stone': {
      const remaining = (gs.countableGear[target] ?? 0) - def.paramNum;
      if (remaining > 0) {
        gs.countableGear[target] = remaining;
      } else {
        delete gs.countableGear[target];
      }
      return;
    }
  }
}

export function acknowledgeAchi(gs: GameState, id: string): boolean {
  const state = gs.achi[id];
  if (!state || state.state !== ACHI_STATE_COMPLETE) return false;
  state.state = ACHI_STATE_ACKNOWLEDGED;
  gs.achiVersion++;
  return true;
}

export function payAchi(gs: GameState, id: string): boolean {
  const def = gs.lib.achi.items.get(id)!;
  if (def.type !== 'pay') return false;

  const state = gs.achi[id];
  if (!state || state.state >= ACHI_STATE_COMPLETE) return false;
  if (getAchiPayOwned(gs, def) < def.paramNum) return false;

  deductAchiPayTarget(gs, def);
  state.state = ACHI_STATE_ACKNOWLEDGED;
  state.best = def.paramNum;
  state.projectedValue = 0;
  gs.achiVersion++;
  return true;
}

type GameNotifHandler = (gs: GameState, notif: GameNotif) => void;

function updateTrackedEarnAchi(gs: GameState, handler: string, value: number): void {
  let changed = false;
  for (const [id, state] of Object.entries(gs.achi)) {
    if (state.state !== ACHI_STATE_TRACKED) continue;

    const def = gs.lib.achi.items.get(id)!;
    if (def.type !== 'earn') continue;
    if (def.handler !== handler) continue;

    const nextBest = Math.max(state.best, value);
    if (nextBest !== state.best) {
      state.best = nextBest;
      changed = true;
    }
    if (state.best >= def.paramNum) {
      state.state = ACHI_STATE_COMPLETE;
      state.projectedValue = 0;
      changed = true;
    }
  }
  if (changed) {
    gs.achiVersion++;
  }
}

function setTrackedEarnAchi(gs: GameState, handler: string, value: number): void {
  let changed = false;
  for (const [id, state] of Object.entries(gs.achi)) {
    if (state.state !== ACHI_STATE_TRACKED) continue;

    const def = gs.lib.achi.items.get(id)!;
    if (def.type !== 'earn') continue;
    if (def.handler !== handler) continue;

    if (state.best !== value) {
      state.best = value;
      changed = true;
    }
    if (state.best >= def.paramNum) {
      if (state.state !== ACHI_STATE_COMPLETE) {
        state.state = ACHI_STATE_COMPLETE;
        state.projectedValue = 0;
        changed = true;
      }
    }
  }
  if (changed) {
    gs.achiVersion++;
  }
}

function incrementTrackedEarnAchi(gs: GameState, handler: string, amount: number): void {
  let changed = false;
  for (const [id, state] of Object.entries(gs.achi)) {
    if (state.state !== ACHI_STATE_TRACKED) continue;

    const def = gs.lib.achi.items.get(id)!;
    if (def.type !== 'earn') continue;
    if (def.handler !== handler) continue;

    state.best += amount;
    changed = true;
    if (state.best >= def.paramNum) {
      state.state = ACHI_STATE_COMPLETE;
      state.projectedValue = 0;
    }
  }
  if (changed) {
    gs.achiVersion++;
  }
}

function setProjectedEarnAchi(gs: GameState, handler: string, value: number): void {
  let changed = false;
  for (const [id, state] of Object.entries(gs.achi)) {
    if (state.state !== ACHI_STATE_TRACKED) continue;

    const def = gs.lib.achi.items.get(id)!;
    if (def.type !== 'earn') continue;
    if (def.handler !== handler) continue;

    if (state.projectedValue !== value) {
      state.projectedValue = value;
      changed = true;
    }
  }
  if (changed) {
    gs.achiVersion++;
  }
}

function clearProjectedEarnAchi(gs: GameState, handler: string): void {
  setProjectedEarnAchi(gs, handler, 0);
}

function processMazeMoveCommittedNotif(gs: GameState, _notif: NotifMazeMoveCommitted): void {
  const m = gs.maze;
  setProjectedEarnAchi(gs, 'mine_maze_chrono', m.collectedChronotraces);
  setProjectedEarnAchi(gs, 'mine_maze_credits', m.collectedCredits);
  setProjectedEarnAchi(gs, 'visit_maze_nodes', m.visitedNodeCount);
  setProjectedEarnAchi(gs, 'visit_unique_maze_cells', m.uniqueCellsVisitedCount);
}

function updateTrackedKillMonsterAchi(gs: GameState, outcome: RaidOutcome): void {
  let changed = false;
  for (const [id, state] of Object.entries(gs.achi)) {
    if (state.state !== ACHI_STATE_TRACKED) continue;

    const def = gs.lib.achi.items.get(id)!;
    if (def.type !== 'earn') continue;
    if (def.handler !== 'kill_monster') continue;
    if (!raidOutcomeKilledMonster(outcome, def.paramStr)) continue;

    state.best = def.paramNum;
    state.projectedValue = 0;
    state.state = ACHI_STATE_COMPLETE;
    changed = true;
  }
  if (changed) {
    gs.achiVersion++;
  }
}

function fightKilledMonster(entry: FightEncounterLogEntry): boolean {
  if (entry.skipped) return false;
  if (entry.dieFromOvertime) return false;
  if (entry.selfDestructed) return false;
  for (const event of entry.fightLog) {
    if (event.selfDestructed) return false;
    if (event.theirHpAfter <= 0) return true;
  }
  return false;
}

function raidOutcomeKilledMonster(outcome: RaidOutcome, monsterId: string): boolean {
  for (const entry of outcome.log.entries) {
    if (entry.kind !== 'FightEncounter') continue;
    if (entry.monsterId !== monsterId) continue;
    if (fightKilledMonster(entry)) return true;
  }
  return false;
}

function processRefiningCompleteNotif(gs: GameState, notif: NotifRefiningComplete): void {
  updateTrackedEarnAchi(gs, 'earn_refining_chrono', notif.chronotracesGained);
  updateTrackedEarnAchi(gs, 'earn_refining_credits', notif.creditsGained);
}

function processMazeRunDoneNotif(gs: GameState, notif: NotifMazeRunDone): void {
  if (notif.completed) {
    updateTrackedEarnAchi(gs, 'mine_maze_chrono', notif.collectedChronotraces);
    updateTrackedEarnAchi(gs, 'mine_maze_credits', notif.collectedCredits);
    updateTrackedEarnAchi(gs, 'visit_maze_nodes', notif.mazeNodesVisited);
    updateTrackedEarnAchi(gs, 'visit_unique_maze_cells', notif.uniqueMazeCellsVisited);
  }
  clearProjectedEarnAchi(gs, 'mine_maze_chrono');
  clearProjectedEarnAchi(gs, 'mine_maze_credits');
  clearProjectedEarnAchi(gs, 'visit_maze_nodes');
  clearProjectedEarnAchi(gs, 'visit_unique_maze_cells');
}

function processRaidCompleteNotif(gs: GameState, notif: NotifRaidComplete): void {
  updateTrackedKillMonsterAchi(gs, notif.outcome);
}

function processNexusUpgradePlacedNotif(gs: GameState, _notif: NotifNexusUpgradePlaced): void {
  incrementTrackedEarnAchi(gs, 'place_nexus_upgrades', 1);
}

function processNexusUpgradesRefundedNotif(gs: GameState, _notif: NotifNexusUpgradesRefunded): void {
  setTrackedEarnAchi(gs, 'place_nexus_upgrades', 0);
}

const gameNotifHandlers = new Map<string, GameNotifHandler>([
  ['NotifRefiningComplete', (gs, notif) => processRefiningCompleteNotif(gs, notif as NotifRefiningComplete)],
  ['NotifMazeMoveCommitted', (gs, notif) => processMazeMoveCommittedNotif(gs, notif as NotifMazeMoveCommitted)],
  ['NotifMazeRunDone', (gs, notif) => processMazeRunDoneNotif(gs, notif as NotifMazeRunDone)],
  ['NotifRaidComplete', (gs, notif) => processRaidCompleteNotif(gs, notif as NotifRaidComplete)],
  ['NotifNexusUpgradePlaced', (gs, notif) => processNexusUpgradePlacedNotif(gs, notif as NotifNexusUpgradePlaced)],
  ['NotifNexusUpgradesRefunded', (gs, notif) => processNexusUpgradesRefundedNotif(gs, notif as NotifNexusUpgradesRefunded)],
]);

export function processAchiNotifs(gs: GameState, notifs: GameNotif[]): void {
  for (const notif of notifs) {
    const handler = gameNotifHandlers.get(notif.name);
    if (!handler) throw new Error(`[Achi] No handler for game notif: ${notif.name}`);
    handler(gs, notif);
  }
}
