import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import type { GameState, RaidOutcome, RefineryOutcome } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { computeRefinePreview } from './Refine';
import { getEffectiveRaidDefinition } from './RaidMutation';
import { computeRefinePreviewChem } from './RefinePreview';
import type { Lib } from './Lib';
import { createWafer, type Wafer } from './Wafer';

// Reactive UI-facing state (kept separate from logical GameState)
export interface UIRaidDef extends RaidDefinition { }

export interface UIRefinery {
  health: number;
  hasRecipe: boolean;
  // When loaded
  recipeId?: string;
  startedAtSec?: number;
  timeRemainingSec?: number;
  progressPct?: number;
  ingredients?: Record<string, number>;
  overflowWaste?: Record<string, number>;
  expectedCredits?: number;
  expectedChrono?: number;
  expectedFlux?: number;
  failureChancePct?: number;
}

export const uiState = reactive({
  // top bar
  credits: 0,
  chronotraces: 0,
  timeFlux: 0,
  timeMinutes: 0,
  canAdvanceTime: false,
  timeActive: false,
  // reactive identity for active raid (forces recompute on change)
  raidKey: '' as string,

  strength: 0,
  speed: 0,
  volume: 0,
  looting: 0,

  raids: [] as UIRaidDef[],
  raidOrder: [] as string[],
  unlockedRaidIds: [] as string[],
  unlockedGear: [] as string[],
  activeQuests: [] as string[],
  questProgressById: {} as Record<string, number>,

  activeRaidId: '',
  selectedGearPrice: 0,

  // Estimates for active raid
  raidSurvivalPct: 0,
  raidTimeEstimateSec: 0,

  // modal outcome + levelups
  lastOutcome: null as RaidOutcome | null,
  lastRefineryOutcome: null as RefineryOutcome | null,
  levelupsAvailable: 0,

  // global tab state
  activeTab: 'raid' as 'raid' | 'refine' | 'research' | 'maze',

  // level-up modal state
  levelUpOpen: false,

  // recipe upgrade modal state
  recipeUpgradeOpen: false,
  recipeUpgradeCtx: null as null | { researchId: string; price: number; effect: 'modifyEssences' | 'increaseQuality'; params?: Record<string, number> },

  // cheat overlay state
  cheatOpen: false,
  devAtlasKey: '' as '' | 'items',

  // refine tab mirrors
  refineries: [] as UIRefinery[],
  items: [] as Array<{ id: string; quantity: number }>,
  recipes: [] as string[],
  research: [] as string[],
  recipesVersion: 0,
  // refine UI state
  selectedRefineryIndex: -1 as number,
  // wafer state exposed to UI
  wafer: createWafer(2) as Wafer,
  waferVersion: 0, // Increment to force reactivity

  // maze UI state
  mazeLevelIndex: 0,
  mazeMovesMade: 0,
  mazeMaxMoves: 0,
  mazeKeysCollected: 0,
  mazeTotalKeys: 0,
  mazeFailed: false,
  mazeSolved: false,
});

// Formatted time display: "X days, HH:MM"
export const timeDisplay = computed(() => {
  // Keep dependency reactive while sourcing precise seconds from gameRef when available
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.timeMinutes;
  const seconds = Math.max(0, Math.floor((gameRef?.time ?? (uiState.timeMinutes * 60)) || 0));
  return formatDurationHM(seconds);
});

// Next-event UI removed: no computed nextEventText

// Internal game reference for write-backs
let gameRef: GameState | null = null;

// Next-event identity tracking removed with next-event UI
// Track last seen raid snapshot identity to notify UI when gear/params change
let lastRaidKey = '' as string;
// Track wafer state to detect changes
let lastWaferItemCount = 0;
let lastWaferEnabledCount = 0;


