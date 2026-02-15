import { ref, type Ref, type ComputedRef, onUnmounted } from 'vue';
import type { Point2 } from '../ItemLib';
import { pixelToAxial } from '../HexMath';

type Point2Ref = Ref<Point2> | ComputedRef<Point2>;

export interface HexPaneInteractionOptions {
  canvas: Ref<HTMLCanvasElement | null>;
  origin: Point2Ref;
  hexSize: number;
  zoom: Ref<number>;
  offset: Ref<Point2>;
  hoverAxial: Ref<Point2 | null>;
  minZoom: number;
  maxZoom: number;
  zoomStopRenderDebounceMs?: number;
  isPaintMode: (event: MouseEvent) => boolean;
  onHoverChanged: (axial: Point2 | null) => void;
  onPrimaryClick: (axial: Point2, event: MouseEvent) => void;
  onPaintAt: (axial: Point2) => void;
  onPanOrZoomTransient: () => void;
  onPanOrZoomCommit: () => void;
  onMouseLeave: () => void;
}

const PAN_START_DISTANCE_SQ = 9;
const DEFAULT_ZOOM_STOP_RENDER_DEBOUNCE_MS = 400;

export function useHexPaneInteraction(options: HexPaneInteractionOptions) {
  const isPanning = ref(false);
  const isMouseDown = ref(false);
  const isPainting = ref(false);
  const lastPanClient = ref<Point2 | null>(null);

  let zoomStopTimeoutId: number | null = null;

  function clearZoomStopTimeout(): void {
    if (zoomStopTimeoutId == null || typeof window === 'undefined') return;
    window.clearTimeout(zoomStopTimeoutId);
    zoomStopTimeoutId = null;
  }

  function scheduleZoomStopCommit(): void {
    if (typeof window === 'undefined') return;
    clearZoomStopTimeout();
    const delay = options.zoomStopRenderDebounceMs ?? DEFAULT_ZOOM_STOP_RENDER_DEBOUNCE_MS;
    zoomStopTimeoutId = window.setTimeout(() => {
      zoomStopTimeoutId = null;
      options.onPanOrZoomCommit();
    }, delay);
  }

  function eventToAxial(event: MouseEvent | WheelEvent): Point2 | null {
    const canvas = options.canvas.value;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const z = options.zoom.value || 1;
    const off = options.offset.value;
    const worldX = (px - off.x) / z;
    const worldY = (py - off.y) / z;

    return pixelToAxial({ x: worldX, y: worldY }, options.hexSize, options.origin.value);
  }

  function updateHoverCell(event: MouseEvent): void {
    const axial = eventToAxial(event);
    if (!axial) return;

    const prev = options.hoverAxial.value;
    if (!prev || prev.x !== axial.x || prev.y !== axial.y) {
      options.hoverAxial.value = axial;
      options.onHoverChanged(axial);
    }
  }

  function onWheel(event: WheelEvent): void {
    const canvas = options.canvas.value;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const oldZoom = options.zoom.value || 1;
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    let newZoom = oldZoom * zoomFactor;
    newZoom = Math.max(options.minZoom, Math.min(options.maxZoom, newZoom));

    if (newZoom === oldZoom) return;

    const off = options.offset.value;
    const worldX = (px - off.x) / oldZoom;
    const worldY = (py - off.y) / oldZoom;

    options.offset.value = {
      x: px - worldX * newZoom,
      y: py - worldY * newZoom,
    };
    options.zoom.value = newZoom;

    options.onPanOrZoomTransient();
    scheduleZoomStopCommit();
  }

  function onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;

    isMouseDown.value = true;
    isPanning.value = false;
    lastPanClient.value = { x: event.clientX, y: event.clientY };

    isPainting.value = options.isPaintMode(event);
    if (!isPainting.value) return;

    updateHoverCell(event);
    if (options.hoverAxial.value) {
      options.onPaintAt(options.hoverAxial.value);
    }
  }

  function onMouseMove(event: MouseEvent): void {
    updateHoverCell(event);

    if (isPainting.value && isMouseDown.value) {
      if (options.hoverAxial.value) {
        options.onPaintAt(options.hoverAxial.value);
      }
      return;
    }

    if (!isMouseDown.value || !lastPanClient.value) return;

    const prev = lastPanClient.value;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;

    if (!isPanning.value) {
      const distSq = dx * dx + dy * dy;
      if (distSq < PAN_START_DISTANCE_SQ) {
        return;
      }
      isPanning.value = true;
    }

    lastPanClient.value = { x: event.clientX, y: event.clientY };

    options.offset.value = {
      x: options.offset.value.x + dx,
      y: options.offset.value.y + dy,
    };

    options.onPanOrZoomTransient();
  }

  function clearPointerState(): void {
    isMouseDown.value = false;
    isPanning.value = false;
    isPainting.value = false;
    lastPanClient.value = null;
  }

  function onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return;

    const wasPainting = isPainting.value;
    const wasPanning = isMouseDown.value && isPanning.value;

    if (isMouseDown.value && !isPanning.value && !wasPainting) {
      const axial = eventToAxial(event);
      if (axial) {
        options.onPrimaryClick(axial, event);
      }
    }

    clearPointerState();

    if (wasPanning) {
      options.onPanOrZoomCommit();
    }
  }

  function onMouseLeave(_event: MouseEvent): void {
    const wasPanning = isMouseDown.value && isPanning.value;

    clearPointerState();

    if (options.hoverAxial.value) {
      options.hoverAxial.value = null;
      options.onHoverChanged(null);
    }

    options.onMouseLeave();

    if (wasPanning) {
      options.onPanOrZoomCommit();
    }
  }

  function onWindowMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return;

    const wasPanning = isMouseDown.value && isPanning.value;
    clearPointerState();

    if (wasPanning) {
      options.onPanOrZoomCommit();
    }
  }

  onUnmounted(() => {
    clearZoomStopTimeout();
  });

  return {
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onWindowMouseUp,
  };
}
