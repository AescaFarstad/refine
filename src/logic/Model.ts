import type { GameState } from "./GameState";
import type { CmdInput } from "./input/InputCommands";
import { processEvt } from './evt/EvtProcessor';
import { Evt } from "./evt/Evt";
import { EvtRaidComplete } from './evt/Evt';

const TIME_SPEED_MAX = 3800;
const TIME_SPEED_MIN = 30;
const TIME_SPEED_RAMP_SEC = 3;

export const globalInputQueue: CmdInput[] = [];

// deltaTime is in seconds
export function update(gs: GameState, deltaTime: number): void {

  while (gs.nextEvt) {
    if (gs.time >= gs.nextEvt.at) {
      const evt = gs.nextEvt;
      gs.time = evt.at;
      gs.nextEvt = null;
      processEvt(gs, evt);
      computeNextEvt(gs);
    }
    else
      break;
  }
  if (!gs.nextEvt) {
    gs.timeActive = false;
    computeNextEvt(gs);
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

function computeNextEvt(gs: GameState): number | null {
  const raidId = gs.raid.id;
  if (!raidId) {
    gs.nextEvt = null;
    return null;
  }

  const def = gs.lib.raids.get(raidId)!;

  const totalDurationSec = Math.max(0, (def.durationMin || 0) * 60);

  const progressPct = Math.max(0, Math.min(100, gs.raid.progress || 0));
  const remainingSec = Math.round(totalDurationSec * (100 - progressPct) / 100);

  gs.nextEvt = new EvtRaidComplete({ at: gs.time + remainingSec });

  return remainingSec;
}
