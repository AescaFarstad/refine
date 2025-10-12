import type { GameState } from '../GameState';
import type { Evt } from './Evt';
import { EvtRaidComplete } from './Evt';

type EvtHandler = (gs: GameState, evt: Evt) => void;
const handlersByName = new Map<string, EvtHandler>();

handlersByName.set('EvtRaidComplete', (gs, evt) => {
  const e = evt as EvtRaidComplete;

  gs.raid.id = '';
  gs.raid.progress = 0;
});

export function processEvt(gs: GameState, evt: Evt): void {
  const handler = handlersByName.get(evt.name);
  if (handler) {
    handler(gs, evt);
  }
  else {
    throw new Error(`No handler for event: ${evt.name}`);
  }
}
