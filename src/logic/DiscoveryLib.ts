// Discoveries track what the player has seen or unlocked.
// Some discoveries are purely visual - they control when UI elements appear.
// Others behave like unlocks - the bonus/feature is not applied until discovered.
const ids = [
  'INTRO_SEEN',
  'UI_GEAR',
  'UI_GEAR_UPGRADE_MODAL_OPENED',
  'UI_SHARDS',
  'UI_DAMAGE_BREAKDOWN',
  'UI_TIME_BREAKDOWN',
  'UI_REFINE_YIELD',
  'UNIQUE_ITEMS_YIELD',
  'CYAN_YIELD',
  'MAGENTA_YIELD',
  'ESSENCE_RESEARCH_KNOWLEDGE',
  'MAZE_NAVIGATION',
  'SIGNATURES',
  'TAB_REFINE',
  'TAB_RESEARCH',
  'TAB_MAZE',
  'TAB_REFINE_VISITED',
  'TAB_RESEARCH_VISITED',
  'TAB_MAZE_VISITED',
  'UI_RAID_MONSTERS',
  'UI_RAID_LOOT',
  'UI_RAID_SPEED',
  'UI_RAID_SELECTION',
  'UI_RAID_RESOURCES_COLLECTED',
  'GEAR_XP',
  'UI_WAFER_INFO',
  'UI_SIGNATURE_INFO',
  'MAGENTA_CRYSTALS',
  'FRACTAL_ESSENCE_YIELD',
  'SPICE_ESSENCE_YIELD',
  'WHITE_BLACK_ESSENCE_SWAP',
  'MAZE_NEXUS',
  'REFINEMENT_FAILED',
  'YOU_WON_SEEN',
  'DEV',
] as const;

type DiscoveryKey = (typeof ids)[number];

export const DISCOVERY = ids.reduce((acc, id) => {
  acc[id] = id;
  return acc;
}, {} as any) as { [K in DiscoveryKey]: K };

export interface MonochromeEssenceBehavior {
  waferChargeEssence: 'black' | 'white';
  yieldPenaltyEssence: 'black' | 'white';
  fractalYieldEssence: 'black' | 'white';
  spiceYieldEssence: 'black' | 'white';
}

const DEFAULT_MONOCHROME_ESSENCE_BEHAVIOR: MonochromeEssenceBehavior = {
  waferChargeEssence: 'white',
  yieldPenaltyEssence: 'black',
  fractalYieldEssence: 'black',
  spiceYieldEssence: 'white',
};

const SWAPPED_MONOCHROME_ESSENCE_BEHAVIOR: MonochromeEssenceBehavior = {
  waferChargeEssence: 'black',
  yieldPenaltyEssence: 'white',
  fractalYieldEssence: 'white',
  spiceYieldEssence: 'black',
};

export function getMonochromeEssenceBehavior(
  discoveries: Readonly<Record<string, boolean | undefined>>,
): MonochromeEssenceBehavior {
  if (discoveries[DISCOVERY.WHITE_BLACK_ESSENCE_SWAP] === true) {
    return SWAPPED_MONOCHROME_ESSENCE_BEHAVIOR;
  }
  return DEFAULT_MONOCHROME_ESSENCE_BEHAVIOR;
}

const GATHER_RESOURCES_UNLOCK_SOURCE_GEAR_IDS = ['scaffold', 'tesseract'] as const;
const GATHER_RESOURCES_TACTIC_GEAR_ID = 'gather_resources';

export function syncDerivedGearUnlocks(unlockedGear: string[]): boolean {
  if (unlockedGear.includes(GATHER_RESOURCES_TACTIC_GEAR_ID)) {
    return false;
  }

  for (const gearId of GATHER_RESOURCES_UNLOCK_SOURCE_GEAR_IDS) {
    if (unlockedGear.includes(gearId)) {
      unlockedGear.push(GATHER_RESOURCES_TACTIC_GEAR_ID);
      return true;
    }
  }

  return false;
}

// Prefer using `DISCOVERY.*` literals, but allow ad-hoc string ids too.
export type DiscoveryId = (typeof DISCOVERY)[keyof typeof DISCOVERY] | string;
