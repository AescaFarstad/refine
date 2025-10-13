import type { GameState } from "./GameState";
import type { CmdInput } from "./input/InputCommands";
import { processEvt } from './evt/EvtProcessor';
import { Evt } from "./evt/Evt";
import { EvtRaidComplete, EvtRefineryDone } from './evt/Evt';
import { processCheats } from './cheat/CheatProcessor';

const TIME_SPEED_MAX = 3800;
const TIME_SPEED_MIN = 300;
const TIME_SPEED_RAMP_SEC = 1;

export const globalInputQueue: CmdInput[] = [];

// deltaTime is in seconds
export function update(gs: GameState, deltaTime: number): void {
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
    computeNextEvt(gs);
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

    if (gs.raid.id && gs.nextEvt) {
      const def = gs.lib.raids.get(gs.raid.id);
      if (def) {
        const totalDurationSec = Math.max(0, (def.durationMin || 0) * 60);
        if (totalDurationSec > 0) {
          const timeElapsed = gs.time - oldTime;
          const progressGain = (timeElapsed / totalDurationSec) * 100;
          gs.raid.progress = Math.min(100, gs.raid.progress + progressGain);
        }
      }
    }

    // exponential ramp: multiply by MAX^(dt/T)
    const growth = Math.pow(TIME_SPEED_MAX, Math.min(1, dt / TIME_SPEED_RAMP_SEC));
    const nextSpeed = (gs.timeSpeed || 1) * growth;
    gs.timeSpeed = Math.min(TIME_SPEED_MAX, nextSpeed);
  } else {
    gs.timeSpeed = TIME_SPEED_MIN;
  }
}

export function computeNextEvt(gs: GameState): number | null {
  // Candidate: raid completion
  let bestAt: number | null = null;
  let bestEvt: Evt | null = null;

  const raidId = gs.raid.id;
  if (raidId) {
    const def = gs.lib.raids.get(raidId)!;
    const totalDurationSec = Math.max(0, (def.durationMin || 0) * 60);
    const progressPct = Math.max(0, Math.min(100, gs.raid.progress || 0));
    const remainingSec = Math.round(totalDurationSec * (100 - progressPct) / 100);
    const at = gs.time + remainingSec;
    bestAt = at;
    bestEvt = new EvtRaidComplete({ at });
  }

  // Candidates: refineries finishing
  for (let i = 0; i < gs.refineries.length; i++) {
    const r = gs.refineries[i];
    // Only gate on loadedRecipe; startedAt can be 0
    if (!r.loadedRecipe) continue;
    const recipe = gs.lib.recipes.get(r.loadedRecipe);
    if (!recipe) continue;
    const at = r.startedAt + Math.max(0, recipe.duration || 0);
    if (bestAt === null || at < bestAt) {
      bestAt = at;
      bestEvt = new EvtRefineryDone({ at, refineryIndex: i });
    }
  }

  gs.nextEvt = bestEvt;
  if (bestAt === null) return null;
  const remaining = Math.max(0, Math.round(bestAt - gs.time));
  return remaining;
}
