import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import type { GameState, RaidOutcome, RefineryOutcome } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { computeRaidStats, type EquipmentType as CalcEquipmentType } from './Raid';
import { computeRefinePreview } from './Refine';
import type { Lib } from './Lib';

// Reactive UI-facing state (kept separate from logical GameState)
export interface UIRaidDef extends RaidDefinition {}
export type EquipmentType = 'light' | 'medium' | 'overprice';

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
  // reactive identity for next scheduled event (forces recompute on change)
  nextEvtKey: '' as string,

  strength: 0,
  speed: 0,
  volume: 0,
  looting: 0,

  raids: [] as UIRaidDef[],
  raidOrder: [] as string[],
  unlockedRaidIds: [] as string[],
  questProgressById: {} as Record<string, number>,

  sliders: {} as Record<string, { quest: number; survive: number; loot: number }>,

  equipmentById: {} as Record<string, EquipmentType>,

  activeRaidId: '',
  activeRaidProgress: 0,

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

// Next event display string, e.g., "Shegolskoe raid in 25m" or "Refinery 1 in 2h 40m"
export const nextEventText = computed(() => {
  // Touch reactive deps so this recomputes as time and queue change
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.timeMinutes;
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.canAdvanceTime;
  // Also track identity changes of the next event
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.nextEvtKey;

  if (!gameRef || !gameRef.nextEvt) return '';
  const evt = gameRef.nextEvt;
  const remaining = Math.max(0, Math.round((evt.at || 0) - (gameRef.time || 0)));
  const when = formatDurationHM(remaining);

  if (evt.name === 'EvtRaidComplete') {
    const id = gameRef.raid.id;
    const def = id ? gameRef.lib.raids.get(id) : undefined;
    const title = def?.name ?? (id || 'Raid');
    return `${title} raid in ${when}`;
  }
  if (evt.name === 'EvtRefineryDone') return `Refinery in ${when}`;
  return '';
});

// Internal game reference for write-backs
let gameRef: GameState | null = null;

// Track last seen next event identity to update reactive key only on change
let lastNextEvtKey = '' as string;

