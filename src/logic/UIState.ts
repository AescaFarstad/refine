import { reactive, computed } from 'vue';
import type { GameState, RaidOutcome } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { computeRaidStats, type EquipmentType as CalcEquipmentType } from './Raid';

// Reactive UI-facing state (kept separate from logical GameState)
export interface UIRaidDef extends RaidDefinition {}
export type EquipmentType = 'light' | 'medium' | 'overprice';

export const uiState = reactive({
  // top bar
  credits: 0,
  chronotraces: 0,
  timeMinutes: 0,
  canAdvanceTime: false,

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
  levelupsAvailable: 0,

  // global tab state
  activeTab: 'raid' as 'raid' | 'refine' | 'research',

  // level-up modal state
  levelUpOpen: false,

  // cheat overlay state
  cheatOpen: false,
  devAtlasKey: '' as '' | 'items',

  // refine tab mirrors
  refineries: [] as Array<{ health: number; hasRecipe: boolean }>,
  items: [] as Array<{ id: string; quantity: number }>,
  recipes: [] as string[],
});

// Formatted time display: "X days, HH:MM"
export const timeDisplay = computed(() => {
  const total = Math.max(0, Math.floor(uiState.timeMinutes || 0));
  const minutesPerDay = 24 * 60;
  const days = Math.floor(total / minutesPerDay);
  const remainder = total % minutesPerDay;
  const hours = Math.floor(remainder / 60);
  const minutes = remainder % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${days} days, ${hh}:${mm}`;
});

// Internal game reference for write-backs
let gameRef: GameState | null = null;

export function SyncUIFromGameState(game: GameState): void {
  gameRef = game;
  uiState.credits = game.credits;
  uiState.chronotraces = game.chronotraces;
  // Model tracks time in seconds; UI needs minutes for display
  uiState.timeMinutes = Math.floor((game.time || 0) / 60);
  uiState.canAdvanceTime = !!game.nextEvt;

  uiState.strength = game.strength;
  uiState.speed = game.speed;
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
  uiState.levelupsAvailable = game.levelupsAvailable;

  // refine tab basics
  uiState.refineries = (game.refineries || []).map(r => ({
    health: r.health,
    hasRecipe: !!r.loadedRecipe,
  }));
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
  gameRef.raid.speed = gameRef.speed;
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
