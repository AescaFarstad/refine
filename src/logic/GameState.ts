import { Lib } from "./Lib";
import type { Evt } from './evt/Evt';
import SeededRandom from "./core/SeededRandom";
import { Essence } from "./ItemLib";
import type { Point2 } from "./core/math";
import type { CheatInput } from './cheat/CheatCommands';
import { CheatAddRaidItems, CheatUnlockAllGear, CheatAddResources, CheatUnlockAllRaids } from './cheat/CheatCommands';
import { IS_DEBUG } from './Const';
import type { IceMaze } from "../maze/IceMaze";
import type { Wafer } from "./Wafer";
import { createWafer } from "./Wafer";
import { initResearchCells } from "./Research";
import gearCategories from "../data/gear_categories";
import type { RaidEventLog } from './RaidLog';

export const DEFAULT_SPEED: number = 6;
export const MIN_WALK_SPEED: number = 1; // km/h

export class GameState {
  public lib: Lib = new Lib();

  // Elapsed game time in seconds (canonical for /core/ as well)
  public gameTime: number = 0;

  public timeActive: boolean = false;
  public timeSpeed: number = 1;

  public random: SeededRandom = new SeededRandom();

  // Properties for /core/ compatibility (not actively used in this project)
  public hypothetical: { key: string; connections: any } | null = null;
  public connections: any = null;


  public credits: number = 1000;
  public chronotraces: number = 0;
  public timeFlux: number = 0;
  public shardDust: number = 0;
  public strength: number = 0;
  public speed: number = DEFAULT_SPEED;//km/h
  public volume: number = 10;
  public baseMaxWeight: number = 10;
  public damage: number = 1;
  public chanceToHit: number = 60;
  public chanceToBlock: number = 30;
  public health: number = 10;
  public wafer: Wafer = createWafer(2);
  public waferSize: Point2 = { x: 0, y: 0 };
  public waferUpgradesPurchased: number = 0;
  public waferMouseCoords: Point2 | null = null;
  public refiningDuration: number = 0;
  public shards: Array<Shard> = [];
  public raid: ActiveRaid = new ActiveRaid();

  public researchCells: ResearchCell[] = [];
  public researchOwnedCount: number = 0;
  public researchRevealRadius: number = 3;

  public unlockedRaids: Array<Raid> = [new Raid("shegolskoe")];

  public nextEvt: Evt | null = null;
  public lastRaidOutcome: RaidOutcome | null = null;
  public lastRefineryOutcome: RefineryOutcome | null = null;

  public items: Array<Item> = [];
  public encounteredEssences: Record<string, true> = {};

  public maze: IceMaze | null = null;
  public mazeLevelIndex: number = 0;
  public labirinthResetRequested: boolean = false;



  public cheats: Array<CheatInput> = IS_DEBUG ? [
    new CheatAddResources(),
    new CheatAddRaidItems({ id: "shegolskoe", count: 10 }),
    new CheatUnlockAllGear(),
    new CheatUnlockAllRaids()
  ] : [];

  public unlocks: string[] = [];
  public completedQuests: string[] = [];
  public activeQuests: string[] = [];
  public gearLevels: Record<string, number> = {};
  public skillPoints: number = 0;
  public unlockedGear: string[] = [
    'brass_knuckles', 'painkillers', 'pouches', 'no_scavenging',
  ];
  public loadouts: Record<string, string[]> = {
    shegolskoe: [],
    ozernoye: [],
  };
  public selectedGearPrice: number = 0;

  public raidSurvivalEstimatePct: number = 0;
  public raidTimeEstimateSec: number = 0;
  public raidZoneCollapseDeathPct: number = 0;

  constructor() {
    for (const categoryId of Object.keys(gearCategories)) {
      this.gearLevels[categoryId] = 1;
    }
    initResearchCells(this, this.lib.research);
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
  public regenAfterEncounter: number = 0;
  public weight: number = 0;
  public maxWeight: number = 10;
  public bagsVolume: number = 0;
  public usedVolume: number = 0;
  public damage: number = 1;
  public perks: string[] = [];
  public lootChanceBonus: number = 0;
  public hitChance: number = 60;
  public blockChance: number = 30;
  public reflectOnHitPct: number = 0;   // monster hits you
  public reflectOnBlockPct: number = 0; // you block monster
  public biopsyChance: number = 0;      // chance to successfully harvest monster loot
}


export class Raid {
  constructor(id: string) {
    this.id = id;
  }
  public id: string = "";
  public questsDone: number = 0;
  public questProgress: number = 0;
}

export class RaidOutcome {
  public id: string = "";
  public questsDone: number = 0;
  public success: boolean = false;
  public questDeltaPct: number = 0;
  public unlockedRaidId: string | null = null;
  public plannedEncounters: number = 0;
  public looted: Array<Item> = [];
  public discardedByVolume: Array<Item> = [];
  public discardedByLuck: Array<Item> = [];
  public barelyInTime: boolean = false;

  public log: RaidEventLog = { entries: [] };
  public timeSpentSec: number = 0;
  public skillPointsGained: number = 0;
  public questsCompleted: string[] = [];
  public zoneChange: string | null = null;
  public finalHp: number = 0;
  public finalMaxHp: number = 0;
  public finalBagsUsed: number = 0;
  public finalBagsCapacity: number = 0;
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

export interface Shard {
  id: string;
  resource: string; // 'credits', 'chronotraces', 'timeFlux', 'shards'
  amount: number;
  pos: Point2;
  vel: Point2;
  angle: number;
  omega: number;
  triggered: boolean;
  pickupDelaySec: number;
  size: number;
}

export interface ResearchCell {
  nodeId: number;
  archetypeId: string;
  revealed: boolean;
  owned: boolean;
  cost: number;
  blocked: boolean; // the void cells
}
