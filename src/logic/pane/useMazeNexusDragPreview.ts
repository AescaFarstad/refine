import { ref, type Ref } from 'vue';
import type { Point2 } from '../ItemLib';
import { canPlaceMazeNexusItem } from '../Maze';
import {
  setMazeManualDragFollowerVisible,
  type MazeDragEndDetail,
  type MazeDragPayload,
} from '../MazeNexusDnd';
import type { ReadonlyGameState } from '../UIState';

interface MazeDragMoveDetail {
  clientX: number;
  clientY: number;
  payload: MazeDragPayload | null;
}

export interface MazeNexusDragPreviewOptions {
  getGameState: () => ReadonlyGameState;
  clientToAxial: (clientX: number, clientY: number) => Point2 | null;
  queuePlaceNexusItem: (target: Point2, nexusItemId: string) => void;
  onPreviewChanged: () => void;
  onPlacementCommitted: () => void;
}

export interface MazeNexusDragPreviewController {
  dragNexusItemId: Ref<string>;
  dragNexusAxial: Ref<Point2 | null>;
  dragNexusValid: Ref<boolean>;
  onMazeDragMove: (event: CustomEvent<MazeDragMoveDetail>) => void;
  onMazeDragEnd: (event: CustomEvent<MazeDragEndDetail>) => void;
  clearDragPreview: () => void;
}

export function useMazeNexusDragPreview(
  options: MazeNexusDragPreviewOptions,
): MazeNexusDragPreviewController {
  const dragNexusItemId = ref('');
  const dragNexusAxial = ref<Point2 | null>(null);
  const dragNexusValid = ref(false);

  function clearDragPreview(): void {
    const wasValid = dragNexusValid.value;
    dragNexusItemId.value = '';
    dragNexusAxial.value = null;
    dragNexusValid.value = false;
    if (wasValid) {
      setMazeManualDragFollowerVisible(true);
    }
    options.onPreviewChanged();
  }

  function onMazeDragMove(event: CustomEvent<MazeDragMoveDetail>): void {
    const { clientX, clientY, payload } = event.detail;
    if (!payload || !payload.item) {
      clearDragPreview();
      return;
    }

    const itemId = payload.item.id;
    const axial = options.clientToAxial(clientX, clientY);
    const valid = !!axial && canPlaceMazeNexusItem(options.getGameState(), itemId, axial);

    if (valid) {
      setMazeManualDragFollowerVisible(false);
    } else {
      setMazeManualDragFollowerVisible(true);
    }

    dragNexusItemId.value = itemId;
    dragNexusAxial.value = axial;
    dragNexusValid.value = valid;
    options.onPreviewChanged();
  }

  function onMazeDragEnd(event: CustomEvent<MazeDragEndDetail>): void {
    const { clientX, clientY, payload, cancelled } = event.detail;
    if (!payload || !payload.item) return;

    if (cancelled) {
      clearDragPreview();
      setMazeManualDragFollowerVisible(true);
      return;
    }

    const itemId = payload.item.id;
    const axial = options.clientToAxial(clientX, clientY);

    if (axial && canPlaceMazeNexusItem(options.getGameState(), itemId, axial)) {
      options.queuePlaceNexusItem(axial, itemId);
    }

    clearDragPreview();
    setMazeManualDragFollowerVisible(true);

    requestAnimationFrame(() => {
      options.onPlacementCommitted();
    });
  }

  return {
    dragNexusItemId,
    dragNexusAxial,
    dragNexusValid,
    onMazeDragMove,
    onMazeDragEnd,
    clearDragPreview,
  };
}
