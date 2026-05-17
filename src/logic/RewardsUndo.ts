import type { GameState } from './GameState';
import type { Reward } from './Reward';
import { grantMazeNexusUpgradeOpportunities } from './MazeNexusUpgradeProgress';

export function undoReward(gs: GameState, reward: Reward): boolean {
  switch (reward.kind) {
    case 'resource':
      gs[reward.resource] -= reward.amount;
      return true;

    case 'stat': {
      const anyGs = gs as any;
      anyGs[reward.stat] = anyGs[reward.stat] - reward.value;
      return true;
    }

    case 'refining_yield_pct_bonus':
      gs.refiningYieldPctBonus -= reward.amount;
      return true;

    case 'refining_success_chance_bonus':
      gs.refiningSuccessChanceBonus -= reward.amount;
      return true;

    case 'refining_speed_pct_bonus':
      gs.refiningSpeedPctBonus -= reward.amount;
      return true;

    case 'refining_red_essence_resource_bonus':
      gs.refiningRedEssenceResourceBonus -= reward.amount;
      return true;

    case 'refining_green_essence_resource_bonus':
      gs.refiningGreenEssenceResourceBonus -= reward.amount;
      return true;

    case 'refining_blue_essence_resource_bonus':
      gs.refiningBlueEssenceResourceBonus -= reward.amount;
      return true;

    case 'refining_yellow_neighbor_bonus':
      gs.refiningYellowNeighborBonus -= reward.amount;
      return true;

    case 'countable_gear':
      gs.countableGear[reward.gearId] = (gs.countableGear[reward.gearId] || 0) - reward.amount;
      return true;

    case 'maze_nexus_upgrade_opportunity':
      grantMazeNexusUpgradeOpportunities(gs, -reward.amount);
      return true;

    case 'unlock_gear':
    case 'unlock_raid':
    case 'unlock_quest':
    case 'discovery':
    case 'learn_signatures':
    case 'learn_n_signatures':
    case 'raid_mutation':
    case 'raid_loot_chance':
    case 'raid_rarity_buff':
    case 'raid_add_item':
    case 'show_ui':
    case 'timeline_deteriorate_random_raid':
      return false;
  }
}

export function undoRewards(gs: GameState, rewards: readonly Reward[]): number {
  let undoneCount = 0;
  for (let i = rewards.length - 1; i >= 0; i--) {
    if (undoReward(gs, rewards[i])) {
      undoneCount++;
    }
  }
  return undoneCount;
}
