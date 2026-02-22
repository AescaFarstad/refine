import type { Ref } from 'vue';
import type { Point2 } from '../ItemLib';
import type { getGameState, getGameStateMutable } from '../UIState';
import { axialToIndex } from '../Research';
import { FREE_MOVE_PANEL_ID } from '../NexusLib';
import {
  computeMazeVisibilityFromAxial,
  buildMazeVisibilityHexBoundaryLoops,
} from '../MazeVision';

type GameStateAccessor = typeof getGameState;
type GameStateMutableAccessor = typeof getGameStateMutable;

export function useMazeVisibilityPreview(options: {
  hoverAxial: Ref<Point2 | null>;
  dragNexusItemId: Ref<string | null>;
  dragNexusAxial: Ref<Point2 | null>;
  dragNexusValid: Ref<boolean>;
  getGameState: GameStateAccessor;
  getGameStateMutable: GameStateMutableAccessor;
}) {
  const {
    hoverAxial,
    dragNexusItemId,
    dragNexusAxial,
    dragNexusValid,
    getGameState,
    getGameStateMutable,
  } = options;

  function isHoveringPlacedDoubleVisionPanel(axial: Point2 | null): boolean {
    if (!axial) return false;
    const idx = axialToIndex(axial.x, axial.y);
    if (idx === -1) return false;
    const gs = getGameState();
    return gs.researchCells[idx]!.nexusId === FREE_MOVE_PANEL_ID;
  }

  function getVisibilityPreviewOriginCell(): Point2 | null {
    if (
      dragNexusItemId.value === FREE_MOVE_PANEL_ID
      && dragNexusValid.value
      && dragNexusAxial.value !== null
    ) {
      return dragNexusAxial.value;
    }

    const hoverCell = hoverAxial.value;
    if (isHoveringPlacedDoubleVisionPanel(hoverCell)) {
      return hoverCell;
    }

    return null;
  }

  function getMazeVisibilityRuntime() {
    const runtime = getGameStateMutable().mazeVisibility.runtime;
    if (runtime === null) {
      throw new Error('Maze visibility runtime is not initialized by gameplay.');
    }
    return runtime;
  }

  function recomputeHoverVisibility(): void {
    const mazeVisibility = getGameStateMutable().mazeVisibility;
    mazeVisibility.result = null;
    mazeVisibility.boundaryLoops = null;
    const originCell = getVisibilityPreviewOriginCell();
    if (originCell === null) {
      return;
    }

    const runtime = getMazeVisibilityRuntime();
    mazeVisibility.result = computeMazeVisibilityFromAxial(
      runtime,
      originCell.x,
      originCell.y,
    );
    mazeVisibility.boundaryLoops = buildMazeVisibilityHexBoundaryLoops(runtime.aux, mazeVisibility.result);
  }

  return {
    recomputeHoverVisibility,
    getMazeVisibilityRuntime,
  };
}
