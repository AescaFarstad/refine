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

