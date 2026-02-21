import type { NexusItemDefinition } from './NexusLib';
import atlasStorage from './AtlasStorage';

export type MazeDragPayload = {
  item: NexusItemDefinition;
};

export type MazeDragEndDetail = {
  clientX: number;
  clientY: number;
  payload: MazeDragPayload;
  cancelled: boolean;
};

export const MAZE_DRAG_MOVE_EVENT = 'maze-drag-move';
export const MAZE_DRAG_END_EVENT = 'maze-drag-end';

let active = false;
let payloadRef: MazeDragPayload | null = null;
let follower: HTMLDivElement | null = null;
let followerVisible = true;
let rafPending = false;
let lastX = 0;
let lastY = 0;
const FOLLOWER_SIZE = 48;

function onPointerMove(e: PointerEvent | MouseEvent) {
  if (!active || !follower) return;
  const x = (e as PointerEvent).clientX;
  const y = (e as PointerEvent).clientY;
  lastX = x;
  lastY = y;

  // Center the follower on cursor
  follower.style.transform = `translate(${Math.round(x - FOLLOWER_SIZE / 2)}px, ${Math.round(y - FOLLOWER_SIZE / 2)}px)`;

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      window.dispatchEvent(new CustomEvent(MAZE_DRAG_MOVE_EVENT, {
        detail: { clientX: lastX, clientY: lastY, payload: payloadRef }
      }));
    });
  }
}

function cleanupFollower() {
  if (follower && follower.parentNode) follower.parentNode.removeChild(follower);
  follower = null;
  followerVisible = true;
  document.body.classList.remove('maze-dragging');
}

function finishDrag(e: PointerEvent | MouseEvent, cancelled: boolean) {
  if (!active) return;
  active = false;
  const x = (e as PointerEvent).clientX;
  const y = (e as PointerEvent).clientY;

  removeListeners();

  if (payloadRef) {
    const detail: MazeDragEndDetail = {
      clientX: x,
      clientY: y,
      payload: payloadRef,
      cancelled,
    };
    window.dispatchEvent(new CustomEvent(MAZE_DRAG_END_EVENT, { detail }));
  }

  cleanupFollower();
  payloadRef = null;
}

function onPointerUp(e: PointerEvent | MouseEvent) {
  finishDrag(e, false);
}

function onPointerCancel(e: PointerEvent) {
  finishDrag(e, true);
}

function removeListeners() {
  const win = window as Window & typeof globalThis;
  win.removeEventListener('pointermove', onPointerMove as any);
  win.removeEventListener('pointerup', onPointerUp as any);
  win.removeEventListener('pointercancel', onPointerCancel as any);
  win.removeEventListener('keydown', onKeyDown as any);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    finishDrag({ clientX: lastX, clientY: lastY } as PointerEvent, true);
  }
}

function createFollower(item: NexusItemDefinition): boolean {
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.top = '0px';
  wrap.style.left = '0px';
  wrap.style.width = `${FOLLOWER_SIZE}px`;
  wrap.style.height = `${FOLLOWER_SIZE}px`;
  wrap.style.pointerEvents = 'none';
  wrap.style.zIndex = '999999';
  wrap.style.display = 'grid';
  wrap.style.placeItems = 'center';
  wrap.style.transform = 'translate(-9999px, -9999px)';

  const nexusFrame = atlasStorage.getNexusFrame(`nexus:${item.id}`);
  if (nexusFrame) {
    const source = atlasStorage.getNexusSource();
    const canvas = document.createElement('canvas');
    const dpr = Math.max(2, window.devicePixelRatio || 1);
    canvas.width = FOLLOWER_SIZE * dpr;
    canvas.height = FOLLOWER_SIZE * dpr;
    canvas.style.width = `${FOLLOWER_SIZE}px`;
    canvas.style.height = `${FOLLOWER_SIZE}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        source,
        nexusFrame.x, nexusFrame.y, nexusFrame.w, nexusFrame.h,
        0, 0, FOLLOWER_SIZE * dpr, FOLLOWER_SIZE * dpr,
      );
      wrap.appendChild(canvas);
    }
  } else {
  const imageKey = item.placableInstanceDescription?.image;
  if (imageKey) {
    const frame = atlasStorage.getItemsFrame(imageKey);
    if (frame) {
      const source = atlasStorage.getItemsSource();
      const canvas = document.createElement('canvas');

      // Use higher internal resolution for crisp rendering on high-DPI screens
      // or to avoid downsampling artifacts if the source is large.
      const dpr = window.devicePixelRatio || 1;
      const sizeMultiplier = Math.max(2, dpr); // Ensure at least 2x supersampling relative to CSS size

      canvas.width = FOLLOWER_SIZE * sizeMultiplier;
      canvas.height = FOLLOWER_SIZE * sizeMultiplier;
      canvas.style.width = `${FOLLOWER_SIZE}px`;
      canvas.style.height = `${FOLLOWER_SIZE}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false; // Keep pixel art sharp during drawImage

        // Calculate scaling to fit within the larger canvas buffer
        const bufferSize = FOLLOWER_SIZE * sizeMultiplier;
        // Target size for the image within the buffer (e.g. 80% of the space)
        const targetSize = bufferSize * 0.8;

        const scale = Math.min(targetSize / frame.w, targetSize / frame.h);
        const w = frame.w * scale;
        const h = frame.h * scale;
        const dx = (bufferSize - w) / 2;
        const dy = (bufferSize - h) / 2;

        ctx.drawImage(source, frame.x, frame.y, frame.w, frame.h, dx, dy, w, h);
        wrap.appendChild(canvas);
      }
    }
  } else {
    // Fallback glyph
    const glyph = document.createElement('span');
    glyph.textContent = item.glyph || item.name.charAt(0);
    glyph.style.fontSize = `${Math.floor(FOLLOWER_SIZE * 0.6)}px`;
    glyph.style.fontWeight = '700';
    glyph.style.color = 'rgba(248, 250, 252, 0.96)';
    glyph.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
    wrap.appendChild(glyph);
  }
  }

  document.body.appendChild(wrap);
  follower = wrap;
  document.body.classList.add('maze-dragging');
  return true;
}

export function startMazeManualDrag(item: NexusItemDefinition, startEvent: PointerEvent | MouseEvent) {
  if (active) return;

  if (!createFollower(item)) return;

  active = true;
  payloadRef = { item };

  const win = window as Window & typeof globalThis;
  win.addEventListener('pointermove', onPointerMove as any);
  win.addEventListener('pointerup', onPointerUp as any);
  win.addEventListener('pointercancel', onPointerCancel as any);
  win.addEventListener('keydown', onKeyDown as any);

  // Initial position
  onPointerMove(startEvent);
}

export function setMazeManualDragFollowerVisible(visible: boolean) {
  followerVisible = !!visible;
  if (follower) {
    follower.style.visibility = followerVisible ? 'visible' : 'hidden';
  }
}
