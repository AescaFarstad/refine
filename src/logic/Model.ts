import type { GameState } from "./GameState";
import type { CmdInput } from "./input/InputCommands";
import { processEvt } from './evt/EvtProcessor';
import { processCheats } from './cheat/CheatProcessor';
import { calculateVisibility } from "./Research";
import { ensureShardDiscovery, ensureResearchTabDiscovery, ensureMazeTabDiscovery } from "./Discover";
import { syncDerivedGearUnlocks } from "./DiscoveryLib";
import { saveAutosave } from "./SaveLoad";
import { accumulateRaidResources } from './Raid';

const TIME_SPEED_MAX = 3800;
const TIME_SPEED_MIN = 300;
const TIME_SPEED_RAMP_SEC = 1;

export const globalInputQueue: CmdInput[] = [];

// Duration of the shard pickup animation in seconds;
export const SHARD_PICKUP_DELAY_SEC = 0.6;
const COUNTABLE_GEAR_SHARD_RESOURCES = new Set(['zone_crystal', 'fractal', 'spice']);

export function setResearchRevealRadius(gs: GameState, radius: number): void {
  gs.researchRevealRadius = radius;
  calculateVisibility(gs, gs.lib.research);
}

// deltaTime is in seconds
export function update(gs: GameState, deltaTime: number): void {
  if (gs.cheats && gs.cheats.length > 0) {
    processCheats(gs);
  }

  syncDerivedGearUnlocks(gs.unlockedGear);
  updateShards(gs, deltaTime);
  ensureShardDiscovery(gs);

  if (gs.lastRaidOutcome || gs.lastRefineryOutcome) {
    return;
  }

  if (gs.timeActive && gs.nextEvt && gs.gameTime >= gs.nextEvt.at) {
    const evt = gs.nextEvt;
    const timeDelta = Math.max(0, evt.at - gs.gameTime);
    gs.gameTime = evt.at;
    accumulateRaidResources(gs, timeDelta);
    gs.nextEvt = null;
    processEvt(gs, evt);
    if (evt.name === 'EvtRefineryDone') {
      saveAutosave(gs);
    }
    gs.timeActive = false;
    return;
  }

  if (!gs.nextEvt) {
    gs.timeActive = false;
  }

  if (gs.timeActive) {
    const dt = Math.max(0, deltaTime);
    const scaledDelta = dt * Math.max(1, gs.timeSpeed || 1);
    const remainingToEvt = gs.nextEvt ? Math.max(0, gs.nextEvt.at - gs.gameTime) : scaledDelta;
    const timeDelta = Math.min(scaledDelta, remainingToEvt);
    gs.gameTime += timeDelta;
    accumulateRaidResources(gs, timeDelta);

    // exponential ramp: multiply by MAX^(dt/T)
    const effectiveMax = TIME_SPEED_MAX * (gs.timeSpeedMaxBoost || 1);
    const growth = Math.pow(effectiveMax, Math.min(1, dt / TIME_SPEED_RAMP_SEC));
    const nextSpeed = (gs.timeSpeed || 1) * growth;
    gs.timeSpeed = Math.min(effectiveMax, nextSpeed);
  } else {
    gs.timeSpeed = TIME_SPEED_MIN;
    gs.timeSpeedMaxBoost = 1;
  }
}

// Shard physics (position, velocity, bouncing) is handled in UI (RefineAnim.vue).
// Model only handles: grace period, triggered shard resource granting, cleanup.
function updateShards(gs: GameState, dt: number) {
  const hadAnyShards = gs.shards.some(s => s !== null);

  // If there are no shards but we still have a refinery
  // outcome, treat the outcome as fully resolved so that
  // the wafer UI can become interactive again.
  if (!gs.shards || gs.shards.length === 0) {
    if (gs.lastRefineryOutcome) {
      gs.lastRefineryOutcome = null;
    }
    return;
  }

  if (gs.shardPickupGraceSec > 0) {
    gs.shardPickupGraceSec = Math.max(0, gs.shardPickupGraceSec - dt);
  }

  // Process triggered shards (picked up in UI)
  for (let i = 0; i < gs.shards.length; i++) {
    const shard = gs.shards[i];
    if (!shard || !shard.triggered) continue;

    const remaining = shard.pickupDelaySec - dt;
    shard.pickupDelaySec = remaining;
    if (remaining <= 0) {
      if (shard.resource === 'credits') {
        gs.credits += shard.amount;
      } else if (shard.resource === 'chronotraces') {
        gs.chronotraces += shard.amount;
        ensureResearchTabDiscovery(gs);
      } else if (shard.resource === 'timeFlux') {
        gs.timeFlux += shard.amount;
        ensureMazeTabDiscovery(gs);
      } else if (shard.resource === 'shards') {
        gs.shardDust += shard.amount;
      } else if (COUNTABLE_GEAR_SHARD_RESOURCES.has(shard.resource)) {
        gs.countableGear[shard.resource] = (gs.countableGear[shard.resource] || 0) + shard.amount;
        if (!gs.unlockedGear.includes(shard.resource)) {
          gs.unlockedGear.push(shard.resource);
        }
        syncDerivedGearUnlocks(gs.unlockedGear);
      }
      gs.shards[i] = null as any;
    }
  }

  const hasAnyShards = gs.shards.some(s => s !== null);
  if (!hasAnyShards) {
    gs.shards.length = 0;
    gs.lastRefineryOutcome = null;
    if (hadAnyShards) {
      saveAutosave(gs);
    }
  }
}
