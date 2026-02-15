import { ref, type Ref, type ComputedRef, onUnmounted } from 'vue';
import { bfsMazePath } from '../BFS';
import { axialToPixel } from '../HexMath';
import { MAZE_ENTRANCE } from '../Maze';
import type { Point2 } from '../ItemLib';
import type { ReadonlyGameState } from '../UIState';

type Point2Ref = Ref<Point2> | ComputedRef<Point2>;

interface MoveSegment {
  kind: 'path' | 'command';
  path: Point2[];
  target: Point2;
  expectedAvatarCell: Point2;
  resetsMaze: boolean;
}

interface MazeProjection {
  avatarCell: Point2;
  movementUsed: number;
  takenCellKeys: Set<string>;
}

export interface MazeMoveAnimationOptions {
  hexSize: number;
  avatarMoveSpeed: number;
  origin: Point2Ref;
  facingAngle: Ref<number>;
  turnTowards: (current: number, target: number, dt: number) => number;
  positionAvatarAt: (pixelX: number, pixelY: number, angle: number) => void;
  stopIdleFacingLoop: () => void;
  getGameState: () => ReadonlyGameState;
  queueMoveCommand: (target: Point2) => void;
  clearHoverPathImmediate: () => void;
  scheduleBaseRender: () => void;
  updateAvatarPosition: () => void;
  onPathAnimationFullyComplete: () => void;
}

export interface MazeMoveAnimationController {
  movePath: Ref<Point2[]>;
  moveAnimProgress: Ref<number>;
  segmentQueue: Ref<MoveSegment[]>;
  pendingAvatarCell: Ref<Point2 | null>;
  getQueuedAvatarCell: () => Point2;
  getQueuedMovementUsed: () => number;
  startMoveAnimation: (path: Point2[], fromCell?: Point2) => void;
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
  let projectedBaseOverride: MazeProjection | null = null;
  let animStartCell: Point2 = { x: 0, y: 0 };
  let animFrameId: number | null = null;
  let lastAnimTime = 0;

  function toCellKey(cell: Point2): string {
    return `${cell.x},${cell.y}`;
  }

  function cloneCell(cell: Point2): Point2 {
    return { x: cell.x, y: cell.y };
  }

  function buildResourceCellKeys(gs: ReadonlyGameState): Set<string> {
    const resourceCellKeys = new Set<string>();
    for (const spawn of gs.mazeResourceSpawns) {
      resourceCellKeys.add(toCellKey(spawn.cell));
    }
    return resourceCellKeys;
  }

  function createPathSegment(path: Point2[]): MoveSegment {
    const target = path[path.length - 1]!;
    const resetsMaze = target.x === MAZE_ENTRANCE.x && target.y === MAZE_ENTRANCE.y;
    const expectedAvatarCell = resetsMaze ? cloneCell(MAZE_ENTRANCE) : cloneCell(target);
    return {
      kind: 'path',
      path,
      target: cloneCell(target),
      expectedAvatarCell,
      resetsMaze,
    };
  }

  function createResetCommandSegment(target: Point2): MoveSegment {
    return {
      kind: 'command',
      path: [],
      target: cloneCell(target),
      expectedAvatarCell: cloneCell(MAZE_ENTRANCE),
      resetsMaze: true,
    };
  }

  function snapshotProjection(gs: ReadonlyGameState): MazeProjection {
    return {
      avatarCell: cloneCell(gs.maze.avatarCell),
      movementUsed: gs.maze.movementUsed,
      takenCellKeys: new Set(gs.maze.takenCells.map(toCellKey)),
    };
  }

  function cloneProjection(projection: MazeProjection): MazeProjection {
    return {
      avatarCell: cloneCell(projection.avatarCell),
      movementUsed: projection.movementUsed,
      takenCellKeys: new Set(projection.takenCellKeys),
    };
  }

  function applySegmentToProjection(
    projection: MazeProjection,
    segment: MoveSegment,
    resourceCellKeys: Set<string>,
  ): void {
    if (segment.resetsMaze) {
      projection.avatarCell = cloneCell(segment.expectedAvatarCell);
      projection.movementUsed = 0;
      projection.takenCellKeys.clear();
      return;
    }

    projection.movementUsed += segment.path.length;
    for (const cell of segment.path) {
      const key = toCellKey(cell);
      if (resourceCellKeys.has(key)) {
        projection.takenCellKeys.add(key);
      }
    }
    projection.avatarCell = cloneCell(segment.expectedAvatarCell);
  }

