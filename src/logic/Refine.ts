import type { Lib } from './Lib';
import type { Essence } from './ItemLib';
import type { GameState } from './GameState';
import { RefineryOutcome } from './GameState';
import { calculateOutputs, computeRefinePreviewChem, rollSuccess } from './RefinePreview';
import { clearWafer } from './Wafer';
import { getHypRepresentation } from './HypNumbers';
import { SHARD_LAUNCH_SPEED, SHARD_MAX_OMEGA, SHARD_MIN_OMEGA, SHARD_OMEGA_POWER } from './Model';
import { calculateShardFontSize } from '../utils/ShardDisplay';
import { EvtRefineryDone } from './evt/Evt';
import { discover } from './Discover';
import { DISCOVERY } from './DiscoveryLib';
import { applyReward } from './Reward';

export function computeLoadedEssencesFromItems(lib: Lib, items: Array<{ id: string; quantity: number }>): Essence {
  const totals: Essence = {};
  for (const it of items) {
    const def = lib.getItem(it.id);
    for (const k of Object.keys(def.essence)) {
      totals[k] = (totals[k] || 0) + def.essence[k]! * it.quantity;
    }
  }
  return totals;
}

export function startRefining(gs: GameState): void {
  if (gs.nextEvt && gs.nextEvt.name === 'EvtRefineryDone') return;

  // Items are removed from inventory as they are placed onto the wafer.
  let hasAny = false;
  for (const placed of gs.wafer.items) {
    if (placed) { hasAny = true; break; }
  }
  if (!hasAny) return;

  const preview = computeRefinePreviewChem(gs.wafer, {
    signatures: gs.lib.signatures,
    signatureLevel: gs.signatureLevel,
    completedSignatureIds: gs.completedSignatureIds,
    discoveries: gs.discoveries,
    refinedUniqueItemIds: gs.refinedUniqueItemIds,
  });
  gs.refiningDuration = Math.max(0, Math.round(preview.timeSec));

  const duration = gs.refiningDuration;
  gs.nextEvt = new EvtRefineryDone({ at: gs.gameTime + duration });
  gs.timeActive = true;
}

export function resolveRefineryDone(gs: GameState): void {
  const wafer = gs.wafer;

  const preview = computeRefinePreviewChem(wafer, {
    signatures: gs.lib.signatures,
    signatureLevel: gs.signatureLevel,
    completedSignatureIds: gs.completedSignatureIds,
    discoveries: gs.discoveries,
    refinedUniqueItemIds: gs.refinedUniqueItemIds,
  });
  const succeeded = rollSuccess(preview.failureChancePct);

  const outcome = new RefineryOutcome();
  outcome.success = succeeded;

  for (const item of wafer.items) {
    if (!item) continue;
    gs.refinedUniqueItemIds[item.id] = true;
  }

  if (succeeded) {
    const magentaCount = preview.essenceTotals['magenta'] || 0;
    if (magentaCount > 0 && !gs.discoveries[DISCOVERY.MAGENTA_CRYSTALS]) {
      applyReward(gs, { kind: 'discovery', discoveryId: DISCOVERY.MAGENTA_CRYSTALS });
      applyReward(gs, { kind: 'countable_gear', gearId: 'zone_crystal', amount: magentaCount });
      applyReward(gs, { kind: 'show_ui', ui: 'RUIMagentsCrystals' });
    }

    if (preview.newlyCompletedSignatureIds.length > 0) {
      discover(gs, DISCOVERY.SIGNATURES);
      const completed = new Set(gs.completedSignatureIds);
      const justCompleted: string[] = [];
      for (const id of preview.newlyCompletedSignatureIds) {
        if (completed.has(id)) continue;
        gs.completedSignatureIds.push(id);
        if (!gs.learnedSignatureIds.includes(id)) {
          gs.learnedSignatureIds.push(id);
        }
        completed.add(id);
        justCompleted.push(id);
      }
      if (justCompleted.length > 0) {
        applyReward(gs, {
          kind: 'show_ui',
          ui: 'signature_complete',
          params: { signatureIds: justCompleted },
        });
      }
    }

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
}

function createShards(gs: GameState, resource: string, amount: number): void {
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
