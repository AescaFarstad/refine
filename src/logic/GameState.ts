import { Lib } from "./Lib";
import type { Evt } from './evt/Evt';
import SeededRandom from "./core/SeededRandom";
import { Essence } from "./ItemLib";
import type { Point2 } from "./core/math";
import type { CheatInput } from './cheat/CheatCommands';
import type { Wafer } from "./Wafer";
import { createWafer } from "./Wafer";
import { initResearchCells } from "./Research";
import { computeMazeResourceSpawns } from "./Maze";
import type { HexVisionAux } from './HexVisionAux';
import type { MazeVisibilityResult, MazeVisibilityRuntime } from './MazeVision';
import gearCategories from "../data/gear_categories";
import type { RaidEventLog } from './RaidLog';
import type { RaidMutation, MutationDescription } from './RaidMutation';
import type { Reward, UIModalEntry } from './Reward';

/*
  When adding/editing properties here, make sure save-loading is compatible.
  /src/logic/SaveLoad.ts
  Version bump is always done manually, don't touch it.
*/

export const DEFAULT_SPEED: number = 6;
export const MIN_WALK_SPEED: number = 1; // km/h

export type MazeOracleState = 'riddling' | 'riddlePassed';

export class GameState {
  public lib: Lib = new Lib();
  public readonly version: number = 1; // game state version for serialization
  public seed: number = 0;

  // Elapsed game time in seconds (canonical for /core/ as well)
  public gameTime: number = 0;

  public timeActive: boolean = false;
  public timeSpeed: number = 1;
  public timeSpeedMaxBoost: number = 1;

  public random: SeededRandom = new SeededRandom(0);

  // Properties for /core/ compatibility (not actively used in this project)
  public hypothetical: { key: string; connections: any } | null = null;
  public connections: any = null;


  public credits: number = 2000;
  public chronotraces: number = 0;
  public timeFlux: number = 0;
  public shardDust: number = 0;
  public strength: number = 0;
  public speed: number = DEFAULT_SPEED;//km/h
  public volume: number = 10;
  public baseMaxWeight: number = 10;
  public damage: number = 1;
  public chanceToHit: number = 100;
  public chanceToBlock: number = 0;
  public armor: number = 0;
  public health: number = 10;
  public itemBans: number = 0;
  public wafer: Wafer = createWafer(2);
  public waferCharge: number = 0;
  public waferUpgradesPurchased: number = 0;
  public refiningDuration: number = 0;
  public refiningYieldPctBonus: number = 0;
  public uniqueItemsBonusYield: number = 0;
  public refiningSuccessChanceBonus: number = 0;
  public refiningSpeedPctBonus: number = 0;
  public refiningRedEssenceResourceBonus: number = 0;
  public refiningGreenEssenceResourceBonus: number = 0;
  public refiningBlueEssenceResourceBonus: number = 0;
  public refiningYellowNeighborBonus: number = 0;
  public shards: Array<Shard> = [];
  public raid: ActiveRaid = new ActiveRaid();

  public researchCells: ResearchCell[] = [];
  public researchOwnedCount: number = 0;
  public researchRevealRadius: number = 3;
  public researchSignatureLearnIndex: number = 0;

  // Maze — persistent (saved)
  public mazeHighCredits: number = 0;
  public mazeHighChronotraces: number = 0;
  public mazeHighShardDust: number = 0;
  public mazeHighZoneCrystal: number = 0;
  public mazeHighFractal: number = 0;
  public mazeHighMovementUsed: number = 0;
  public mazeNextNexusPlacementId: number = 1;
  public mazeNexusPlacementRotationSteps: Record<string, number> = {};
  public mazeNexusAvailableUpgradeIds: string[] = [];
  public mazeNexusPlacedUpgradeIds: string[] = [];
  public mazeNexusUpgradeOpportunityCount: number = 1;
  public mazeNexusUpgradeOfferSeed: number = -1;
  public mazeNexusUpgradeSeedCursor: number = 0;
  public mazeNexusRefundResetRegretUsed: boolean = false;
  public mazeOracleStateByNodeId: Record<string, MazeOracleState> = {};
  public mazeResetEntranceCell: Point2 = { x: 0, y: 0 };
  public mazeIncrementalBonusPerPickup: number = 0;
  public mazeHasShardsRefresherPanel: boolean = false;

  // Maze — transient (not saved, reset on load)
  public maze: MazeTransient = createMazeTransient();
  public mazeVisibility: MazeVisibilityState = createMazeVisibilityState();

  // Maze — derived (computed on load + research purchase)
  public mazeResourceSpawns: MazeResourceSpawn[] = [];

  public unlockedRaids: Array<Raid> = [new Raid("shegolskoe")];

  public nextEvt: Evt | null = null;
  public lastRaidOutcome: RaidOutcome | null = null;
  public acknowledgedRaidOutcome: RaidOutcome | null = null;
  public lastRefineryOutcome: RefineryOutcome | null = null;
  public shardPickupGraceSec: number = 0;