export function SyncUIFromGameState(game: GameState): void {
  gameRef = game;
  uiState.credits = game.credits;
  uiState.chronotraces = game.chronotraces;
  uiState.timeFlux = (game as any).timeFlux ?? 0;
  // Model tracks time in seconds; UI needs minutes for display
  uiState.timeMinutes = Math.floor((game.time || 0) / 60);
  uiState.canAdvanceTime = !!game.nextEvt;

  // Update reactive next event identity so dependent UI recomputes when it changes
  const key = game.nextEvt
    ? `${game.nextEvt.name}|${game.nextEvt.at ?? ''}|${
        game.nextEvt.name === 'EvtRaidComplete'
          ? `raid:${game.raid.id ?? ''}`
          : ''
      }`
    : '';
  if (key !== lastNextEvtKey) {
    uiState.nextEvtKey = key;
    lastNextEvtKey = key;
  }

  uiState.strength = game.strength;
  uiState.looting = game.looting;
  uiState.volume = game.volume;
  uiState.looting = game.looting;

  const raids: UIRaidDef[] = [];
  const order: string[] = [];
  game.lib.raids.forEach((def, id) => {
    raids.push(def);
    order.push(id);
    ensureSliders(id);
    ensureEquipment(id);
  });
  uiState.raids = raids;
  uiState.raidOrder = order;

  // unlocked raids and their quest progress
  uiState.unlockedRaidIds = game.unlockedRaids.map(r => r.id);
  const progress: Record<string, number> = {};
  game.unlockedRaids.forEach(r => { progress[r.id] = r.questProgress; });
  uiState.questProgressById = progress;

  uiState.activeRaidId = game.raid.id;
  uiState.activeRaidProgress = game.raid.progress;

  // sync outcome and levelups
  uiState.lastOutcome = game.lastRaidOutcome;
  uiState.lastRefineryOutcome = game.lastRefineryOutcome;
  uiState.levelupsAvailable = game.levelupsAvailable;

  // refine tab basics (single refinery)
  const entries: UIRefinery[] = [];
  const loadedId = (game as any).loadedRecipe as string;
  const startedAt = (game as any).recipeStartedAt as number;
  const hasRecipe = !!loadedId;
  const base: UIRefinery = { health: 100, hasRecipe };
  if (hasRecipe) {
    base.recipeId = loadedId;
    base.startedAtSec = startedAt;
    const recipe = game.lib.recipes.get(loadedId);
    const duration = Math.max(0, recipe?.duration || 0);
    if (duration > 0) {
      const elapsed = Math.max(0, (game.time || 0) - (startedAt || 0));
      const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
      const remaining = Math.max(0, Math.round(duration - elapsed));
      base.progressPct = progressPct;
      base.timeRemainingSec = remaining;
    } else {
      base.progressPct = 0;
      base.timeRemainingSec = 0;
    }
    const ingredients = (recipe?.ingredients || {}) as Record<string, number>;
    base.ingredients = ingredients;
    base.overflowWaste = ((game as any).overflowEssences || {}) as Record<string, number>;

    const preview = computeRefinePreview(game.lib, loadedId, 100, ingredients);
    base.expectedCredits = preview.expectedCredits;
    base.expectedChrono = preview.expectedChrono;
    base.expectedFlux = preview.expectedFlux;
    base.failureChancePct = preview.failureChancePct;
  }
  // Always present a single panel so layout stays consistent
  entries.push(base);
  uiState.refineries = entries;
  uiState.items = (game.items || []).map(it => ({ id: it.id, quantity: it.quantity }));
  uiState.recipes = Array.isArray((game as any).recipes) ? [...(game as any).recipes] : [];
  const r: any = (game as any).research;
  if (Array.isArray(r)) uiState.research = [...r];
  else if (r && typeof r.forEach === 'function' && typeof r.has === 'function') uiState.research = Array.from(r as Set<string>);
  else uiState.research = [];

  // Propagate lib recipes version for UI reactivity on upgrades
  uiState.recipesVersion = (game.lib as any).recipesVersion || 0;

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
export function getGameLib(): Lib | null {
  return gameRef?.lib ?? null;
}

// Provide read-only access to the current GameState (for UI components that need live instances)
export function getGameState(): GameState | null {
  return gameRef;
}

// Ensure sliders exist with default 50/50/50 for a raid id
export function ensureSliders(id: string): void {
  if (!uiState.sliders[id]) {
    uiState.sliders[id] = { quest: 100, survive: 100, loot: 100 };
  }
}

export function ensureEquipment(id: string): void {
  if (!uiState.equipmentById[id]) {
    uiState.equipmentById[id] = 'medium';
  }
}

export function getEquipment(id: string): EquipmentType {
  ensureEquipment(id);
  return uiState.equipmentById[id];
}

export function setEquipment(id: string, type: EquipmentType): void {
  uiState.equipmentById[id] = type;
}

export interface UIRaidStats {
  effectiveStrength: number;
  survivalChancePct: number;
  lootRatePct: number;
  questDeltaPct: number;
  equipmentPrice: number;
}

export function computeRaidStatsUI(
  def: UIRaidDef,
  quest: number,
  survive: number,
  loot: number,
  equipment: EquipmentType,
): UIRaidStats {
  // Touch reactive player stats so callers' computed() re-evaluates when they change
  // This keeps raid stats in sync after level-ups or other stat updates.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.strength; // reactive dependency
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.volume;   // future use if formula uses volume
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.speed;    // future use if formula uses speed
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.looting;  // future use if UI depends on it

  if (!gameRef) {
    return { effectiveStrength: 0, survivalChancePct: 0, lootRatePct: 0, questDeltaPct: 0, equipmentPrice: 0 };
  }
  const r = computeRaidStats(
    gameRef,
    def,
    quest,
    survive,
    loot,
    equipment as CalcEquipmentType,
  );
  return {
    effectiveStrength: r.strength,
    survivalChancePct: r.survivalChancePct,
    lootRatePct: r.lootRatePct,
    questDeltaPct: r.questDeltaPct,
    equipmentPrice: r.price,
  };
}

// Display list: all unlocked raids followed by only the next locked one
export const displayRaids = computed(() => {
  const unlockedSet = new Set(uiState.unlockedRaidIds);
  const items = [] as Array<{ def: UIRaidDef; locked: boolean; questProgress: number; questsDone: number }>;
  let showedLocked = false;
  for (const id of uiState.raidOrder) {
    const def = uiState.raids.find(r => r.id === id);
    if (!def) continue;
    const isUnlocked = unlockedSet.has(id);
    if (isUnlocked) {
      // find matching raid in game to get questsDone; fall back to 0
      const raid = gameRef?.unlockedRaids.find(r => r.id === id);
      const questsDone = raid?.questsDone ?? 0;
      items.push({ def, locked: false, questProgress: uiState.questProgressById[id] ?? 0, questsDone });
    } else if (!showedLocked) {
      items.push({ def, locked: true, questProgress: 0, questsDone: 0 });
      showedLocked = true;
    }
  }
  return items;
});

export const isAnyRaidActive = computed(() => !!uiState.activeRaidId);
export function isRaidActive(id: string): boolean {
  return uiState.activeRaidId === id;
}

export function startRaid(id: string): void {
  if (!gameRef) return;
  if (gameRef.raid.id) return; // already running something
  const s = uiState.sliders[id] ?? { quest: 100, survive: 100, loot: 100 };
  gameRef.raid.id = id;
  gameRef.raid.progress = 0;
  // copy player stats
  gameRef.raid.looting = gameRef.looting;
  gameRef.raid.strength = gameRef.strength;
  gameRef.raid.volume = gameRef.volume;
  // copy focus weights
  gameRef.raid.questWeight = s.quest;
  gameRef.raid.surviveWeight = s.survive;
  gameRef.raid.lootWeight = s.loot;

  // reflect in UI mirror
  uiState.activeRaidId = gameRef.raid.id;
  uiState.activeRaidProgress = gameRef.raid.progress;
}

// Helper labels for sliders
export function questDeltaLabel(value: number): string {
  const delta = Math.round(value - 100);
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}%`;
}
