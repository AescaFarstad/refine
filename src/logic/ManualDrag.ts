import type { Molecule } from './ItemLib';
import { createMoleculeCanvasWithAnchor } from './DrawMolecule';
import { HEX_SIZE, ESSENCE_SIZE, DRAG_RADIUS_MULTIPLIER } from './RefineUIBehaviour';

export type ManualDragPayload = {
  id: string;
  molecule: Molecule;
};

export type ManualDragEndDetail = {
  clientX: number;
  clientY: number;
  canceled: boolean;
  payload: ManualDragPayload;
};

const MOVE_EVENT = 'manual-drag-move';
const END_EVENT = 'manual-drag-end';

let active = false;
let payloadRef: ManualDragPayload | null = null;
let follower: HTMLDivElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let anchorX = 0;
let anchorY = 0;
let lastX = 0;
let lastY = 0;
let followerVisible = true;

function onPointerMove(e: PointerEvent | MouseEvent) {
  if (!active || !follower) return;
  const x = (e as PointerEvent).clientX;
  const y = (e as PointerEvent).clientY;
  lastX = x;
  lastY = y;
  follower.style.transform = `translate(${Math.round(x - anchorX)}px, ${Math.round(y - anchorY)}px)`;
  // Fire move event for potential consumers (optional)
  window.dispatchEvent(new CustomEvent(MOVE_EVENT, { detail: { clientX: x, clientY: y, payload: payloadRef } }));
}

function cleanupFollower() {
  if (follower && follower.parentNode) follower.parentNode.removeChild(follower);
  follower = null;
  canvasEl = null;
  document.body.classList.remove('manual-dragging');
  followerVisible = true;
}

function onPointerUp(e: PointerEvent | MouseEvent, canceled: boolean = false) {
  if (!active) return;
  active = false;
  const x = (e as PointerEvent).clientX;
  const y = (e as PointerEvent).clientY;

  // Remove listeners
  const win = window as Window & typeof globalThis;
  if ('PointerEvent' in window) {
    win.removeEventListener('pointermove', onPointerMove as any);
    win.removeEventListener('pointerup', onPointerUp as any);
    win.removeEventListener('pointercancel', onPointerCancel as any);
  } else {
    win.removeEventListener('mousemove', onPointerMove as any);
    win.removeEventListener('mouseup', onPointerUp as any);
  }
  win.removeEventListener('keydown', onKeyDown as any);
  win.removeEventListener('dragstart', onNativeDragStart as any, true);
  win.removeEventListener('selectstart', onSelectStart as any, true);

  // Dispatch end event with drop coordinates
  const detail: ManualDragEndDetail = {
    clientX: x,
    clientY: y,
    canceled,
    payload: payloadRef!,
  };
  window.dispatchEvent(new CustomEvent<ManualDragEndDetail>(END_EVENT, { detail } as any));

  // Cleanup visual follower
  cleanupFollower();
  payloadRef = null;
}

function onPointerCancel(e: PointerEvent) {
  onPointerUp(e, true);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    // Synthesize a clientX/Y from last known transform if needed
    const rect = follower?.getBoundingClientRect();
    const x = rect ? rect.left + anchorX : 0;
    const y = rect ? rect.top + anchorY : 0;
    onPointerUp({ clientX: x, clientY: y } as any, true);
  }
}

function attachFollower(payload: ManualDragPayload, start: PointerEvent | MouseEvent) {
  const res = createMoleculeCanvasWithAnchor(payload.molecule, HEX_SIZE, ESSENCE_SIZE, DRAG_RADIUS_MULTIPLIER);
  if (!res) return false;
  canvasEl = res.canvas;
  anchorX = res.anchorX;
  anchorY = res.anchorY;

  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.top = '0px';
  wrap.style.left = '0px';
  wrap.style.width = res.canvas.width + 'px';
  wrap.style.height = res.canvas.height + 'px';
  wrap.style.pointerEvents = 'none';
  wrap.style.zIndex = '999999';
  wrap.style.transform = 'translate(-9999px, -9999px)';
  wrap.appendChild(res.canvas);
  document.body.appendChild(wrap);
  follower = wrap;
  document.body.classList.add('manual-dragging');

  // Position immediately
  onPointerMove(start);
  return true;
}

export function startManualDrag(payload: ManualDragPayload, startEvent: PointerEvent | MouseEvent) {
  if (active) return;
  active = true;
  payloadRef = payload;

  // Build visual follower
  const ok = attachFollower(payload, startEvent);
  if (!ok) { active = false; payloadRef = null; return; }

  // Global listeners
  const win = window as Window & typeof globalThis;
  if ('PointerEvent' in window) {
    win.addEventListener('pointermove', onPointerMove as any);
    win.addEventListener('pointerup', onPointerUp as any, { once: false });
    win.addEventListener('pointercancel', onPointerCancel as any, { once: false });
  } else {
    win.addEventListener('mousemove', onPointerMove as any);
    win.addEventListener('mouseup', onPointerUp as any, { once: false });
  }
  win.addEventListener('keydown', onKeyDown as any);

  // Suppress any native drag and text selection while active
  win.addEventListener('dragstart', onNativeDragStart as any, true);
  win.addEventListener('selectstart', onSelectStart as any, true);
}

// Convenience constants for listeners in components
export const ManualDragEvents = {
  Move: MOVE_EVENT,
  End: END_EVENT,
};

function onNativeDragStart(ev: DragEvent) {
  if (active) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }
}

function onSelectStart(ev: Event) {
  if (active) {
    ev.preventDefault();
  }
}

// External control to show/hide the follower (e.g., hide over wafer)
export function setManualDragFollowerVisible(visible: boolean) {
  followerVisible = !!visible;
  if (follower) {
    follower.style.visibility = followerVisible ? 'visible' : 'hidden';
  }
}

export function updateManualDragMolecule(molecule: Molecule) {
  if (!active || !follower) return;

  const res = createMoleculeCanvasWithAnchor(molecule, HEX_SIZE, ESSENCE_SIZE, DRAG_RADIUS_MULTIPLIER);
  if (!res) return;

  anchorX = res.anchorX;
  anchorY = res.anchorY;

  follower.innerHTML = '';
  follower.appendChild(res.canvas);
  follower.style.width = res.canvas.width + 'px';
  follower.style.height = res.canvas.height + 'px';

  if (payloadRef) {
    payloadRef.molecule = molecule;
  }

  // Force position update to respect new anchor using last known mouse position
  if (lastX !== 0 || lastY !== 0) {
    follower.style.transform = `translate(${Math.round(lastX - anchorX)}px, ${Math.round(lastY - anchorY)}px)`;
  }
}
