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
  constructor() {}
}

export class CheatUnlockAllRaids implements CheatInput {
  readonly name = 'CheatUnlockAllRaids';
  constructor() {}
}

