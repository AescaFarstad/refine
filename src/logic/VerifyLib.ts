import type { EncounterDef } from './RaidLib';
import type { Lib } from './Lib';
import type { RaidMutation } from './RaidMutation';
import type { Reward } from './Reward';
import { DISCOVERY } from './DiscoveryLib';
import { REWARD_UI_KEYS } from '../components/rewardUI/RewardUIRegistry';

type VerifyErrors = string[];

const DISCOVERY_IDS: Set<string> = new Set(Object.values(DISCOVERY));
const REWARD_UI_KEY_SET = new Set(REWARD_UI_KEYS);

function addMissingRef(errors: VerifyErrors, context: string, kind: string, id: string): void {
  errors.push(`${context} references missing ${kind}: ${id}`);
}

function ensureExists(errors: VerifyErrors, map: Map<string, unknown>, id: string, context: string, kind: string): void {
  if (!map.has(id)) addMissingRef(errors, context, kind, id);
}

function verifyEncounterRefs(encounter: EncounterDef, context: string, lib: Lib, errors: VerifyErrors): void {
  switch (encounter.type) {
    case 'PreparationEncounter':
      ensureExists(errors, lib.gear, encounter.gearId, context, 'gear');
      return;
    case 'MonsterLootEncounter':
      ensureExists(errors, lib.monsters, encounter.monsterId, context, 'monster');
      return;
    case 'FightEncounter':
      ensureExists(errors, lib.monsters, encounter.monsterId, context, 'monster');
      return;
    case 'QuestEncounter':
      ensureExists(errors, lib.quests, encounter.questId, context, 'quest');
      return;
    case 'WalkEncounter':
    case 'LootEncounter':
      return;
  }
}

function verifyRaidMutationRefs(mutation: RaidMutation, context: string, lib: Lib, errors: VerifyErrors): void {
  switch (mutation.kind) {
    case 'AddMonsterMutation':
      ensureExists(errors, lib.monsters, mutation.monsterId, context, 'monster');
      return;
    case 'UpgradeMonsterMutation':
      ensureExists(errors, lib.monsters, mutation.fromMonsterId, context, 'monster');
      ensureExists(errors, lib.monsters, mutation.toMonsterId, context, 'monster');
      return;
    case 'QuestMutation':
      ensureExists(errors, lib.quests, mutation.questId, context, 'quest');
      return;
    case 'LootMutation':
    case 'WalkMutation':
    case 'LootDifficultyMutation':
    case 'ZoneCollapseTimeMutation':
      return;
  }
}

function verifyRewardRefs(reward: Reward, context: string, lib: Lib, errors: VerifyErrors): void {
  switch (reward.kind) {
    case 'unlock_gear':
      ensureExists(errors, lib.gear, reward.gearId, context, 'gear');
      return;
    case 'countable_gear':
      ensureExists(errors, lib.gear, reward.gearId, context, 'gear');
      return;
    case 'unlock_raid':
      ensureExists(errors, lib.raidSources, reward.raidId, context, 'raid');
      return;
    case 'unlock_quest':
      ensureExists(errors, lib.quests, reward.questId, context, 'quest');
      return;
    case 'learn_signatures':
      for (const signatureId of reward.signatureIds) {
        ensureExists(errors, lib.signatures, signatureId, context, 'signature');
      }
      return;
    case 'raid_mutation':
      if (reward.targetRaidId) {
        ensureExists(errors, lib.raidSources, reward.targetRaidId, context, 'raid');
      }
      verifyRaidMutationRefs(reward.mutation, `${context} raid_mutation`, lib, errors);
      return;
    case 'raid_add_item':
      if (reward.targetRaidId) {
        ensureExists(errors, lib.raidSources, reward.targetRaidId, context, 'raid');
      }
      for (const itemId of reward.itemIds) {
        ensureExists(errors, lib.items, itemId, context, 'item');
      }
      return;
    case 'raid_loot_chance':
    case 'raid_rarity_buff':
      if (reward.targetRaidId) {
        ensureExists(errors, lib.raidSources, reward.targetRaidId, context, 'raid');
      }
      return;
    case 'resource':
    case 'refining_yield_pct_bonus':
    case 'refining_success_chance_bonus':
    case 'refining_speed_pct_bonus':
      return;
    case 'discovery':
      if (!DISCOVERY_IDS.has(reward.discoveryId)) {
        addMissingRef(errors, context, 'discovery', reward.discoveryId);
      }
      return;
    case 'show_ui':
      if (!REWARD_UI_KEY_SET.has(reward.ui)) {
        addMissingRef(errors, context, 'reward ui', reward.ui);
      }
      return;
    case 'learn_n_signatures':
    case 'stat':
      return;
  }
}

