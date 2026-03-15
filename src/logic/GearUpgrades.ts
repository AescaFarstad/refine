import type { GameState } from './GameState';
import { GEAR_UPGRADE_STAT_KEYS, type GearDefinition, type GearUpgradeDefinition } from './GearLib';

type GearLibView = {
  readonly gear: ReadonlyMap<string, GearDefinition>;
};

type GearUpgradeXpState = {
  readonly lib: GearLibView;
  readonly gearXpById: Readonly<Record<string, number | undefined>>;
};

type GearUpgradeSelectionState = {
  readonly lib: GearLibView;
  readonly gearUpgradeIdsById: Readonly<Record<string, readonly string[] | undefined>>;
};

export function getGearUpgradeThresholds(gear: GearDefinition): number[] {
  let total = 0;
  return gear.xp.map(cost => {
    total += Math.max(0, cost | 0);
    return total;
  });
}

export function getUnlockedGearUpgradeCount(gs: GearUpgradeXpState, gearId: string): number {
  const gear = gs.lib.gear.get(gearId)!;
  const xp = Math.max(0, gs.gearXpById[gearId] ?? 0);
  let unlocked = 0;
  for (const threshold of getGearUpgradeThresholds(gear)) {
    if (xp < threshold) break;
    unlocked++;
  }
  return unlocked;
}

export function getAppliedGearUpgradeIds(gs: Pick<GearUpgradeSelectionState, 'gearUpgradeIdsById'>, gearId: string): string[] {
  return [...(gs.gearUpgradeIdsById[gearId] ?? [])];
}

export function getAppliedGearUpgradeDefinitions(gs: GearUpgradeSelectionState, gearId: string): GearUpgradeDefinition[] {
  const gear = gs.lib.gear.get(gearId)!;
  return getAppliedGearUpgradeIds(gs, gearId).map(upgradeId => gear.ups[upgradeId]!);
}

export function getPendingGearUpgradeCount(gs: GearUpgradeXpState & GearUpgradeSelectionState, gearId: string): number {
  const unlocked = getUnlockedGearUpgradeCount(gs, gearId);
  const applied = getAppliedGearUpgradeIds(gs, gearId).length;
  return Math.max(0, unlocked - applied);
}

export function buildEffectiveGear(base: Readonly<GearDefinition>, upgrades: readonly Readonly<GearUpgradeDefinition>[]): GearDefinition {
  if (upgrades.length === 0) return base;

  const effective: GearDefinition = {
    ...base,
    xp: base.xp.slice(),
    ups: { ...base.ups },
  };

  for (const upgrade of upgrades) {
    for (const key of GEAR_UPGRADE_STAT_KEYS) {
      effective[key] += upgrade[key];
    }
    if (upgrade.removePerk) {
      effective.perk = '';
      effective.description = '';
    }
    if (upgrade.changeDescription) {
      effective.description = upgrade.changeDescription;
    }
  }

  return effective;
}

export function buildEffectiveGearForId(gs: GearUpgradeSelectionState, gearId: string): GearDefinition {
  const base = gs.lib.gear.get(gearId)!;
  const upgrades = getAppliedGearUpgradeDefinitions(gs, gearId);
  return buildEffectiveGear(base, upgrades);
}

export function cacheActiveRaidEffectiveGear(gs: GameState, gearId: string): GearDefinition {
  const effective = buildEffectiveGearForId(gs, gearId);
  gs.raid.effectiveGearById[gearId] = effective;
  return effective;
}

export function getCachedActiveRaidGear<TGear extends GearDefinition>(gs: { readonly raid: { readonly effectiveGearById: Readonly<Record<string, TGear | undefined>> } }, gearId: string): TGear {
  return gs.raid.effectiveGearById[gearId]!;
}

export function addGearXp(gs: GameState, gearIds: readonly string[], amount: number): void {
  const delta = Math.max(0, amount | 0);
  if (delta <= 0) return;
  for (const gearId of gearIds) {
    const gear = gs.lib.gear.get(gearId)!;
    if (gear.xp.length === 0) continue;
    gs.gearXpById[gearId] = (gs.gearXpById[gearId] ?? 0) + delta;
  }
}

export function getUpgradeSkillPointsCost(gs: GameState, gearId: string, upgradeId: string): number {
  const gear = gs.lib.gear.get(gearId)!;
  const upgrade = gear.ups[upgradeId];
  if (!upgrade) return -1;
  return upgrade.skillPoints; // -1 = costs 1, 0 = free, 1 = grants 1
}

export function canApplyGearUpgrade(gs: GameState, gearId: string, upgradeId: string): boolean {
  const gear = gs.lib.gear.get(gearId)!;
  if (!gear.ups[upgradeId]) return false;
  const spCost = gear.ups[upgradeId].skillPoints;
  // spCost < 0 means it costs skill points; check we have enough
  if (spCost < 0 && gs.skillPoints < -spCost) return false;
  if (getPendingGearUpgradeCount(gs, gearId) <= 0) return false;
  return !getAppliedGearUpgradeIds(gs, gearId).includes(upgradeId);
}

export function applyGearUpgrade(gs: GameState, gearId: string, upgradeId: string): boolean {
  if (!canApplyGearUpgrade(gs, gearId, upgradeId)) return false;
  const gear = gs.lib.gear.get(gearId)!;
  const spCost = gear.ups[upgradeId].skillPoints;
  gs.skillPoints -= -spCost; // spCost=-1 => skillPoints -= 1; spCost=1 => skillPoints += 1
  const next = getAppliedGearUpgradeIds(gs, gearId).slice();
  next.push(upgradeId);
  gs.gearUpgradeIdsById[gearId] = next;
  return true;
}
