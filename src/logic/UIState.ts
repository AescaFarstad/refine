import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import type { GameState, RaidOutcome, RefineryOutcome } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { computeRaidStats, type EquipmentType as CalcEquipmentType } from './Raid';
import { computeRefinePreview } from './Refine';

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
  failureChancePct?: number;
}

export const uiState = reactive({
  // top bar
  credits: 0,
  chronotraces: 0,
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
  activeTab: 'raid' as 'raid' | 'refine' | 'research',

  // level-up modal state
  levelUpOpen: false,

  // cheat overlay state
  cheatOpen: false,
  devAtlasKey: '' as '' | 'items',

  // refine tab mirrors
  refineries: [] as UIRefinery[],
  items: [] as Array<{ id: string; quantity: number }>,
  recipes: [] as string[],
  // refine UI state
  selectedRefineryIndex: -1 as number,
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
  if (evt.name === 'EvtRefineryDone') {
    const idx = ((evt as any).refineryIndex ?? 0) as number;
    return `Refinery ${idx + 1} in ${when}`;
  }
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
  // Model tracks time in seconds; UI needs minutes for display
  uiState.timeMinutes = Math.floor((game.time || 0) / 60);
  uiState.canAdvanceTime = !!game.nextEvt;

  // Update reactive next event identity so dependent UI recomputes when it changes
  const key = game.nextEvt
    ? `${game.nextEvt.name}|${game.nextEvt.at ?? ''}|${
        game.nextEvt.name === 'EvtRefineryDone'
          ? `ridx:${(game.nextEvt as any).refineryIndex ?? ''}`
          : game.nextEvt.name === 'EvtRaidComplete'
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

  // refine tab basics
  uiState.refineries = (game.refineries || []).map(r => {
    const hasRecipe = !!r.loadedRecipe;
    const entry: UIRefinery = {
      health: r.health,
      hasRecipe,
    };
    if (hasRecipe) {
      entry.recipeId = r.loadedRecipe;
      entry.startedAtSec = r.startedAt;
      const recipe = game.lib.recipes.get(r.loadedRecipe);
      const duration = Math.max(0, recipe?.duration || 0);
      if (duration > 0) {
        const elapsed = Math.max(0, (game.time || 0) - (r.startedAt || 0));
        const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
        const remaining = Math.max(0, Math.round(duration - elapsed));
        entry.progressPct = progressPct;
        entry.timeRemainingSec = remaining;
      } else {
        entry.progressPct = 0;
        entry.timeRemainingSec = 0;
      }
      const ingredients = (recipe?.ingredients || {}) as Record<string, number>;
      entry.ingredients = ingredients;
      entry.overflowWaste = (r.overflowEssences || {}) as Record<string, number>;

      const preview = computeRefinePreview(game.lib, r.loadedRecipe, r.health, ingredients);
      entry.expectedCredits = preview.expectedCredits;
      entry.expectedChrono = preview.expectedChrono;
      entry.failureChancePct = preview.failureChancePct;
    }
    return entry;
  });
  uiState.items = (game.items || []).map(it => ({ id: it.id, quantity: it.quantity }));
  uiState.recipes = Array.isArray((game as any).recipes) ? [...(game as any).recipes] : [];
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
