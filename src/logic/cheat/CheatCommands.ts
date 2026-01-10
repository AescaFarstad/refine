import type { Point2 } from '../core/math';

export interface CheatInput {
  name: string;
}

export class CheatAddRaidItems implements CheatInput {
  readonly name = 'CheatAddRaidItems';
  readonly id: string; // raid id
  readonly count: number;
  constructor(args: { id: string; count: number }) {
    this.id = args.id;
    this.count = args.count;
  }
}

export class CheatUnlockAllGear implements CheatInput {
  readonly name = 'CheatUnlockAllGear';
  constructor() {}
}

export class CheatAddResources implements CheatInput {
  readonly name = 'CheatAddResources';
  readonly credits: number;
  readonly chronotraces: number;
  readonly timeFlux: number;
  readonly shardDust: number;
  readonly skillPoints: number;
  constructor(args: { credits?: number; chronotraces?: number; timeFlux?: number; shardDust?: number; skillPoints?: number }) {
    this.credits = args.credits ?? 0;
    this.chronotraces = args.chronotraces ?? 0;
    this.timeFlux = args.timeFlux ?? 0;
    this.shardDust = args.shardDust ?? 0;
    this.skillPoints = args.skillPoints ?? 0;
  }
}

export class CheatUnlockAllRaids implements CheatInput {
  readonly name = 'CheatUnlockAllRaids';
  constructor() {}
}

export class CheatLoadResearchState implements CheatInput {
  readonly name = 'CheatLoadResearchState';
  readonly ownedCells: Point2[];
  constructor(args: { ownedCells?: Point2[] }) {
    this.ownedCells = args.ownedCells ?? [];
  }
}

export class CheatUnlockAllQuests implements CheatInput {
  readonly name = 'CheatUnlockAllQuests';
  constructor() {}
}

export class CheatDisableQuestPrereqs implements CheatInput {
  readonly name = 'CheatDisableQuestPrereqs';
  readonly disabled: boolean;
  constructor(args: { disabled: boolean }) {
    this.disabled = args.disabled;
  }
}

export class CheatGrantDiscoveries implements CheatInput {
  readonly name = 'CheatGrantDiscoveries';
  readonly discoveryIds: string[];
  constructor(args: { discoveryIds?: string[] }) {
    this.discoveryIds = args.discoveryIds ?? [];
  }
}
