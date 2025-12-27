import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import type { GameState, RaidOutcome, RefineryOutcome, Shard } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { getEffectiveRaidDefinition } from './RaidMutation';
import { computeRefinePreviewChem } from './RefinePreview';
import type { Lib } from './Lib';
import { createWafer, type Wafer } from './Wafer';
import type { Point2 } from './ItemLib';

export interface UIRaidDef extends RaidDefinition { }

export interface UIRefinery {
  health: number;
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
  lib: null as Lib | null,

  credits: 0,
  chronotraces: 0,
  timeFlux: 0,
  shardDust: 0,
  timeMinutes: 0,
  canAdvanceTime: false,
  timeActive: false,
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

  raidSurvivalPct: 0,
  raidTimeEstimateSec: 0,

  lastOutcome: null as RaidOutcome | null,
  lastRefineryOutcome: null as RefineryOutcome | null,
  levelupsAvailable: 0,

  activeTab: 'raid' as 'raid' | 'refine' | 'research' | 'maze',

  levelUpOpen: false,

  cheatOpen: false,
  devAtlasKey: '' as '' | 'items',
  devMoleculeEditorOpen: false,
  editResearchOpen: false,

  refineries: [] as UIRefinery[],
  items: [] as Array<{ id: string; quantity: number }>,
  waferUpgradesPurchased: 0,
  selectedRefineryIndex: -1 as number,
  wafer: createWafer(2) as Wafer,
  waferSize: { x: 0, y: 0 } as Point2,
  shards: [] as Shard[],
  waferVersion: 0,

  mazeLevelIndex: 0,
  mazeMovesMade: 0,
  mazeMaxMoves: 0,
  mazeKeysCollected: 0,
  mazeTotalKeys: 0,
  mazeFailed: false,
  mazeSolved: false,

  researchOwnedCount: 0,
  researchRevealRadius: 0,
  researchEditMode: '' as '' | 'empty' | 'void' | 'obstacle',
  researchEditVersion: 0,
});

// Formatted time display: "X days, HH:MM"
export const timeDisplay = computed(() => {
  // Keep dependency reactive while sourcing precise seconds from gameRef when available
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.timeMinutes;
  const seconds = Math.max(0, Math.floor((gameRef?.gameTime ?? (uiState.timeMinutes * 60)) || 0));
  return formatDurationHM(seconds);
});

let gameRef: GameState | null = null;

let lastRaidKey = '' as string;
let lastWaferItemCount = 0;
let lastWaferEnabledCount = 0;


export function SyncUIFromGameState(game: GameState): void {
  gameRef = game;
  uiState.lib = game.lib;
  uiState.credits = game.credits;
  uiState.chronotraces = game.chronotraces;
  uiState.timeFlux = game.timeFlux ?? 0;
  uiState.shardDust = (game as any).shardDust || 0;
  // Model tracks time in seconds; UI needs minutes for display
  uiState.timeMinutes = Math.floor((game.gameTime || 0) / 60);
  uiState.canAdvanceTime = !!game.nextEvt;
  uiState.timeActive = game.timeActive;

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

  uiState.lastOutcome = game.lastRaidOutcome;
  uiState.lastRefineryOutcome = game.lastRefineryOutcome;
  uiState.levelupsAvailable = game.levelupsAvailable;

  const entries: UIRefinery[] = [];
  const hasWafer = !!game.wafer;
  const base: UIRefinery = { health: 100 };
  if (hasWafer && game.nextEvt?.name === 'EvtRefineryDone') {
    const preview = computeRefinePreviewChem(game.wafer!);
    const duration = Math.max(0, game.refiningDuration || preview.timeSec || 0);
    const startedAt = (game.nextEvt.at || 0) - duration;

    base.startedAtSec = startedAt;
    if (duration > 0) {
      const elapsed = Math.max(0, (game.gameTime || 0) - startedAt);
      const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
      const remaining = Math.max(0, Math.round(duration - elapsed));
      base.progressPct = progressPct;
      base.timeRemainingSec = remaining;
    } else {
      base.progressPct = 0;
      base.timeRemainingSec = 0;
    }
    base.expectedCredits = preview.expectedCredits;
    base.expectedChrono = preview.expectedChrono;
    base.expectedFlux = preview.expectedFlux;
    base.failureChancePct = preview.failureChancePct;
  }
  entries.push(base);
  uiState.refineries = entries;
  uiState.items = (game.items || []).map(it => ({ id: it.id, quantity: it.quantity }));

  uiState.wafer = game.wafer;
  uiState.waferSize = game.waferSize;
  uiState.shards = game.shards;
  uiState.waferUpgradesPurchased = (game as any).waferUpgradesPurchased || 0;

  if (game.wafer) {
    const currentItemCount = Array.isArray(game.wafer.items) ? game.wafer.items.filter(item => item !== null).length : 0;
    const currentEnabledCount = game.wafer.enabledCount;
    if (currentItemCount !== lastWaferItemCount || currentEnabledCount !== lastWaferEnabledCount) {
      uiState.waferVersion++;
      lastWaferItemCount = currentItemCount;
      lastWaferEnabledCount = currentEnabledCount;
    }
  }

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

  if (game.researchOwnedCount !== uiState.researchOwnedCount) {
    uiState.researchOwnedCount = game.researchOwnedCount;
  }

  const radius = (game as any).researchRevealRadius;
  uiState.researchRevealRadius = typeof radius === 'number' ? radius : 0;
}

// Expose current game lib for UI components that need live definitions
export function getGameLib(): Lib {
  return gameRef!.lib;
}

// Provide read-only access to the current GameState (for UI components that need live instances)
export function getGameState(): GameState {
  return gameRef!;
}
