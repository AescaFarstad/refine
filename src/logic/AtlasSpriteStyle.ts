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

  if (mode === 'fixed') {
    scale = Math.min(size / Math.max(frame.w, frame.h), maxScale);
    width = size;
    height = size;
  } else {
    scale = Math.min(size / frame.w, size / frame.h, maxScale);
    width = frame.w * scale;
    height = frame.h * scale;
  }

  const atlasW = source.naturalWidth;
  const atlasH = source.naturalHeight;

  return {
    width: `${width}px`,
    height: `${height}px`,
    backgroundImage: `url(${source.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
    backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
  };
}
