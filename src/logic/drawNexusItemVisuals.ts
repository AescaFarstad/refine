import type { Point2 } from './ItemLib';
import atlasStorage from './AtlasStorage';

export type NexusGlyphPlacement = 'perCell' | 'center';
export type NexusImagePlacement = 'perCell' | 'center';

export type NexusVisualCell = {
  pixel: Point2;
  glyphColor: string;
  imageOpacityMul: number;
  glyphOpacityMul: number;
};

export type DrawNexusItemVisualsOptions = {
  ctx: CanvasRenderingContext2D;
  cells: readonly NexusVisualCell[];
  centerPixel: Point2;
  imageKey: string;
  iconMaxSize: number;
  glyphText: string;
  glyphSize: number;
  glyphPlacement: NexusGlyphPlacement;
  imagePlacement: NexusImagePlacement;
  opacity: number;
  centerGlyphColor: string;
  centerGlyphOpacityMul: number;
};

function drawNexusItemImage(
  ctx: CanvasRenderingContext2D,
  imageKey: string,
  pixel: Point2,
  iconMaxSize: number,
  opacity: number,
): boolean {
  if (!imageKey) return false;

  const frame = atlasStorage.getItemsFrame(imageKey);
  if (!frame) return false;

  const source = atlasStorage.getItemsSource();
  const scale = Math.min(iconMaxSize / frame.w, iconMaxSize / frame.h);
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.drawImage(
    source,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    pixel.x - drawW / 2,
    pixel.y - drawH / 2,
    drawW,
    drawH,
  );
  ctx.restore();
  return true;
}

function drawNexusItemGlyph(
  ctx: CanvasRenderingContext2D,
  text: string,
  pixel: Point2,
  glyphSize: number,
  color: string,
  opacity: number,
): void {
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.font = `bold ${glyphSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, pixel.x, pixel.y + 1);
  ctx.restore();
}

export function drawNexusItemVisuals(options: DrawNexusItemVisualsOptions): void {
  const {
    ctx,
    cells,
    centerPixel,
    imageKey,
    iconMaxSize,
    glyphText,
    glyphSize,
    glyphPlacement,
    imagePlacement,
    opacity,
    centerGlyphColor,
    centerGlyphOpacityMul,
  } = options;

  if (imagePlacement === 'perCell') {
    for (const cell of cells) {
      drawNexusItemImage(
        ctx,
        imageKey,
        cell.pixel,
        iconMaxSize,
        opacity * cell.imageOpacityMul,
      );
    }
  } else {
    drawNexusItemImage(
      ctx,
      imageKey,
      centerPixel,
      iconMaxSize,
      opacity,
    );
  }

  if (!glyphText) return;

  if (glyphPlacement === 'perCell') {
    for (const cell of cells) {
      drawNexusItemGlyph(
        ctx,
        glyphText,
        cell.pixel,
        glyphSize,
        cell.glyphColor,
        opacity * cell.glyphOpacityMul,
      );
    }
  } else {
    drawNexusItemGlyph(
      ctx,
      glyphText,
      centerPixel,
      glyphSize,
      centerGlyphColor,
      opacity * centerGlyphOpacityMul,
    );
  }
}
