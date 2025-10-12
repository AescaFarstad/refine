import type { GameState } from '../GameState';
import { globalInputQueue } from '../Model';
import type { CmdInput } from './InputCommands';
import { CmdStartRaid, CmdAdvanceTime, CmdAknowledgeOutcome, CmdLevelup } from './InputCommands';
import { LEVEL_UP_STRENGTH, LEVEL_UP_LOOTING, LEVEL_UP_VOLUME } from '../Const';

type Handler = (gs: GameState, cmd: CmdInput) => void;
const handlersByName = new Map<string, Handler>();

handlersByName.set('CmdAdvanceTime', (gs, cmd) => {
  gs.timeActive = true;
});

handlersByName.set('CmdStartRaid', (gs, cmd) => {
  const c = cmd as CmdStartRaid;
  if (!c.id || gs.raid.id) return;
  gs.raid.id = c.id;
  gs.raid.progress = 0;
  // copy player stats at deployment time
  gs.raid.speed = gs.speed;
  gs.raid.strength = gs.strength;
  gs.raid.volume = gs.volume;
  gs.raid.looting = gs.looting;
  // copy focus weights from UI-provided values
  gs.raid.questWeight = c.quest;
  gs.raid.surviveWeight = c.survive;
  gs.raid.lootWeight = c.loot;
  gs.raid.equipment = c.equipment;
  gs.credits -= c.cost;
});

handlersByName.set('CmdAknowledgeOutcome', (gs, cmd) => {
  // Clear last raid outcome from game state
  gs.lastRaidOutcome = null;
});

handlersByName.set('CmdLevelup', (gs, cmd) => {
  if (gs.levelupsAvailable <= 0) return;
  const c = cmd as CmdLevelup;
  switch (c.stat) {
    case 'strength':
      gs.strength += LEVEL_UP_STRENGTH;
      break;
    case 'volume':
      gs.volume += LEVEL_UP_VOLUME;
      break;
    case 'looting':
      gs.looting += LEVEL_UP_LOOTING;
      break;
  }
  gs.levelupsAvailable = Math.max(0, gs.levelupsAvailable - 1);
});

export function processInputs(gameState: GameState): void {
  for (const command of globalInputQueue) {
    console.log(`Input: ${command.name}`);
    const handler = handlersByName.get(command.name);
    if (handler) {
      handler(gameState, command);
    } else {
      // Unknown commands are ignored but logged for visibility during dev
      // eslint-disable-next-line no-console
      console.warn(`[InputProcessor] No handler for command: ${command.name}`);
    }
  }
  globalInputQueue.length = 0;
}
