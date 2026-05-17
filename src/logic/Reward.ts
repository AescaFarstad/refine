import { Raid, type GameState } from './GameState';
import type { RaidMutation } from './RaidMutation';
import { applyPermanentRaidMutation, pickAndApplyRaidDeteriorationMutation } from './RaidMutation';
import { discover, ensureResearchTabDiscovery, ensureMazeTabDiscovery } from './Discover';
import { DISCOVERY, syncDerivedGearUnlocks } from './DiscoveryLib';
import { grantMazeNexusUpgradeOpportunities } from './MazeNexusUpgradeProgress';

export interface RefiningRewardBonus {
  refiningYieldPctBonus: number;
  refiningSuccessChanceBonus: number;
  refiningSpeedPctBonus: number;
  refiningRedEssenceResourceBonus: number;
  refiningGreenEssenceResourceBonus: number;
  refiningBlueEssenceResourceBonus: number;
  refiningYellowNeighborBonus: number;
}

export function createRefiningRewardBonus(): RefiningRewardBonus {
  return {
    refiningYieldPctBonus: 0,
    refiningSuccessChanceBonus: 0,
    refiningSpeedPctBonus: 0,
    refiningRedEssenceResourceBonus: 0,
    refiningGreenEssenceResourceBonus: 0,
    refiningBlueEssenceResourceBonus: 0,
    refiningYellowNeighborBonus: 0,
  };
}

