import type { Ref, ComputedRef } from 'vue';
import { axialToPixel } from '../HexMath';
import { RESOURCE_SPECS } from '../Resources';
import {
  getMazeNextIncrementalPickupBonus,
  resolveMazeRefresherStep,
} from '../MazeNexusBonuses';
import { axialToIndex } from '../Research';
import type { Point2 } from '../ItemLib';
import type { MazeResourceSpawn } from '../GameState';
import type { ReadonlyGameState } from '../UIState';

const REFRESHER_DELAY_MS_PER_UNIT = 50; // 0.5 sec / 10 units

const PICKUP_DURATION = 1500; // ms
const PICKUP_FLOAT_DISTANCE = 32; // pixels (world space)
const PICKUP_SCALE_START = 1.0;
const PICKUP_SCALE_END = 1.5;
const PICKUP_RING_MAX_RADIUS = 20;
const PICKUP_RING_LINE_WIDTH = 1.5;
const PICKUP_PAIR_OFFSET_X = 22;
const PICKUP_PAIR_SCALE_OFFSET_COMPENSATION = 0.45;
const PICKUP_OPAQUE_PORTION = 0.7;

const REFRESHER_PULSE_DURATION = 900; // ms
const REFRESHER_RING_LINE_WIDTH = 2;
const REFRESHER_COLOR = '56, 189, 248';

interface PickupParticle {
  wx: number;
  wy: number;
  screenOffsetX: number;
  glyph: string;
  color: string;
  amount: number;
  startTime: number;
}

interface RefresherPulse {
  wx: number;
  wy: number;
  startTime: number;
}

export interface MazeResourceEffectsOptions {
  effectsCanvas: Ref<HTMLCanvasElement | null>;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  hexSize: number;
  origin: ComputedRef<Point2>;
  getGameState: () => ReadonlyGameState;
  scheduleBaseRender: () => void;
}

export interface MazeResourceEffectsController {
  onSegmentComplete: (targetCell: Point2, takenBefore: Point2[], segmentPath: Point2[]) => void;
  getVisuallyTakenCellKeys: () => ReadonlySet<string>;
  clearVisualRefreshMask: () => void;
  dispose: () => void;
}

function toCellKey(cell: Point2): string {
  return `${cell.x},${cell.y}`;
}

