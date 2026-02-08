import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import { createRaidDamageBreakdown, createRaidTimeBreakdownSec, type GameState, type RaidDamageBreakdown, type RaidOutcome, type RefineryOutcome, type Shard, type RaidTimeBreakdownSec } from './GameState';
import type { RaidDefinition } from './RaidLib';
import { getEffectiveRaidDefinition } from './Raid';
import { computeRefinePreviewChem } from './RefinePreview';
import type { Lib } from './Lib';
import { createWafer, type Wafer } from './Wafer';
import type { Point2 } from './ItemLib';
import { DISCOVERY } from './DiscoveryLib';
import type { UIModalEntry } from './Reward';

export interface ShardPhysics {
  pos: Point2;
  vel: Point2;
  angle: number;
  omega: number;
}

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
  unlockedGearCategories: [] as string[],
  countableGear: {} as Record<string, number>,
  activeQuests: [] as string[],
  reviewedQuestIds: [] as string[],
  questProgressById: {} as Record<string, number>,
  raidFoundItemIdsByRaidId: {} as Record<string, string[]>,
  bannedItemIdsByRaidId: {} as Record<string, string[]>,
  itemBans: 0,

  activeRaidId: '',
  selectedGearPrice: 0,

  raidSurvivalPct: 0,
  raidTimeEstimateSec: 0,
  raidTimeEstimateMinSec: 0,
  raidTimeEstimateMaxSec: 0,
  raidTimeEstimateStdDevSec: 0,
  raidZoneCollapseDeathPct: 0,
  raidZoneCollapseDeaths: 0,
  raidMonsterDeaths: 0,
  raidTimeBreakdownSimulations: 0,
  raidTimeBreakdownSuccesses: 0,
  raidTimeBreakdownFailures: 0,
  raidTimeBreakdownOverallSec: createRaidTimeBreakdownSec() as RaidTimeBreakdownSec,
  raidTimeBreakdownSuccessSec: createRaidTimeBreakdownSec() as RaidTimeBreakdownSec,
  raidTimeBreakdownFailureSec: createRaidTimeBreakdownSec() as RaidTimeBreakdownSec,
  raidTimeBreakdownZoneCollapseSec: createRaidTimeBreakdownSec() as RaidTimeBreakdownSec,
  raidDamageBreakdownOverall: createRaidDamageBreakdown() as RaidDamageBreakdown,
  raidDamageBreakdownSuccess: createRaidDamageBreakdown() as RaidDamageBreakdown,
  raidDamageBreakdownFailure: createRaidDamageBreakdown() as RaidDamageBreakdown,

  lastOutcome: null as RaidOutcome | null,
  acknowledgedOutcome: null as RaidOutcome | null,
  showAcknowledgedOutcome: false,
  lastRefineryOutcome: null as RefineryOutcome | null,

  activeTab: 'raid' as 'raid' | 'refine' | 'research' | 'maze',

  gearUpgradeModalOpen: false,
  gearUpgradeFocusCategory: '' as string,
  hasDiscoveredGear: false,
  hasDiscoveredGearUpgradeModal: false,
  hasEverHadShards: false,

  cheatOpen: false,
  devAtlasKey: '' as '' | 'items' | 'locations' | 'molecules',
  devMoleculeEditorOpen: false,
  editResearchOpen: false,

  refinery: null as UIRefinery | null,
  items: [] as Array<{ id: string; quantity: number }>,
  unrefinedOwnedItemIds: [] as string[],
  unrefinedOwnedItemIdMap: {} as Record<string, true>,
  encounteredEssences: [] as string[],
  seenEssences: [] as string[],
  discoveryCounter: 0,
  hasDiscoveredSignatures: false,
  showSignaturePlacementDiscoveryModal: false,
  signaturePlacementDiscoveryId: '' as string,
  hasDiscoveredRefineTab: false,
  hasDiscoveredResearchTab: false,
  hasDiscoveredMazeTab: false,
  hasDiscoveredRaidMonsters: false,
  hasDiscoveredRaidLoot: false,
  hasDiscoveredRaidSpeed: false,
  hasDiscoveredRaidSelection: false,
  hasDiscoveredCyanYield: false,
  hasDiscoveredMagentaYield: false,
  hasDiscoveredSignatureInfo: false,
  hasVisitedRefineTab: false,
  hasVisitedResearchTab: false,
  hasVisitedMazeTab: false,
  signatureLevel: 1,
  learnedSignatureIds: [] as string[],
  completedSignatureIds: [] as string[],
  signatureLearnQueue: [] as string[],
  waferUpgradesPurchased: 0,
  wafer: createWafer(2) as Wafer,
  shards: [] as Shard[],
  shardPickupGraceSec: 0,
  shardPhysics: new Map<string, ShardPhysics>(),
  waferVersion: 0,

  mazeLevelIndex: 0,
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

  questPrereqsVersion: 0,

  // Queue of UI modal keys to show (from show_ui rewards)
  pendingUIModals: [] as UIModalEntry[],

  showIntroModal: false,
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
let lastRaidFoundItemsVersion = -1;
let lastUnlockedRaidIdsKey = '';
let lastInventoryItemCount = -1;
let lastRefinedUniqueCount = -1;
let lastHasUniqueItemsYield = false;


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
    ? `${game.raid.id}|${game.raid.hp}|${game.raid.maxHp}|${game.raid.baseSpeed}|${game.raid.speedBonusPct}|${game.raid.speedBonusFlat}|${game.raid.regenPerKm}|${game.raid.regenAfterCombat}|${game.raid.weight}|${game.raid.maxWeight}|${(game.raid.damage ?? game.damage ?? 1)}|${game.raid.bagsVolume}|${game.raid.usedVolume}|${game.raid.lootChanceBonus}|${game.raid.tmpLootBuffAppliedPct}|${game.raid.hitChance}|${game.raid.blockChance}|${game.raid.reflectOnHitPct}|${game.raid.reflectOnBlockPct}|${game.raid.biopsyChance}|${loadoutKey}`
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
  {
    const categories = new Set<string>();
    for (const gearId of game.unlockedGear) {
      const gear = game.lib.gear.get(gearId);
      if (gear) categories.add(gear.category);
    }
    uiState.unlockedGearCategories = [...categories];
  }
  uiState.countableGear = { ...game.countableGear };
  uiState.activeQuests = Array.isArray(game.activeQuests) ? [...game.activeQuests] : [];
  uiState.reviewedQuestIds = Array.isArray(game.reviewedQuestIds) ? [...game.reviewedQuestIds] : [];
  const progress: Record<string, number> = {};
  game.unlockedRaids.forEach(r => { progress[r.id] = r.questProgress; });
  uiState.questProgressById = progress;

  {
    const unlockedKey = game.unlockedRaids.map(r => r.id).join('|');
    const version = game.raidFoundItemsVersion | 0;
    if (version !== lastRaidFoundItemsVersion || unlockedKey !== lastUnlockedRaidIdsKey) {
      const found: Record<string, string[]> = {};
      for (const r of game.unlockedRaids) {
        found[r.id] = [...r.foundItemIds];
      }
      uiState.raidFoundItemIdsByRaidId = found;
      lastRaidFoundItemsVersion = version;
      lastUnlockedRaidIdsKey = unlockedKey;
    }
  }

  {
    const banned: Record<string, string[]> = {};
    for (const r of game.unlockedRaids) {
      banned[r.id] = [...r.bannedItemIds];
    }
    uiState.bannedItemIdsByRaidId = banned;
  }
  uiState.itemBans = game.itemBans;

  uiState.activeRaidId = game.raid.id;
  uiState.selectedGearPrice = game.selectedGearPrice ?? 0;
  const sim = game.raidSimulation;
  uiState.raidSurvivalPct = sim.survivalEstimatePct;
  uiState.raidTimeEstimateSec = sim.timeEstimateSec;
  uiState.raidTimeEstimateMinSec = sim.timeEstimateMinSec;
  uiState.raidTimeEstimateMaxSec = sim.timeEstimateMaxSec;
  uiState.raidTimeEstimateStdDevSec = sim.timeEstimateStdDevSec;
  uiState.raidZoneCollapseDeathPct = sim.zoneCollapseDeathPct;
  uiState.raidZoneCollapseDeaths = sim.zoneCollapseDeaths;
  uiState.raidMonsterDeaths = sim.monsterDeaths;
  uiState.raidTimeBreakdownSimulations = sim.simulations;
  uiState.raidTimeBreakdownSuccesses = sim.successes;
  uiState.raidTimeBreakdownFailures = sim.failures;
  uiState.raidTimeBreakdownOverallSec = sim.timeBreakdownOverallSec;
  uiState.raidTimeBreakdownSuccessSec = sim.timeBreakdownSuccessSec;
  uiState.raidTimeBreakdownFailureSec = sim.timeBreakdownFailureSec;
  uiState.raidTimeBreakdownZoneCollapseSec = sim.timeBreakdownZoneCollapseSec;
  uiState.raidDamageBreakdownOverall = sim.damageBreakdownOverall;
  uiState.raidDamageBreakdownSuccess = sim.damageBreakdownSuccess;
  uiState.raidDamageBreakdownFailure = sim.damageBreakdownFailure;

  uiState.lastOutcome = game.lastRaidOutcome;
  uiState.acknowledgedOutcome = game.acknowledgedRaidOutcome;
  if (!uiState.acknowledgedOutcome) {
    uiState.showAcknowledgedOutcome = false;
  }
  uiState.lastRefineryOutcome = game.lastRefineryOutcome;

  const hasWafer = !!game.wafer;
  const refinery: UIRefinery = {};
  if (hasWafer && game.nextEvt?.name === 'EvtRefineryDone') {
    const preview = computeRefinePreviewChem(game as ReadonlyGameState);
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
  uiState.items = game.items.map(it => ({ id: it.id, quantity: it.quantity }));
  {
    const hasUniqueItemsYield = game.discoveries[DISCOVERY.UNIQUE_ITEMS_YIELD] === true;
    const inventoryItemCount = game.items.reduce((sum, it) => sum + it.quantity, 0);
    const refinedUniqueCount = Object.keys(game.refinedUniqueItemIds).length;
    if (!hasUniqueItemsYield) {
      if (uiState.unrefinedOwnedItemIds.length > 0) {
        uiState.unrefinedOwnedItemIds = [];
        uiState.unrefinedOwnedItemIdMap = {};
      }
      lastInventoryItemCount = inventoryItemCount;
      lastRefinedUniqueCount = refinedUniqueCount;
      lastHasUniqueItemsYield = false;
    } else if (
      !lastHasUniqueItemsYield ||
      inventoryItemCount !== lastInventoryItemCount ||
      refinedUniqueCount !== lastRefinedUniqueCount
    ) {
      const ids: string[] = [];
      const idMap: Record<string, true> = {};
      for (const it of game.items) {
        if (game.refinedUniqueItemIds[it.id]) continue;
        ids.push(it.id);
        idMap[it.id] = true;
      }
      uiState.unrefinedOwnedItemIds = ids;
      uiState.unrefinedOwnedItemIdMap = idMap;
      lastInventoryItemCount = inventoryItemCount;
      lastRefinedUniqueCount = refinedUniqueCount;
      lastHasUniqueItemsYield = true;
    }
  }
  uiState.encounteredEssences = Object.keys(game.encounteredEssences);
  uiState.seenEssences = Object.keys(game.seenEssences);
  uiState.discoveryCounter = game.discoveryCounter;
  uiState.hasDiscoveredGear = game.discoveries[DISCOVERY.UI_GEAR] === true;
  uiState.hasDiscoveredGearUpgradeModal = game.discoveries[DISCOVERY.UI_GEAR_UPGRADE_MODAL_OPENED] === true;
  uiState.hasDiscoveredSignatures = game.discoveries[DISCOVERY.SIGNATURES] === true;
  uiState.hasDiscoveredRefineTab = game.discoveries[DISCOVERY.TAB_REFINE] === true;
  uiState.hasDiscoveredResearchTab = game.discoveries[DISCOVERY.TAB_RESEARCH] === true;
  uiState.hasDiscoveredMazeTab = game.discoveries[DISCOVERY.TAB_MAZE] === true;
  uiState.hasDiscoveredRaidMonsters = game.discoveries[DISCOVERY.UI_RAID_MONSTERS] === true;
  uiState.hasDiscoveredRaidLoot = game.discoveries[DISCOVERY.UI_RAID_LOOT] === true;
  uiState.hasDiscoveredRaidSpeed = game.discoveries[DISCOVERY.UI_RAID_SPEED] === true;
  uiState.hasDiscoveredRaidSelection = game.discoveries[DISCOVERY.UI_RAID_SELECTION] === true;
  uiState.hasDiscoveredCyanYield = game.discoveries[DISCOVERY.CYAN_YIELD] === true;
  uiState.hasDiscoveredMagentaYield = game.discoveries[DISCOVERY.MAGENTA_YIELD] === true;
  uiState.hasDiscoveredSignatureInfo = game.discoveries[DISCOVERY.UI_SIGNATURE_INFO] === true;
  uiState.hasVisitedRefineTab = game.discoveries[DISCOVERY.TAB_REFINE_VISITED] === true;
  uiState.hasVisitedResearchTab = game.discoveries[DISCOVERY.TAB_RESEARCH_VISITED] === true;
  uiState.hasVisitedMazeTab = game.discoveries[DISCOVERY.TAB_MAZE_VISITED] === true;
  uiState.signatureLevel = game.signatureLevel;
  uiState.learnedSignatureIds = [...game.learnedSignatureIds];
  uiState.completedSignatureIds = [...game.completedSignatureIds];
  uiState.signatureLearnQueue = [...game.signatureLearnQueue];
  uiState.showSignaturePlacementDiscoveryModal = !!game.signaturePlacementDiscoveryId;
  uiState.signaturePlacementDiscoveryId = game.signaturePlacementDiscoveryId;
  uiState.hasEverHadShards =
    (game.discoveries[DISCOVERY.UI_SHARDS] === true) ||
    (game.shardDust > 0) ||
    (game.waferUpgradesPurchased > 0);

  uiState.wafer = game.wafer;
  uiState.shards = game.shards.filter(s => s !== null);
  uiState.shardPickupGraceSec = game.shardPickupGraceSec || 0;
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
    uiState.mazeKeysCollected = maze.state?.keysCollected || 0;
    uiState.mazeTotalKeys = maze.state?.keys?.length || 0;
    uiState.mazeFailed = !!maze.state?.failed;
    uiState.mazeSolved = (maze.state?.keys?.length || 0) === (maze.state?.keysCollected || 0);
  } else {
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

  uiState.activeTab = game.activeTab;

  uiState.pendingUIModals = [...game.pendingUIModals];

  uiState.showIntroModal = game.discoveries[DISCOVERY.INTRO_SEEN] !== true;
}

// Expose current game lib for UI components that need live definitions
export function getGameLib(): Lib {
  return gameRef!.lib;
}


export type DeepReadonly<T> =
  T extends (...args: unknown[]) => unknown ? T :
  T extends Map<infer K, infer V> ? ReadonlyMap<K, DeepReadonly<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> :
  T extends (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

export type ReadonlyGameState = DeepReadonly<GameState>;


export function getGameState(): ReadonlyGameState {
  return gameRef!;
}

// Mutable access for dev/cheat tools only - bypasses readonly protection
export function getGameStateMutable(): GameState {
  return gameRef!;
}
