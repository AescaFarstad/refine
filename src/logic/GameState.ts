import { Lib } from "./Lib";
import type { Evt } from './evt/Evt';
import type { EquipmentType } from './Raid';

export const QUEST_POINTS : number = 100

export class GameState {
  public lib: Lib = new Lib();

  // Elapsed game time in seconds
  public time: number = 0;
  public timeActive: boolean = false;
  public timeSpeed: number = 1;


  public credits: number = 20000;
  public chronotraces: number = 0;
  public strength: number = 120;
  public volume: number = 100;
  public speed: number = 100;
  public refineries : Array<Refinery> = [];
  public raid : ActiveRaid = new ActiveRaid();

  public unlockedRaids : Array<Raid> = [new Raid("shegolskoe")];

  public nextEvt: Evt | null = null;
}

export class Refinery {
  public health: number = 100;
}

export class ActiveRaid {
  public id: string = "";
  public progress: number = 0;
  public strength: number = 0;
  public volume: number = 0;
  public speed: number = 0;
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
