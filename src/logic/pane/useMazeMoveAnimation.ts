import { ref, type Ref, type ComputedRef, onUnmounted } from 'vue';
import { axialToPixel } from '../HexMath';
import { createMazeEnterProjection, planMazeMoveSegments, projectMazeMoveTo, type MazeEnterProjection } from '../Maze';
import { REFRESHER_PANEL_PAUSE_MS, isMazeRefresherStep } from '../MazeNexusBonuses';
import type { Point2 } from '../ItemLib';
import type { ReadonlyGameState } from '../UIState';

type Point2Ref = Ref<Point2> | ComputedRef<Point2>;

interface MoveSegment {
  path: Point2[];
  target: Point2;
  expectedAvatarCell: Point2;
}

export interface MazeMoveAnimationOptions {
  hexSize: number;
  avatarMoveSpeed: number;
  origin: Point2Ref;
  facingAngle: Ref<number>;
  turnTowards: (current: number, target: number, dt: number, speedMultiplier?: number) => number;
  positionAvatarAt: (pixelX: number, pixelY: number, angle: number) => void;
  stopIdleFacingLoop: () => void;
  getGameState: () => ReadonlyGameState;
  queueMoveCommand: (target: Point2) => void;
  clearHoverPathImmediate: () => void;
  scheduleBaseRender: () => void;
  updateAvatarPosition: () => void;
  onSegmentComplete: (targetCell: Point2, takenBefore: Point2[], segmentPath: Point2[]) => void;
  onPathAnimationFullyComplete: () => void;
}

export interface MazeMoveAnimationController {
  movePath: Ref<Point2[]>;
  moveAnimProgress: Ref<number>;
  segmentQueue: Ref<MoveSegment[]>;
  pendingAvatarCell: Ref<Point2 | null>;
  getQueuedAvatarCell: () => Point2;
  getQueuedMovementUsed: () => number;
  onPrimaryClick: (axial: Point2) => void;
  dispose: () => void;
}

