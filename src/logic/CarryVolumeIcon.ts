import atlasStorage from './AtlasStorage';

export const CARRY_VOLUME_FRAME = 'stat:volume';

// Rendered once while building the runtime atlas: open box with two front flaps.
export function renderCarryVolumeSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = 'rgb(248, 250, 252)';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D('M5 8L12 5L19 8L12 11Z M5 8L1 11L8 14L12 11L16 14L23 11L19 8 M5 13V18L12 22L19 18V13 M12 11V22'));
  ctx.restore();
}

export function drawCarryVolumeIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const frame = atlasStorage.getMoleculesFrame(CARRY_VOLUME_FRAME)!;
  ctx.drawImage(atlasStorage.getMoleculesSource(), frame.x, frame.y, frame.w, frame.h,
    centerX - size / 2, centerY - size / 2, size, size);
  ctx.restore();
}
