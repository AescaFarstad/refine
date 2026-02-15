import { type Ref, type ComputedRef, onUnmounted } from 'vue';
import { axialToPixel } from '../HexMath';
import { RESOURCE_SPECS } from '../Resources';
import type { Point2 } from '../ItemLib';
import type { MazeResourceSpawn } from '../GameState';

const PICKUP_DURATION = 1200; // ms
const PICKUP_FLOAT_DISTANCE = 32; // pixels (world space)
const PICKUP_SCALE_START = 1.0;
const PICKUP_SCALE_END = 1.5;
const RING_MAX_RADIUS = 20;
const RING_LINE_WIDTH = 1.5;

interface PickupParticle {
  wx: number; // world-space pixel x
  wy: number; // world-space pixel y
  glyph: string;
  color: string;
  amount: number;
  startTime: number;
}

export interface MazePickupAnimationOptions {
  effectsCanvas: Ref<HTMLCanvasElement | null>;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  hexSize: number;
  origin: ComputedRef<Point2>;
}

export interface MazePickupAnimationController {
  spawnAt: (cell: Point2, spawn: MazeResourceSpawn) => void;
  dispose: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

export function useMazePickupAnimation(
  options: MazePickupAnimationOptions,
): MazePickupAnimationController {
  const particles: PickupParticle[] = [];
  let rafId: number | null = null;

  function spawnAt(cell: Point2, spawn: MazeResourceSpawn): void {
    const pixel = axialToPixel(cell, options.hexSize, options.origin.value);
    const spec = RESOURCE_SPECS[spawn.resourceKey];
    particles.push({
      wx: pixel.x,
      wy: pixel.y,
      glyph: spec.glyph,
      color: spec.color,
      amount: spawn.amount,
      startTime: performance.now(),
    });
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick(now: number): void {
    rafId = null;

    // Remove expired
    for (let i = particles.length - 1; i >= 0; i--) {
      if (now - particles[i]!.startTime > PICKUP_DURATION) {
        particles.splice(i, 1);
      }
    }

    if (particles.length === 0) {
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

    for (const p of particles) {
      const elapsed = now - p.startTime;
      const t = Math.min(1, elapsed / PICKUP_DURATION);
      const ease = easeOutCubic(t);

      const alpha = 1 - t;
      const scale = PICKUP_SCALE_START + (PICKUP_SCALE_END - PICKUP_SCALE_START) * ease;
      const floatY = -PICKUP_FLOAT_DISTANCE * ease;

      // Node position (screen space) — ring stays here
      const nodeSx = off.x + p.wx * z;
      const nodeSy = off.y + p.wy * z;

      // Expanding ring at node position
      const ringProgress = Math.min(1, t * 2.5); // ring finishes at 40% of duration
      if (ringProgress < 1) {
        const ringAlpha = (1 - ringProgress) * 0.6;
        const ringRadius = RING_MAX_RADIUS * easeOutCubic(ringProgress) * z;
        ctx.save();
        ctx.beginPath();
        ctx.arc(nodeSx, nodeSy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = RING_LINE_WIDTH * z;
        ctx.globalAlpha = ringAlpha;
        ctx.stroke();
        ctx.restore();
      }

      // Floating label position (screen space)
      const sx = nodeSx;
      const sy = nodeSy + floatY * z;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(z * scale, z * scale);
      ctx.globalAlpha = alpha;

      // Glyph
      const glyphSize = 14;
      ctx.font = `bold ${glyphSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.color;
      ctx.fillText(p.glyph, 0, 0);

      // Amount text
      const amountText = `+${p.amount}`;
      ctx.font = `bold ${glyphSize * 0.7}px sans-serif`;
      ctx.fillText(amountText, glyphSize * 0.9, 0);

      ctx.restore();
    }
  }

  function dispose(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    particles.length = 0;
  }

  onUnmounted(dispose);

  return { spawnAt, dispose };
}
