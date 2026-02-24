import type { Point2 } from './ItemLib';

export const RESEARCH_PLACEMENT_TEMPLATE_CELLS: readonly Point2[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

export const RESEARCH_PLACEMENT_TEMPLATE_DEFAULT: readonly Point2[] = [
  { x: 0, y: 0 },
];

export function researchPlacementTemplateCellKey(cell: Point2): string {
  return `${cell.x},${cell.y}`;
}
