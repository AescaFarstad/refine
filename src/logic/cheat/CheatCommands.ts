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

