import type { GameState } from '../GameState';
import { globalInputQueue, SHARD_PICKUP_DELAY_SEC } from '../Model';
import type { CmdInput } from './InputCommands';
import { CmdStartRaid, CmdAdvanceTime, CmdAknowledgeOutcome, CmdLevelup, CmdStartRefining, CmdMazeMove, CmdMazeReset, type MazeDir, CmdMazeRestart, CmdSelectRaid, CmdToggleGear, CmdToggleQuest, CmdGrowWafer, CmdResearchNode } from './InputCommands';
import { LEVEL_UP_STRENGTH, LEVEL_UP_LOOTING, LEVEL_UP_VOLUME } from '../Const';
import { EvtRefineryDone } from '../evt/Evt';
import { computeLoadedEssencesFromItems } from '../Refine';
import { computeRefinePreviewChem, computeEffectiveEssences } from '../RefinePreview';
import type { Point2 } from '../core/math';
import { runRaid, recomputeActiveRaidParams, toggleGearForRaid, recomputeActiveRaidEstimates } from '../Raid';
import type { QuestDefinition } from '../QuestLib';
import { getEffectiveRaidDefinition, pickAndApplyRaidSuccessMutation, describeMutation } from '../RaidMutation';
import { createWafer, placeMolecule, removeMolecule, enableCellWithFloodfill, computeWaferUpgradePrice } from '../Wafer';
import { applyResearchPurchase } from '../Research';

type Handler = (gs: GameState, cmd: CmdInput) => void;
const handlersByName = new Map<string, Handler>();

handlersByName.set('CmdAdvanceTime', (gs, cmd) => {
  gs.timeActive = true;
});

handlersByName.set('CmdStartRaid', (gs, cmd) => {
  const c = cmd as CmdStartRaid;
  if (!c.id) return;

  // Resolve selected raid as an effective copy (modded + active quest overlays)
  const def = getEffectiveRaidDefinition(gs, c.id);
  if (!def) return;

  if ((gs.reach || 0) < Math.max(0, def.reachRequired || 0)) {
    return;
  }

  recomputeActiveRaidParams(gs, c.id);

  const result = runRaid(gs, def);

  gs.gameTime = Math.max(0, (gs.gameTime || 0) + Math.max(0, result.timeSpentSec || 0));

  // End-of-raid quest processing (reach + skill points)
  let reachGained = 0;
  let skillPointsGained = 0;
  const completedNow: string[] = [];
  let zoneChange: string | null = null;
  if (result.success) {
    const allQuests = gs.lib.quests || new Map<string, QuestDefinition>();
    allQuests.forEach((q, id) => {
      const already = (gs.completedQuests || []).includes(id);
      const applies = (!q.raidRestriction || q.raidRestriction.includes(c.id)) && (!!q.autoaccept);
      if (!already && applies) {
        const r = q.rewards || {};
        const incReach = Math.max(0, r.reach || 0);
        if (incReach > 0) {
          gs.reach = Math.max(0, (gs.reach || 0) + incReach);
          reachGained += incReach;
        }
        const incSP = Math.max(0, (r as any).skillPoints || 0);
        if (incSP > 0) {
          gs.skillPoints = Math.max(0, (gs.skillPoints || 0) + incSP);
          skillPointsGained += incSP;
        }
        (gs.completedQuests || (gs.completedQuests = [])).push(id);
        completedNow.push(id);
      }
    });

    const chosen = pickAndApplyRaidSuccessMutation(gs, c.id);
    if (chosen) {
      zoneChange = describeMutation(gs, chosen.mutation);
    }
  }

  // Store outcome/log (shape will evolve later with more details)
  (gs as any).lastRaidOutcome = {
    id: c.id,
    success: !!result.success,
    log: result.log,
    timeSpentSec: result.timeSpentSec,
    plannedEncounters: result.plannedEncounters,
    reachGained,
    skillPointsGained,
    questsCompleted: completedNow,
    zoneChange,
    finalHp: gs.raid.hp,
    finalMaxHp: gs.raid.maxHp,
    finalBagsUsed: gs.raid.usedVolume,
    finalBagsCapacity: Math.max(0, gs.volume || 0) + Math.max(0, gs.raid.bagsVolume || 0),
  };
});

handlersByName.set('CmdStartRefining', (gs, cmd) => {
  if (gs.nextEvt && gs.nextEvt.name === 'EvtRefineryDone') return;
  if (!gs.wafer || gs.wafer.items.length === 0) return;

  const itemCounts = new Map<string, number>();
  // Use gs.wafer as the source of truth
  for (const placed of gs.wafer.items) {
    if (!placed) continue;
    const id = placed.id;
    itemCounts.set(id, (itemCounts.get(id) || 0) + 1);
  }

  for (const [itemId, count] of itemCounts) {
    const inv = gs.items;
    const entry = inv.find(x => x.id === itemId);
    if (!entry) continue;
    entry.quantity = Math.max(0, (entry.quantity || 0) - count);
    if (entry.quantity <= 0) {
      const i = inv.indexOf(entry);
      if (i >= 0) inv.splice(i, 1);
    }
  }

  const preview = computeRefinePreviewChem(gs.wafer);
  gs.refiningDuration = Math.max(0, Math.round(preview.timeSec || 0));

  const duration = gs.refiningDuration;
  gs.nextEvt = new EvtRefineryDone({ at: gs.gameTime + duration });
  gs.timeActive = true;
});

