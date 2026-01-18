import { Raid, type GameState } from './GameState';
import type { RaidMutation } from './RaidMutation';
import { applyPermanentRaidMutation } from './RaidMutation';
import { discover, ensureResearchTabDiscovery, ensureMazeTabDiscovery } from './Discover';
import { DISCOVERY } from './DiscoveryLib';

export type Reward =
  | { kind: 'resource'; resource: 'credits' | 'chronotraces' | 'timeFlux' | 'shardDust' | 'skillPoints'; amount: number }

  | { kind: 'unlock'; unlockId: string }
  | { kind: 'unlock_gear'; gearId: string }
  | { kind: 'unlock_raid'; raidId: string }
  | { kind: 'unlock_quest'; questId: string }
  | { kind: 'discovery'; discoveryId: string }
  | { kind: 'learn_signatures'; signatureIds: string[] }
  | { kind: 'learn_n_signatures'; count: number }
  | { kind: 'countable_gear'; gearId: string; amount: number }

  | { kind: 'stat'; stat: string; value: number }

  // Raid Modifications (Context-sensitive or targeted)
  // If targetRaidId is undefined, it applies to the "current" raid context (e.g. for Quest completion rewards)
  | { kind: 'raid_mutation'; mutation: RaidMutation; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_loot_chance'; delta: number; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_rarity_buff'; delta: number; targetRaidId?: string; sentiment?: 'positive' | 'negative' }
  | { kind: 'raid_add_item'; itemIds: string[]; targetRaidId?: string; sentiment?: 'positive' | 'negative' }

  // UI interactions
  | { kind: 'show_ui'; ui: string }
  ;

export interface RewardContext {
  activeRaidId?: string;
  raidEntry?: { lootingRarityBuff: number };
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
      // Reset raid selection discovery so the user is prompted to select the new raid
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
      // Auto-unlock the gear if not already unlocked
      if (!gs.unlockedGear.includes(reward.gearId)) {
        gs.unlockedGear.push(reward.gearId);
      }
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
      for (const itemId of reward.itemIds) {
        if (!raidDef.items.includes(itemId)) {
          raidDef.items.push(itemId);
        }
      }
      break;
    }

    case 'show_ui':
      if (!gs.pendingUIModals.includes(reward.ui)) {
        gs.pendingUIModals.push(reward.ui);
      }
      break;
  }
}
