import type { ResearchPlacementInput } from '../logic/ResearchLib';
import type { Point2 } from '../logic/core/math';
import { paneGear } from './pane_gear';
import { paneStats } from './pane_stats';
import { paneSpecial } from './pane_special';
export const researchPane: ResearchPlacementInput[] = [...paneSpecial, ...paneGear, ...paneStats,];

export const researchPaneEmptyCells: Point2[] = [
  { x: 0, y: -2 }, { x: -3, y: 0 }, { x: -2, y: 2 },
];

export const researchPaneVoidCells: Point2[] = [
  { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 },
];
