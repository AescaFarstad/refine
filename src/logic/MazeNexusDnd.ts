import type { NexusItemDefinition } from './NexusLib';
import {
  createNexusPreviewFrameCanvas,
  NEXUS_UI_PREVIEW_SIZE,
} from './NexusPreviewCanvas';

export type MazeDragNexusItem = Readonly<Pick<NexusItemDefinition, 'id'>>;

export type MazeDragPayload = {
  item: MazeDragNexusItem;
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
const FOLLOWER_SIZE = NEXUS_UI_PREVIEW_SIZE;

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

function createFollower(item: MazeDragNexusItem): void {
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

  wrap.appendChild(createNexusPreviewFrameCanvas(item.id, FOLLOWER_SIZE));

  document.body.appendChild(wrap);
  follower = wrap;
  document.body.classList.add('maze-dragging');
}

export function startMazeManualDrag(item: MazeDragNexusItem, startEvent: PointerEvent | MouseEvent) {
  if (active) return;

  createFollower(item);

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
