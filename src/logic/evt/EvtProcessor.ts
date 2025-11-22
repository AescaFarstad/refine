import type { GameState } from '../GameState';
import type { Evt } from './Evt';
import { EvtRaidComplete, EvtRefineryDone } from './Evt';
import { computeRefinePreviewChem, rollSuccess, calculateOutputs } from '../RefinePreview';
import { RefineryOutcome } from '../GameState';
import { clearWafer } from '../Wafer';

type EvtHandler = (gs: GameState, evt: Evt) => void;
const handlersByName = new Map<string, EvtHandler>();

handlersByName.set('EvtRaidComplete', (gs, evt) => {
  // Stage 1: No-op outcome to clear active raid; no rewards, no progress.
  const raidId = gs.raid.id;
  const outcome = {
    id: raidId,
    questsDone: 0,
    success: false,
    questDeltaPct: 0,
    unlockedRaidId: null as string | null,
    looted: [] as { id: string; quantity: number }[],
    discardedByVolume: [] as { id: string; quantity: number }[],
    discardedByLuck: [] as { id: string; quantity: number }[],
  };

  gs.lastRaidOutcome = outcome;
  gs.raid.id = '';
});

handlersByName.set('EvtRefineryDone', (gs, evt) => {
  if (!gs.wafer) return;
  const wafer = gs.wafer;

  const preview = computeRefinePreviewChem(wafer);
  const succeeded = rollSuccess(preview.failureChancePct);

  const outcome = new RefineryOutcome();
  outcome.recipeId = '';
  outcome.success = succeeded;

  const outputs = calculateOutputs(preview, succeeded);
  if (succeeded) {
    gs.credits += outputs.credits;
    gs.chronotraces += outputs.chrono;
    gs.timeFlux = Math.max(0, (gs.timeFlux || 0) + outputs.flux);
    outcome.creditsGained = outputs.credits;
    outcome.chronotracesGained = outputs.chrono;
    outcome.timeFluxGained = outputs.flux;
  }

  gs.lastRefineryOutcome = outcome;
  clearWafer(gs.wafer);
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