export type Reward =
  | { kind: 'resource'; resource: 'credits' | 'chronotraces' | 'timeFlux' | 'shardDust' | 'skillPoints'; amount: number }

  | { kind: 'unlock_gear'; gearId: string }
  | { kind: 'unlock_raid'; raidId: string }
  | { kind: 'unlock_quest'; questId: string }
  | { kind: 'discovery'; discoveryId: string }
  | { kind: 'learn_signatures'; signatureIds: readonly string[] }
  | { kind: 'learn_n_signatures'; count: number }
  | { kind: 'countable_gear'; gearId: string; amount: number }
  | { kind: 'maze_nexus_upgrade_opportunity'; amount: number }

  | { kind: 'stat'; stat: string; value: number }
  | { kind: 'refining_yield_pct_bonus'; amount: number }
  | { kind: 'refining_success_chance_bonus'; amount: number }
  | { kind: 'refining_speed_pct_bonus'; amount: number }
  | { kind: 'refining_red_essence_resource_bonus'; amount: number }
  | { kind: 'refining_green_essence_resource_bonus'; amount: number }
  | { kind: 'refining_blue_essence_resource_bonus'; amount: number }
  | { kind: 'refining_yellow_neighbor_bonus'; amount: number }

  // Raid Modifications (Context-sensitive or targeted)
  // If targetRaidId is undefined, it applies to the "current" raid context (e.g. for Quest completion rewards)
  | { kind: 'raid_mutation'; mutation: RaidMutation; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_loot_chance'; delta: number; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_rarity_buff'; delta: number; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_add_item'; itemIds: readonly string[]; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'timeline_deteriorate_random_raid' }

  // UI interactions
  | { kind: 'show_ui'; ui: string; params?: Record<string, unknown> }
  ;

export interface UIModalEntry {
  ui: string;
  params?: Record<string, unknown>;
}

export interface RewardContext {
  activeRaidId?: string;
  raidEntry?: { lootingRarityBuff: number };
}

function unlockGear(gs: GameState, gearId: string): void {
  if (!gs.unlockedGear.includes(gearId)) {
    gs.unlockedGear.push(gearId);
  }
  syncDerivedGearUnlocks(gs.unlockedGear);
}

export function applyReward(gs: GameState, reward: Reward, context: RewardContext = {}): void {
  switch (reward.kind) {
    case 'resource':
      gs[reward.resource] += reward.amount;
      if (reward.resource === 'chronotraces' && reward.amount > 0) {
        ensureResearchTabDiscovery(gs);
      } else if (reward.resource === 'timeFlux' && reward.amount > 0) {
        ensureMazeTabDiscovery(gs);
      }
      break;

    case 'stat': {
      const anyGs = gs as any;
      anyGs[reward.stat] = anyGs[reward.stat] + reward.value;
      if (reward.stat === 'uniqueItemsBonusYield' && !gs.discoveries[DISCOVERY.UI_REFINE_YIELD]) {
        discover(gs, DISCOVERY.UI_REFINE_YIELD);
      }
      break;
    }

    case 'refining_yield_pct_bonus':
      gs.refiningYieldPctBonus += reward.amount;
      break;

    case 'refining_success_chance_bonus':
      gs.refiningSuccessChanceBonus += reward.amount;
      break;

    case 'refining_speed_pct_bonus':
      gs.refiningSpeedPctBonus += reward.amount;
      break;

    case 'refining_red_essence_resource_bonus':
      gs.refiningRedEssenceResourceBonus += reward.amount;
      break;

    case 'refining_green_essence_resource_bonus':
      gs.refiningGreenEssenceResourceBonus += reward.amount;
      break;

    case 'refining_blue_essence_resource_bonus':
      gs.refiningBlueEssenceResourceBonus += reward.amount;
      break;

    case 'refining_yellow_neighbor_bonus':
      gs.refiningYellowNeighborBonus += reward.amount;
      break;

    case 'unlock_gear':
      unlockGear(gs, reward.gearId);
      break;

    case 'unlock_raid':
      gs.unlockedRaids.push(new Raid(reward.raidId));
      delete gs.discoveries[DISCOVERY.UI_RAID_SELECTION];
      gs.discoveryCounter = 0;
      break;

    case 'unlock_quest':
      break;

    case 'discovery':
      discover(gs, reward.discoveryId);
      break;

    case 'learn_signatures':
      for (const id of reward.signatureIds) {
        if (gs.learnedSignatureIds.includes(id)) continue;
        gs.learnedSignatureIds.push(id);
      }
      break;

    case 'learn_n_signatures': {
      discover(gs, DISCOVERY.SIGNATURES);
      const learned = new Set(gs.learnedSignatureIds);
      const unlearned = Array.from(gs.lib.signatures.values())
        .map(s => s.id)
        .filter(id => !learned.has(id));
      const count = Math.min(reward.count, unlearned.length);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(gs.random.get() * unlearned.length);
        gs.learnedSignatureIds.push(unlearned[idx]);
        unlearned.splice(idx, 1);
      }
      break;
    }

    case 'countable_gear':
      gs.countableGear[reward.gearId] = (gs.countableGear[reward.gearId] || 0) + reward.amount;
      unlockGear(gs, reward.gearId);
      break;

    case 'maze_nexus_upgrade_opportunity':
      grantMazeNexusUpgradeOpportunities(gs, reward.amount);
      break;

    case 'raid_mutation': {
      const raidId = (reward.targetRaidId ?? context.activeRaidId)!;
      applyPermanentRaidMutation(gs, raidId, reward.mutation);
      break;
    }

    case 'raid_loot_chance': {
      const raidId = (reward.targetRaidId ?? context.activeRaidId)!;
      gs.lib.raids.get(raidId)!.baseLootChance += reward.delta;
      break;
    }

    case 'raid_rarity_buff':
      context.raidEntry!.lootingRarityBuff += reward.delta;
      break;

    case 'raid_add_item': {
      const raidId = (reward.targetRaidId ?? context.activeRaidId)!;
      const raidDef = gs.lib.raids.get(raidId)!;
      let changed = false;
      for (const itemId of reward.itemIds) {
        if (!raidDef.items.includes(itemId)) {
          raidDef.items.push(itemId);
          changed = true;
        }
      }
      if (changed) {
        raidDef.itemPoolsByRarity = gs.lib.buildItemPoolsByRarity(raidDef.items);
      }
      break;
    }

    case 'show_ui':
      if (!gs.pendingUIModals.some(m => m.ui === reward.ui)) {
        gs.pendingUIModals.push({ ui: reward.ui, params: reward.params });
      }
      break;

    case 'timeline_deteriorate_random_raid': {
      if (gs.unlockedRaids.length === 0) {
        break;
      }
      const idx = Math.floor(gs.random.get() * gs.unlockedRaids.length);
      const raidId = gs.unlockedRaids[idx]!.id;
      pickAndApplyRaidDeteriorationMutation(gs, raidId);
      break;
    }
  }
}
