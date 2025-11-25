import type { GameState } from '../GameState';
import type { Evt } from './Evt';
import { EvtRaidComplete, EvtRefineryDone } from './Evt';
import { computeRefinePreviewChem, rollSuccess, calculateOutputs } from '../RefinePreview';
import { RefineryOutcome } from '../GameState';
import { clearWafer } from '../Wafer';
import { getHypRepresentation } from '../HypNumbers';
import { SHARD_LAUNCH_SPEED } from '../Model';
import { calculateShardFontSize } from '../../utils/ShardDisplay';

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

    createShards(gs, 'credits', outputs.credits);
    createShards(gs, 'chronotraces', outputs.chrono);
    createShards(gs, 'timeFlux', outputs.flux);

    outcome.creditsGained = outputs.credits;
    outcome.chronotracesGained = outputs.chrono;
    outcome.timeFluxGained = outputs.flux;
  }

  gs.lastRefineryOutcome = outcome;
  clearWafer(gs.wafer);
});

function createShards(gs: GameState, resource: string, amount: number) {
  if (amount <= 0) return;
  const representation = getHypRepresentation(amount);

  // Representation index i corresponds to value i+1
  for (let i = 0; i < representation.length; i++) {
    const count = representation[i];
    const value = i + 1;
    for (let j = 0; j < count; j++) {
      const angle = gs.random.get_in_range(0, Math.PI * 2);
      const speed = gs.random.get_in_range(SHARD_LAUNCH_SPEED.x, SHARD_LAUNCH_SPEED.y);
      gs.shards.push({
        id: Math.random().toString(36).substr(2, 9),
        resource,
        amount: value,
        pos: { x: 0, y: 0 }, // Spawn in middle (will be relative to wafer center in UI, but here 0,0)
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        triggered: false,
        pickupDelaySec: 0,
        size: calculateShardFontSize(value),
      });
    }
  }
}

export function processEvt(gs: GameState, evt: Evt): void {
  const handler = handlersByName.get(evt.name);
  if (handler) {
    handler(gs, evt);
  }
  else {
    throw new Error(`No handler for event: ${evt.name}`);
  }
}