export function SyncUIFromGameState(game: GameState): void {
  gameRef = game;
  uiState.credits = game.credits;
  uiState.chronotraces = game.chronotraces;
  uiState.timeFlux = game.timeFlux ?? 0;
  // Model tracks time in seconds; UI needs minutes for display
  uiState.timeMinutes = Math.floor((game.time || 0) / 60);
  uiState.canAdvanceTime = !!game.nextEvt;
  uiState.timeActive = game.timeActive;


  // Update reactive identity for active raid to drive UI recomputation
  const rk = game.raid
    ? `${game.raid.id}|${game.raid.hp}|${game.raid.maxHp}|${game.raid.baseSpeed}|${game.raid.speedBonusPct}|${game.raid.regenPerKm}|${game.raid.weight}|${game.raid.maxWeight}|${(game.raid.damage ?? game.damage ?? 1)}|${game.raid.bagsVolume}|${game.raid.usedVolume}`
    : '';
  if (rk !== lastRaidKey) {
    uiState.raidKey = rk;
    lastRaidKey = rk;
  }

  uiState.strength = game.strength;
  uiState.speed = game.speed ?? 0;
  uiState.volume = game.volume;
  uiState.looting = game.looting;

  // Present effective raid definitions (permanent + active quest overlays) to the UI
  const raids: UIRaidDef[] = [];
  const order: string[] = [];
  game.lib.raids.forEach((_, id) => {
    const eff = getEffectiveRaidDefinition(game, id) as UIRaidDef | null;
    if (eff) {
      raids.push(eff);
      order.push(id);
    }
  });
  uiState.raids = raids;
  uiState.raidOrder = order;

  // unlocked raids and their quest progress
  uiState.unlockedRaidIds = game.unlockedRaids.map(r => r.id);
  uiState.unlockedGear = Array.isArray(game.unlockedGear) ? [...game.unlockedGear] : [];
  uiState.activeQuests = Array.isArray((game as any).activeQuests) ? [...(game as any).activeQuests] : [];
  const progress: Record<string, number> = {};
  game.unlockedRaids.forEach(r => { progress[r.id] = r.questProgress; });
  uiState.questProgressById = progress;

  uiState.activeRaidId = game.raid.id;
  uiState.selectedGearPrice = game.selectedGearPrice ?? 0;
  uiState.raidSurvivalPct = (game as any).raidSurvivalEstimatePct || 0;
  uiState.raidTimeEstimateSec = (game as any).raidTimeEstimateSec || 0;

  // sync outcome and levelups
  uiState.lastOutcome = game.lastRaidOutcome;
  uiState.lastRefineryOutcome = game.lastRefineryOutcome;
  uiState.levelupsAvailable = game.levelupsAvailable;

  // refine tab basics (single refinery)
  const entries: UIRefinery[] = [];
  const hasWafer = !!game.wafer;
  const base: UIRefinery = { health: 100, hasRecipe: hasWafer };
  if (hasWafer && game.nextEvt?.name === 'EvtRefineryDone') {
    base.recipeId = '';
    base.startedAtSec = (game.nextEvt.at || 0) - (4 * 3600);
    const duration = 4 * 3600;
    if (duration > 0) {
      const elapsed = Math.max(0, (game.time || 0) - base.startedAtSec);
      const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
      const remaining = Math.max(0, Math.round(duration - elapsed));
      base.progressPct = progressPct;
      base.timeRemainingSec = remaining;
    } else {
      base.progressPct = 0;
      base.timeRemainingSec = 0;
    }
    const preview = computeRefinePreviewChem(game.wafer!);
    base.expectedCredits = preview.expectedCredits;
    base.expectedChrono = preview.expectedChrono;
    base.expectedFlux = preview.expectedFlux;
    base.failureChancePct = preview.failureChancePct;
  }
  // Always present a single panel so layout stays consistent
  entries.push(base);
  uiState.refineries = entries;
  uiState.items = (game.items || []).map(it => ({ id: it.id, quantity: it.quantity }));
  uiState.recipes = Array.isArray(game.recipes) ? [...game.recipes] : [];
  if (game.research && typeof (game.research as Set<string>).forEach === 'function' && typeof (game.research as Set<string>).has === 'function') uiState.research = Array.from(game.research as Set<string>);
  else uiState.research = [];

  // Propagate lib recipes version for UI reactivity on upgrades
  uiState.recipesVersion = game.lib.recipesVersion || 0;

  // Sync wafer state
  uiState.wafer = game.wafer;
  // Increment version if wafer content changed (for reactivity)
  if (game.wafer) {
    const currentItemCount = Array.isArray(game.wafer.items) ? game.wafer.items.filter(item => item !== null).length : 0;
    const currentEnabledCount = game.wafer.enabledCount;
    if (currentItemCount !== lastWaferItemCount || currentEnabledCount !== lastWaferEnabledCount) {
      uiState.waferVersion++;
      lastWaferItemCount = currentItemCount;
      lastWaferEnabledCount = currentEnabledCount;
    }
  }


  // Sync maze state for reactivity
  uiState.mazeLevelIndex = game.mazeLevelIndex || 0;
  const maze = game.maze;
  if (maze) {
    uiState.mazeMovesMade = maze.movesMade || 0;
    uiState.mazeMaxMoves = maze.maxMoves || 0;
    uiState.mazeKeysCollected = maze.state?.keysCollected || 0;
    uiState.mazeTotalKeys = maze.state?.keys?.length || 0;
    uiState.mazeFailed = !!maze.state?.failed;
    uiState.mazeSolved = (maze.state?.keys?.length || 0) === (maze.state?.keysCollected || 0);
  } else {
    uiState.mazeMovesMade = 0;
    uiState.mazeMaxMoves = 0;
    uiState.mazeKeysCollected = 0;
    uiState.mazeTotalKeys = 0;
    uiState.mazeFailed = false;
    uiState.mazeSolved = false;
  }
}

// Expose current game lib for UI components that need live definitions (e.g., modded recipes)
export function getGameLib(): Lib {
  return gameRef!.lib;
}

// Provide read-only access to the current GameState (for UI components that need live instances)
export function getGameState(): GameState {
  return gameRef!;
}
// Raids UI helpers were removed during migration to the new raid system.
