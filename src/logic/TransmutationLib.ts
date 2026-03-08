import type { ResourceKey } from './Resources';
import { RESOURCE_KEYS } from './Resources';

export interface TransmutationPrice {
  gear: Record<string, number>;
  resources: Record<ResourceKey, number>;
}

export type TransmutationResult =
  | {
      kind: 'gear';
      gearId: string;
      amount: number;
    }
  | {
      kind: 'resource';
      resource: ResourceKey;
      amount: number;
    };

export interface TransmutationDefinition {
  id: string;
  name: string;
  price: TransmutationPrice;
  priceIncrease: TransmutationPrice;
  result: TransmutationResult;
}

export type RawTransmutationPrice = {
  gear?: Record<string, number>;
  resources?: Partial<Record<ResourceKey, number>>;
};

export type RawTransmutationResult =
  | {
      kind: 'gear';
      gearId: string;
      amount?: number;
    }
  | {
      kind: 'resource';
      resource: ResourceKey;
      amount?: number;
    };

export interface RawTransmutationDefinition {
  name: string;
  price?: RawTransmutationPrice;
  priceIncrease?: RawTransmutationPrice;
  result: RawTransmutationResult;
}

function createEmptyTransmutationPrice(): TransmutationPrice {
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

function normalizeTransmutationPrice(raw?: RawTransmutationPrice): TransmutationPrice {
  const price = createEmptyTransmutationPrice();
  if (!raw) return price;

  if (raw.gear) {
    for (const [gearId, amount] of Object.entries(raw.gear)) {
      price.gear[gearId] = amount;
    }
  }

  if (raw.resources) {
    for (const resourceKey of RESOURCE_KEYS) {
      price.resources[resourceKey] = raw.resources[resourceKey] ?? 0;
    }
  }

  return price;
}

function normalizeTransmutationResult(raw: RawTransmutationResult): TransmutationResult {
  if (raw.kind === 'gear') {
    return {
      kind: 'gear',
      gearId: raw.gearId,
      amount: raw.amount ?? 1,
    };
  }

  return {
    kind: 'resource',
    resource: raw.resource,
    amount: raw.amount ?? 1,
  };
}

export function parseTransmutationDefinitions(
  raw: Record<string, RawTransmutationDefinition>
): Map<string, TransmutationDefinition> {
  const map = new Map<string, TransmutationDefinition>();

  for (const [id, def] of Object.entries(raw)) {
    map.set(id, {
      id,
      name: def.name,
      price: normalizeTransmutationPrice(def.price),
      priceIncrease: normalizeTransmutationPrice(def.priceIncrease),
      result: normalizeTransmutationResult(def.result),
    });
  }

  return map;
}
