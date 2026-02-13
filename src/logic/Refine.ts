import type { Lib } from './Lib';
import type { Essence } from './ItemLib';
import type { GameState } from './GameState';
import { RefineryOutcome } from './GameState';
import { calculateOutputs, computeRefinePreviewChem } from './RefinePreview';
import { clearWafer } from './Wafer';
import { getHypRepresentation } from './HypNumbers';
import { calculateShardFontSize } from '../utils/ShardDisplay';
import { EvtRefineryDone } from './evt/Evt';
import { discover } from './Discover';
import { DISCOVERY } from './DiscoveryLib';
import { applyReward } from './Reward';

const FAILED_SHARD_PICKUP_GRACE_SEC = 2.4;

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

  const preview = computeRefinePreviewChem(gs);
  gs.refiningDuration = Math.max(0, Math.round(preview.timeSec));

  const duration = gs.refiningDuration;
  gs.nextEvt = new EvtRefineryDone({ at: gs.gameTime + duration });
  gs.timeActive = true;
}

export function resolveRefineryDone(gs: GameState): void {
  const wafer = gs.wafer;

  const preview = computeRefinePreviewChem(gs);
  const roll = gs.random.get() * 100;
  const succeeded = roll > preview.failureChancePct;

  const outcome = new RefineryOutcome();
  outcome.success = succeeded;

  if (succeeded) {
    for (const item of wafer.items) {
      if (!item) continue;
      gs.refinedUniqueItemIds[item.id] = true;
    }

    const magentaCount = preview.essenceTotals['magenta'] || 0;
    if (magentaCount > 0 && !gs.discoveries[DISCOVERY.MAGENTA_CRYSTALS]) {
      applyReward(gs, { kind: 'discovery', discoveryId: DISCOVERY.MAGENTA_CRYSTALS });
      applyReward(gs, { kind: 'show_ui', ui: 'RUIMagentsCrystals' });
    }

    for (const gearOutput of preview.gearOutputs) {
      if (gearOutput.count > 0) {
        createShards(gs, gearOutput.gearId, gearOutput.count, 1);
      }
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
        for (const signatureId of justCompleted) {
          const signature = gs.lib.getSignature(signatureId);
          for (const reward of signature.rewards) {
            applyReward(gs, reward);
          }
        }
        applyReward(gs, {
          kind: 'show_ui',
          ui: 'signature_complete',
          params: { signatureIds: justCompleted },
        });
      }
    }

    const outputs = calculateOutputs(preview, succeeded);
    createShards(gs, 'credits', outputs.credits, 1);
    createShards(gs, 'chronotraces', outputs.chrono, 1);
    createShards(gs, 'timeFlux', outputs.flux, 1);

    outcome.creditsGained = outputs.credits;
    outcome.chronotracesGained = outputs.chrono;
    outcome.timeFluxGained = outputs.flux;
  } else {
    const shardAmount =
      Math.max(0, preview.expectedCredits || 0) +
      Math.max(0, preview.expectedChrono || 0) +
      Math.max(0, preview.expectedFlux || 0);
    if (shardAmount > 0) {
      createShards(gs, 'shards', shardAmount, 2);
    }
    gs.shardPickupGraceSec = FAILED_SHARD_PICKUP_GRACE_SEC;
  }

  gs.lastRefineryOutcome = outcome;
  clearWafer(gs.wafer);
}

// Physics (pos, vel, angle, omega) is initialized in UI layer (RefineAnim.vue)
// when it detects a new shard without physics state.
function createShards(gs: GameState, resource: string, amount: number, launchSpeedMultiplier: number): void {
  if (amount <= 0) return;
  const representation = getHypRepresentation(amount);

  // Representation index i corresponds to value i+1
  for (let i = 0; i < representation.length; i++) {
    const count = representation[i];
    const value = i + 1;
    for (let j = 0; j < count; j++) {
      gs.shards.push({
        id: gs.random.get().toString(36).substring(2, 11),
        resource,
        amount: value,
        triggered: false,
        pickupDelaySec: 0,
        size: calculateShardFontSize(value),
        launchSpeedMultiplier,
      });
    }
  }
}
