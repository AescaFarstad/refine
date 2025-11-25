import { Lib } from "./Lib";
import type { Evt } from './evt/Evt';
import SeededRandom from "./core/SeededRandom";
import { Essence } from "./ItemLib";
import type { Point2 } from "./core/math";
import type { CheatInput } from './cheat/CheatCommands';
import { CheatAddRaidItems } from './cheat/CheatCommands';
import type { IceMaze } from "../maze/IceMaze";
import type { Wafer } from "./Wafer";
import { createWafer } from "./Wafer";

export const DEFAULT_SPEED: number = 6;
export const MIN_WALK_SPEED: number = 1; // km/h

export class GameState {
  public lib: Lib = new Lib();

  // Elapsed game time in seconds
  public time: number = 0;
  public timeActive: boolean = false;
  public timeSpeed: number = 1;

  public random: SeededRandom = new SeededRandom();


  public credits: number = 5000;
  public chronotraces: number = 500;
  public timeFlux: number = 150;
  public shardDust: number = 1000;
  public strength: number = 120;
  public reach: number = 0;
  public looting: number = 0;
  public speed: number = DEFAULT_SPEED;//km/h
  public volume: number = 10;
  public baseMaxWeight: number = 10;
  public damage: number = 1;
  public chanceToHit: number = 60;
  public chanceToBlock: number = 30;
  public health: number = 10;
  public overflowEssences: Essence = {};
  public wafer: Wafer = createWafer(2);
  public waferSize: Point2 = { x: 0, y: 0 };
  public waferUpgradesPurchased: number = 0;
  public waferMouseCoords: Point2 | null = null;
  public refiningDuration: number = 0;
  public shards: Array<Shard> = [];
  public raid: ActiveRaid = new ActiveRaid();

  public unlockedRaids: Array<Raid> = [new Raid("shegolskoe")];
  public recipes: Array<string> = ["c1", "c2", "c3", "c4"];

  public nextEvt: Evt | null = null;
  public lastRaidOutcome: RaidOutcome | null = null;
  public lastRefineryOutcome: RefineryOutcome | null = null;
  public levelupsAvailable: number = 0;

  public items: Array<Item> = [];
  public research: Set<string> = new Set(["tier_0"]);

  // Ice Maze persistent state
  public maze: IceMaze | null = null;
  public mazeLevelIndex: number = 0;
  // Internal: flag set by inputs to request a rebuild at current level (handled in Model)
  public _labirinthResetRequested?: boolean;



  public cheats: Array<CheatInput> = [
    new CheatAddRaidItems({ id: "shegolskoe", count: 10 })
  ];

  public unlocks: string[] = [];
  public completedQuests: string[] = [];
  public activeQuests: string[] = [];
  public gearLevels: Record<string, number> = {
    weapons: 1,
    accessories: 1,
    armor: 1,
    bags: 1,
    devices: 1,
    companions: 1,
    grenades: 1,
    medicine: 1,
    tactics: 1,
  };
  public skillPoints: number = 0;
  public unlockedGear: string[] = [
    'boots_basic', 'sprint_boots',
    'stim_patch', 'medkit_basic',
    'empty_pack', 'ruksack', 'cargo_harness',
    'aspirator_probe', 'metal_detector', 'field_scanner',
    'rusty_machete', 'makeshift_spear', 'nail_gun', 'stun_baton',
    'kevlar_helmet', 'kevlar_vest',
    'spiked_armor',
    'flash_grenade', 'frag_grenade',
    'robodog', 'needle_drone', 'cargo_drone',
    'scope', 'laser_sight',
    'tactics_thorough_search', 'tactics_immovable_wall',
  ];
  public loadouts: Record<string, string[]> = {
    shegolskoe: ['sprint_boots', 'medkit_basic', 'cargo_harness', 'aspirator_probe', 'makeshift_spear', 'spiked_armor', 'frag_grenade', 'needle_drone'],
    ozernoye: [],
  };
  public selectedGearPrice: number = 0;

  // Estimates for the currently active raid (UI mirrors these)
  public raidSurvivalEstimatePct: number = 0;
  public raidTimeEstimateSec: number = 0;
}

export class ActiveRaid {
  public id: string = "";
  // Snapshot-like params used by the runner and UI previews
  public hp: number = 100;
  public maxHp: number = 100;
  public baseSpeed: number = 6; // km/h
  public speedBonusPct: number = 0; // additive percent
  public speedBonusFlat: number = 0; // flat km/h added
  public regenPerKm: number = 0; // HP per km
  public weight: number = 0;
  public maxWeight: number = 10;
  // Gear-provided extra capacity; base capacity comes from GameState.volume
  public bagsVolume: number = 0;
  // Current used volume accumulated during a raid run
  public usedVolume: number = 0;
  public damage: number = 1;
  public perks: string[] = [];
  // Additive loot chance bonus from gear (percent)
  public lootChanceBonus: number = 0;
  public hitChance: number = 60;
  public blockChance: number = 30;
  // Reflect: percent of monster's damage reflected back
  public reflectOnHitPct: number = 0;   // monster hits you
  public reflectOnBlockPct: number = 0; // you block monster
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
  // Items obtained and discarded during this raid
  public looted: Array<Item> = [];
  public discardedByVolume: Array<Item> = [];
  public discardedByLuck: Array<Item> = [];
}

export class Item {
  public id: string = "";
  public quantity: number = 0;
}

export class RefineryOutcome {
  public recipeId: string = "";
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
