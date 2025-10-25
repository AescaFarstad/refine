import { Lib } from "./Lib";
import type { Evt } from './evt/Evt';
import type { EquipmentType } from './Raid';
import SeededRandom from "./core/SeededRandom";
import { Essence } from "./ItemLib";
import type { CheatInput } from './cheat/CheatCommands';
import { CheatAddRaidItems } from './cheat/CheatCommands';
import type { IceMaze } from "../maze/IceMaze";

export const QUEST_POINTS : number = 100

export class GameState {
  public lib: Lib = new Lib();

  // Elapsed game time in seconds
  public time: number = 0;
  public timeActive: boolean = false;
  public timeSpeed: number = 1;

  public random: SeededRandom = new SeededRandom();


  public credits: number = 500;
  public chronotraces: number = 500;
  public timeFlux: number = 150;
  public strength: number = 120;
  public volume: number = 50;
  public looting: number = 100;
  public loadedRecipe: string = "";
  public recipeStartedAt: number = 0;
  public overflowEssences: Essence = {};
  public raid : ActiveRaid = new ActiveRaid();

  public unlockedRaids : Array<Raid> = [new Raid("shegolskoe")];
  public recipes : Array<string> = ["c1", "c2", "c3", "c4"];

  public nextEvt: Evt | null = null;
  public lastRaidOutcome : RaidOutcome | null = null;
  public lastRefineryOutcome: RefineryOutcome | null = null;
  public levelupsAvailable : number = 0;
  
  public items: Array<Item> = [];
  public research : Set<string> = new Set(["tier_0"]);

  // Ice Maze persistent state
  public maze: IceMaze | null = null;
  public mazeLevelIndex: number = 0;
  // Internal: flag set by inputs to request a rebuild at current level (handled in Model)
  public _labirinthResetRequested?: boolean;



  public cheats: Array<CheatInput> = [
    new CheatAddRaidItems({ id: "shegolskoe", count: 10 })
  ];
}

export class ActiveRaid {
  public id: string = "";
  public progress: number = 0;
  public strength: number = 0;
  public volume: number = 0;
  public looting: number = 0;
  public questWeight: number = 100;
  public surviveWeight: number = 100;
  public lootWeight: number = 100;
  public equipment: EquipmentType = 'medium';
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