export function useMazeMoveAnimation(options: MazeMoveAnimationOptions): MazeMoveAnimationController {
  const MAX_QUEUE_SPEED_MULTIPLIER = 4;
  const QUEUED_STEPS_FOR_MAX_SPEED = 24;
  const MIN_QUEUE_STEPS_FOR_SPEEDUP = 4;
  const STRAIGHT_DOT_THRESHOLD = 0.7;
  const STRAIGHT_SECTION_SPEED_MULTIPLIER = 1.2;
  const TURN_SECTION_SPEED_MULTIPLIER = 0.75;
  const MIN_FINAL_SPEED_MULTIPLIER = 0.5;

  const movePath = ref<Point2[]>([]);
  const moveAnimProgress = ref(0);
  const segmentQueue = ref<MoveSegment[]>([]);
  const pendingAvatarCell = ref<Point2 | null>(null);

  let activeSegment: MoveSegment | null = null;
  let projectedBaseOverride: MazeEnterProjection | null = null;
  let animStartCell: Point2 = { x: 0, y: 0 };
  let animFrameId: number | null = null;
  let lastAnimTime = 0;
  let segmentPauseTimeoutId: number | null = null;
  let segmentPauseActive = false;

  function copy(cell: Point2): Point2 {
    return { x: cell.x, y: cell.y };
  }

  function isRefresherPanelCell(gs: ReadonlyGameState, cell: Point2): boolean {
    return isMazeRefresherStep(gs, cell);
  }

  function cloneProjection(projection: MazeEnterProjection): MazeEnterProjection {
    return {
      avatarCell: copy(projection.avatarCell),
      movementUsed: projection.movementUsed,
      takenCells: projection.takenCells.map(copy),
      resetEntranceCell: copy(projection.resetEntranceCell),
    };
  }

  function clearProjectedBaseOverrideIfIdle(): void {
    if (
      projectedBaseOverride &&
      movePath.value.length === 0 &&
      segmentQueue.value.length === 0 &&
      pendingAvatarCell.value === null
    ) {
      projectedBaseOverride = null;
    }
  }

  function applySegmentToProjection(gs: ReadonlyGameState, projection: MazeEnterProjection, segment: MoveSegment): void {
    const result = projectMazeMoveTo(gs, projection, segment.target);
    if (!result.success) {
      throw new Error('Failed to project queued maze segment');
    }
  }

  function getProjectedQueueState(gs: ReadonlyGameState): MazeEnterProjection {
    clearProjectedBaseOverrideIfIdle();

    const projection = projectedBaseOverride
      ? cloneProjection(projectedBaseOverride)
      : createMazeEnterProjection(gs);

    if (activeSegment) {
      applySegmentToProjection(gs, projection, activeSegment);
    }
    for (const segment of segmentQueue.value) {
      applySegmentToProjection(gs, projection, segment);
    }

    return projection;
  }

  function commitDispatchedSegment(segment: MoveSegment): void {
    const gs = options.getGameState();
    const projection = projectedBaseOverride
      ? cloneProjection(projectedBaseOverride)
      : createMazeEnterProjection(gs);
    applySegmentToProjection(gs, projection, segment);
    projectedBaseOverride = projection;
  }

  function startPathAnimation(path: Point2[], fromCell?: Point2): void {
    if (path.length === 0) return;
    if (segmentPauseTimeoutId != null) {
      window.clearTimeout(segmentPauseTimeoutId);
      segmentPauseTimeoutId = null;
    }
    segmentPauseActive = false;
    options.stopIdleFacingLoop();
    const src = fromCell ?? options.getGameState().maze.avatarCell;
    animStartCell = { x: src.x, y: src.y };
    movePath.value = path;
    moveAnimProgress.value = 0;
    lastAnimTime = performance.now();
    if (animFrameId == null) {
      animFrameId = requestAnimationFrame(animationTick);
    }
  }

  function continueAfterSegment(fromCell: Point2, pauseMs: number): void {
    if (pauseMs <= 0) {
      segmentPauseActive = false;
      processNextSegment(fromCell);
      return;
    }

    if (segmentPauseTimeoutId != null) {
      window.clearTimeout(segmentPauseTimeoutId);
      segmentPauseTimeoutId = null;
    }
    segmentPauseActive = true;
    segmentPauseTimeoutId = window.setTimeout(() => {
      segmentPauseTimeoutId = null;
      segmentPauseActive = false;
      processNextSegment(fromCell);
    }, pauseMs);
  }

  function processNextSegment(fromCell?: Point2): void {
    const nextSegment = segmentQueue.value.shift();
    if (!nextSegment) {
      activeSegment = null;
      options.onPathAnimationFullyComplete();
      return;
    }

    activeSegment = nextSegment;

    if (nextSegment.path.length === 0) {
      options.stopIdleFacingLoop();
      commitDispatchedSegment(nextSegment);
      options.queueMoveCommand(nextSegment.target);
      options.scheduleBaseRender();
      options.updateAvatarPosition();
      processNextSegment(nextSegment.expectedAvatarCell);
      return;
    }

    startPathAnimation(nextSegment.path, fromCell);
  }

  function getQueuedStepCount(): number {
    let queuedSteps = Math.max(0, movePath.value.length - moveAnimProgress.value);
    for (const segment of segmentQueue.value) {
      queuedSteps += segment.path.length;
    }
    return queuedSteps;
  }

  function getQueueLengthSpeedMultiplier(): number {
    const queuedSteps = getQueuedStepCount();
    if (queuedSteps <= MIN_QUEUE_STEPS_FOR_SPEEDUP) {
      return 1;
    }

    const normalized = Math.min(
      1,
      (queuedSteps - MIN_QUEUE_STEPS_FOR_SPEEDUP) / (QUEUED_STEPS_FOR_MAX_SPEED - MIN_QUEUE_STEPS_FOR_SPEEDUP),
    );
    return 1 + normalized * (MAX_QUEUE_SPEED_MULTIPLIER - 1);
  }

  function getTurnSpeedMultiplier(path: Point2[], currentStep: number, fromCell: Point2, toCell: Point2): number {
    const futureCell = path[currentStep + 1];
    if (!futureCell) return 1;

    const fromPixel = axialToPixel(fromCell, options.hexSize, options.origin.value);
    const toPixel = axialToPixel(toCell, options.hexSize, options.origin.value);
    const futurePixel = axialToPixel(futureCell, options.hexSize, options.origin.value);

    const currentDx = toPixel.x - fromPixel.x;
    const currentDy = toPixel.y - fromPixel.y;
    const futureDx = futurePixel.x - toPixel.x;
    const futureDy = futurePixel.y - toPixel.y;
    const currentLen = Math.hypot(currentDx, currentDy);
    const futureLen = Math.hypot(futureDx, futureDy);

    if (currentLen === 0 || futureLen === 0) {
      return 1;
    }

    const dot = (currentDx * futureDx + currentDy * futureDy) / (currentLen * futureLen);
    return dot > STRAIGHT_DOT_THRESHOLD ? STRAIGHT_SECTION_SPEED_MULTIPLIER : TURN_SECTION_SPEED_MULTIPLIER;
  }

  function animationTick(now: number): void {
    animFrameId = null;
    const dt = Math.max(0, (now - lastAnimTime) / 1000);
    lastAnimTime = now;

    const path = movePath.value;
    if (path.length === 0) return;

    const speedStep = Math.floor(moveAnimProgress.value);
    const speedFromCell = speedStep === 0 ? animStartCell : path[speedStep - 1]!;
    const speedToCell = path[Math.min(speedStep, path.length - 1)]!;

    const queueSpeedMultiplier = getQueueLengthSpeedMultiplier();
    const turnSpeedMultiplier = getTurnSpeedMultiplier(path, speedStep, speedFromCell, speedToCell);
    const speedMultiplier = Math.max(
      MIN_FINAL_SPEED_MULTIPLIER,
      Math.min(MAX_QUEUE_SPEED_MULTIPLIER, queueSpeedMultiplier * turnSpeedMultiplier),
    );

    moveAnimProgress.value += dt * options.avatarMoveSpeed * speedMultiplier;
    const currentStep = Math.floor(moveAnimProgress.value);

    if (currentStep >= path.length) {
      const segment = activeSegment!;
      const targetPixel = axialToPixel(segment.expectedAvatarCell, options.hexSize, options.origin.value);
      options.positionAvatarAt(targetPixel.x, targetPixel.y, options.facingAngle.value);

      movePath.value = [];
      moveAnimProgress.value = 0;
      pendingAvatarCell.value = copy(segment.expectedAvatarCell);
      const takenBefore = options.getGameState().maze.takenCells.map(copy);
      commitDispatchedSegment(segment);
      options.queueMoveCommand(segment.target);
      options.onSegmentComplete(segment.target, takenBefore, segment.path);
      options.scheduleBaseRender();
      activeSegment = null;
      const pauseMs = isRefresherPanelCell(options.getGameState(), segment.expectedAvatarCell)
        ? REFRESHER_PANEL_PAUSE_MS
        : 0;
      continueAfterSegment(segment.expectedAvatarCell, pauseMs);
      return;
    }

    const t = moveAnimProgress.value - currentStep;
    const fromCell = currentStep === 0 ? animStartCell : path[currentStep - 1]!;
    const toCell = path[currentStep]!;

    const fromPixel = axialToPixel(fromCell, options.hexSize, options.origin.value);
    const toPixel = axialToPixel(toCell, options.hexSize, options.origin.value);

    const interpX = fromPixel.x + (toPixel.x - fromPixel.x) * t;
    const interpY = fromPixel.y + (toPixel.y - fromPixel.y) * t;

    const dx = toPixel.x - fromPixel.x;
    const dy = toPixel.y - fromPixel.y;
    if (dx !== 0 || dy !== 0) {
      const targetAngle = Math.atan2(dy, dx);
      options.facingAngle.value = options.turnTowards(options.facingAngle.value, targetAngle, dt, speedMultiplier);
    }

    options.positionAvatarAt(interpX, interpY, options.facingAngle.value);
    animFrameId = requestAnimationFrame(animationTick);
  }

  function onPrimaryClick(axial: Point2): void {
    const gs = options.getGameState();
    const projectedState = getProjectedQueueState(gs);
    const plannedStops = planMazeMoveSegments(gs, projectedState, axial);
    if (plannedStops.length === 0) return;

    const projectionCursor = cloneProjection(projectedState);
    const queuedSegments: MoveSegment[] = [];
    for (const stop of plannedStops) {
      const stepResult = projectMazeMoveTo(gs, projectionCursor, stop);
      if (!stepResult.success) break;
      queuedSegments.push({
        path: stepResult.path.map(copy),
        target: copy(stop),
        expectedAvatarCell: copy(projectionCursor.avatarCell),
      });
    }
    if (queuedSegments.length === 0) return;

    options.clearHoverPathImmediate();
    segmentQueue.value.push(...queuedSegments);
    if (movePath.value.length === 0 && activeSegment === null && !segmentPauseActive) {
      processNextSegment();
    }
  }

  function getQueuedAvatarCell(): Point2 {
    const projection = getProjectedQueueState(options.getGameState());
    return copy(projection.avatarCell);
  }

  function getQueuedMovementUsed(): number {
    const projection = getProjectedQueueState(options.getGameState());
    return projection.movementUsed;
  }

  function dispose(): void {
    if (segmentPauseTimeoutId != null) {
      window.clearTimeout(segmentPauseTimeoutId);
      segmentPauseTimeoutId = null;
      segmentPauseActive = false;
    }
    if (animFrameId == null) return;
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  onUnmounted(dispose);

  return {
    movePath,
    moveAnimProgress,
    segmentQueue,
    pendingAvatarCell,
    getQueuedAvatarCell,
    getQueuedMovementUsed,
    onPrimaryClick,
    dispose,
  };
}
