import { ref, type Ref, type ComputedRef, onUnmounted } from 'vue';
import type { Point2 } from '../ItemLib';
import { axialToPixel } from '../HexMath';

type Point2Ref = Ref<Point2> | ComputedRef<Point2>;

export interface MazeAvatarOptions {
  avatarCanvas: Ref<HTMLCanvasElement | null>;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  origin: Point2Ref;
  hexSize: number;
  avatarCanvasSize: number;
  avatarTurnSpeed: number;
  getDisplayAvatarCell: () => Point2;
  getDisplayedHoverPath: () => Point2[];
  getMouseWorldPos: () => Point2 | null;
  isMoving: () => boolean;
}

export interface MazeAvatarController {
  facingAngle: Ref<number>;
  drawAvatar: () => void;
  updateAvatarPosition: () => void;
  ensureIdleFacingLoop: () => void;
  stopIdleFacingLoop: () => void;
  positionAvatarAt: (pixelX: number, pixelY: number, angle: number) => void;
  turnTowards: (current: number, target: number, dt: number, speedMultiplier?: number) => number;
  dispose: () => void;
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

function shortestAngleDelta(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  return ((to - from + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
}

function angleBetween(from: Point2, to: Point2): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  return Math.atan2(dy, dx);
}

export function useMazeAvatar(options: MazeAvatarOptions): MazeAvatarController {
  const facingAngle = ref(0);

  let facingFrameId: number | null = null;
  let lastFacingTime = 0;

  function turnTowards(current: number, target: number, dt: number, speedMultiplier = 1): number {
    const maxTurn = options.avatarTurnSpeed * dt * speedMultiplier;
    const delta = shortestAngleDelta(current, target);
    if (Math.abs(delta) <= maxTurn) {
      return normalizeAngle(target);
    }
    return normalizeAngle(current + Math.sign(delta) * maxTurn);
  }

  function drawAvatar(): void {
    const c = options.avatarCanvas.value;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = options.avatarCanvasSize * dpr;
    c.height = options.avatarCanvasSize * dpr;
    c.style.width = `${options.avatarCanvasSize}px`;
    c.style.height = `${options.avatarCanvasSize}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const cx = options.avatarCanvasSize / 2;
    const cy = options.avatarCanvasSize / 2;
    const r = options.hexSize * 0.65;

    ctx.clearRect(0, 0, options.avatarCanvasSize, options.avatarCanvasSize);
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgb(255, 220, 80)';
    ctx.strokeStyle = 'rgb(180, 150, 40)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.6, r * 0.6);
    ctx.lineTo(-r * 0.3, 0);
    ctx.lineTo(-r * 0.6, -r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function positionAvatarAt(pixelX: number, pixelY: number, angle: number): void {
    const c = options.avatarCanvas.value;
    if (!c) return;

    const z = options.zoom.value;
    const off = options.offset.value;
    const screenX = pixelX * z + off.x;
    const screenY = pixelY * z + off.y;
    const half = options.avatarCanvasSize / 2;

    c.style.left = `${screenX - half}px`;
    c.style.top = `${screenY - half}px`;
    c.style.transform = `rotate(${angle}rad) scale(${z})`;
  }

  function getDisplayAvatarPixel(): Point2 {
    return axialToPixel(options.getDisplayAvatarCell(), options.hexSize, options.origin.value);
  }

  function getIdleTargetAngle(): number | null {
    const hoverPath = options.getDisplayedHoverPath();
    if (hoverPath.length > 0) {
      const fromPixel = getDisplayAvatarPixel();
      const toPixel = axialToPixel(hoverPath[0]!, options.hexSize, options.origin.value);
      return angleBetween(fromPixel, toPixel);
    }

    const mouseWorldPos = options.getMouseWorldPos();
    if (!mouseWorldPos) return null;
    const fromPixel = getDisplayAvatarPixel();
    const dx = mouseWorldPos.x - fromPixel.x;
    const dy = mouseWorldPos.y - fromPixel.y;
    if (dx * dx + dy * dy < (options.hexSize * 2) ** 2) return null;
    return angleBetween(fromPixel, mouseWorldPos);
  }

  function shouldRunIdleFacing(): boolean {
    return !options.isMoving() && (options.getDisplayedHoverPath().length > 0 || options.getMouseWorldPos() !== null);
  }

  function idleFacingTick(now: number): void {
    facingFrameId = null;
    const dt = Math.max(0, (now - lastFacingTime) / 1000);
    lastFacingTime = now;

    if (!shouldRunIdleFacing()) return;

    const target = getIdleTargetAngle();
    if (target == null) return;

    facingAngle.value = turnTowards(facingAngle.value, target, dt);
    const pixel = getDisplayAvatarPixel();
    positionAvatarAt(pixel.x, pixel.y, facingAngle.value);

    if (shouldRunIdleFacing()) {
      facingFrameId = requestAnimationFrame(idleFacingTick);
    }
  }

  function ensureIdleFacingLoop(): void {
    if (!shouldRunIdleFacing()) return;
    if (facingFrameId != null) return;
    lastFacingTime = performance.now();
    facingFrameId = requestAnimationFrame(idleFacingTick);
  }

  function stopIdleFacingLoop(): void {
    if (facingFrameId == null) return;
    cancelAnimationFrame(facingFrameId);
    facingFrameId = null;
  }

  function updateAvatarPosition(): void {
    const pixel = getDisplayAvatarPixel();
    positionAvatarAt(pixel.x, pixel.y, facingAngle.value);
  }

  function dispose(): void {
    stopIdleFacingLoop();
  }

  onUnmounted(dispose);

  return {
    facingAngle,
    drawAvatar,
    updateAvatarPosition,
    ensureIdleFacingLoop,
    stopIdleFacingLoop,
    positionAvatarAt,
    turnTowards,
    dispose,
  };
}
