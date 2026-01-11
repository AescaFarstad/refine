import type { GameState } from '../GameState';
import type { Evt } from './Evt';
import { resolveRefineryDone } from '../Refine';

type EvtHandler = (gs: GameState, evt: Evt) => void;
const handlersByName = new Map<string, EvtHandler>();

handlersByName.set('EvtRefineryDone', (gs, evt) => {
  resolveRefineryDone(gs);
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
