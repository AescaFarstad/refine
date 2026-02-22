import type { Point2 } from './core/math';

export const FREE_MOVE_PANEL_ID = 'free_move_panel';
export const REFRESHER_PANEL_ID = 'refresher_panel';
export const SHARDS_REFRESHER_PANEL_ID = 'shards_refresher_panel';
export const PLUS_ONE_PANEL_ID = 'plus_one_panel';
export const PLUS_ONE_RADIUS_PANEL_ID = 'plus_one_radius_panel';
export const DOUBLER_PANEL_ID = 'doubler_panel';
export const CREDITS_DOUBLER_PANEL_ID = 'credits_doubler_panel';
export const CHRONOTRACES_DOUBLER_PANEL_ID = 'chronotraces_doubler_panel';
export const INCREMENTAL_PANEL_ID = 'incremental_panel';
export const ANTIVOID_PANEL_ID = 'antivoid_panel';
export const CREDITS_PANEL_ID = 'credits_panel';
export const CHRONOTRACES_PANEL_ID = 'chronotraces_panel';
export const CRYSTAL_PANEL_ID = 'crystal_panel';

export type PlacableInstanceDescription = {
  passable: boolean;
  button: boolean;
  rotating: boolean;
  showInMaze: boolean;
  cells: Point2[];
  glyph: string;
  image: string;
  opacity: number;
  glyphPlacement: 'perCell' | 'center';
  imagePlacement: 'perCell' | 'center';
  showStandardBackground: boolean;
  glyphScale: number;
  imageScale: number;
};

export type NexusItemDefinition = {
  id: string;
  name: string;
  description: string;
  price: number;
  placable: boolean;
  specialAction: '' | 'refund_reset_regret' | 'time_singularity';
  showMenuHint: boolean;
  minAcquiredUpgradesForOffer: number;
  priceIncrease: number[];
  maxCount: number;
  travelPriceIncrease: number;
  placedOnce: boolean;
  effectRadius: number;
  limitRadius: number;
  placableInstanceDescription: PlacableInstanceDescription;
};

export type RawNexusItemDefinition = Omit<NexusItemDefinition, 'id' | 'placable' | 'specialAction' | 'showMenuHint' | 'minAcquiredUpgradesForOffer' | 'priceIncrease' | 'maxCount' | 'travelPriceIncrease' | 'placedOnce' | 'effectRadius' | 'limitRadius' | 'placableInstanceDescription'> & {
  placable?: boolean;
  specialAction?: '' | 'refund_reset_regret' | 'time_singularity';
  showMenuHint?: boolean;
  priceIncrease?: number[];
  maxCount?: number;
  travelPriceIncrease?: number;
  placedOnce?: boolean;
  minAcquiredUpgradesForOffer?: number;
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
    const specialAction = def.specialAction ?? '';
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
      placable: def.placable ?? true,
      specialAction,
      showMenuHint: def.showMenuHint ?? (specialAction === ''),
      minAcquiredUpgradesForOffer: def.minAcquiredUpgradesForOffer ?? 0,
      priceIncrease: def.priceIncrease ? def.priceIncrease.slice() : [0],
      maxCount: def.maxCount ?? -1,
      travelPriceIncrease: def.travelPriceIncrease ?? 0,
      placedOnce: def.placedOnce ?? false,
      effectRadius: def.effectRadius ?? 0,
      limitRadius: def.limitRadius ?? 0,
      placableInstanceDescription: {
        passable,
        button,
        rotating: rawPlacable?.rotating ?? false,
        showInMaze: rawPlacable?.showInMaze ?? true,
        cells: normalizedCells,
        glyph: rawPlacable?.glyph ?? '',
        image: rawPlacable?.image ?? '',
        opacity: rawPlacable?.opacity ?? 1,
        glyphPlacement: rawPlacable?.glyphPlacement ?? 'perCell',
        imagePlacement: rawPlacable?.imagePlacement ?? 'perCell',
        showStandardBackground: rawPlacable?.showStandardBackground ?? button,
        glyphScale: rawPlacable?.glyphScale ?? 1,
        imageScale: rawPlacable?.imageScale ?? 1,
      },
    });
  }
  return result;
}
