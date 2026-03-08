import type { AtlasFrame, AtlasSource } from './AtlasStorage';

export type AtlasSpriteMode = 'fixed' | 'fit';

export interface AtlasSpriteStyleOptions {
  size: number;
  mode?: AtlasSpriteMode;
  allowUpscale?: boolean;
}

export function atlasSpriteStyle(source: AtlasSource, frame: AtlasFrame, options: AtlasSpriteStyleOptions): Record<string, string> {
  const size = options.size;
  const mode = options.mode ?? 'fixed';
  const allowUpscale = options.allowUpscale ?? true;
  const maxScale = allowUpscale ? Infinity : 1;
  let scale = 1;
  let width = size;
  let height = size;
  let paddingTop = 0;
  let paddingRight = 0;
  let paddingBottom = 0;
  let paddingLeft = 0;

  if (mode === 'fixed') {
    scale = Math.min(size / Math.max(frame.w, frame.h), maxScale);
    const contentWidth = frame.w * scale;
    const contentHeight = frame.h * scale;
    width = size;
    height = size;
    paddingTop = (size - contentHeight) / 2;
    paddingBottom = size - contentHeight - paddingTop;
    paddingLeft = (size - contentWidth) / 2;
    paddingRight = size - contentWidth - paddingLeft;
  } else {
    scale = Math.min(size / frame.w, size / frame.h, maxScale);
    width = frame.w * scale;
    height = frame.h * scale;
  }

  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;

  const style: Record<string, string> = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };

  if (mode === 'fixed') {
    style.boxSizing = 'border-box';
    style.paddingTop = `${paddingTop}px`;
    style.paddingRight = `${paddingRight}px`;
    style.paddingBottom = `${paddingBottom}px`;
    style.paddingLeft = `${paddingLeft}px`;
    style.backgroundOrigin = 'content-box';
    style.backgroundClip = 'content-box';
  }

  return style;
}
