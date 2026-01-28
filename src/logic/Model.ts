import type { GameState } from "./GameState";
import type { CmdInput } from "./input/InputCommands";
import { processEvt } from './evt/EvtProcessor';
import { processCheats } from './cheat/CheatProcessor';
import { IS_DEBUG } from './Const';
// IceMaze instance is persisted on GameState
import { IceMaze } from "../maze/IceMaze";
import { ArtefactType, Chase } from "../maze/Chase";
import generateIceMaze from "../maze/IceMazeGen";
import { calculateVisibility } from "./Research";
import { ensureShardDiscovery, ensureResearchTabDiscovery, ensureMazeTabDiscovery } from "./Discover";
import { applyReward } from "./Reward";

const TIME_SPEED_MAX = 3800;
const TIME_SPEED_MIN = 300;
const TIME_SPEED_RAMP_SEC = 1;

export const globalInputQueue: CmdInput[] = [];

// Duration of the shard pickup animation in seconds;
export const SHARD_PICKUP_DELAY_SEC = 0.6;

export function setResearchRevealRadius(gs: GameState, radius: number): void {
  gs.researchRevealRadius = radius;
  calculateVisibility(gs, gs.lib.research);
}

// deltaTime is in seconds
export function update(gs: GameState, deltaTime: number): void {
  initOrAdvanceMaze(gs);
  if (gs.maze) {
    gs.maze.timeFluxAvailable = Math.floor(gs.timeFlux);
  }
  gs.maze?.update(deltaTime);
  if (gs.maze) {
    gs.timeFlux = gs.maze.timeFluxAvailable;
  }

  if (IS_DEBUG && gs.cheats && gs.cheats.length > 0) {
    processCheats(gs);
  }

  updateShards(gs, deltaTime);
  ensureShardDiscovery(gs);

  if (gs.lastRaidOutcome || gs.lastRefineryOutcome) {
    return;
  }

  if (gs.timeActive && gs.nextEvt && gs.gameTime >= gs.nextEvt.at) {
    const evt = gs.nextEvt;
    gs.gameTime = evt.at;
    gs.nextEvt = null;
    processEvt(gs, evt);
    gs.timeActive = false;
    return;
  }

  if (!gs.nextEvt) {
    gs.timeActive = false;
  }

  if (gs.timeActive) {
    const dt = Math.max(0, deltaTime);
    const oldTime = gs.gameTime;
    gs.gameTime += dt * Math.max(1, gs.timeSpeed || 1);

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
      } else if (shard.resource === 'zone_crystal') {
        gs.countableGear['zone_crystal'] = (gs.countableGear['zone_crystal'] || 0) + shard.amount;
        if (!gs.unlockedGear.includes('zone_crystal')) {
          gs.unlockedGear.push('zone_crystal');
        }
      }
      gs.shards[i] = null as any;
    }
  }

  const hasAnyShards = gs.shards.some(s => s !== null);
  if (!hasAnyShards) {
    gs.shards.length = 0;
    gs.lastRefineryOutcome = null;
  }
}

function initOrAdvanceMaze(gs: GameState) {
  const levels = gs.lib.mazeLevels || [];
  if (!levels.length) return;

  const clampIndex = (i: number) => Math.max(0, Math.min(levels.length - 1, i | 0));

  // Reset requested by input
  if (gs.labirinthResetRequested) {
    gs.labirinthResetRequested = false;
    if (gs.maze) {
      gs.timeFlux += gs.maze.movesMade;
    }
    const idx = clampIndex(gs.mazeLevelIndex);
    const def = levels[idx];
    const seed = Math.floor(gs.random.get_in_range(1, 0x7fffffff));
    const moves = gs.timeFlux;
    const inst = new IceMaze({ x: def.x, y: def.y }, moves, seed);
    inst.loadSettings(toSettings(def, seed), seed);
    gs.maze = inst;
    return;
  }

  // Initialize if missing
  if (!gs.maze) {
    const idx = clampIndex(gs.mazeLevelIndex);
    const def = levels[idx];
    const seed = Math.floor(gs.random.get_in_range(1, 0x7fffffff));
    const moves = gs.timeFlux;
    const inst = new IceMaze({ x: def.x, y: def.y }, moves, seed);
    inst.loadSettings(toSettings(def, seed), seed);
    gs.maze = inst;
    return;
  }

  // Auto-advance when solved (wait for animations to finish)
  const solved = Chase.isSolved(gs.maze.state);
  if (solved && !gs.maze.isAnimating()) {

    const currentLevelIdx = clampIndex(gs.mazeLevelIndex);
    const currentDef = levels[currentLevelIdx];

    gs.timeFlux = 0;

    if (currentDef && currentDef.reward && Array.isArray(currentDef.reward)) {
      for (const r of currentDef.reward) {
        applyReward(gs, r);
      }
    }

    const next = clampIndex(gs.mazeLevelIndex + 1);
    gs.mazeLevelIndex = next;
    // Rebuild immediately at next level
    const def = levels[next];
    const seed = Math.floor(gs.random.get_in_range(1, 0x7fffffff));
    const moves = gs.timeFlux;
    const inst = new IceMaze({ x: def.x, y: def.y }, moves, seed);
    inst.loadSettings(toSettings(def, seed), seed);
    gs.maze = inst;
  }
}

function toSettings(def: any, seed: number) {
  const artefacts = (def.artefacts || []).map((a: any) => ({
    type: (a.type === 'BOMB' ? ArtefactType.BOMB : a.type === 'EYE' ? ArtefactType.EYE : ArtefactType.FREEZE) as number,
    x: a.x, y: a.y,
  }));

  // If the definition requests a fixed layout, use the provided values and skip generation
  if (def.useFixedLayout) {
    const spawn = def.spawn ? { x: def.spawn.x, y: def.spawn.y } : { x: 1, y: 1 };
    const keys = (def.keys || []).map((k: any) => ({ x: k.x, y: k.y }));
    const fill = (def.fill || []).map((f: any) => ({ x: f.x, y: f.y }));
    return {
      x: def.x, y: def.y,
      spawn,
      keys,
      spawnProbability: Math.max(0, def.spawnProbability || 0),
      maxDemons: Math.max(0, def.maxDemons || 0),
      artefacts,
      fill,
    } as any;
  }

  // Otherwise, generate a baseline layout and allow optional overrides from definition
  const layout = generateIceMaze(def, seed);
  const spawn = def.spawn ? { x: def.spawn.x, y: def.spawn.y } : { x: layout.spawn?.x ?? 1, y: layout.spawn?.y ?? 1 };
  const keys = (def.keys && def.keys.length ? def.keys : (layout.keys || [])).map((k: any) => ({ x: k.x, y: k.y }));
  // Keep generated obstacles unless a fully fixed layout is requested
  const fill = (layout.fill || []).map((f: any) => ({ x: f.x, y: f.y }));
  return {
    x: def.x, y: def.y,
    spawn,
    keys,
    spawnProbability: Math.max(0, def.spawnProbability || 0),
    maxDemons: Math.max(0, def.maxDemons || 0),
    artefacts,
    fill,
  } as any;
}
