import { itemDefinitions } from '../data/items';
import atlasStorage from './AtlasStorage';
import { drawMolecule } from './DrawMolecule';
import { axialToPixel } from './HexMath';
import { ESSENCE_SIZE, HEX_SIZE } from './RenderConstants';

let moleculeAtlasReady = false;
let moleculeAtlasLoading: Promise<void> | null = null;

export async function ensureMoleculeAtlas(): Promise<void> {
  if (moleculeAtlasReady) return;
  if (moleculeAtlasLoading) return moleculeAtlasLoading;

  moleculeAtlasLoading = (async () => {
    if (typeof document === 'undefined') return;

    try {
      await atlasStorage.loadItemsAtlas();
    } catch (_e) {
      // Allow fallback drawing if atlas assets fail to load.
    }

    atlasStorage.clearMoleculeAtlas();

    const VIEW_SIZE = 96;
    // Reference 4x4 grid dimensions (approximate)
    // 4 columns * sqrt(3)*18 ~= 125
    // 4 rows * 1.5*18 ~= 108
    const REF_W = 125;
    const REF_H = 110;

    const baseScale = Math.min(VIEW_SIZE / REF_W, VIEW_SIZE / REF_H);

    for (const [id, def] of Object.entries(itemDefinitions)) {
      if (!def.molecule) continue;
      const mol = def.molecule;

      // Calculate bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const atom of mol.atoms) {
        const p = axialToPixel(atom, HEX_SIZE);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      const padding = ESSENCE_SIZE / 2 + 6;
      const w = maxX - minX + padding * 2;
      const h = maxY - minY + padding * 2;

      // Scale logic
      const fitScale = Math.min(VIEW_SIZE / w, VIEW_SIZE / h);
      const finalScale = Math.min(baseScale, fitScale);

      const canvas = document.createElement('canvas');
      canvas.width = VIEW_SIZE;
      canvas.height = VIEW_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      ctx.translate(VIEW_SIZE / 2, VIEW_SIZE / 2);
      ctx.scale(finalScale, finalScale);
      ctx.translate(-cx, -cy);

      drawMolecule(ctx, mol, HEX_SIZE, { x: 0, y: 0 }, { essenceSize: ESSENCE_SIZE });

      atlasStorage.setMoleculeImage(id, canvas.toDataURL());
    }

    moleculeAtlasReady = true;
  })()
    .finally(() => {
      moleculeAtlasLoading = null;
    });

  return moleculeAtlasLoading;
}

