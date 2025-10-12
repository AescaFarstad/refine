import type { EquipmentType } from '../Raid';

export interface CmdInput {
  name: string;
}

export class CmdAdvanceTime implements CmdInput {
  readonly name = 'CmdAdvanceTime';
}

export class CmdStartRaid implements CmdInput {
  readonly name = 'CmdStartRaid';
  readonly id: string;
  readonly quest: number;
  readonly survive: number;
  readonly loot: number;
  readonly equipment: EquipmentType;
  readonly cost: number;
  constructor(args: { id: string; quest: number; survive: number; loot: number; equipment: EquipmentType; cost: number; }) {
    this.id = args.id;
    this.quest = args.quest;
    this.survive = args.survive;
    this.loot = args.loot;
    this.equipment = args.equipment;
    this.cost = args.cost;
  }
}

export class CmdAknowledgeOutcome implements CmdInput {
  readonly name = 'CmdAknowledgeOutcome';
}

export type LevelupStat = 'strength' | 'volume' | 'looting';

export class CmdLevelup implements CmdInput {
  readonly name = 'CmdLevelup';
  readonly stat: LevelupStat;
  constructor(stat: LevelupStat) {
    this.stat = stat;
  }
}
