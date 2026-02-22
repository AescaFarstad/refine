import atlasStorage from './AtlasStorage';

export interface DrawMazeResourceMarkerOptions {
  glyph: string;
  iconImage: string;
  color: string;
  centerX: number;
  centerY: number;
  glyphSizePx: number;
  glyphYOffsetPx?: number;
  iconScale?: number;
  iconAlpha?: number;
}

export function drawMazeResourceMarker(
  ctx: CanvasRenderingContext2D,
  options: DrawMazeResourceMarkerOptions,
): void {
  const {
    glyph,
    iconImage,
    color,
    centerX,
    centerY,
    glyphSizePx,
    glyphYOffsetPx = 0,
    iconScale = 1.2,
    iconAlpha = 1,
  } = options;

  if (iconImage.length > 0) {
    const source = atlasStorage.getItemsSource();
    const frame = atlasStorage.getItemsFrame(iconImage)!;
    const iconSizePx = glyphSizePx * iconScale;

    ctx.save();
    ctx.globalAlpha *= iconAlpha;
    ctx.drawImage(
      source,
      frame.x, frame.y, frame.w, frame.h,
      centerX - iconSizePx / 2, centerY - iconSizePx / 2,
      iconSizePx, iconSizePx,
    );
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.font = `bold ${glyphSizePx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(glyph, centerX, centerY + glyphYOffsetPx);
  ctx.restore();
}
