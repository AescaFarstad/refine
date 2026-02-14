import type { Point2 } from '../core/math';
import type { Molecule } from '../ItemLib';

export interface CmdInput {
  name: string;
}

export class CmdAdvanceTime implements CmdInput {
  readonly name = 'CmdAdvanceTime';
}

export class CmdStartRaid implements CmdInput {
  readonly name = 'CmdStartRaid';
  readonly id: string;
  constructor(args: { id: string }) { this.id = args.id; }
}

export class CmdAcknowledgeOutcome implements CmdInput {
  readonly name = 'CmdAcknowledgeOutcome';
}

export class CmdConsumeOutcomeRewards implements CmdInput {
  readonly name = 'CmdConsumeOutcomeRewards';
}

export class CmdAcknowledgeSignatureLearn implements CmdInput {
  readonly name = 'CmdAcknowledgeSignatureLearn';
}

export class CmdAcknowledgeSignaturePlacementDiscovery implements CmdInput {
  readonly name = 'CmdAcknowledgeSignaturePlacementDiscovery';
}

export class CmdPreviewSignature implements CmdInput {
  readonly name = 'CmdPreviewSignature';
  readonly id: string;
  constructor(args: { id: string }) {
    this.id = args.id;
  }
}

export class CmdStartRefining implements CmdInput {
  readonly name = 'CmdStartRefining';
  constructor() { }
}

export class CmdResearchNode implements CmdInput {
  readonly name = 'CmdResearchNode';
  readonly pos: Point2;
  constructor(args: { pos: Point2 }) {
    this.pos = args.pos;
  }
}

// Raids UI: selection and gear toggling
export class CmdSelectRaid implements CmdInput {
  readonly name = 'CmdSelectRaid';
  readonly id: string;
  constructor(args: { id: string }) { this.id = args.id; }
}

export class CmdToggleGear implements CmdInput {
  readonly name = 'CmdToggleGear';
  readonly raidId: string;
  readonly gearId: string;
  readonly selected: boolean; // true = select, false = unselect
  constructor(args: { raidId: string; gearId: string; selected: boolean }) {
    this.raidId = args.raidId;
    this.gearId = args.gearId;
    this.selected = !!args.selected;
  }
}

// Unlock one additional slot for a gear category by spending skill points
// Removed: unlocking gear slots logic

// Quests UI: toggle manual quest activation (non-autoaccept quests)
export class CmdToggleQuest implements CmdInput {
  readonly name = 'CmdToggleQuest';
  readonly id: string;
  readonly active: boolean;
  constructor(args: { id: string; active: boolean }) {
    this.id = args.id;
    this.active = !!args.active;
  }
}

// Mark a quest as reviewed (user hovered over it)
export class CmdReviewQuest implements CmdInput {
  readonly name = 'CmdReviewQuest';
  readonly id: string;
  constructor(args: { id: string }) {
    this.id = args.id;
  }
}

// Wafer manipulation commands

export class CmdPlaceMolecule implements CmdInput {
  readonly name = 'CmdPlaceMolecule';
  readonly itemId: string;
  readonly molecule: Molecule;
  readonly rotation: number;
  constructor(args: { itemId: string; molecule: Molecule; rotation?: number }) {
    this.itemId = args.itemId;
    this.molecule = args.molecule;
    this.rotation = args.rotation ?? 0;
  }
}

export class CmdRemoveMolecule implements CmdInput {
  readonly name = 'CmdRemoveMolecule';
  readonly itemIdx: number;
  constructor(args: { itemIdx: number }) {
    this.itemIdx = args.itemIdx;
  }
}

export class CmdGrowWafer implements CmdInput {
  readonly name = 'CmdGrowWafer';
  readonly pos: Point2;
  constructor(args: { pos: Point2 }) {
    this.pos = args.pos;
  }
}

export class CmdUpgradeGearCategory implements CmdInput {
  readonly name = 'CmdUpgradeGearCategory';
  readonly categoryId: string;
  constructor(args: { categoryId: string }) {
    this.categoryId = args.categoryId;
  }
}

export class CmdOpenGearUpgradeModal implements CmdInput {
  readonly name = 'CmdOpenGearUpgradeModal';
}

export class CmdDiscover implements CmdInput {
  readonly name = 'CmdDiscover';
  readonly discoveryId: string;
  constructor(args: { discoveryId: string }) {
    this.discoveryId = args.discoveryId;
  }
}

export class CmdMarkEssencesSeen implements CmdInput {
  readonly name = 'CmdMarkEssencesSeen';
  constructor() { }
}

export class CmdSwitchTab implements CmdInput {
  readonly name = 'CmdSwitchTab';
  readonly tab: 'raid' | 'refine' | 'research' | 'maze';
  constructor(args: { tab: 'raid' | 'refine' | 'research' | 'maze' }) {
    this.tab = args.tab;
  }
}

export class CmdDismissUIModal implements CmdInput {
  readonly name = 'CmdDismissUIModal';
  readonly ui: string;
  readonly rewards: import('../Reward').Reward[];
  constructor(args: { ui: string; rewards?: import('../Reward').Reward[] }) {
    this.ui = args.ui;
    this.rewards = args.rewards ?? [];
  }
}

export class CmdToggleItemBan implements CmdInput {
  readonly name = 'CmdToggleItemBan';
  readonly raidId: string;
  readonly itemId: string;
  readonly banned: boolean;
  constructor(args: { raidId: string; itemId: string; banned: boolean }) {
    this.raidId = args.raidId;
    this.itemId = args.itemId;
    this.banned = args.banned;
  }
}

export class CmdDismissIntro implements CmdInput {
  readonly name = 'CmdDismissIntro';
}

export class CmdPickupShard implements CmdInput {
  readonly name = 'CmdPickupShard';
  readonly shardId: string;
  constructor(args: { shardId: string }) {
    this.shardId = args.shardId;
  }
}

export class CmdSpeedUpRefining implements CmdInput {
  readonly name = 'CmdSpeedUpRefining';
}

export class CmdClearShardPickupGrace implements CmdInput {
  readonly name = 'CmdClearShardPickupGrace';
}
