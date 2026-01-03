import type { GameState } from '../GameState';
import type { Evt } from './Evt';
import { computeRefinePreviewChem, rollSuccess, calculateOutputs } from '../RefinePreview';
import { RefineryOutcome } from '../GameState';
import { clearWafer } from '../Wafer';
import { getHypRepresentation } from '../HypNumbers';
import { SHARD_LAUNCH_SPEED, SHARD_MAX_OMEGA, SHARD_MIN_OMEGA, SHARD_OMEGA_POWER } from '../Model';
import { calculateShardFontSize } from '../../utils/ShardDisplay';

type EvtHandler = (gs: GameState, evt: Evt) => void;
const handlersByName = new Map<string, EvtHandler>();

handlersByName.set('EvtRefineryDone', (gs, evt) => {
  if (!gs.wafer) return;
  const wafer = gs.wafer;

  const preview = computeRefinePreviewChem(wafer);
  const succeeded = rollSuccess(preview.failureChancePct);

  const outcome = new RefineryOutcome();
  outcome.success = succeeded;

  if (succeeded) {
    const outputs = calculateOutputs(preview, succeeded);
    createShards(gs, 'credits', outputs.credits);
    createShards(gs, 'chronotraces', outputs.chrono);
    createShards(gs, 'timeFlux', outputs.flux);

    outcome.creditsGained = outputs.credits;
    outcome.chronotracesGained = outputs.chrono;
    outcome.timeFluxGained = outputs.flux;
  } else {
    const shardAmount =
      Math.max(0, preview.expectedCredits || 0) +
      Math.max(0, preview.expectedChrono || 0) +
      Math.max(0, preview.expectedFlux || 0);
    if (shardAmount > 0) {
      createShards(gs, 'shards', shardAmount);
    }
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
      const speedNorm = (speed - SHARD_LAUNCH_SPEED.x) / (SHARD_LAUNCH_SPEED.y - SHARD_LAUNCH_SPEED.x || 1);
      const clampedSpeedNorm = Math.max(0, Math.min(1, speedNorm));
      const omegaBase = gs.random.get();
      const omegaBias = Math.pow(omegaBase, SHARD_OMEGA_POWER);
      const omegaT = clampedSpeedNorm + (1 - clampedSpeedNorm) * omegaBias;
      const omegaMagnitude = SHARD_MIN_OMEGA + (SHARD_MAX_OMEGA - SHARD_MIN_OMEGA) * omegaT;
      const omegaSign = gs.random.get() < 0.5 ? -1 : 1;
      const omega = omegaSign * omegaMagnitude;
      const initialAngle = gs.random.get_in_range(0, Math.PI * 2);
      gs.shards.push({
        id: Math.random().toString(36).substr(2, 9),
        resource,
        amount: value,
        pos: { x: 0, y: 0 }, // Spawn in middle (will be relative to wafer center in UI, but here 0,0)
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        angle: initialAngle,
        omega,
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
