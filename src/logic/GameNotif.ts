import type { RaidOutcome } from './GameState';

export interface BaseGameNotif {
  name: string;
}

export class NotifRefiningComplete implements BaseGameNotif {
  readonly name = 'NotifRefiningComplete';
  readonly success: boolean;
  readonly creditsGained: number;
  readonly chronotracesGained: number;
  readonly timeFluxGained: number;

  constructor(args: {
    success: boolean;
    creditsGained: number;
    chronotracesGained: number;
    timeFluxGained: number;
  }) {
    this.success = args.success;
    this.creditsGained = args.creditsGained;
    this.chronotracesGained = args.chronotracesGained;
    this.timeFluxGained = args.timeFluxGained;
  }
}

export class NotifMazeRunDone implements BaseGameNotif {
  readonly name = 'NotifMazeRunDone';
  readonly collectedCredits: number;
  readonly collectedChronotraces: number;
  readonly collectedShardDust: number;
  readonly collectedZoneCrystal: number;
  readonly collectedFractal: number;
  readonly collectedSpice: number;
  readonly collectedTransmutationCore: number;
  readonly movementUsed: number;
  readonly uniqueMazeCellsVisited: number;
  readonly mazeNodesVisited: number;
  readonly completed: boolean;

  constructor(args: {
    collectedCredits: number;
    collectedChronotraces: number;
    collectedShardDust: number;
    collectedZoneCrystal: number;
    collectedFractal: number;
    collectedSpice: number;
    collectedTransmutationCore: number;
    movementUsed: number;
    uniqueMazeCellsVisited: number;
    mazeNodesVisited: number;
    completed: boolean;
  }) {
    this.collectedCredits = args.collectedCredits;
    this.collectedChronotraces = args.collectedChronotraces;
    this.collectedShardDust = args.collectedShardDust;
    this.collectedZoneCrystal = args.collectedZoneCrystal;
    this.collectedFractal = args.collectedFractal;
    this.collectedSpice = args.collectedSpice;
    this.collectedTransmutationCore = args.collectedTransmutationCore;
    this.movementUsed = args.movementUsed;
    this.uniqueMazeCellsVisited = args.uniqueMazeCellsVisited;
    this.mazeNodesVisited = args.mazeNodesVisited;
    this.completed = args.completed;
  }
}

export class NotifMazeMoveCommitted implements BaseGameNotif {
  readonly name = 'NotifMazeMoveCommitted';
}

export class NotifRaidComplete implements BaseGameNotif {
  readonly name = 'NotifRaidComplete';
  readonly outcome: RaidOutcome;

  constructor(args: { outcome: RaidOutcome }) {
    this.outcome = args.outcome;
  }
}

export class NotifNexusUpgradePlaced implements BaseGameNotif {
  readonly name = 'NotifNexusUpgradePlaced';
  readonly nexusItemId: string;

  constructor(args: { nexusItemId: string }) {
    this.nexusItemId = args.nexusItemId;
  }
}

export class NotifNexusUpgradesRefunded implements BaseGameNotif {
  readonly name = 'NotifNexusUpgradesRefunded';
}

export type GameNotif =
  | NotifRefiningComplete
  | NotifMazeRunDone
  | NotifMazeMoveCommitted
  | NotifRaidComplete
  | NotifNexusUpgradePlaced
  | NotifNexusUpgradesRefunded;
