import { type Ref, type ComputedRef, onUnmounted } from 'vue';
import { axialToPixel } from '../HexMath';
import type { Point2 } from '../ItemLib';

const REFRESHER_PULSE_DURATION = 900; // ms
const REFRESHER_RING_LINE_WIDTH = 2;
const REFRESHER_COLOR = '56, 189, 248';

interface RefresherPulse {
  wx: number;
  wy: number;
  startTime: number;
}

type Point2Ref = Ref<Point2> | ComputedRef<Point2>;

export interface MazeRefresherAnimationOptions {
  effectsCanvas: Ref<HTMLCanvasElement | null>;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  hexSize: number;
  origin: Point2Ref;
}

export interface MazeRefresherAnimationController {
  spawnAt: (cell: Point2, delayMs?: number) => void;
  dispose: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

export function useMazeRefresherAnimation(
  options: MazeRefresherAnimationOptions,
): MazeRefresherAnimationController {
  const pulses: RefresherPulse[] = [];
  let rafId: number | null = null;

  function spawnAt(cell: Point2, delayMs: number = 0): void {
    const pixel = axialToPixel(cell, options.hexSize, options.origin.value);
    pulses.push({
      wx: pixel.x,
      wy: pixel.y,
      startTime: performance.now() + delayMs,
    });
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick(now: number): void {
    rafId = null;

    for (let i = pulses.length - 1; i >= 0; i--) {
      if (now - pulses[i]!.startTime > REFRESHER_PULSE_DURATION) {
        pulses.splice(i, 1);
      }
    }

    if (pulses.length === 0) {
      clearEffectsCanvas();
      return;
    }

    render(now);
    rafId = requestAnimationFrame(tick);
  }

  function clearEffectsCanvas(): void {
    const c = options.effectsCanvas.value;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function render(now: number): void {
    const c = options.effectsCanvas.value;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    const z = options.zoom.value;
    const off = options.offset.value;
    const baseRadius = options.hexSize * z;

    for (const pulse of pulses) {
      const elapsed = now - pulse.startTime;
      if (elapsed < 0) continue;

      const t = Math.min(1, elapsed / REFRESHER_PULSE_DURATION);
      const ease = easeOutCubic(t);
      const sx = off.x + pulse.wx * z;
      const sy = off.y + pulse.wy * z;

      const ringRadius = baseRadius * (0.5 + (1.8 * ease));
      const ringAlpha = (1 - t) * 0.7;
      const flashRadius = baseRadius * (1.4 - (0.8 * ease));
      const flashAlpha = (1 - t) * (1 - t) * 0.45;

      ctx.save();
      const flash = ctx.createRadialGradient(sx, sy, 0, sx, sy, flashRadius);
      flash.addColorStop(0, `rgba(${REFRESHER_COLOR}, ${flashAlpha})`);
      flash.addColorStop(0.6, `rgba(${REFRESHER_COLOR}, ${flashAlpha * 0.35})`);
      flash.addColorStop(1, `rgba(${REFRESHER_COLOR}, 0)`);
      ctx.beginPath();
      ctx.arc(sx, sy, flashRadius, 0, Math.PI * 2);
      ctx.fillStyle = flash;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
      ctx.lineWidth = REFRESHER_RING_LINE_WIDTH * z;
      ctx.strokeStyle = `rgba(${REFRESHER_COLOR}, ${ringAlpha})`;
      ctx.stroke();
      ctx.restore();
    }
  }

  function dispose(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pulses.length = 0;
  }

  onUnmounted(dispose);

  return {
    spawnAt,
    dispose,
  };
}