  public items: Record<string, number> = {};
  public encounteredEssences: Record<string, true> = {};
  public seenEssences: Record<string, true> = {};
  public discoveries: Record<string, true> = {};
  public discoveryCounter: number = 0;
  public refinedUniqueItemIds: Record<string, true> = {};

  // Signature progress
  public signatureLevel: number = 1;
  public learnedSignatureIds: string[] = [];
  public completedSignatureIds: string[] = [];
  public signatureLearnQueue: string[] = [];
  public signaturePlacementDiscoveryId: string = '';

  public activeTab: 'raid' | 'refine' | 'research' | 'maze' = 'raid';

  public cheats: Array<CheatInput> = [];

  public completedQuests: string[] = [];
  public activeQuests: string[] = [];
  public reviewedQuestIds: string[] = [];
  public gearLevels: Record<string, number> = {};
  public skillPoints: number = 0;
  public unlockedGear: string[] = [
    'brass_knuckles', 'bandage', 'pouches', 'no_scavenging',
  ];
  public loadouts: Record<string, string[]> = {
    shegolskoe: [],
    ozernoye: [],
  };
  public countableGear: Record<string, number> = {};
  public transmutationCraftCounts: Record<string, number> = {};
  public selectedGearPrice: number = 0;

  public raidSimulation: RaidSimulation = new RaidSimulation();
  public raidFoundItemsVersion: number = 0;

  // Queue of UI modal keys to show (from show_ui rewards)
  public pendingUIModals: UIModalEntry[] = [];

  constructor(seed: number = Date.now()) {
    const normalizedSeed = seed >>> 0;
    this.seed = normalizedSeed;
    this.random = new SeededRandom(normalizedSeed);
    this.mazeNexusUpgradeSeedCursor = (normalizedSeed ^ 0x9e3779b9) >>> 0;

    for (const categoryId of Object.keys(gearCategories)) {
      this.gearLevels[categoryId] = 1;
    }
    initResearchCells(this, this.lib.research);
    computeMazeResourceSpawns(this, this.lib.research);
  }
}

export class ActiveRaid {
  public id: string = "";
  // Snapshot-like params used by the runner and UI previews
  public hp: number = 10;
  public maxHp: number = 10;
  public baseSpeed: number = 6; // km/h
  public speedBonusPct: number = 0;
  public speedBonusFlat: number = 0;
  public regenPerKm: number = 0;
  public regenAfterCombat: number = 0;
  public regenPer10Minutes: number = 0;
  public weight: number = 0;
  public maxWeight: number = 10;
  public bagsVolume: number = 10;
  public usedVolume: number = 0;
  public damage: number = 1;
  public perks: string[] = [];
  public lootChanceBonus: number = 0;
  public tmpLootBuffAppliedPct: number = 0;
  public tmpLootBuffNextRaidPct: number = 0;
  public hitChance: number = 60;
  public blockChance: number = 30;
  public armor: number = 0;
  public attackSkipCount: number = 0;
  public stunChance: number = 0;
  public reflectOnHitPct: number = 0;   // monster hits you
  public reflectOnBlockPct: number = 0; // you block monster
  public biopsyChance: number = 0;      // chance to successfully harvest monster loot
  public reimbursedPct: number = 0;     // % of gear price reimbursed on combat death
  public rarityBuff: number = 0;        // bonus to loot rarity from gear
  public preventsGlobalTimeAdvance: boolean = false;
  public preventsSuccessZoneDeterioration: boolean = false;
}

export class Raid {
  constructor(id: string) {
    this.id = id;
  }
  public id: string = "";
  public successes: number = 0;
  public questCompletions: number = 0;
  public questsDone: number = 0;
  public questProgress: number = 0;
  public lootingRarityBuff: number = 0;
  public tmpLootBuff: number = 0;

  public foundItemIds: string[] = [];
  public bannedItemIds: string[] = [];
  public uncollectedCredits: number = 0;
  public maxStoredCredits: number = 500;
  public passiveCreditsPerHour: number = 0;

  // Cumulative price adjustments per gear item for this raid
  public gearPriceAdjustments: Record<string, number> = {};
}

export class RaidOutcome {
  public id: string = "";
  public questsDone: number = 0;
  public success: boolean = false;
  public questDeltaPct: number = 0;
  public unlockedRaidId: string | null = null;
  public plannedEncounters: number = 0;
  public looted: Array<Item> = [];
  public discarded: Array<Item> = [];
  public barelyInTime: boolean = false;

  public log: RaidEventLog = { entries: [] };
  public timeSpentSec: number = 0;
  public questsCompleted: string[] = [];
  public rewardsApplied: Reward[] = [];
  public rewardsConsumed: boolean = false;
  public raidMutationsApplied: RaidMutation[] = [];
  public raidItemsAdded: string[] = [];
  public lootChanceDeltaApplied: number = 0;
  public lootingRarityBuffDeltaApplied: number = 0;
  public newQuestsAvailable: string[] = [];
  public zoneChange: MutationDescription | null = null;
  public finalHp: number = 0;
  public finalMaxHp: number = 0;
  public finalBagsUsed: number = 0;
  public finalBagsCapacity: number = 0;
  public reimbursedCredits: number = 0;
  public zoneCollapseSec: number = 0;
}

