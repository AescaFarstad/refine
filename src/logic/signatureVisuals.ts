import atlasStorage from './AtlasStorage';

export type SignatureVisualState = 'hidden' | 'revealed' | 'completed';

export function getSignatureAtlasVars(): Record<string, string> {
  const moleculesSource = atlasStorage.getMoleculesSource();
  const atlasW = moleculesSource?.naturalWidth ?? 0;
  const atlasH = moleculesSource?.naturalHeight ?? 0;
  return {
    '--sig-atlas': moleculesSource ? `url(${moleculesSource.src})` : 'none',
    '--sig-atlas-size': `${atlasW}px ${atlasH}px`,
  };
}

export function getSignatureSpriteStyle(id: string, state: SignatureVisualState): Record<string, string> {
  const src = atlasStorage.getMoleculesSource();
  if (!src) return {};

  if (state === 'hidden') {
    const frame = atlasStorage.getMoleculesFrame(`sig:wafer:${id}`);
    if (!frame) return {};
    const targetSize = 48;
    const scale = Math.min(targetSize / frame.w, targetSize / frame.h);
    return {
      width: `${Math.round(frame.w * scale)}px`,
      height: `${Math.round(frame.h * scale)}px`,
      backgroundImage: `url(${src.src})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
      backgroundSize: `${src.naturalWidth * scale}px ${src.naturalHeight * scale}px`,
    };
  }

  const frameKey = state === 'completed' ? `sig:card:done:${id}` : `sig:card:open:${id}`;
  const frame = atlasStorage.getMoleculesFrame(frameKey);
  if (!frame) return {};
  const targetH = 54;
  const scale = targetH / frame.h;
  return {
    width: `${Math.round(frame.w * scale)}px`,
    height: `${Math.round(frame.h * scale)}px`,
    backgroundImage: `url(${src.src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
    backgroundSize: `${src.naturalWidth * scale}px ${src.naturalHeight * scale}px`,
  };
}
