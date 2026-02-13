import type { Lib } from './Lib';
import { getResourceSpec } from './Resources';
import type { Reward } from './Reward';

const STAT_LABELS: Record<string, string> = {
  damage: 'Damage',
  health: 'Health',
  volume: 'Bag Volume',
  baseMaxWeight: 'Max Carry Weight',
  researchRevealRadius: 'Research Vision Radius',
  skillPoints: 'Skill Points',
  strength: 'Strength',
  looting: 'Looting',
  speed: 'Speed',
  chanceToHit: 'Chance to Hit',
  chanceToBlock: 'Chance to Block',
  itemBans: 'Max Blocked Items',
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function formatRewardHintText(reward: Reward, lib: Lib): string {
  switch (reward.kind) {
    case 'resource': {
      const spec = getResourceSpec(reward.resource);
      return `${signed(reward.amount)}${spec.glyph} ${spec.name}`;
    }
    case 'unlock_gear':
      return `Unlock gear: ${lib.gear.get(reward.gearId)!.name}`;
    case 'unlock_raid':
      return `Unlock raid: ${lib.raidSources.get(reward.raidId)!.name}`;
    case 'unlock_quest':
      return `Unlock quest: ${lib.quests.get(reward.questId)!.name}`;
    case 'discovery':
      return `Discovery: ${reward.discoveryId}`;
    case 'learn_signatures':
      return `Learn signatures: ${reward.signatureIds.length}`;
    case 'learn_n_signatures':
      return `Learn ${reward.count} random signatures`;
    case 'countable_gear':
      return `${signed(reward.amount)} ${lib.gear.get(reward.gearId)!.name}`;
    case 'stat': {
      const statName = STAT_LABELS[reward.stat] ?? reward.stat;
      return `${signed(reward.value)} ${statName}`;
    }
    case 'refining_yield_pct_bonus':
      return `${signed(reward.amount)}% refining yield`;
    case 'refining_success_chance_bonus':
      return `${signed(reward.amount)}% refining success chance`;
    case 'refining_speed_pct_bonus':
      return `${signed(reward.amount)}% refining speed`;
    case 'raid_mutation':
      return 'Raid mutation';
    case 'raid_loot_chance':
      return `Raid loot chance ${signed(reward.delta)}%`;
    case 'raid_rarity_buff':
      return `Raid rarity ${signed(reward.delta)}`;
    case 'raid_add_item': {
      const itemNames = reward.itemIds.map(id => lib.getItem(id).name);
      return `Raid loot items: ${itemNames.join(', ')}`;
    }
    case 'show_ui':
      return `UI event: ${reward.ui}`;
  }
}

export function formatRewardsHintText(rewards: readonly Reward[], lib: Lib): string[] {
  return rewards.map(r => formatRewardHintText(r, lib));
}