export class Item {
  public id: string = "";
  public quantity: number = 0;
}

export class RefineryOutcome {
  public success: boolean = false;
  public creditsGained: number = 0;
  public chronotracesGained: number = 0;
  public timeFluxGained: number = 0;
}

export interface ResourceDelta {
  credits: number;
  chronotraces: number;
  timeFlux: number;
  shardDust: number;
}

// Physics state for shards is stored in UIState, not here.
// GameState only tracks shard existence and pickup status.
export interface Shard {
  id: string;
  resource: string; // 'credits', 'chronotraces', 'timeFlux', 'shards'
  amount: number;
  triggered: boolean;
  pickupDelaySec: number;
  size: number;
  launchSpeedMultiplier: number;
}

export interface MazeResourceSpawn {
  cell: Point2;
  resourceKey: 'credits' | 'chronotraces' | 'shardDust' | 'zone_crystal' | 'fractal';
  amount: number;
}

export interface MazeTransient {
  avatarCell: Point2;
  movementUsed: number;
  incrementalBonusCounter: number;
  collectedCredits: number;
  collectedChronotraces: number;
  collectedShardDust: number;
  collectedZoneCrystal: number;
  collectedFractal: number;
  takenCells: Point2[];
  version: number;
}

export interface MazeVisibilityState {
  aux: HexVisionAux | null;
  runtime: MazeVisibilityRuntime | null;
  result: MazeVisibilityResult | null;
  boundaryLoops: Point2[][] | null;
}

export function createMazeTransient(avatarCell: Point2 = { x: 0, y: 0 }): MazeTransient {
  return {
    avatarCell: { x: avatarCell.x, y: avatarCell.y },
    movementUsed: 0,
    incrementalBonusCounter: 0,
    collectedCredits: 0,
    collectedChronotraces: 0,
    collectedShardDust: 0,
    collectedZoneCrystal: 0,
    collectedFractal: 0,
    takenCells: [],
    version: 0,
  };
}

export function createMazeVisibilityState(): MazeVisibilityState {
  return {
    aux: null,
    runtime: null,
    result: null,
    boundaryLoops: null,
  };
}

export interface ResearchCell {
  nodeId: number;
  archetypeId: string;
  nexusId: string;
  nexusPlacementId: number;
  passable: boolean;
  mazeMoveCostMult: number; // derived: movement cost to enter this cell (0 or 1)
  revealed: boolean;
  owned: boolean;
  cost: number;
  blocked: boolean; // true for void cells that cannot be owned or traversed
  filledByAntiVoid: boolean;
}


export interface RaidTimeBreakdownSec {
  totalSec: number;
  fightingSec: number;
  walkingSec: number;
  preparingSec: number;
  scavengingSec: number;
  dissectingSec: number;
  investigatingSec: number;
}

export function createRaidTimeBreakdownSec(): RaidTimeBreakdownSec {
  return {
    totalSec: 0,
    fightingSec: 0,
    walkingSec: 0,
    preparingSec: 0,
    scavengingSec: 0,
    dissectingSec: 0,
    investigatingSec: 0,
  };
}

export interface RaidDamageBreakdown {
  totalDamageReceived: number;
  damageReceivedByMonsterId: Record<string, number>;
  hpGeneratedAfterCombat: number;
  hpGeneratedWalking: number;
  hpGeneratedTimeBased: number;
}

export function createRaidDamageBreakdown(): RaidDamageBreakdown {
  return {
    totalDamageReceived: 0,
    damageReceivedByMonsterId: {},
    hpGeneratedAfterCombat: 0,
    hpGeneratedWalking: 0,
    hpGeneratedTimeBased: 0,
  };
}

export class RaidSimulation {
  public survivalEstimatePct: number = 0;
  public timeEstimateSec: number = 0;
  public timeEstimateMinSec: number = 0;
  public timeEstimateMaxSec: number = 0;
  public timeEstimateStdDevSec: number = 0;
  public zoneCollapseDeathPct: number = 0;
  public zoneCollapseDeaths: number = 0;
  public monsterDeaths: number = 0;
  public simulations: number = 0;
  public successes: number = 0;
  public failures: number = 0;
  public timeBreakdownOverallSec: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  public timeBreakdownSuccessSec: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  public timeBreakdownFailureSec: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  public timeBreakdownZoneCollapseSec: RaidTimeBreakdownSec = createRaidTimeBreakdownSec();
  public damageBreakdownOverall: RaidDamageBreakdown = createRaidDamageBreakdown();
  public damageBreakdownSuccess: RaidDamageBreakdown = createRaidDamageBreakdown();
  public damageBreakdownFailure: RaidDamageBreakdown = createRaidDamageBreakdown();
}
