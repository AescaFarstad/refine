import type { GameState } from "./GameState";
import type { CmdInput } from "./input/InputCommands";
import { processEvt } from './evt/EvtProcessor';
import { processCheats } from './cheat/CheatProcessor';
import { IS_DEBUG } from './Const';
// IceMaze instance is persisted on GameState
import { IceMaze } from "../maze/IceMaze";
import { distancePointToSegment } from "./core/math";
import { ArtefactType, Chase } from "../maze/Chase";
import generateIceMaze from "../maze/IceMazeGen";
import { clearWafer } from "./Wafer";
import { calculateVisibility } from "./Research";
import { ensureShardDiscovery } from "./Discover";

const TIME_SPEED_MAX = 3800;
const TIME_SPEED_MIN = 300;
const TIME_SPEED_RAMP_SEC = 1;

export const SHARD_MIN_OMEGA = 0.1;
export const SHARD_MAX_OMEGA = 20;
export const SHARD_OMEGA_POWER = 5;
export const SHARD_OMEGA_TO_SPEED_K = 4;
export const SHARD_OMEGA_TRANSFER_FRACTION = 0.5;

export const globalInputQueue: CmdInput[] = [];

// Duration of the shard pickup animation in seconds;
export const SHARD_PICKUP_DELAY_SEC = 0.6;

export function setResearchRevealRadius(gs: GameState, radius: number): void {
  gs.researchRevealRadius = radius;
  calculateVisibility(gs, gs.lib.research);
}

const SHARD_ATTRACTION_RANGE_PX = 250;
const SHARD_BASE_GRAV_ACCEL = 180;
const SHARD_ATTRACTION_BASE_AMOUNT = 5;
const SHARD_DRAG_STRENGTH_PER_SEC = 0.05;
const SHARD_RADIUS_MULT = 1.2
export const SHARD_LAUNCH_SPEED = { x: 20, y: 100 }

let lastWaferMouse: { x: number; y: number } | null = null;