  function getProjectedQueueState(gs: ReadonlyGameState): MazeProjection {
    if (
      projectedBaseOverride &&
      movePath.value.length === 0 &&
      segmentQueue.value.length === 0 &&
      pendingAvatarCell.value === null
    ) {
      projectedBaseOverride = null;
    }

    const projection = projectedBaseOverride
      ? cloneProjection(projectedBaseOverride)
      : snapshotProjection(gs);
    const resourceCellKeys = buildResourceCellKeys(gs);

    if (activeSegment) {
      applySegmentToProjection(projection, activeSegment, resourceCellKeys);
    }
    for (const segment of segmentQueue.value) {
      applySegmentToProjection(projection, segment, resourceCellKeys);
    }

    return projection;
  }

  function commitDispatchedSegment(segment: MoveSegment): void {
    const gs = options.getGameState();
    const resourceCellKeys = buildResourceCellKeys(gs);
    const projection = projectedBaseOverride
      ? cloneProjection(projectedBaseOverride)
      : snapshotProjection(gs);
    applySegmentToProjection(projection, segment, resourceCellKeys);
    projectedBaseOverride = projection;
  }

  function startPathAnimation(path: Point2[], fromCell?: Point2): void {
    if (path.length === 0) return;
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

  function processNextSegment(fromCell?: Point2): void {
    const nextSegment = segmentQueue.value.shift();
    if (!nextSegment) {
      activeSegment = null;
      options.onPathAnimationFullyComplete();
      return;
    }

    activeSegment = nextSegment;

    if (nextSegment.kind === 'command') {
      options.stopIdleFacingLoop();
      pendingAvatarCell.value = cloneCell(nextSegment.expectedAvatarCell);
      commitDispatchedSegment(nextSegment);
      options.queueMoveCommand(nextSegment.target);
      options.scheduleBaseRender();
      options.updateAvatarPosition();
      processNextSegment(nextSegment.expectedAvatarCell);
      return;
    }

    startPathAnimation(nextSegment.path, fromCell);
  }

  function startMoveAnimation(path: Point2[], fromCell?: Point2): void {
    if (path.length === 0) return;
    activeSegment = createPathSegment(path);
    startPathAnimation(path, fromCell);
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
      pendingAvatarCell.value = cloneCell(segment.expectedAvatarCell);
      commitDispatchedSegment(segment);
      options.queueMoveCommand(segment.target);
      options.scheduleBaseRender();
      processNextSegment(segment.expectedAvatarCell);
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
      options.facingAngle.value = options.turnTowards(options.facingAngle.value, targetAngle, dt);
    }

    options.positionAvatarAt(interpX, interpY, options.facingAngle.value);
    animFrameId = requestAnimationFrame(animationTick);
  }

  function onPrimaryClick(axial: Point2): void {
    const gs = options.getGameState();
    const projectedState = getProjectedQueueState(gs);
    const result = bfsMazePath(gs, projectedState.avatarCell, axial);
    if (!result.reachable || result.cost === 0) return;

    options.clearHoverPathImmediate();

    const remaining = gs.timeFlux - projectedState.movementUsed;
    if (result.cost > remaining) {
      segmentQueue.value.push(createResetCommandSegment(axial));
      if (movePath.value.length === 0 && activeSegment === null) {
        processNextSegment();
      }
      return;
    }

    const resourceCellKeys = buildResourceCellKeys(gs);
    const queuedSegments: MoveSegment[] = [];
    let segStart = 0;
    for (let i = 0; i < result.path.length - 1; i++) {
      const cell = result.path[i]!;
      const key = toCellKey(cell);
      if (resourceCellKeys.has(key) && !projectedState.takenCellKeys.has(key)) {
        const segPath = result.path.slice(segStart, i + 1);
        const segment = createPathSegment(segPath);
        queuedSegments.push(segment);
        applySegmentToProjection(projectedState, segment, resourceCellKeys);
        segStart = i + 1;
      }
    }

    if (segStart < result.path.length) {
      const segPath = result.path.slice(segStart);
      const segment = createPathSegment(segPath);
      queuedSegments.push(segment);
      applySegmentToProjection(projectedState, segment, resourceCellKeys);
    }

    if (queuedSegments.length === 0) {
      return;
    }

    segmentQueue.value.push(...queuedSegments);
    if (movePath.value.length === 0 && activeSegment === null) {
      processNextSegment();
    }
  }

  function getQueuedAvatarCell(): Point2 {
    const projection = getProjectedQueueState(options.getGameState());
    return cloneCell(projection.avatarCell);
  }

  function getQueuedMovementUsed(): number {
    const projection = getProjectedQueueState(options.getGameState());
    return projection.movementUsed;
  }

  function dispose(): void {
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
    startMoveAnimation,
    onPrimaryClick,
    dispose,
  };
}
