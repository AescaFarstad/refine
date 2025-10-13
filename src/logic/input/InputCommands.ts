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

export class CmdAcknowledgeRefineryOutcome implements CmdInput {
  readonly name = 'CmdAcknowledgeRefineryOutcome';
}

export type LevelupStat = 'strength' | 'volume' | 'looting';

export class CmdLevelup implements CmdInput {
  readonly name = 'CmdLevelup';
  readonly stat: LevelupStat;
  constructor(stat: LevelupStat) {
    this.stat = stat;
  }
}

// Refining start command (handled later)
export class CmdStartRefining implements CmdInput {
  readonly name = 'CmdStartRefining';
  readonly recipeId: string;
  readonly refineryIndex: number;
  readonly items: Array<{ id: string; quantity: number }>;
  constructor(args: { recipeId: string; refineryIndex: number; items: Array<{ id: string; quantity: number }>; }) {
    this.recipeId = args.recipeId;
    this.refineryIndex = args.refineryIndex;
    this.items = args.items;
  }
}
