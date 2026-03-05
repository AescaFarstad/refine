import { getGameLib, getGameStateMutable, uiState, type ReadonlyResearchArchetype } from '../UIState';
import type { ResearchCell } from '../GameState';
import type { Point2 } from '../ItemLib';
import { axialDistance, axialRange } from '../HexMath';
import { axialToIndex, calculateVisibility } from '../Research';
import {
  RESEARCH_PLACEMENT_TEMPLATE_CELLS,
  RESEARCH_PLACEMENT_TEMPLATE_DEFAULT,
  researchPlacementTemplateCellKey,
} from '../researchPlacementTemplate';

export type ResearchEditMode = '' | 'empty' | 'void' | 'obstacle' | 'coordinates' | string;

interface ResearchNewlyPlacedEntry {
  archetypeId: string;
  cells: Point2[];
  radius: number;
}

export interface UseResearchPaneDevEditOptions {
  onEdited: () => void;
}

function collectExpandedCells(centers: readonly Point2[], radius: number): Point2[] {
  const uniqueCells: Point2[] = [];
  const seen = new Set<string>();
  for (const center of centers) {
    const expandedCells = radius > 0 ? axialRange(center, radius) : [center];
    for (const expanded of expandedCells) {
      const key = `${expanded.x},${expanded.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueCells.push(expanded);
    }
  }
  return uniqueCells;
}

function getActivePlacementTemplateCells(): Point2[] {
  const template = (uiState as any).researchPlacementTemplate as Point2[] | undefined;
  if (!template) {
    return RESEARCH_PLACEMENT_TEMPLATE_DEFAULT.map(cell => ({ x: cell.x, y: cell.y }));
  }
  const selected = new Set(template.map(cell => researchPlacementTemplateCellKey(cell)));
  return RESEARCH_PLACEMENT_TEMPLATE_CELLS
    .filter(cell => selected.has(researchPlacementTemplateCellKey(cell)))
    .map(cell => ({ x: cell.x, y: cell.y }));
}

function applyArchetypeStateToCell(cell: ResearchCell, arch: ReadonlyResearchArchetype | null, mode: string): void {
  if (arch) {
    if (arch.type === 'void') {
      cell.blocked = true;
      cell.cost = 0;
      cell.owned = false;
      cell.revealed = false;
      return;
    }
    if (arch.type === 'obstacle') {
      cell.blocked = false;
      cell.cost = 1;
      return;
    }
    cell.blocked = false;
    cell.cost = 0;
    return;
  }

  cell.blocked = mode === 'void';
  cell.cost = mode === 'obstacle' ? 1 : 0;
}

export function useResearchPaneDevEdit(options: UseResearchPaneDevEditOptions) {
  function getEditMode(): ResearchEditMode | undefined {
    return (uiState as any).researchEditMode as ResearchEditMode | undefined;
  }

  function isNodePlacementMode(mode: string): boolean {
    if (mode === 'empty' || mode === 'void' || mode === 'obstacle' || mode === 'coordinates') {
      return false;
    }
    return getGameLib().research.archetypes.has(mode);
  }

  function getNodePlacementPreviewCells(center: Point2): Point2[] {
    const templateCells = getActivePlacementTemplateCells();
    const placementRadius = (uiState as any).researchPlacementRadius || 0;
    const centerCells = templateCells.map(cell => ({ x: center.x + cell.x, y: center.y + cell.y }));
    return collectExpandedCells(centerCells, placementRadius);
  }

  function applyEditModeAt(axial: Point2): void {
    const mode = getEditMode();
    if (!mode) return;
    if (mode === 'coordinates') {
      const coordText = `{ x: ${axial.x}, y: ${axial.y} }`;
      navigator.clipboard.writeText(coordText).catch(err => {
        console.error('Failed to copy coordinates to clipboard:', err);
      });
      return;
    }

    const lib = getGameLib();
    const basicArchetypeId = mode === 'empty' ? 'empty' : mode === 'void' ? 'void' : mode === 'obstacle' ? 'obs' : '';
    const isTemplatePlacement = basicArchetypeId === '' && lib.research.archetypes.has(mode);
    if (basicArchetypeId === '' && !isTemplatePlacement) return;
    const archetypeId = basicArchetypeId || mode;

    const gs = getGameStateMutable();
    const arch = lib.research.archetypes.get(archetypeId) || null;
    let changed = false;
    const applyCell = (cell: ResearchCell, clearNodeId: boolean = false): void => {
      if (clearNodeId) cell.nodeId = -1;
      cell.archetypeId = archetypeId;
      applyArchetypeStateToCell(cell, arch, mode);
      changed = true;
    };

    if (isTemplatePlacement) {
      const templateCells = getActivePlacementTemplateCells();
      if (templateCells.length === 0) return;
      const radius = (uiState as any).researchPlacementRadius || 0;
      const centerCells = templateCells.map(cell => ({ x: axial.x + cell.x, y: axial.y + cell.y }));
      for (const target of collectExpandedCells(centerCells, radius)) {
        const targetIndex = axialToIndex(target.x, target.y);
        if (targetIndex === -1) continue;
        applyCell(gs.researchCells[targetIndex]!);
      }
      if (!changed) return;
      const newlyPlaced = (uiState as any).researchNewlyPlaced as ResearchNewlyPlacedEntry[];
      newlyPlaced.push({ archetypeId: mode, cells: centerCells, radius });
      (uiState as any).researchNewlyPlaced = newlyPlaced;
    } else {
      const idx = axialToIndex(axial.x, axial.y);
      if (idx === -1) return;
      const cell = gs.researchCells[idx]!;
      const newlyPlaced = (uiState as any).researchNewlyPlaced as ResearchNewlyPlacedEntry[];
      const hitIndex = newlyPlaced.findIndex(entry =>
        entry.radius > 0
          ? entry.cells.some(c => axialDistance(axial, c) <= entry.radius)
          : entry.cells.some(c => c.x === axial.x && c.y === axial.y)
      );
      if (hitIndex !== -1) {
        const hit = newlyPlaced[hitIndex]!;
        for (const target of collectExpandedCells(hit.cells, hit.radius)) {
          const targetIndex = axialToIndex(target.x, target.y);
          if (targetIndex === -1) continue;
          applyCell(gs.researchCells[targetIndex]!);
        }
        newlyPlaced.splice(hitIndex, 1);
        (uiState as any).researchNewlyPlaced = newlyPlaced;
      } else if (cell.nodeId >= 0) {
        const nodeId = cell.nodeId;
        for (let i = 0; i < gs.researchCells.length; i++) {
          const targetCell = gs.researchCells[i]!;
          if (targetCell.nodeId !== nodeId) continue;
          applyCell(targetCell, true);
        }
      } else {
        applyCell(cell);
      }
    }

    if (!changed) return;
    calculateVisibility(gs, gs.lib.research);
    options.onEdited();
    uiState.researchEditVersion += 1;
  }

  return {
    getEditMode,
    isNodePlacementMode,
    getNodePlacementPreviewCells,
    applyEditModeAt,
  };
}
