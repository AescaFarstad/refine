import type { Point2 } from './core/math';

export type PlacableInstanceDescription = {
  passable: boolean;
  cells: Point2[];
  image: string;
};

export type NexusItemDefinition = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceIncrease: number;
  maxCount: number;
  travelPriceIncrease: number;
  effectRadius: number;
  limitRadius: number;
  glyph: string;
  placableInstanceDescription?: PlacableInstanceDescription;
};

export type RawNexusItemDefinition = Omit<NexusItemDefinition, 'id' | 'priceIncrease' | 'maxCount' | 'travelPriceIncrease' | 'effectRadius' | 'limitRadius' | 'glyph'> & {
  glyph?: string;
  priceIncrease?: number;
  maxCount?: number;
  travelPriceIncrease?: number;
  effectRadius?: number;
  limitRadius?: number;
  placableInstanceDescription?: PlacableInstanceDescription;
};

export function parseNexusItemDefinitions(
  raw: Record<string, RawNexusItemDefinition>
): Map<string, NexusItemDefinition> {
  const result = new Map<string, NexusItemDefinition>();
  for (const [id, def] of Object.entries(raw)) {
    result.set(id, {
      id,
      name: def.name,
      description: def.description,
      price: def.price,
      priceIncrease: def.priceIncrease ?? 0,
      maxCount: def.maxCount ?? -1,
      travelPriceIncrease: def.travelPriceIncrease ?? 0,
      effectRadius: def.effectRadius ?? 0,
      limitRadius: def.limitRadius ?? 0,
      glyph: def.glyph ?? '',
      placableInstanceDescription: def.placableInstanceDescription,
    });
  }
  return result;
}
