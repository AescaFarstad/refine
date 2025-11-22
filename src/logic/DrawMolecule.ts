import type { Molecule } from './ItemLib';
import atlasStorage from './AtlasStorage';
import { axialToPixel } from './HexMath';
import { getPivotHex } from './MoleculeUtils';

export function drawMolecule(
  ctx: CanvasRenderingContext2D,
  molecule: Molecule,
  hexSize: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  opts?: { bondStroke?: string; bondWidth?: number; essenceSize?: number; radiusMultiplier?: number }
): void {
  const source = atlasStorage.getItemsSource();
  const bondStroke = opts?.bondStroke ?? 'rgba(200, 200, 200, 0.6)';
  const bondWidth = opts?.bondWidth ?? 3;
  const essenceSize = opts?.essenceSize ?? 28;
  const radiusMultiplier = opts?.radiusMultiplier ?? 1.0;
  const drawSize = essenceSize * radiusMultiplier;

  // Bonds
  ctx.save();
  ctx.strokeStyle = bondStroke;
  ctx.lineWidth = bondWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const conn of molecule.connections) {
    const from = axialToPixel(conn.from, hexSize, origin);
    const to = axialToPixel(conn.to, hexSize, origin);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();

  // Atoms
  for (const atom of molecule.atoms) {
    const pixel = axialToPixel({ x: atom.x, y: atom.y }, hexSize, origin);
    const frame = atlasStorage.getItemsFrame(atom.color);
    if (source && frame) {
      ctx.drawImage(
        source,
        frame.x, frame.y, frame.w, frame.h,
        pixel.x - drawSize / 2, pixel.y - drawSize / 2, drawSize, drawSize
      );
    } else {
      ctx.fillStyle = getEssenceColorFallback(atom.color);
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, drawSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(atom.color[0].toUpperCase(), pixel.x, pixel.y);
    }
  }
}

export function createMoleculeCanvasWithAnchor(
  molecule: Molecule,
  hexSize: number,
  essenceSize: number,
  radiusMultiplier: number = 1.0
): { canvas: HTMLCanvasElement, anchorX: number, anchorY: number } | null {
  const drawSize = essenceSize * radiusMultiplier;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const source = atlasStorage.getItemsSource();
  if (!source) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minCenterX = Infinity, minCenterY = Infinity, maxCenterX = -Infinity, maxCenterY = -Infinity;
  const atomPixels: Array<{ x: number, y: number, color: string }> = [];
  for (const atom of molecule.atoms) {
    const screen = axialToPixel({ x: atom.x, y: atom.y }, hexSize);
    atomPixels.push({ x: screen.x, y: screen.y, color: atom.color });
    // Canvas bounds consider sprite size
    minX = Math.min(minX, screen.x - drawSize / 2);
    minY = Math.min(minY, screen.y - drawSize / 2);
    maxX = Math.max(maxX, screen.x + drawSize / 2);
    maxY = Math.max(maxY, screen.y + drawSize / 2);
    // Pure atom-center bounds for anchor
    minCenterX = Math.min(minCenterX, screen.x);
    minCenterY = Math.min(minCenterY, screen.y);
    maxCenterX = Math.max(maxCenterX, screen.x);
    maxCenterY = Math.max(maxCenterY, screen.y);
  }

  const padding = 10;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);

  canvas.width = width;
  canvas.height = height;

  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  // Use the pivot hex (rounded centroid) as the anchor
  const pivotAxial = getPivotHex(molecule);
  const pivotPixel = axialToPixel(pivotAxial, hexSize);

  const centroidX = pivotPixel.x + offsetX;
  const centroidY = pivotPixel.y + offsetY;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const conn of molecule.connections) {
    const from = axialToPixel(conn.from, hexSize);
    const to = axialToPixel(conn.to, hexSize);

    ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(from.x + offsetX, from.y + offsetY);
    ctx.lineTo(to.x + offsetX, to.y + offsetY);
    ctx.stroke();
  }

  for (const ap of atomPixels) {
    const centerX = ap.x + offsetX;
    const centerY = ap.y + offsetY;

    const frame = atlasStorage.getItemsFrame(ap.color);
    if (frame) {
      ctx.drawImage(
        source,
        frame.x, frame.y, frame.w, frame.h,
        centerX - drawSize / 2, centerY - drawSize / 2, drawSize, drawSize
      );
    } else {
      ctx.fillStyle = getEssenceColorFallback(ap.color);
      ctx.beginPath();
      ctx.arc(centerX, centerY, drawSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(drawSize * 0.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ap.color[0].toUpperCase(), centerX, centerY);
    }
  }

  return { canvas, anchorX: centroidX, anchorY: centroidY };
}

import { DRAG_RADIUS_MULTIPLIER } from './RefineUIBehaviour';

export function drawGhostMolecule(
  ctx: CanvasRenderingContext2D,
  molecule: Molecule,
  valid: boolean,
  hexSize: number = 18,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  essenceSize: number = 28
): void {
  const bondStroke = valid ? 'rgba(200, 255, 245, 0.7)' : 'rgba(255, 200, 200, 0.7)';
  drawMolecule(ctx, molecule, hexSize, origin, { bondStroke, bondWidth: 3, essenceSize, radiusMultiplier: DRAG_RADIUS_MULTIPLIER });
}

export function createMoleculeCanvas(
  molecule: Molecule,
  hexSize: number,
  essenceSize: number
): HTMLCanvasElement | null {
  const res = createMoleculeCanvasWithAnchor(molecule, hexSize, essenceSize);
  return res ? res.canvas : null;
}

function getEssenceColorFallback(essence: string): string {
  const colors: Record<string, string> = {
    red: '#ff4444',
    blue: '#4444ff',
    green: '#44ff44',
    yellow: '#ffdd44',
  };
  return colors[essence] || '#888888';
}