handlersByName.set('CmdAknowledgeOutcome', (gs, cmd) => {
  gs.lastRaidOutcome = null;
});

handlersByName.set('CmdAcknowledgeRefineryOutcome', (gs, cmd) => {
  gs.lastRefineryOutcome = null;
});

// Maze controls: movement via InputProcessor (Vue only dispatches commands)
handlersByName.set('CmdMazeMove', (gs, cmd) => {
  if (!gs.maze) return;
  const c = cmd as CmdMazeMove;
  let d: Point2 | null = null;
  switch (c.dir) {
    case 'up': d = { x: 0, y: -1 }; break;
    case 'left': d = { x: -1, y: 0 }; break;
    case 'down': d = { x: 0, y: 1 }; break;
    case 'right': d = { x: 1, y: 0 }; break;
  }
  if (d) gs.maze.tryMove(d);
});

handlersByName.set('CmdMazeReset', (gs, cmd) => {
  gs.labirinthResetRequested = true;
});

handlersByName.set('CmdMazeRestart', (gs, cmd) => {
  // Restart current level without regenerating layout (same seed/settings)
  if (gs.maze) gs.maze.reset();
});

// Raid UI commands
handlersByName.set('CmdSelectRaid', (gs, cmd) => {
  const c = cmd as CmdSelectRaid;
  if (!c.id) return;
  // Prevent selecting locked raids based on reach requirement
  const def = gs.lib.raids.get(c.id);
  if (!def) return;
  const reachReq = Math.max(0, (def as any).reachRequired || 0);
  if ((gs as any).reach < reachReq) return;
  recomputeActiveRaidParams(gs, c.id);
  recomputeActiveRaidEstimates(gs, 100);
});

handlersByName.set('CmdToggleGear', (gs, cmd) => {
  const c = cmd as CmdToggleGear;
  toggleGearForRaid(gs, c.raidId, c.gearId, c.selected);
  recomputeActiveRaidEstimates(gs, 100);
});

// Removed: unlocking gear slots logic

// Quests: toggle manual activation for non-autoaccept quests
handlersByName.set('CmdToggleQuest', (gs, cmd) => {
  const c = cmd as CmdToggleQuest;
  const id = (c.id || '').trim();
  if (!id) return;
  const q = gs.lib.quests.get(id);
  if (!q) return;
  // Ignore if quest is autoaccepted or completed
  if (q.autoaccept) return;
  if ((gs.completedQuests || []).includes(id)) return;
  const list = (gs.activeQuests || (gs.activeQuests = []));
  const i = list.indexOf(id);
  const want = !!c.active;
  if (want) {
    if (i === -1) list.push(id);
  } else {
    if (i !== -1) list.splice(i, 1);
  }
  // Active quests can mutate encounter composition; refresh estimates for active raid
  recomputeActiveRaidEstimates(gs, 100);
});

// Wafer manipulation handlers
handlersByName.set('CmdPlaceMolecule', (gs, cmd) => {
  const c = cmd as any; // CmdPlaceMolecule
  if (!gs.wafer) {
    gs.wafer = createWafer(3);
  }
  placeMolecule(gs.wafer, c.itemId, c.molecule, c.rotation ?? 0);
  computeEffectiveEssences(gs.wafer);
});

handlersByName.set('CmdRemoveMolecule', (gs, cmd) => {
  const c = cmd as any; // CmdRemoveMolecule
  if (!gs.wafer) return;
  removeMolecule(gs.wafer, c.itemIdx);
  computeEffectiveEssences(gs.wafer);
});

handlersByName.set('CmdGrowWafer', (gs, cmd) => {
  const c = cmd as CmdGrowWafer;
  if (!c.pos) return;

  if (!gs.wafer) {
    gs.wafer = createWafer(3);
  }

  const upgradesPurchased = (gs as any).waferUpgradesPurchased || 0;
  const price = computeWaferUpgradePrice(upgradesPurchased);
  const currentShards = (gs as any).shardDust || 0;
  if (currentShards < price) return;

  const added = enableCellWithFloodfill(gs.wafer, c.pos);
  if (added <= 0) return;

  (gs as any).shardDust = Math.max(0, currentShards - price);
  (gs as any).waferUpgradesPurchased = upgradesPurchased + 1;
  computeEffectiveEssences(gs.wafer);
});

handlersByName.set('CmdResearchNode', (gs, cmd) => {
  const c = cmd as CmdResearchNode;
  if (!c.pos) return;
  const lib = gs.lib.research;
  const result = applyResearchPurchase(gs, lib, c.pos.x, c.pos.y);
  if (result.success && gs.raid && gs.raid.id) {
    recomputeActiveRaidParams(gs, gs.raid.id);
    recomputeActiveRaidEstimates(gs, 100);
  }
});


export function processInputs(gameState: GameState): void {
  for (const command of globalInputQueue) {
    const handler = handlersByName.get(command.name);
    if (handler) {
      handler(gameState, command);
    } else {
      // Unknown commands are ignored but logged for visibility during dev
      // eslint-disable-next-line no-console
      console.warn(`[InputProcessor] No handler for command: ${command.name}`);
    }
  }
  globalInputQueue.length = 0;
}
