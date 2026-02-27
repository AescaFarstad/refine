import { reactive, computed } from 'vue';
import { formatDurationHM } from './StringUtils';
import { createRaidDamageBreakdown, createRaidTimeBreakdownSec, type GameState, type RaidDamageBreakdown, type RaidOutcome, type RefineryOutcome, type Shard, type RaidTimeBreakdownSec } from './GameState';
import type { EncounterDef, RaidDefinition } from './RaidLib';
import { getEffectiveRaidDefinition } from './Raid';
import { computeRefinePreviewChem } from './RefinePreview';
import type { Lib } from './Lib';
import { createWafer, type Wafer } from './Wafer';
import type { Point2 } from './ItemLib';
import { DISCOVERY } from './DiscoveryLib';
import type { UIModalEntry } from './Reward';

export type DeepReadonly<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends (...args: any[]) => any ? T :
  T extends Map<infer K, infer V> ? ReadonlyMap<K, DeepReadonly<V>> :
  T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> :
  T extends (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

export type ReadonlyLib = DeepReadonly<Lib>;
export type ReadonlyGameState = DeepReadonly<GameState>;
export type ReadonlyResearchCell = ReadonlyGameState['researchCells'][number];
export type ReadonlyResearchArchetype = ReadonlyLib['research']['archetypes'] extends ReadonlyMap<string, infer V> ? V : never;
export type ReadonlyResearchNodeInstance = ReadonlyLib['research']['nodes'] extends ReadonlyMap<number, infer V> ? V : never;

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

function createDefaultUIState() {
  return {
    lib: null as ReadonlyLib | null,

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
    devAtlasKey: '' as '' | 'items' | 'locations' | 'molecules' | 'nexus',
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
    refinePreviewVersion: 0,

    researchOwnedCount: 0,
    researchRevealRadius: 0,
    researchEditMode: '' as string,
    researchEditVersion: 0,
    researchPlacementRadius: 0,
    researchPlacementTemplate: [{ x: 0, y: 0 }] as Array<{ x: number; y: number }>,
    researchNewlyPlaced: [] as Array<{
      archetypeId: string;
      cells: Array<{ x: number; y: number }>;
      radius: number;
    }>,

    mazeMovementUsed: 0,
    mazeVersion: 0,
    mazeNexusMenuOpen: false,
    mazeOracleMenuOpen: false,
    mazeVisitedOracleNodeId: -1,
    mazeNexusAvailableUpgradeIds: [] as string[],
    mazeNexusPlacedUpgradeIds: [] as string[],
    mazeNexusUpgradeOpportunityCount: 1,
    mazeNexusUpgradeOfferSeed: -1,
    mazeResetReason: '' as '' | 'warped' | 'banked',

    questPrereqsVersion: 0,

    // Queue of UI modal keys to show (from show_ui rewards)
    pendingUIModals: [] as UIModalEntry[],

    showIntroModal: false,
  };
}

export type UIState = ReturnType<typeof createDefaultUIState>;

export const uiState = reactive(createDefaultUIState());

// Formatted time display: "X days, HH:MM"
export const timeDisplay = computed(() => {
  // Keep dependency reactive while sourcing precise seconds from gameRef when available
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  uiState.timeMinutes;
  const seconds = Math.max(0, Math.floor((gameRef?.gameTime ?? (uiState.timeMinutes * 60)) || 0));
  return formatDurationHM(seconds);
});

let gameRef: GameState | null = null;

interface UISyncCache {
  lastRaidKey: string;
  lastEffectiveRaidsKey: string;
  lastWaferItemCount: number;
  lastWaferEnabledCount: number;
  lastRefiningYieldPctBonus: number;
  lastRefiningSuccessChanceBonus: number;
  lastRefiningSpeedPctBonus: number;
  lastRefiningRedEssenceResourceBonus: number;
  lastRefiningGreenEssenceResourceBonus: number;
  lastRefiningBlueEssenceResourceBonus: number;
  lastRefiningYellowNeighborBonus: number;
  lastRaidFoundItemsVersion: number;
  lastUnlockedRaidIdsKey: string;
  lastInventoryItemCount: number;
  lastRefinedUniqueCount: number;
  lastUniqueItemsBonusYield: number;
  lastHasUniqueItemsYield: boolean;
}

const SYNC_CACHE_DEFAULTS: UISyncCache = {
  lastRaidKey: '',
  lastEffectiveRaidsKey: '',
  lastWaferItemCount: 0,
  lastWaferEnabledCount: 0,
  lastRefiningYieldPctBonus: Number.NaN,
  lastRefiningSuccessChanceBonus: Number.NaN,
  lastRefiningSpeedPctBonus: Number.NaN,
  lastRefiningRedEssenceResourceBonus: Number.NaN,
  lastRefiningGreenEssenceResourceBonus: Number.NaN,
  lastRefiningBlueEssenceResourceBonus: Number.NaN,
  lastRefiningYellowNeighborBonus: Number.NaN,
  lastRaidFoundItemsVersion: -1,
  lastUnlockedRaidIdsKey: '',
  lastInventoryItemCount: -1,
  lastRefinedUniqueCount: -1,
  lastUniqueItemsBonusYield: Number.NaN,
  lastHasUniqueItemsYield: false,
};

let syncCache: UISyncCache = { ...SYNC_CACHE_DEFAULTS };

function encounterSyncKey(encounter: EncounterDef): string {
  switch (encounter.type) {
    case 'FightEncounter':
      return `FightEncounter:${encounter.monsterId}`;
    case 'QuestEncounter':
      return `QuestEncounter:${encounter.questId}`;
    case 'MonsterLootEncounter':
      return `MonsterLootEncounter:${encounter.monsterId}`;
    default:
      return encounter.type;
  }
}

function raidDefinitionSyncKey(raid: RaidDefinition): string {
  const encountersKey = raid.encounters
    .map(step => `${Math.trunc(step.count)}:${encounterSyncKey(step.encounter)}`)
    .join(',');
  return `${raid.id}|${raid.baseLootChance}|${raid.zoneCollapseSec}|${raid.zoneCollapseStepPerMutation}|${raid.items.join(',')}|${encountersKey}`;
}

function buildEffectiveRaidsSyncKey(game: GameState): string {
  const raidKeys: string[] = [];
  const loadoutKeys: string[] = [];
  game.lib.raids.forEach((raid, id) => {
    raidKeys.push(raidDefinitionSyncKey(raid));
    loadoutKeys.push(`${id}:${(game.loadouts[id] ?? []).join(',')}`);
  });

  const activeQuestsKey = [...game.activeQuests].sort().join(',');
  const completedQuestsKey = [...game.completedQuests].sort().join(',');
  const unlockedRaidProgressKey = game.unlockedRaids
    .map(r => `${r.id}:${r.successes}:${r.questCompletions}`)
    .sort()
    .join(',');

  return `${uiState.questPrereqsVersion}|${activeQuestsKey}|${completedQuestsKey}|${unlockedRaidProgressKey}|${loadoutKeys.join(';')}|${raidKeys.join(';')}`;
}

function overwriteUIState(next: UIState): void {
  const target = uiState as unknown as Record<string, unknown>;
  const nextObj = next as unknown as Record<string, unknown>;

  for (const key of Object.keys(target)) {
    if (!(key in nextObj)) {
      delete target[key];
    }
  }
  for (const [key, value] of Object.entries(nextObj)) {
    target[key] = value;
  }
}

function resetSyncCache(): void {
  syncCache = { ...SYNC_CACHE_DEFAULTS };
}

export function resetUIState(): void {
  overwriteUIState(createDefaultUIState());
  resetSyncCache();
}


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
    ? `${game.raid.id}|${game.raid.hp}|${game.raid.maxHp}|${game.raid.baseSpeed}|${game.raid.speedBonusPct}|${game.raid.speedBonusFlat}|${game.raid.regenPerKm}|${game.raid.regenAfterCombat}|${game.raid.weight}|${game.raid.maxWeight}|${(game.raid.damage ?? game.damage ?? 1)}|${game.raid.bagsVolume}|${game.raid.usedVolume}|${game.raid.lootChanceBonus}|${game.raid.tmpLootBuffAppliedPct}|${game.raid.hitChance}|${game.raid.blockChance}|${game.raid.armor}|${game.raid.reflectOnHitPct}|${game.raid.reflectOnBlockPct}|${game.raid.biopsyChance}|${loadoutKey}`
    : '';
  if (rk !== syncCache.lastRaidKey) {
    uiState.raidKey = rk;
    syncCache.lastRaidKey = rk;
  }

  uiState.strength = game.strength;
  uiState.speed = game.speed ?? 0;
  uiState.volume = game.volume;

  const effectiveRaidsKey = buildEffectiveRaidsSyncKey(game);
  if (effectiveRaidsKey !== syncCache.lastEffectiveRaidsKey) {
    const raids: UIRaidDef[] = [];
    const order: string[] = [];
    game.lib.raids.forEach((_, id) => {
      const eff = getEffectiveRaidDefinition(game, id) as UIRaidDef;
      raids.push(eff);
      order.push(id);
    });
    uiState.raids = raids;
    uiState.raidOrder = order;
    syncCache.lastEffectiveRaidsKey = effectiveRaidsKey;
  }

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
    if (version !== syncCache.lastRaidFoundItemsVersion || unlockedKey !== syncCache.lastUnlockedRaidIdsKey) {
      const found: Record<string, string[]> = {};
      for (const r of game.unlockedRaids) {
        found[r.id] = [...r.foundItemIds];
      }
      uiState.raidFoundItemIdsByRaidId = found;
      syncCache.lastRaidFoundItemsVersion = version;
      syncCache.lastUnlockedRaidIdsKey = unlockedKey;
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
  uiState.items = Object.entries(game.items).map(([id, quantity]) => ({ id, quantity }));
  {
    const hasUniqueItemsYield = game.uniqueItemsBonusYield > 0;
    const inventoryItemCount = Object.values(game.items).reduce((sum, qty) => sum + qty, 0);
    const refinedUniqueCount = Object.keys(game.refinedUniqueItemIds).length;
    if (!hasUniqueItemsYield) {
      if (uiState.unrefinedOwnedItemIds.length > 0) {
        uiState.unrefinedOwnedItemIds = [];
        uiState.unrefinedOwnedItemIdMap = {};
      }
      syncCache.lastInventoryItemCount = inventoryItemCount;
      syncCache.lastRefinedUniqueCount = refinedUniqueCount;
      syncCache.lastHasUniqueItemsYield = false;
    } else if (
      !syncCache.lastHasUniqueItemsYield ||
      inventoryItemCount !== syncCache.lastInventoryItemCount ||
      refinedUniqueCount !== syncCache.lastRefinedUniqueCount
    ) {
      const ids: string[] = [];
      const idMap: Record<string, true> = {};
      for (const id of Object.keys(game.items)) {
        if (game.refinedUniqueItemIds[id]) continue;
        ids.push(id);
        idMap[id] = true;
      }
      uiState.unrefinedOwnedItemIds = ids;
      uiState.unrefinedOwnedItemIdMap = idMap;
      syncCache.lastInventoryItemCount = inventoryItemCount;
      syncCache.lastRefinedUniqueCount = refinedUniqueCount;
      syncCache.lastHasUniqueItemsYield = true;
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

  if (
    game.refiningYieldPctBonus !== syncCache.lastRefiningYieldPctBonus ||
    game.uniqueItemsBonusYield !== syncCache.lastUniqueItemsBonusYield ||
    game.refiningSuccessChanceBonus !== syncCache.lastRefiningSuccessChanceBonus ||
    game.refiningSpeedPctBonus !== syncCache.lastRefiningSpeedPctBonus ||
    game.refiningRedEssenceResourceBonus !== syncCache.lastRefiningRedEssenceResourceBonus ||
    game.refiningGreenEssenceResourceBonus !== syncCache.lastRefiningGreenEssenceResourceBonus ||
    game.refiningBlueEssenceResourceBonus !== syncCache.lastRefiningBlueEssenceResourceBonus ||
    game.refiningYellowNeighborBonus !== syncCache.lastRefiningYellowNeighborBonus
  ) {
    uiState.refinePreviewVersion++;
    syncCache.lastRefiningYieldPctBonus = game.refiningYieldPctBonus;
    syncCache.lastUniqueItemsBonusYield = game.uniqueItemsBonusYield;
    syncCache.lastRefiningSuccessChanceBonus = game.refiningSuccessChanceBonus;
    syncCache.lastRefiningSpeedPctBonus = game.refiningSpeedPctBonus;
    syncCache.lastRefiningRedEssenceResourceBonus = game.refiningRedEssenceResourceBonus;
    syncCache.lastRefiningGreenEssenceResourceBonus = game.refiningGreenEssenceResourceBonus;
    syncCache.lastRefiningBlueEssenceResourceBonus = game.refiningBlueEssenceResourceBonus;
    syncCache.lastRefiningYellowNeighborBonus = game.refiningYellowNeighborBonus;
  }

  if (game.wafer) {
    const currentItemCount = Array.isArray(game.wafer.items) ? game.wafer.items.filter(item => item !== null).length : 0;
    const currentEnabledCount = game.wafer.enabledCount;
    if (currentItemCount !== syncCache.lastWaferItemCount || currentEnabledCount !== syncCache.lastWaferEnabledCount) {
      uiState.waferVersion++;
      syncCache.lastWaferItemCount = currentItemCount;
      syncCache.lastWaferEnabledCount = currentEnabledCount;
    }
  }

  if (game.researchOwnedCount !== uiState.researchOwnedCount) {
    uiState.researchOwnedCount = game.researchOwnedCount;
  }

  const radius = game.researchRevealRadius;
  uiState.researchRevealRadius = typeof radius === 'number' ? radius : 0;

  uiState.mazeMovementUsed = game.maze.movementUsed;
  uiState.mazeVersion = game.maze.version;
  uiState.mazeNexusAvailableUpgradeIds = [...game.mazeNexusAvailableUpgradeIds];
  uiState.mazeNexusPlacedUpgradeIds = [...game.mazeNexusPlacedUpgradeIds];
  uiState.mazeNexusUpgradeOpportunityCount = game.mazeNexusUpgradeOpportunityCount;
  uiState.mazeNexusUpgradeOfferSeed = game.mazeNexusUpgradeOfferSeed;

  uiState.activeTab = game.activeTab;

  uiState.pendingUIModals = [...game.pendingUIModals];

  uiState.showIntroModal = game.discoveries[DISCOVERY.INTRO_SEEN] !== true;
}

// Expose current game lib for UI components that need live definitions
export function getGameLib(): ReadonlyLib {
  return gameRef!.lib;
}


export function getGameState(): ReadonlyGameState {
  return gameRef!;
}

// Mutable access for dev/cheat tools only - bypasses readonly protection
export function getGameStateMutable(): GameState {
  return gameRef!;
}

export function replaceGameState(game: GameState): void {
  resetUIState();
  SyncUIFromGameState(game);
}
