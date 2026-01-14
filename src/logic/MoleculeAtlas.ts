import { itemDefinitions } from '../data/items';
import atlasStorage from './AtlasStorage';
import { drawMolecule } from './DrawMolecule';
import { axialToPixel } from './HexMath';
import { ESSENCE_COLORS, ESSENCE_SIZE, HEX_SIZE } from './RenderConstants';
import signaturesData from '../data/signatures';
import signatureLayoutsData from '../data/signature_layouts';
import { parseSignatureDefinitions } from './SignatureLib';
import { computeSignatureOriginForCanvas, drawSignatureLines } from './drawSignature';
import { drawHexagon } from './DrawHex';

let moleculeAtlasReady = false;
let moleculeAtlasLoading: Promise<void> | null = null;

type PackedEntry = {
  key: string;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
};

async function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load runtime atlas image'));
    };
    img.src = url;
  });
  // Note: We don't revoke the URL here because the image needs it for CSS background-image usage.
  // The URL will be cleaned up when the page unloads.
  return img;
}

function resolveEssenceColor(essence: string): string {
  return ESSENCE_COLORS[essence] || '#888888';
}

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

    const VIEW_SIZE = 96;
    // Reference 4x4 grid dimensions (approximate)
    // 4 columns * sqrt(3)*18 ~= 125
    // 4 rows * 1.5*18 ~= 108
    const REF_W = 125;
    const REF_H = 110;

    const baseScale = Math.min(VIEW_SIZE / REF_W, VIEW_SIZE / REF_H);

    const packed: PackedEntry[] = [];

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

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      packed.push({
        key: `mol:${id}`,
        w: VIEW_SIZE,
        h: VIEW_SIZE,
        draw: (ctx, x, y) => {
          ctx.save();
          ctx.translate(x + VIEW_SIZE / 2, y + VIEW_SIZE / 2);
          ctx.scale(finalScale, finalScale);
          ctx.translate(-cx, -cy);
          drawMolecule(ctx, mol, HEX_SIZE, { x: 0, y: 0 }, { essenceSize: ESSENCE_SIZE });
          ctx.restore();
        },
      });
    }

    const signatures = parseSignatureDefinitions(signaturesData, signatureLayoutsData);
    const unknownSigColorsRendered = new Set<string>();
    for (const sig of signatures.values()) {
      // Signatures panel (pre-rendered "known" and "unknown")
      {
        const drawSignatureMolecule = (ctx: CanvasRenderingContext2D, completed: boolean, canvasW: number, canvasH: number): void => {
          ctx.clearRect(0, 0, canvasW, canvasH);

          const baseHexSize = 11;
          const margin = 10;

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const atom of sig.molecule.atoms) {
            const p = axialToPixel({ x: atom.x, y: atom.y }, baseHexSize, { x: 0, y: 0 });
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          }

          const spanX = Math.max(1, maxX - minX);
          const spanY = Math.max(1, maxY - minY);
          const scale = Math.min(
            (canvasW - margin * 2) / (spanX + baseHexSize * 2),
            (canvasH - margin * 2) / (spanY + baseHexSize * 2),
          );

          const hexSize = Math.max(8, baseHexSize * scale);
          const origin = {
            x: canvasW / 2 - (minX + maxX) / 2 * scale,
            y: canvasH / 2 - (minY + maxY) / 2 * scale,
          };

          for (const atom of sig.molecule.atoms) {
            const center = axialToPixel({ x: atom.x, y: atom.y }, hexSize, origin);
            const essenceColor = resolveEssenceColor(atom.color);
            const radiusFactor = completed ? 0.82 : 0.58;
            drawHexagon(ctx, center, hexSize * radiusFactor, {
              fillColor: completed ? essenceColor : undefined,
              strokeColor: completed ? 'rgba(15, 23, 42, 0.9)' : essenceColor,
              lineWidth: 2,
            });
          }
        };

        const drawUnknown = (ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void => {
          ctx.clearRect(0, 0, canvasW, canvasH);
          const color = resolveEssenceColor(sig.color);

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '800 46px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';

          const text = '?';
          ctx.strokeText(text, canvasW / 2, canvasH / 2);
          ctx.fillText(text, canvasW / 2, canvasH / 2);
          ctx.restore();
        };

        // Known, incomplete
        {
          const canvasW = 80;
          const canvasH = 90;
          packed.push({
            key: `sig:card:open:${sig.id}`,
            w: canvasW,
            h: canvasH,
            draw: (ctx, x, y) => {
              ctx.save();
              ctx.translate(x, y);
              drawSignatureMolecule(ctx, false, canvasW, canvasH);
              ctx.restore();
            },
          });
        }

        // Known, completed
        {
          const canvasW = 80;
          const canvasH = 90;
          packed.push({
            key: `sig:card:done:${sig.id}`,
            w: canvasW,
            h: canvasH,
            draw: (ctx, x, y) => {
              ctx.save();
              ctx.translate(x, y);
              drawSignatureMolecule(ctx, true, canvasW, canvasH);
              ctx.restore();
            },
          });
        }

        // Unknown
        {
          if (!unknownSigColorsRendered.has(sig.color)) {
            unknownSigColorsRendered.add(sig.color);
            const canvasW = 80;
            const canvasH = 90;
            packed.push({
              key: `sig:card:unknownColor:${sig.color}`,
              w: canvasW,
              h: canvasH,
              draw: (ctx, x, y) => {
                ctx.save();
                ctx.translate(x, y);
                drawUnknown(ctx, canvasW, canvasH);
                ctx.restore();
              },
            });
          }
        }
      }

      // Inline (small, unblurred)
      {
        const canvasSize = 32;
        packed.push({
          key: `sig:inline:${sig.id}`,
          w: canvasSize,
          h: canvasSize,
          draw: (ctx, x, y) => {
            const cells = sig.molecule.atoms.map(a => ({ x: a.x, y: a.y }));
            const hexSize = 4.6;
            const origin = computeSignatureOriginForCanvas(cells, hexSize, { w: canvasSize, h: canvasSize });
            ctx.save();
            ctx.translate(x, y);
            ctx.clearRect(0, 0, canvasSize, canvasSize);
            drawSignatureLines(ctx, cells, { origin, hexSize, color: sig.color, lineWidth: 2, blur: 0 });
            ctx.restore();
          },
        });
      }

      // Wafer (scaled, blurred for large only)
      {
        const lineWidth = 6;
        const cells = sig.molecule.atoms.map(a => ({ x: a.x, y: a.y }));

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const c of cells) {
          const p = axialToPixel(c, HEX_SIZE, { x: 0, y: 0 });
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const blur = cells.length < 5 ? 0 : 10;
        const padding = Math.ceil(lineWidth / 2 + blur + 2);
        const w = Math.max(1, Math.ceil(spanX + padding * 2));
        const h = Math.max(1, Math.ceil(spanY + padding * 2));
        const anchorX = -minX + padding;
        const anchorY = -minY + padding;
        atlasStorage.setSignatureWaferAnchor(sig.id, { x: anchorX, y: anchorY });
        packed.push({
          key: `sig:wafer:${sig.id}`,
          w,
          h,
          draw: (ctx, x, y) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.clearRect(0, 0, w, h);
            drawSignatureLines(ctx, cells, { origin: { x: anchorX, y: anchorY }, hexSize: HEX_SIZE, color: sig.color, lineWidth, blur });
            ctx.restore();
          },
        });
      }
    }

    // Build runtime atlas for dev view (molecules + signature variants)
    {
      const maxRowW = 2048;
      const padding = 2;
      let x = padding;
      let y = padding;
      let rowH = 0;
      let usedW = 0;
      const placed: Array<{ key: string; draw: PackedEntry['draw']; x: number; y: number; w: number; h: number }> = [];
      let maxEntryW = 0;
      for (const e of packed) maxEntryW = Math.max(maxEntryW, e.w);
      const safeMaxRowW = Math.max(maxRowW, maxEntryW + padding * 2);

      for (const e of packed) {
        if (x + e.w + padding > safeMaxRowW) {
          x = padding;
          y += rowH + padding;
          rowH = 0;
        }
        placed.push({ key: e.key, draw: e.draw, x, y, w: e.w, h: e.h });
        x += e.w + padding;
        rowH = Math.max(rowH, e.h);
        usedW = Math.max(usedW, x);
      }

      const w = Math.max(1, usedW + padding);
      const h = Math.max(1, y + rowH + padding);
      const atlasCanvas = document.createElement('canvas');
      atlasCanvas.width = w;
      atlasCanvas.height = h;
      const ctx = atlasCanvas.getContext('2d');
      if (ctx) {
        const frames = new Map<string, { x: number; y: number; w: number; h: number }>();
        for (const p of placed) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x, p.y, p.w, p.h);
          ctx.clip();
          p.draw(ctx, p.x, p.y);
          ctx.restore();
          frames.set(p.key, { x: p.x, y: p.y, w: p.w, h: p.h });
        }
        const blob = await new Promise<Blob>((resolve, reject) => {
          atlasCanvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
        });
        const img = await imageFromBlob(blob);
        atlasStorage.setRuntimeAtlas('molecules', { source: img, frames, meta: { w, h, padding } });
      }
    }

    moleculeAtlasReady = true;
  })()
    .finally(() => {
      moleculeAtlasLoading = null;
    });

  return moleculeAtlasLoading;
}
