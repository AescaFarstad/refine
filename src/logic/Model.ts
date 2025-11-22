import type { GameState } from "./GameState";
import type { CmdInput } from "./input/InputCommands";
import { processEvt } from './evt/EvtProcessor';
import { Evt } from "./evt/Evt";
import { EvtRaidComplete, EvtRefineryDone } from './evt/Evt';
import { processCheats } from './cheat/CheatProcessor';
// IceMaze instance is persisted on GameState
import { IceMaze } from "../maze/IceMaze";
import { ArtefactType, Chase } from "../maze/Chase";
import generateIceMaze from "../maze/IceMazeGen";

const TIME_SPEED_MAX = 3800;
const TIME_SPEED_MIN = 300;
const TIME_SPEED_RAMP_SEC = 1;

export const globalInputQueue: CmdInput[] = [];

// deltaTime is in seconds
export function update(gs: GameState, deltaTime: number): void {
  initOrAdvanceMaze(gs);
  gs.maze?.update(deltaTime);

  if (gs.cheats && gs.cheats.length > 0) {
    processCheats(gs);
  }

  if (gs.lastRaidOutcome || gs.lastRefineryOutcome) {
    return;
  }

  if (gs.timeActive && gs.nextEvt && gs.time >= gs.nextEvt.at) {
    const evt = gs.nextEvt;
    gs.time = evt.at;
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
    const oldTime = gs.time;
    gs.time += dt * Math.max(1, gs.timeSpeed || 1);

    // exponential ramp: multiply by MAX^(dt/T)
    const growth = Math.pow(TIME_SPEED_MAX, Math.min(1, dt / TIME_SPEED_RAMP_SEC));
    const nextSpeed = (gs.timeSpeed || 1) * growth;
    gs.timeSpeed = Math.min(TIME_SPEED_MAX, nextSpeed);
  } else {
    gs.timeSpeed = TIME_SPEED_MIN;
  }
}

function initOrAdvanceMaze(gs: GameState) {
  const levels = gs.lib.mazeLevels || [];
  if (!levels.length) return;

  const clampIndex = (i: number) => Math.max(0, Math.min(levels.length - 1, i | 0));

  // Reset requested by input
  if ((gs as any)._labirinthResetRequested) {
    (gs as any)._labirinthResetRequested = false;
    const idx = clampIndex(gs.mazeLevelIndex);
    const def = levels[idx];
    const seed = Math.floor(gs.random.get_in_range(1, 0x7fffffff));
    const moves = Math.max(0, (gs as any).timeFlux || 0);
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
    const moves = Math.max(0, (gs as any).timeFlux || 0);
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
    const moves = Math.max(0, (gs as any).timeFlux || 0);
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
