import type { GameState } from '../GameState';
import { globalInputQueue } from '../Model';
import type { CmdInput } from './InputCommands';
import { CmdStartRaid, CmdAdvanceTime, CmdAknowledgeOutcome, CmdLevelup, CmdStartRefining, CmdAcknowledgeRefineryOutcome, CmdPurchaseResearch, CmdUpgradeRecipe, CmdMazeMove, CmdMazeReset, type MazeDir, CmdMazeRestart } from './InputCommands';
import { LEVEL_UP_STRENGTH, LEVEL_UP_LOOTING, LEVEL_UP_VOLUME, RESEARCH_TIER_PRICE, RESEARCH_TIER_ITEM_PRICE } from '../Const';
import { computeNextEvt } from '../Model';
import { computeLoadedEssencesFromItems, computeOverflowEssences } from '../Refine';
import { applyRecipeUpgrade } from '../Recipe';
import type { Point2 } from '../core/math';

type Handler = (gs: GameState, cmd: CmdInput) => void;
const handlersByName = new Map<string, Handler>();

handlersByName.set('CmdAdvanceTime', (gs, cmd) => {
  gs.timeActive = true;
});

handlersByName.set('CmdStartRaid', (gs, cmd) => {
  const c = cmd as CmdStartRaid;
  if (!c.id || gs.raid.id) return;
  gs.raid.id = c.id;
  gs.raid.progress = 0;
  // copy player stats at deployment time
  gs.raid.strength = gs.strength;
  gs.raid.volume = gs.volume;
  gs.raid.looting = gs.looting;
  // copy focus weights from UI-provided values
  gs.raid.questWeight = c.quest;
  gs.raid.surviveWeight = c.survive;
  gs.raid.lootWeight = c.loot;
  gs.raid.equipment = c.equipment;
  gs.credits -= c.cost;

  computeNextEvt(gs);
});

handlersByName.set('CmdAknowledgeOutcome', (gs, cmd) => {
  // Clear last raid outcome from game state
  gs.lastRaidOutcome = null;
});

handlersByName.set('CmdLevelup', (gs, cmd) => {
  if (gs.levelupsAvailable <= 0) return;
  const c = cmd as CmdLevelup;
  switch (c.stat) {
    case 'strength':
      gs.strength += LEVEL_UP_STRENGTH;
      break;
    case 'volume':
      gs.volume += LEVEL_UP_VOLUME;
      break;
    case 'looting':
      gs.looting += LEVEL_UP_LOOTING;
      break;
  }
  gs.levelupsAvailable = Math.max(0, gs.levelupsAvailable - 1);
});

handlersByName.set('CmdStartRefining', (gs, cmd) => {
  const c = cmd as CmdStartRefining;
  if (gs.loadedRecipe) return; // already running

  // Remove specified items from inventory
  for (const it of c.items || []) {
    const inv = gs.items;
    const entry = inv.find(x => x.id === it.id);
    if (!entry) continue;
    const q = Math.max(0, it.quantity || 0);
    entry.quantity = Math.max(0, (entry.quantity || 0) - q);
    if (entry.quantity <= 0) {
      const i = inv.indexOf(entry);
      if (i >= 0) inv.splice(i, 1);
    }
  }

  const totals = computeLoadedEssencesFromItems(gs.lib, c.items || []);
  (gs as any).overflowEssences = computeOverflowEssences(gs.lib, c.recipeId, totals);
  (gs as any).loadedRecipe = c.recipeId;
  (gs as any).recipeStartedAt = gs.time;

  computeNextEvt(gs);
});

handlersByName.set('CmdAcknowledgeRefineryOutcome', (gs, cmd) => {
  gs.lastRefineryOutcome = null;
});

handlersByName.set('CmdPurchaseResearch', (gs, cmd) => {
  const c = cmd as CmdPurchaseResearch;
  const id = (c.id || '').trim();
  if (!id) return;
  // Prevent double-purchase
  if (gs.research && (gs.research as Set<string>).has(id)) return;
  const price = Math.max(0, Math.round(c.price || 0));
  if ((gs.chronotraces || 0) < price) return;
  // Enforce tier gating for non-tier purchases
  const isTier = id.startsWith('tier_');
  let nodeTierIndex = -1;
  let node: any = null;
  if (!isTier) {
    const tiers = gs.lib.research || [];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t && Object.prototype.hasOwnProperty.call(t, id)) {
        nodeTierIndex = i;
        node = (t as any)[id];
        break;
      }
    }
    if (nodeTierIndex === -1) return; // unknown node
    const requiredTierId = `tier_${nodeTierIndex}`;
    if (!gs.research || !(gs.research as Set<string>).has(requiredTierId)) {
      return; // cannot buy items from locked tier
    }
  }
  // Deduct and record purchase
  gs.chronotraces = Math.max(0, (gs.chronotraces || 0) - price);
  if (!gs.research) (gs as any).research = new Set<string>();
  (gs.research as Set<string>).add(id);

  // Apply effects for certain research nodes
  if (!isTier && node) {
    const eff = (node as any).effect;
    if (eff === 'giveStrength') {
      const amt = Math.round((node as any).amount || 0);
      gs.strength = Math.max(0, (gs.strength || 0) + amt);
    } else if (eff === 'giveLooting') {
      const amt = Math.round((node as any).amount || 0);
      gs.looting = Math.max(0, (gs.looting || 0) + amt);
    } else if (eff === 'giveVolume') {
      const amt = Math.round((node as any).amount || 0);
      gs.volume = Math.max(0, (gs.volume || 0) + amt);
    } else if (eff === 'giveRecipe') {
      const recId = (node as any).upgradeId as string;
      if (recId) {
        if (!Array.isArray(gs.recipes)) gs.recipes = [];
        if (!gs.recipes.includes(recId)) gs.recipes.push(recId);
      }
    }
    // Note: recipeUpgrade has no immediate effect applied here
  }
});

handlersByName.set('CmdUpgradeRecipe', (gs, cmd) => {
  const c = cmd as CmdUpgradeRecipe;
  const researchId = (c.researchId || '').trim();
  const recipeId = (c.recipeId || '').trim();
  if (!researchId || !recipeId) return;
  // Must own the research node
  if (!gs.research || !(gs.research as Set<string>).has(researchId)) return;

  // Resolve the research node to find its upgradeId
  let node: any = null;
  const tiers = gs.lib.research || [];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t && Object.prototype.hasOwnProperty.call(t, researchId)) {
      node = (t as any)[researchId];
      break;
    }
  }
  if (!node || node.effect !== 'recipeUpgrade') return;
  const upgradeId = (node as any).upgradeId as string;
  if (!upgradeId) return;

  // Load target recipe and upgrade definition
  const rec = gs.lib.recipes.get(recipeId);
  const up = gs.lib.recipeUpgrades.get(upgradeId);
  if (!rec || !up) return;

  // Apply upgrade to the current modded recipe, ensuring no essence goes below 0
  const modded = applyRecipeUpgrade(rec, up, gs.lib.recipeQualities);
  gs.lib.recipes.set(recipeId, modded);
  // Bump version so UI recomputes recipe-derived views
  (gs.lib as any).recipesVersion = ((gs.lib as any).recipesVersion || 0) + 1;
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
  // Signal model to rebuild the current level on the next update
  (gs as any)._labirinthResetRequested = true; // note: 'labirinth' matches Model/GameState
});

handlersByName.set('CmdMazeRestart', (gs, cmd) => {
  // Restart current level without regenerating layout (same seed/settings)
  if (gs.maze) gs.maze.reset();
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
