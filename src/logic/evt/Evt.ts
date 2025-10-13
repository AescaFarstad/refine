export interface Evt {
  name: string;
  at: number;
}

export class EvtRaidComplete implements Evt {
  readonly name = 'EvtRaidComplete';
  readonly at: number;
  constructor(args: { at: number}) {
    this.at = args.at;
  }
}

export class EvtRefineryDone implements Evt {
  readonly name = 'EvtRefineryDone';
  readonly at: number;
  readonly refineryIndex: number;
  constructor(args: { at: number; refineryIndex: number }) {
    this.at = args.at;
    this.refineryIndex = args.refineryIndex;
  }
}
