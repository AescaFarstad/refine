import type { DeepReadonly, ReadonlyLib } from './UIState';
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
  armor: 'Armor',
  itemBans: 'Max Blocked Items',
  uniqueItemsBonusYield: 'Unique Items Bonus Yield',
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function formatRaidMutationHint(reward: DeepReadonly<Extract<Reward, { kind: 'raid_mutation' }>>, lib: ReadonlyLib): string {
  const raidPrefix = reward.targetRaidId ? `${lib.raidSources.get(reward.targetRaidId)!.name}: ` : '';
  const mutation = reward.mutation;
  if (mutation.kind === 'AddMonsterMutation') {
    return `${raidPrefix}${lib.monsters.get(mutation.monsterId)!.name} ${signed(mutation.count)}`;
  }
  return `${raidPrefix}Raid mutation`;
}

export function formatRewardHintText(reward: DeepReadonly<Reward>, lib: ReadonlyLib): string {
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
    case 'maze_nexus_upgrade_opportunity':
      return `${signed(reward.amount)} Nexus upgrade opportunities`;
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
    case 'refining_red_essence_resource_bonus':
      return `${signed(reward.amount)} credits per red essence`;
    case 'refining_green_essence_resource_bonus':
      return `${signed(reward.amount)} timeFlux per green essence`;
    case 'refining_blue_essence_resource_bonus':
      return `${signed(reward.amount)} chronotraces per blue essence`;
    case 'refining_yellow_neighbor_bonus':
      return `${signed(reward.amount)} yellow adjacency bonus`;
    case 'raid_mutation':
      return formatRaidMutationHint(reward, lib);
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
    case 'timeline_deteriorate_random_raid':
      return 'A random raid zone deteriorates';
    case 'timeline_deteriorate_all_raids':
      return 'All raid zones deteriorate';
    case 'global_monsters_buff_hp':
      return `All monsters gain ${signed(reward.amount)} health`;
  }
}

export function formatRewardsHintText(rewards: readonly DeepReadonly<Reward>[], lib: ReadonlyLib): string[] {
  return rewards.map(r => formatRewardHintText(r, lib));
}
