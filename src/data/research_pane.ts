import type { ResearchPlacementInput } from '../logic/ResearchLib';
import type { Point2 } from '../logic/core/math';

export const researchPane: ResearchPlacementInput[] = [
  { archetypeId: 'hub', cells: { x: 0, y: 0 }, initiallyOwned: true },
  { archetypeId: 'obs', cells: { x: 1, y: 0 } },
  { archetypeId: 'res_credits', cells: { x: 2, y: 0 } },
  { archetypeId: 'stat_dmg', cells: { x: 3, y: 1 } },
  { archetypeId: 'stat_hp', cells: { x: -2, y: -2 } },
  { archetypeId: 'stat_volume', cells: { x: -3, y: 3 } },
  { archetypeId: 'stat_weight', cells: { x: 5, y: 0 } },
  // Single-cell gear node
  { archetypeId: 'gear_kevlar_helmet', cells: { x: -1, y: 4 } },
  {
    archetypeId: 'gear_laser_sight',
    cells: [
      { x: -2, y: 0 },
      { x: -2, y: 1 },
      { x: -3, y: 0 },
      { x: -3, y: 1 },
    ],
  },
  {
    archetypeId: 'gear_spiked_armor',
    cells: { x: 3, y: -2 },
    radius: 1,
  },
  {
    archetypeId: 'gear_cargo_harness',
    cells: { x: 0, y: -6 },
    radius: 1,
  },
];

export const researchPaneEmptyCells: Point2[] = [
  { x: 7, y: -5 },
  { x: 7, y: -4 },
  { x: 7, y: -3 },
  { x: 7, y: -2 },
];

export const researchPaneVoidCells: Point2[] = [
  { x: 3, y: -7 },
  { x: 4, y: -7 },
  { x: 5, y: -7 },
  { x: 6, y: -7 },
];
