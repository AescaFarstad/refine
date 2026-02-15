import { ref, type Ref } from 'vue';
import type { Point2 } from '../ItemLib';

interface HoverPathTransitionState {
  retractRemaining: number;
  growCells: Point2[];
  growIndex: number;
  progress: number;
  speedCellsPerSecond: number;
}

export interface HoverPathTransitionController {
  displayedPath: Ref<Point2[]>;
  transitionActive: Ref<boolean>;
  queueTo: (targetPath: Point2[]) => void;
  clearImmediate: () => void;
  dispose: () => void;
}

function getCommonPathPrefixLength(a: readonly Point2[], b: readonly Point2[]): number {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    const ac = a[i]!;
    const bc = b[i]!;
    if (ac.x !== bc.x || ac.y !== bc.y) return i;
  }
  return minLen;
}

function getTransitionSpeed(baseSpeedCellsPerSecond: number, delta: number): number {
  const minDelta = 5;
  const maxDelta = 40;
  const maxMultiplier = 5;

  if (delta <= minDelta) return baseSpeedCellsPerSecond;
  if (delta >= maxDelta) return baseSpeedCellsPerSecond * maxMultiplier;

  const t = (delta - minDelta) / (maxDelta - minDelta);
  const multiplier = 1 + t * (maxMultiplier - 1);
  return baseSpeedCellsPerSecond * multiplier;
}

export function useHoverPathTransition(
  renderPath: () => void,
  speedCellsPerSecond: number,
): HoverPathTransitionController {
  const displayedPath = ref<Point2[]>([]);
  const transitionActive = ref(false);

  let transition: HoverPathTransitionState | null = null;
  let animFrameId: number | null = null;
  let lastAnimTime = 0;

  function tick(now: number): void {
    animFrameId = null;
    const t = transition!;

    const dt = Math.max(0, (now - lastAnimTime) / 1000);
    lastAnimTime = now;
    t.progress += dt * t.speedCellsPerSecond;

    let changed = false;
    while (t.progress >= 1) {
      t.progress -= 1;
      if (t.retractRemaining > 0) {
        displayedPath.value.pop();
        t.retractRemaining -= 1;
        changed = true;
        continue;
      }
      if (t.growIndex < t.growCells.length) {
        displayedPath.value.push(t.growCells[t.growIndex]!);
        t.growIndex += 1;
        changed = true;
        continue;
      }
      break;
    }

    if (changed) {
      renderPath();
    }

    if (t.retractRemaining === 0 && t.growIndex >= t.growCells.length) {
      transition = null;
      transitionActive.value = false;
      return;
    }

    animFrameId = requestAnimationFrame(tick);
  }

  function queueTo(targetPath: Point2[]): void {
    const fromPath = displayedPath.value;
    const prefixLen = getCommonPathPrefixLength(fromPath, targetPath);
    const retractRemaining = fromPath.length - prefixLen;
    const growCells = targetPath.slice(prefixLen);
    const delta = retractRemaining + growCells.length;

    if (delta === 0) return;

    const transitionSpeed = targetPath.length === 0
      ? speedCellsPerSecond
      : getTransitionSpeed(speedCellsPerSecond, delta);

    transition = {
      retractRemaining,
      growCells,
      growIndex: 0,
      progress: 0,
      speedCellsPerSecond: transitionSpeed,
    };
    transitionActive.value = true;
    if (animFrameId == null) {
      lastAnimTime = performance.now();
      animFrameId = requestAnimationFrame(tick);
    }
  }

  function clearImmediate(): void {
    displayedPath.value = [];
    transition = null;
    transitionActive.value = false;
    if (animFrameId != null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    renderPath();
  }

  function dispose(): void {
    transition = null;
    transitionActive.value = false;
    if (animFrameId != null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  return { displayedPath, transitionActive, queueTo, clearImmediate, dispose };
}