// deltaTime is in seconds
export function update(gs: GameState, deltaTime: number): void {
  initOrAdvanceMaze(gs);
  if (gs.maze) {
    gs.maze.maxMoves = Math.floor(gs.timeFlux);
  }
  gs.maze?.update(deltaTime);

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
    const growth = Math.pow(TIME_SPEED_MAX, Math.min(1, dt / TIME_SPEED_RAMP_SEC));
    const nextSpeed = (gs.timeSpeed || 1) * growth;
    gs.timeSpeed = Math.min(TIME_SPEED_MAX, nextSpeed);
  } else {
    gs.timeSpeed = TIME_SPEED_MIN;
  }
}

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

  const halfW = gs.waferSize.x / 2;
  const halfH = gs.waferSize.y / 2;
  const mouse = gs.waferMouseCoords;

  if (halfW === 0 || halfH === 0) {
    return;
  }

  // Shards use real time seconds, so we use dt directly
  for (let i = 0; i < gs.shards.length; i++) {
    const shard = gs.shards[i];
    if (!shard) continue;

    // When a shard is triggered (picked up in UI), we stop physics and
    // run a real-time delay before granting resources.
    if (shard.triggered) {
      const remaining = shard.pickupDelaySec - dt;
      shard.pickupDelaySec = remaining;
      if (remaining <= 0) {
        if (shard.resource === 'credits') {
          gs.credits += shard.amount;
        } else if (shard.resource === 'chronotraces') {
          gs.chronotraces += shard.amount;
        } else if (shard.resource === 'timeFlux') {
          gs.timeFlux += shard.amount;
        } else if (shard.resource === 'shards') {
          gs.shardDust += shard.amount;
        }
        gs.shards[i] = null as any;
      }
      continue;
    }

    // Attraction towards mouse when hovering wafer
    if (mouse) {
      const dxMouse = mouse.x - shard.pos.x;
      const dyMouse = mouse.y - shard.pos.y;
      const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

      if (distMouse > 0.0001 && distMouse < SHARD_ATTRACTION_RANGE_PX) {
        // Attraction strength fades linearly to 0 at the edge of the range
        const rangeT = 1 - (distMouse / SHARD_ATTRACTION_RANGE_PX);
        const falloff = Math.max(0, rangeT);

        let resourceFactor = 1;
        if (shard.resource === 'chronotraces') {
          resourceFactor = 0.66;
        } else if (shard.resource === 'timeFlux') {
          resourceFactor = 0.33;
        }

        const sizeFactor = SHARD_ATTRACTION_BASE_AMOUNT / Math.max(1, shard.amount);
        const gravAccel = SHARD_BASE_GRAV_ACCEL * resourceFactor * falloff * sizeFactor;
        const nx = dxMouse / distMouse;
        const ny = dyMouse / distMouse;
        shard.vel.x += nx * gravAccel * dt;
        shard.vel.y += ny * gravAccel * dt;
      }

      const pickupRadius = shard.size * SHARD_RADIUS_MULT;

      let pickupDistance = distMouse;
      if (lastWaferMouse) {
        pickupDistance = distancePointToSegment(
          shard.pos,
          lastWaferMouse,
          mouse,
        );
      }

      if (pickupDistance < pickupRadius) {
        shard.triggered = true;
        shard.pickupDelaySec = SHARD_PICKUP_DELAY_SEC;
        shard.vel.x = 0;
        shard.vel.y = 0;
        continue;
      }
    }

    if (SHARD_DRAG_STRENGTH_PER_SEC > 0 && dt > 0) {
      const drag = Math.exp(-SHARD_DRAG_STRENGTH_PER_SEC * dt);
      shard.vel.x *= drag;
      shard.vel.y *= drag;
      shard.omega *= drag;
    }

    shard.pos.x += shard.vel.x * dt;
    shard.pos.y += shard.vel.y * dt;
    shard.angle += shard.omega * dt;

    const margin = shard.size * 0.5;

    if (shard.pos.x < -halfW + margin) {
      shard.pos.x = -halfW + margin;
      shard.vel.x *= -1;

      const omegaMag = Math.abs(shard.omega);
      if (omegaMag > 0) {
        const omegaSign = shard.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        shard.vel.y += omegaSign * deltaSpeed;
        shard.omega -= omegaSign * transferredOmega;
      }
    } else if (shard.pos.x > halfW - margin) {
      shard.pos.x = halfW - margin;
      shard.vel.x *= -1;

      const omegaMag = Math.abs(shard.omega);
      if (omegaMag > 0) {
        const omegaSign = shard.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        shard.vel.y += omegaSign * deltaSpeed;
        shard.omega -= omegaSign * transferredOmega;
      }
    }

    if (shard.pos.y < -halfH + margin) {
      shard.pos.y = -halfH + margin;
      shard.vel.y *= -1;

      const omegaMag = Math.abs(shard.omega);
      if (omegaMag > 0) {
        const omegaSign = shard.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        shard.vel.x += omegaSign * deltaSpeed;
        shard.omega -= omegaSign * transferredOmega;
      }
    } else if (shard.pos.y > halfH - margin) {
      shard.pos.y = halfH - margin;
      shard.vel.y *= -1;

      const omegaMag = Math.abs(shard.omega);
      if (omegaMag > 0) {
        const omegaSign = shard.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        shard.vel.x += omegaSign * deltaSpeed;
        shard.omega -= omegaSign * transferredOmega;
      }
    }
  }

  const hasAnyShards = gs.shards.some(s => s !== null);
  if (!hasAnyShards) {
    gs.shards.length = 0;
    gs.lastRefineryOutcome = null;
  }

  if (mouse) {
    lastWaferMouse = { x: mouse.x, y: mouse.y };
  } else {
    lastWaferMouse = null;
  }
}

function initOrAdvanceMaze(gs: GameState) {
  const levels = gs.lib.mazeLevels || [];
  if (!levels.length) return;

  const clampIndex = (i: number) => Math.max(0, Math.min(levels.length - 1, i | 0));

  // Reset requested by input
  if (gs.labirinthResetRequested) {
    gs.labirinthResetRequested = false;
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
