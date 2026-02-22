import type { Point2 } from './core/math';

export type PlacableInstanceDescription = {
  passable: boolean;
  button: boolean;
  cells: Point2[];
  image: string;
  opacity: number;
  glyphPlacement: 'perCell' | 'center';
  showStandardBackground: boolean;
  iconScale: number;
};

export type NexusItemDefinition = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceIncrease: number[];
  maxCount: number;
  travelPriceIncrease: number;
  effectRadius: number;
  limitRadius: number;
  glyph: string;
  placableInstanceDescription: PlacableInstanceDescription;
};

export type RawNexusItemDefinition = Omit<NexusItemDefinition, 'id' | 'priceIncrease' | 'maxCount' | 'travelPriceIncrease' | 'effectRadius' | 'limitRadius' | 'glyph' | 'placableInstanceDescription'> & {
  glyph?: string;
  priceIncrease?: number[];
  maxCount?: number;
  travelPriceIncrease?: number;
  effectRadius?: number;
  limitRadius?: number;
  placableInstanceDescription?: Partial<PlacableInstanceDescription>;
};

export function parseNexusItemDefinitions(
  raw: Record<string, RawNexusItemDefinition>
): Map<string, NexusItemDefinition> {
  const result = new Map<string, NexusItemDefinition>();
  for (const [id, def] of Object.entries(raw)) {
    const rawPlacable = def.placableInstanceDescription;
    const passable = rawPlacable?.passable ?? true;
    const button = passable ? (rawPlacable?.button ?? true) : false;
    const placementCells = rawPlacable?.cells;
    const normalizedCells = placementCells && placementCells.length > 0
      ? placementCells.map(cell => ({ x: cell.x, y: cell.y }))
      : [{ x: 0, y: 0 }];

    result.set(id, {
      id,
      name: def.name,
      description: def.description,
      price: def.price,
      priceIncrease: def.priceIncrease ? def.priceIncrease.slice() : [0],
      maxCount: def.maxCount ?? -1,
      travelPriceIncrease: def.travelPriceIncrease ?? 0,
      effectRadius: def.effectRadius ?? 0,
      limitRadius: def.limitRadius ?? 0,
      glyph: def.glyph ?? '',
      placableInstanceDescription: {
        passable,
        button,
        cells: normalizedCells,
        image: rawPlacable?.image ?? '',
        opacity: rawPlacable?.opacity ?? 1,
        glyphPlacement: rawPlacable?.glyphPlacement ?? 'perCell',
        showStandardBackground: rawPlacable?.showStandardBackground ?? button,
        iconScale: rawPlacable?.iconScale ?? 1,
      },
    });
  }
  return result;
}
