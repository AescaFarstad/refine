import { Raid, type GameState } from './GameState';
import type { RaidMutation } from './RaidMutation';
import { applyPermanentRaidMutation } from './RaidMutation';
import { discover } from './Discover';

export type Reward =
  | { kind: 'resource'; resource: 'credits' | 'chronotraces' | 'timeFlux' | 'shardDust' | 'skillPoints'; amount: number }

  | { kind: 'unlock'; unlockId: string }
  | { kind: 'unlock_gear'; gearId: string }
  | { kind: 'unlock_raid'; raidId: string }
  | { kind: 'unlock_quest'; questId: string }
  | { kind: 'discovery'; discoveryId: string }

  | { kind: 'stat'; stat: string; value: number }

  // Raid Modifications (Context-sensitive or targeted)
  // If targetRaidId is undefined, it applies to the "current" raid context (e.g. for Quest completion rewards)
  | { kind: 'raid_mutation'; mutation: RaidMutation; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_loot_chance'; delta: number; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_rarity_buff'; delta: number; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_add_item'; itemId: string; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  ;

export interface RewardContext {
  activeRaidId?: string;
  raidEntry?: { lootingRarityBuff: number };
}

export function applyReward(gs: GameState, reward: Reward, context: RewardContext = {}): void {
  switch (reward.kind) {
    case 'resource':
      gs[reward.resource] += reward.amount;
      break;

    case 'stat': {
      const anyGs = gs as any;
      anyGs[reward.stat] = anyGs[reward.stat] + reward.value;
      break;
    }

    case 'unlock':
      if (!gs.unlocks.includes(reward.unlockId))
        gs.unlocks.push(reward.unlockId);
      break;

    case 'unlock_gear':
      if (!gs.unlockedGear.includes(reward.gearId))
        gs.unlockedGear.push(reward.gearId);
      break;

    case 'unlock_raid':
      gs.unlockedRaids.push(new Raid(reward.raidId));
      break;

    case 'unlock_quest':
      break;

    case 'discovery':
      discover(gs, reward.discoveryId);
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
      if (!raidDef.items.includes(reward.itemId)) {
        raidDef.items.push(reward.itemId);
      }
      break;
    }
  }
}