function sameCell(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function containsCell(cells: readonly Point2[], target: Point2): boolean {
  for (const cell of cells) {
    if (sameCell(cell, target)) return true;
  }
  return false;
}

function removeCell(cells: Point2[], target: Point2): void {
  for (let i = cells.length - 1; i >= 0; i--) {
    if (sameCell(cells[i]!, target)) {
      cells.splice(i, 1);
    }
  }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function computePickupAlpha(t: number): number {
  if (t <= PICKUP_OPAQUE_PORTION) return 1;
  const fadeProgress = (t - PICKUP_OPAQUE_PORTION) / (1 - PICKUP_OPAQUE_PORTION);
  return 1 - fadeProgress;
}

export function useMazeResourceEffects(
  options: MazeResourceEffectsOptions,
): MazeResourceEffectsController {
  const pendingVisualTakenCellKeys = new Set<string>();
  const pendingRevealTimeoutIds = new Map<string, number>();

  const pickupParticles: PickupParticle[] = [];
  const refresherPulses: RefresherPulse[] = [];
  let effectsRafId: number | null = null;

  function ensureEffectsLoop(): void {
    if (effectsRafId !== null) return;
    effectsRafId = requestAnimationFrame(tickEffects);
  }

  function spawnPickupResourceAmountAt(
    cell: Point2,
    resourceKey: MazeResourceSpawn['resourceKey'],
    amount: number,
    delayMs: number = 0,
    screenOffsetX: number = 0,
  ): void {
    const pixel = axialToPixel(cell, options.hexSize, options.origin.value);
    const spec = RESOURCE_SPECS[resourceKey];
    pickupParticles.push({
      wx: pixel.x,
      wy: pixel.y,
      screenOffsetX,
      glyph: spec.glyph,
      color: spec.color,
      amount,
      startTime: performance.now() + delayMs,
    });
    ensureEffectsLoop();
  }

  function spawnPickupAt(cell: Point2, spawn: MazeResourceSpawn, delayMs: number = 0, screenOffsetX: number = 0): void {
    spawnPickupResourceAmountAt(cell, spawn.resourceKey, spawn.amount, delayMs, screenOffsetX);
  }

  function spawnRefresherAt(cell: Point2, delayMs: number = 0): void {
    const pixel = axialToPixel(cell, options.hexSize, options.origin.value);
    refresherPulses.push({
      wx: pixel.x,
      wy: pixel.y,
      startTime: performance.now() + delayMs,
    });
    ensureEffectsLoop();
  }

  function clearEffectsCanvas(): void {
    const c = options.effectsCanvas.value;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function renderRefresherPulses(ctx: CanvasRenderingContext2D, now: number, z: number, off: Point2): void {
    const baseRadius = options.hexSize * z;

    for (const pulse of refresherPulses) {
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

  function renderPickupParticles(ctx: CanvasRenderingContext2D, now: number, z: number, off: Point2): void {
    for (const p of pickupParticles) {
      const elapsed = now - p.startTime;
      if (elapsed < 0) continue;

      const t = Math.min(1, elapsed / PICKUP_DURATION);
      const ease = easeOutCubic(t);

      const alpha = computePickupAlpha(t);
      const scale = PICKUP_SCALE_START + (PICKUP_SCALE_END - PICKUP_SCALE_START) * ease;
      const floatY = -PICKUP_FLOAT_DISTANCE * ease;
      const scaledPairOffsetX = p.screenOffsetX * (1 + ((scale - 1) * PICKUP_PAIR_SCALE_OFFSET_COMPENSATION));

      const nodeSx = off.x + p.wx * z + scaledPairOffsetX;
      const nodeSy = off.y + p.wy * z;

      const ringProgress = Math.min(1, t * 2.5);
      if (ringProgress < 1) {
        const ringAlpha = (1 - ringProgress) * 0.6;
        const ringRadius = PICKUP_RING_MAX_RADIUS * easeOutCubic(ringProgress) * z;
        ctx.save();
        ctx.beginPath();
        ctx.arc(nodeSx, nodeSy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = PICKUP_RING_LINE_WIDTH * z;
        ctx.globalAlpha = ringAlpha;
        ctx.stroke();
        ctx.restore();
      }

      const sx = nodeSx;
      const sy = nodeSy + floatY * z;

      const renderScale = z * scale;
      const glyphBaseSize = 14;
      const glyphSizePx = Math.max(1, glyphBaseSize * renderScale);
      const amountSizePx = Math.max(1, glyphSizePx * 0.7);
      const amountOffsetPx = glyphBaseSize * 0.9 * renderScale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.color;
      ctx.font = `bold ${glyphSizePx}px sans-serif`;
      ctx.fillText(p.glyph, sx, sy);

      const amountText = `+${p.amount}`;
      ctx.font = `bold ${amountSizePx}px sans-serif`;
      ctx.fillText(amountText, sx + amountOffsetPx, sy);

      ctx.restore();
    }
  }

  function renderEffects(now: number): void {
    const c = options.effectsCanvas.value;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    const z = options.zoom.value;
    const off = options.offset.value;

    renderRefresherPulses(ctx, now, z, off);
    renderPickupParticles(ctx, now, z, off);
  }

  function tickEffects(now: number): void {
    effectsRafId = null;

    for (let i = pickupParticles.length - 1; i >= 0; i--) {
      if (now - pickupParticles[i]!.startTime > PICKUP_DURATION) {
        pickupParticles.splice(i, 1);
      }
    }

    for (let i = refresherPulses.length - 1; i >= 0; i--) {
      if (now - refresherPulses[i]!.startTime > REFRESHER_PULSE_DURATION) {
        refresherPulses.splice(i, 1);
      }
    }

    if (pickupParticles.length === 0 && refresherPulses.length === 0) {
      clearEffectsCanvas();
      return;
    }

    renderEffects(now);
    effectsRafId = requestAnimationFrame(tickEffects);
  }

  function clearPendingReveal(cellKey: string): void {
    const existingTimeoutId = pendingRevealTimeoutIds.get(cellKey);
    if (existingTimeoutId != null) {
      window.clearTimeout(existingTimeoutId);
      pendingRevealTimeoutIds.delete(cellKey);
    }
  }

  function setVisualRefreshMask(cellKey: string, delayMs: number): void {
    clearPendingReveal(cellKey);
    if (delayMs <= 0) {
      pendingVisualTakenCellKeys.delete(cellKey);
      options.scheduleBaseRender();
      return;
    }

    pendingVisualTakenCellKeys.add(cellKey);
    options.scheduleBaseRender();

    const timeoutId = window.setTimeout(() => {
      pendingRevealTimeoutIds.delete(cellKey);
      pendingVisualTakenCellKeys.delete(cellKey);
      options.scheduleBaseRender();
    }, delayMs);
    pendingRevealTimeoutIds.set(cellKey, timeoutId);
  }

  function animateRefresherBonuses(segmentPath: Point2[], takenBefore: Point2[]): void {
    if (segmentPath.length === 0) return;

    const gs = options.getGameState();
    const simulatedTaken = takenBefore.map(cell => ({ x: cell.x, y: cell.y }));

    for (const steppedCell of segmentPath) {
      if (containsCell(simulatedTaken, steppedCell)) continue;

      const spawnAtCell = gs.mazeResourceSpawns.find(
        spawn => sameCell(spawn.cell, steppedCell),
      );
      if (spawnAtCell) {
        simulatedTaken.push({ x: steppedCell.x, y: steppedCell.y });
        const refreshedSpawns = resolveMazeRefresherStep(gs, steppedCell, simulatedTaken);
        for (const refreshed of refreshedSpawns) {
          const delayMs = refreshed.distanceUnit * REFRESHER_DELAY_MS_PER_UNIT;
          spawnRefresherAt(refreshed.spawnCell, delayMs);
          setVisualRefreshMask(toCellKey(refreshed.spawnCell), delayMs);
          removeCell(simulatedTaken, refreshed.spawnCell);
        }
        continue;
      }

      const refreshedSpawns = resolveMazeRefresherStep(gs, steppedCell, simulatedTaken);
      for (const refreshed of refreshedSpawns) {
        const delayMs = refreshed.distanceUnit * REFRESHER_DELAY_MS_PER_UNIT;
        spawnRefresherAt(refreshed.spawnCell, delayMs);
        setVisualRefreshMask(toCellKey(refreshed.spawnCell), delayMs);
        removeCell(simulatedTaken, refreshed.spawnCell);
      }

      const steppedIdx = axialToIndex(steppedCell.x, steppedCell.y);
      if (steppedIdx === -1) continue;

      const steppedResearchCell = gs.researchCells[steppedIdx]!;
      if (steppedResearchCell.nexusId) {
        simulatedTaken.push({ x: steppedCell.x, y: steppedCell.y });
      }
    }
  }

  function onSegmentComplete(targetCell: Point2, takenBefore: Point2[], segmentPath: Point2[]): void {
    animateRefresherBonuses(segmentPath, takenBefore);

    const gs = options.getGameState();
    if (containsCell(takenBefore, targetCell)) return;
    const spawn = gs.mazeResourceSpawns.find(
      s => s.cell.x === targetCell.x && s.cell.y === targetCell.y,
    );
    if (spawn) {
      const bonusAmount = getMazeNextIncrementalPickupBonus(gs);
      if (bonusAmount > 0) {
        spawnPickupAt(targetCell, spawn, 0, -PICKUP_PAIR_OFFSET_X);
        spawnPickupResourceAmountAt(targetCell, spawn.resourceKey, bonusAmount, 0, PICKUP_PAIR_OFFSET_X);
        return;
      }
      spawnPickupAt(targetCell, spawn);
    }
  }

  function clearVisualRefreshMask(): void {
    for (const timeoutId of pendingRevealTimeoutIds.values()) {
      window.clearTimeout(timeoutId);
    }
    pendingRevealTimeoutIds.clear();
    if (pendingVisualTakenCellKeys.size > 0) {
      pendingVisualTakenCellKeys.clear();
      options.scheduleBaseRender();
    }
  }

  function getVisuallyTakenCellKeys(): ReadonlySet<string> {
    return pendingVisualTakenCellKeys;
  }

  function dispose(): void {
    clearVisualRefreshMask();
    if (effectsRafId !== null) {
      cancelAnimationFrame(effectsRafId);
      effectsRafId = null;
    }
    pickupParticles.length = 0;
    refresherPulses.length = 0;
    clearEffectsCanvas();
  }

  return {
    onSegmentComplete,
    getVisuallyTakenCellKeys,
    clearVisualRefreshMask,
    dispose,
  };
}

export default useMazeResourceEffects;