export function verifyRaids(lib: Lib, errors: VerifyErrors): void {
  for (const id of lib.raidSources.keys()) {
    if (!lib.raids.has(id)) {
      errors.push(`RaidSources contains raid missing in raids map: ${id}`);
    }
  }
  for (const id of lib.raids.keys()) {
    if (!lib.raidSources.has(id)) {
      errors.push(`Raids map contains raid missing in raidSources: ${id}`);
    }
  }

  for (const raid of lib.raidSources.values()) {
    const context = `Raid[${raid.id}]`;
    for (const itemId of raid.items) {
      ensureExists(errors, lib.items, itemId, context, 'item');
    }
    for (const itemId of raid.allPotentialItems) {
      ensureExists(errors, lib.items, itemId, context, 'item');
    }
    for (const step of raid.encounters) {
      verifyEncounterRefs(step.encounter, `${context} encounter`, lib, errors);
    }
    for (const mutation of raid.initialMutations) {
      verifyRaidMutationRefs(mutation, `${context} initialMutation`, lib, errors);
    }
  }
}

export function verifyQuests(lib: Lib, errors: VerifyErrors): void {
  for (const quest of lib.quests.values()) {
    const context = `Quest[${quest.id}]`;
    for (const raidId of quest.raidRestriction) {
      ensureExists(errors, lib.raidSources, raidId, context, 'raid');
    }
    for (const gearId of quest.gearRequired) {
      ensureExists(errors, lib.gear, gearId, context, 'gear');
    }
    for (const questId of quest.requiresQuestIds) {
      ensureExists(errors, lib.quests, questId, context, 'quest');
    }
    for (const reward of quest.rewards) {
      verifyRewardRefs(reward, `${context} reward`, lib, errors);
    }
    for (const mutation of quest.encounters) {
      verifyRaidMutationRefs(mutation, `${context} encounter`, lib, errors);
    }
  }
}

export function verifyItems(lib: Lib, errors: VerifyErrors): void {
  const rarities = new Set(['common', 'uncommon', 'rare', 'legendary']);
  for (const item of lib.items.values()) {
    if (!rarities.has(item.rarity)) {
      errors.push(`Item[${item.id}] has invalid rarity: ${item.rarity}`);
    }
  }
  for (const monster of lib.monsters.values()) {
    ensureExists(errors, lib.items, monster.lootItemId, `Monster[${monster.id}]`, 'item');
  }
}

export function verifyGear(lib: Lib, errors: VerifyErrors): void {
  for (const gear of lib.gear.values()) {
    const context = `Gear[${gear.id}]`;
    ensureExists(errors, lib.gearCategories, gear.category, context, 'gear category');
    for (const categoryId of Object.keys(gear.bonusDamagePerCategory)) {
      ensureExists(errors, lib.gearCategories, categoryId, context, 'gear category');
    }
    for (const categoryId of Object.keys(gear.bonusHpPerCategory)) {
      ensureExists(errors, lib.gearCategories, categoryId, context, 'gear category');
    }
    for (const categoryId of Object.keys(gear.bonusBlockChancePerCategory)) {
      ensureExists(errors, lib.gearCategories, categoryId, context, 'gear category');
    }
  }
}

export function verifyResearch(lib: Lib, errors: VerifyErrors): void {
  for (const node of lib.research.nodes.values()) {
    if (!lib.research.archetypes.has(node.archetypeId)) {
      errors.push(`ResearchNode[${node.nodeId}] references missing archetype: ${node.archetypeId}`);
    }
  }
  for (const archetype of lib.research.archetypes.values()) {
    const context = `ResearchArchetype[${archetype.id}]`;
    for (const reward of archetype.rewards) {
      verifyRewardRefs(reward, context, lib, errors);
    }
  }
}

export function verifySignatures(lib: Lib, errors: VerifyErrors): void {
  for (const signature of lib.signatures.values()) {
    const context = `Signature[${signature.id}]`;
    for (const reward of signature.rewards) {
      verifyRewardRefs(reward, context, lib, errors);
    }
  }
}

export function verifyLibIntegrity(lib: Lib): void {
  const errors: VerifyErrors = [];
  verifyRaids(lib, errors);
  verifyQuests(lib, errors);
  verifyItems(lib, errors);
  verifyGear(lib, errors);
  verifyResearch(lib, errors);
  verifySignatures(lib, errors);

  if (errors.length > 0) {
    const count = errors.length;
    const label = count === 1 ? 'issue' : 'issues';
    throw new Error(`Lib integrity check failed (${count} ${label}):\n${errors.join('\n')}`);
  }
}
