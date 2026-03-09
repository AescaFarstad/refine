import type { Ref } from 'vue';
import type { Point2 } from '../ItemLib';
import { axialToIndex, indexToAxial } from '../Research';
import { getMazeNexusItemEffectiveRadius, getMazeNexusItemPlacementCells } from '../Maze';
import type { getGameState } from '../UIState';
import { ANTIVOID_PANEL_ID, REFRESHER_PANEL_ID } from '../NexusLib';

type GameStateAccessor = typeof getGameState;
type State = ReturnType<GameStateAccessor>;

export function useMazeHoverRadiusPreview(options: {
  hoverAxial: Ref<Point2 | null>;
  getGameState: GameStateAccessor;
}) {
  const { hoverAxial, getGameState } = options;

  function toCellKey(cell: Point2): string {
    return `${cell.x},${cell.y}`;
  }

  function buildPlacedNexusPlacementCells(gs: State, placementId: number, nexusId: string): Point2[] {
    const cells: Point2[] = [];
    for (let i = 0; i < gs.researchCells.length; i++) {
      const cell = gs.researchCells[i]!;
      if (!cell.nexusId) continue;
      if (!Number.isInteger(cell.nexusPlacementId) || cell.nexusPlacementId <= 0) {
        throw new Error(`Invalid nexus placement id at cell index ${i}`);
      }
      if (cell.nexusPlacementId !== placementId) continue;
      if (cell.nexusId !== nexusId) {
        throw new Error(`Mixed nexus ids for placement id ${placementId}`);
      }
      const axial = indexToAxial(i);
      cells.push({ x: axial.x, y: axial.y });
    }
    return cells;
  }

  function resolvePlacedNexusAnchor(gs: State, nexusId: string, placementCells: readonly Point2[]): Point2 {
    const localCells = getMazeNexusItemPlacementCells(gs, nexusId, { x: 0, y: 0 });
    const expectedKeys = new Set(placementCells.map(toCellKey));

    for (const placementCell of placementCells) {
      for (const localCell of localCells) {
        const anchor = {
          x: placementCell.x - localCell.x,
          y: placementCell.y - localCell.y,
        };
        const candidateCells = getMazeNexusItemPlacementCells(gs, nexusId, anchor);
        if (candidateCells.length !== placementCells.length) continue;

        let matches = true;
        for (const candidateCell of candidateCells) {
          if (!expectedKeys.has(toCellKey(candidateCell))) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return anchor;
        }
      }
    }

    throw new Error(`Failed to resolve placement anchor for nexus item "${nexusId}"`);
  }

  function isHoveringShardRefresherCell(gs: State, hoverCell: Point2): boolean {
    if (!gs.mazeHasShardsRefresherPanel) return false;
    const spawn = gs.mazeResourceSpawns.find(
      s => s.cell.x === hoverCell.x && s.cell.y === hoverCell.y,
    );
    return spawn?.resourceKey === 'shardDust';
  }

  function getHoverNexusRadiusPreview(): { nexusItemId: string; anchor: Point2 } | null {
    const hoverCell = hoverAxial.value;
    if (!hoverCell) return null;

    const gs = getGameState();
    const hoveredIdx = axialToIndex(hoverCell.x, hoverCell.y);
    if (hoveredIdx !== -1) {
      const hoveredResearchCell = gs.researchCells[hoveredIdx]!;
      if (hoveredResearchCell.nexusId && hoveredResearchCell.nexusId !== ANTIVOID_PANEL_ID) {
        if (!Number.isInteger(hoveredResearchCell.nexusPlacementId) || hoveredResearchCell.nexusPlacementId <= 0) {
          throw new Error(`Invalid nexus placement id at cell index ${hoveredIdx}`);
        }
        const effectiveRadius = getMazeNexusItemEffectiveRadius(gs, hoveredResearchCell.nexusId);
        if (effectiveRadius > 0) {
          const placementCells = buildPlacedNexusPlacementCells(
            gs,
            hoveredResearchCell.nexusPlacementId,
            hoveredResearchCell.nexusId,
          );
          const anchor = resolvePlacedNexusAnchor(gs, hoveredResearchCell.nexusId, placementCells);
          return {
            nexusItemId: hoveredResearchCell.nexusId,
            anchor,
          };
        }
      }
    }

    if (isHoveringShardRefresherCell(gs, hoverCell)) {
      const refresherRadius = getMazeNexusItemEffectiveRadius(gs, REFRESHER_PANEL_ID);
      if (refresherRadius > 0) {
        return {
          nexusItemId: REFRESHER_PANEL_ID,
          anchor: hoverCell,
        };
      }
    }

    return null;
  }

  return {
    getHoverNexusRadiusPreview,
  };
}
