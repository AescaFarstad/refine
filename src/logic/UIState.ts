import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import type { GameState, RaidOutcome, RefineryOutcome, Shard } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { getEffectiveRaidDefinition } from './Raid';
import { computeRefinePreviewChem } from './RefinePreview';
import type { Lib } from './Lib';
import { createWafer, type Wafer } from './Wafer';
import type { Point2 } from './ItemLib';
import { IS_DEBUG } from './Const';
import { DISCOVERY } from './DiscoveryLib';

export interface UIRaidDef extends RaidDefinition { }

export interface UIRefinery {
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
  skillPoints: 0,
  timeMinutes: 0,
  canAdvanceTime: false,
  timeActive: false,
  raidKey: '' as string,

  strength: 0,
  speed: 0,
  volume: 0,

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
  raidZoneCollapseDeathPct: 0,

  lastOutcome: null as RaidOutcome | null,
  lastRefineryOutcome: null as RefineryOutcome | null,

  activeTab: 'raid' as 'raid' | 'refine' | 'research' | 'maze',

  gearUpgradeModalOpen: false,
  gearUpgradeFocusCategory: '' as string,
  hasDiscoveredGearUpgradeModal: false,
  hasEverHadShards: false,

  cheatOpen: false,
  devAtlasKey: '' as '' | 'items',
  devMoleculeEditorOpen: false,
  editResearchOpen: IS_DEBUG,

  refinery: null as UIRefinery | null,
  items: [] as Array<{ id: string; quantity: number }>,
  encounteredEssences: [] as string[],
  discoveryCounter: 0,
  waferUpgradesPurchased: 0,
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
  researchEditMode: '' as string,
  researchEditVersion: 0,
  researchPlacementRadius: 0,
  researchNewlyPlaced: [] as Array<{ archetypeId: string; cells: { x: number; y: number }; radius: number }>,
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
  uiState.shardDust = game.shardDust || 0;
  uiState.skillPoints = game.skillPoints || 0;
  // Model tracks time in seconds; UI needs minutes for display
  uiState.timeMinutes = Math.floor((game.gameTime || 0) / 60);
  uiState.canAdvanceTime = !!game.nextEvt;
  uiState.timeActive = game.timeActive;

  const loadoutIds = (game.loadouts && game.raid && game.raid.id) ? game.loadouts[game.raid.id] : null;
  const loadoutKey = Array.isArray(loadoutIds) ? [...loadoutIds].sort().join(',') : '';
  const rk = game.raid
    ? `${game.raid.id}|${game.raid.hp}|${game.raid.maxHp}|${game.raid.baseSpeed}|${game.raid.speedBonusPct}|${game.raid.speedBonusFlat}|${game.raid.regenPerKm}|${game.raid.regenAfterEncounter}|${game.raid.weight}|${game.raid.maxWeight}|${(game.raid.damage ?? game.damage ?? 1)}|${game.raid.bagsVolume}|${game.raid.usedVolume}|${game.raid.lootChanceBonus}|${game.raid.tmpLootBuffAppliedPct}|${game.raid.hitChance}|${game.raid.blockChance}|${game.raid.reflectOnHitPct}|${game.raid.reflectOnBlockPct}|${game.raid.biopsyChance}|${loadoutKey}`
    : '';
  if (rk !== lastRaidKey) {
    uiState.raidKey = rk;
    lastRaidKey = rk;
  }

  uiState.strength = game.strength;
  uiState.speed = game.speed ?? 0;
  uiState.volume = game.volume;

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
  uiState.activeQuests = Array.isArray(game.activeQuests) ? [...game.activeQuests] : [];
  const progress: Record<string, number> = {};
  game.unlockedRaids.forEach(r => { progress[r.id] = r.questProgress; });
  uiState.questProgressById = progress;

  uiState.activeRaidId = game.raid.id;
  uiState.selectedGearPrice = game.selectedGearPrice ?? 0;
  uiState.raidSurvivalPct = game.raidSurvivalEstimatePct;
  uiState.raidTimeEstimateSec = game.raidTimeEstimateSec;
  uiState.raidZoneCollapseDeathPct = game.raidZoneCollapseDeathPct;

  uiState.lastOutcome = game.lastRaidOutcome;
  uiState.lastRefineryOutcome = game.lastRefineryOutcome;

  const hasWafer = !!game.wafer;
  const refinery: UIRefinery = {};
  if (hasWafer && game.nextEvt?.name === 'EvtRefineryDone') {
    const preview = computeRefinePreviewChem(game.wafer!);
    const duration = Math.max(0, game.refiningDuration || preview.timeSec || 0);
    const startedAt = (game.nextEvt.at || 0) - duration;

    refinery.startedAtSec = startedAt;
    if (duration > 0) {
      const elapsed = Math.max(0, (game.gameTime || 0) - startedAt);
      const progressPct = Math.max(0, Math.min(100, Math.round((elapsed / duration) * 100)));
      const remaining = Math.max(0, Math.round(duration - elapsed));
      refinery.progressPct = progressPct;
      refinery.timeRemainingSec = remaining;
    } else {
      refinery.progressPct = 0;
      refinery.timeRemainingSec = 0;
    }
    refinery.expectedCredits = preview.expectedCredits;
    refinery.expectedChrono = preview.expectedChrono;
    refinery.expectedFlux = preview.expectedFlux;
    refinery.failureChancePct = preview.failureChancePct;
  }
  uiState.refinery = refinery;
  uiState.items = (game.items || []).map(it => ({ id: it.id, quantity: it.quantity }));
  uiState.encounteredEssences = Object.keys(game.encounteredEssences || {});
  uiState.discoveryCounter = game.discoveryCounter;
  uiState.hasDiscoveredGearUpgradeModal = game.discoveries[DISCOVERY.GEAR_UPGRADE_MODAL_OPENED] === true;
  uiState.hasEverHadShards =
    (game.discoveries[DISCOVERY.SHARDS] === true) ||
    (game.shardDust > 0) ||
    (game.waferUpgradesPurchased > 0);

  uiState.wafer = game.wafer;
  uiState.waferSize = game.waferSize;
  uiState.shards = game.shards;
  uiState.waferUpgradesPurchased = game.waferUpgradesPurchased || 0;

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

  const radius = game.researchRevealRadius;
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
