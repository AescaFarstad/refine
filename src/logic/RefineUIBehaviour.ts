import type { Molecule, Point2 } from './ItemLib';
import { createMoleculeCanvasWithAnchor } from './DrawMolecule';
import { DRAG_RADIUS_MULTIPLIER, ESSENCE_SIZE, HEX_SIZE, WAFER_CANVAS_HEIGHT, WAFER_CANVAS_WIDTH } from './RenderConstants';

// Render/display constants
export { DRAG_RADIUS_MULTIPLIER, ESSENCE_SIZE, HEX_SIZE, WAFER_CANVAS_HEIGHT, WAFER_CANVAS_WIDTH };

// Pointer helpers
export function eventToCanvasPixel(e: MouseEvent | DragEvent, canvas: HTMLCanvasElement): Point2 {
  const rect = canvas.getBoundingClientRect();
  const clientX = (e as MouseEvent).clientX;
  const clientY = (e as MouseEvent).clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// Drag image helpers
let hiddenCanvas: HTMLCanvasElement | null = null;
function ensureHiddenCanvas(): HTMLCanvasElement {
  if (hiddenCanvas) return hiddenCanvas;
  const c = document.createElement('canvas');
  c.width = 1; c.height = 1;
  c.style.position = 'absolute';
  c.style.top = '-9999px';
  c.style.left = '-9999px';
  document.body.appendChild(c);
  hiddenCanvas = c;
  return c;
}

export function setHiddenDragImage(dt: DataTransfer | null | undefined): void {
  if (!dt) return;
  const ghost = ensureHiddenCanvas();
  try { dt.setDragImage(ghost, 0, 0); } catch (_e) { /* ignore */ }
}

export function setMoleculeDragImage(
  dt: DataTransfer | null | undefined,
  molecule: Molecule,
  hexSize: number = HEX_SIZE,
  essenceSize: number = ESSENCE_SIZE
): void {
  if (!dt) return;
  const res = createMoleculeCanvasWithAnchor(molecule, hexSize, essenceSize, DRAG_RADIUS_MULTIPLIER);
  if (!res) return;
  const canvas = res.canvas;
  canvas.style.position = 'absolute';
  canvas.style.top = '-9999px';
  canvas.style.left = '-9999px';
  try { document.body.appendChild(canvas); dt.setDragImage(canvas, res.anchorX, res.anchorY); } catch (_e) { /* ignore */ }
  setTimeout(() => { try { if (canvas && canvas.parentNode === document.body) document.body.removeChild(canvas); } catch (_e) { } }, 0);
}
