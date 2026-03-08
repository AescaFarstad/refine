import type { GameState } from './GameState';
import { applyReward } from './Reward';
import { RESOURCE_KEYS, type ResourceKey } from './Resources';
import type { TransmutationDefinition, TransmutationPrice } from './TransmutationLib';
import type { ReadonlyGameState } from './UIState';

function createTransmutationPrice(): TransmutationPrice {
  return {
    gear: {},
    resources: {
      credits: 0,
      chronotraces: 0,
      timeFlux: 0,
      shardDust: 0,
      skillPoints: 0,
    },
  };
}

function addScaledTransmutationPrice(
  target: TransmutationPrice,
  source: TransmutationPrice,
  multiplier: number
): void {
  if (multiplier === 0) return;

  for (const [gearId, amount] of Object.entries(source.gear)) {
    target.gear[gearId] = (target.gear[gearId] ?? 0) + amount * multiplier;
  }

  for (const resourceKey of RESOURCE_KEYS) {
    target.resources[resourceKey] += source.resources[resourceKey] * multiplier;
  }
}

function getOwnedResourceAmount(gs: ReadonlyGameState, resource: ResourceKey): number {
  if (resource === 'credits') return gs.credits;
  if (resource === 'chronotraces') return gs.chronotraces;
  if (resource === 'timeFlux') return gs.timeFlux;
  if (resource === 'shardDust') return gs.shardDust;
  return gs.skillPoints;
}

export function getTransmutationCraftCount(gs: ReadonlyGameState, transmutationId: string): number {
  return gs.transmutationCraftCounts[transmutationId] ?? 0;
}

export function getTransmutationEffectivePrice(
  definition: TransmutationDefinition,
  craftedCount: number
): TransmutationPrice {
  const price = createTransmutationPrice();
  addScaledTransmutationPrice(price, definition.price, 1);
  addScaledTransmutationPrice(price, definition.priceIncrease, craftedCount);
  return price;
}

export function getTransmutationCurrentPrice(
  gs: ReadonlyGameState,
  transmutationId: string
): TransmutationPrice {
  const definition = gs.lib.transmutations.get(transmutationId)!;
  return getTransmutationEffectivePrice(definition, getTransmutationCraftCount(gs, transmutationId));
}

export function canTransmutate(gs: ReadonlyGameState, transmutationId: string): boolean {
  const price = getTransmutationCurrentPrice(gs, transmutationId);

  for (const [gearId, amount] of Object.entries(price.gear)) {
    if ((gs.countableGear[gearId] ?? 0) < amount) return false;
  }

  for (const resourceKey of RESOURCE_KEYS) {
    if (getOwnedResourceAmount(gs, resourceKey) < price.resources[resourceKey]) return false;
  }

  return true;
}

export function transmutate(gs: GameState, transmutationId: string): boolean {
  if (!canTransmutate(gs, transmutationId)) return false;

  const definition = gs.lib.transmutations.get(transmutationId)!;
  const price = getTransmutationCurrentPrice(gs, transmutationId);

  for (const [gearId, amount] of Object.entries(price.gear)) {
    const remaining = (gs.countableGear[gearId] ?? 0) - amount;
    if (remaining > 0) {
      gs.countableGear[gearId] = remaining;
    } else {
      delete gs.countableGear[gearId];
    }
  }

  gs.credits -= price.resources.credits;
  gs.chronotraces -= price.resources.chronotraces;
  gs.timeFlux -= price.resources.timeFlux;
  gs.shardDust -= price.resources.shardDust;
  gs.skillPoints -= price.resources.skillPoints;

  if (definition.result.kind === 'gear') {
    applyReward(gs, {
      kind: 'countable_gear',
      gearId: definition.result.gearId,
      amount: definition.result.amount,
    });
  } else {
    applyReward(gs, {
      kind: 'resource',
      resource: definition.result.resource,
      amount: definition.result.amount,
    });
  }

  gs.transmutationCraftCounts[transmutationId] = getTransmutationCraftCount(gs, transmutationId) + 1;
  return true;
}
