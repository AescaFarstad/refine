<template>
  <div ref="container" class="parallax-container">
    <canvas
      v-for="(layer, index) in layers"
      :key="index"
      :ref="el => setCanvasRef(el, index)"
      class="parallax-layer"
      :style="getLayerStyle(index)"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, reactive } from 'vue';
import type { Point2 } from '../logic/ItemLib';

interface ParallaxLayer {
  hexes: ParallaxHex[];
  depth: number;
  alpha: number;
  hexSize: number;
  floatOffset: Point2;
  floatVelocity: Point2;
  floatMaxRadius: number;
}

interface ParallaxHex {
  x: number;
  y: number;
}

const props = defineProps<{
  offset: Point2;
  zoom: number;
}>();

const container = ref<HTMLDivElement | null>(null);
const canvasRefs: (HTMLCanvasElement | null)[] = [];
const layers = reactive<ParallaxLayer[]>([]);
let animationRafId: number | null = null;
let lastAnimationTime = 0;
let canvasWidth = 0;
let canvasHeight = 0;

// Activity tracking for movement subsiding
let lastActivityTime = 0;
const ACTIVITY_FADE_DURATION = 900;
const BASE_MOVEMENT_MULTIPLIER = 4;
const HEX_SIZE_MULTIPLIER = 0.3;

// Track pure panning (excluding zoom-induced offset changes)
let purePanOffset: Point2 = { x: 0, y: 0 };
let lastOffset: Point2 = { x: 0, y: 0 };
let lastZoom = 1;

// Cached unit hex points for pointy-top orientation
const UNIT_HEX_POINTS: Point2[] = (() => {
  const points: Point2[] = [];
  const angleOffset = Math.PI / 6;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + angleOffset;
    points.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  return points;
})();

// Seeded random for deterministic hex placement
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function setCanvasRef(el: unknown, index: number): void {
  canvasRefs[index] = el as HTMLCanvasElement | null;
}

function generateLayers(width: number, height: number): void {
  layers.length = 0;

  // Layer configs: [depth, hexCount, hexSize, alpha, floatMaxRadius]
  const configs: [number, number, number, number, number][] = [
    [0.035, 18, 110, 0.14, 8],
    [0.020, 22, 80, 0.12, 12],
    [0.010, 28, 55, 0.10, 16],
    [0.004, 35, 38, 0.08, 20],
    [0.001, 45, 24, 0.06, 25],
  ];

  const rand = seededRandom(42);
  const padding = 300;

  for (const [depth, count, baseHexSize, alpha, floatMaxRadius] of configs) {
    const hexSize = baseHexSize * HEX_SIZE_MULTIPLIER;
    const hexes: ParallaxHex[] = [];
    const minDistance = hexSize * 2.5;

    let attempts = 0;
    const maxAttempts = count * 50;

    while (hexes.length < count && attempts < maxAttempts) {
      const candidateX = rand() * (width + padding * 2) - padding;
      const candidateY = rand() * (height + padding * 2) - padding;

      let tooClose = false;
      for (const existing of hexes) {
        const dx = candidateX - existing.x;
        const dy = candidateY - existing.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        hexes.push({ x: candidateX, y: candidateY });
      }
      attempts++;
    }

    const angle = rand() * Math.PI * 2;
    const speed = (2 + rand() * 3) * BASE_MOVEMENT_MULTIPLIER;

    layers.push({
      hexes,
      depth,
      alpha,
      hexSize,
      floatOffset: { x: 0, y: 0 },
      floatVelocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      floatMaxRadius,
    });
  }
}

function getActivityMultiplier(): number {
  const now = performance.now();
  const timeSinceActivity = now - lastActivityTime;
  if (timeSinceActivity >= ACTIVITY_FADE_DURATION) {
    return 0;
  }
  return 1 - (timeSinceActivity / ACTIVITY_FADE_DURATION);
}

function updateFloatOffsets(deltaTime: number): void {
  const activityMultiplier = getActivityMultiplier();

  for (const layer of layers) {
    layer.floatOffset.x += layer.floatVelocity.x * deltaTime * activityMultiplier;
    layer.floatOffset.y += layer.floatVelocity.y * deltaTime * activityMultiplier;

    const dist = Math.sqrt(
      layer.floatOffset.x * layer.floatOffset.x +
      layer.floatOffset.y * layer.floatOffset.y
    );

    if (dist > layer.floatMaxRadius) {
      const scale = layer.floatMaxRadius / dist;
      layer.floatOffset.x *= scale;
      layer.floatOffset.y *= scale;

      const normalX = layer.floatOffset.x / dist;
      const normalY = layer.floatOffset.y / dist;

      const dot = layer.floatVelocity.x * normalX + layer.floatVelocity.y * normalY;
      layer.floatVelocity.x -= 2 * dot * normalX;
      layer.floatVelocity.y -= 2 * dot * normalY;

      const perturbAngle = (Math.random() - 0.5) * 0.5;
      const cos = Math.cos(perturbAngle);
      const sin = Math.sin(perturbAngle);
      const vx = layer.floatVelocity.x;
      const vy = layer.floatVelocity.y;
      layer.floatVelocity.x = vx * cos - vy * sin;
      layer.floatVelocity.y = vx * sin + vy * cos;
    }
  }
}

function drawHexFast(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const p = UNIT_HEX_POINTS[i];
    const x = cx + size * p.x;
    const y = cy + size * p.y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

// Render hexes to a layer's canvas ONCE
function renderLayerToCanvas(layerIndex: number): void {
  const canvas = canvasRefs[layerIndex];
  const layer = layers[layerIndex];
  if (!canvas || !layer) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Size canvas larger than viewport to allow movement without re-rendering
  const padding = 400;
  const w = canvasWidth + padding * 2;
  const h = canvasHeight + padding * 2;

  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Compute stroke color
  const bgR = 10, bgG = 15, bgB = 30;
  const fgR = 70, fgG = 90, fgB = 120;
  const t = layer.alpha;
  const r = Math.round(bgR + (fgR - bgR) * t * 3);
  const g = Math.round(bgG + (fgG - bgG) * t * 3);
  const b = Math.round(bgB + (fgB - bgB) * t * 3);
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = 1.5;

  for (const hex of layer.hexes) {
    // Draw at position offset by padding so we have room to shift
    drawHexFast(ctx, hex.x + padding, hex.y + padding, layer.hexSize);
  }
}

function renderAllLayers(): void {
  for (let i = 0; i < layers.length; i++) {
    renderLayerToCanvas(i);
  }
}

// Compute CSS transform for a layer based on current offset/zoom/float
function getLayerStyle(index: number): Record<string, string> {
  const layer = layers[index];
  if (!layer) return {};

  const parallaxFactor = layer.depth;
  const panFactor = 0.1 + parallaxFactor * 10;
  const px = purePanOffset.x * panFactor + layer.floatOffset.x;
  const py = purePanOffset.y * panFactor + layer.floatOffset.y;

  const zoomFactor = 0.06 + parallaxFactor * 0.8;
  const effectiveZoom = 1 + (props.zoom - 1) * zoomFactor;

  // Offset by -padding to center the oversized canvas, then apply parallax
  const padding = 400;
  const tx = -padding + px;
  const ty = -padding + py;

  return {
    transform: `translate(${tx}px, ${ty}px) scale(${effectiveZoom})`,
    transformOrigin: `${canvasWidth / 2 + padding}px ${canvasHeight / 2 + padding}px`,
  };
}

function animationLoop(timestamp: number): void {
  if (lastAnimationTime === 0) {
    lastAnimationTime = timestamp;
  }

  const deltaTime = Math.min((timestamp - lastAnimationTime) / 1000, 0.1);
  lastAnimationTime = timestamp;

  updateFloatOffsets(deltaTime);

  // Force style recalc by touching a reactive property
  // Vue will update :style bindings automatically

  animationRafId = requestAnimationFrame(animationLoop);
}

function setupCanvas(): void {
  const c = container.value;
  if (!c) return;

  const w = c.clientWidth || c.offsetWidth || 800;
  const h = c.clientHeight || c.offsetHeight || 600;

  if (canvasWidth !== w || canvasHeight !== h) {
    canvasWidth = w;
    canvasHeight = h;
    generateLayers(w, h);

    // Wait for Vue to create canvas elements, then render
    requestAnimationFrame(() => {
      renderAllLayers();
    });
  }
}

function onResize(): void {
  setupCanvas();
}

function updatePurePan(): void {
  const currentOffset = props.offset;
  const currentZoom = props.zoom;

  const deltaX = currentOffset.x - lastOffset.x;
  const deltaY = currentOffset.y - lastOffset.y;
  const deltaZoom = currentZoom - lastZoom;

  if (Math.abs(deltaZoom) > 0.001) {
    // Zooming - don't count as panning
  } else if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
    purePanOffset.x += deltaX;
    purePanOffset.y += deltaY;
    lastActivityTime = performance.now();
  }

  lastOffset = { x: currentOffset.x, y: currentOffset.y };
  lastZoom = currentZoom;
}

onMounted(() => {
  setupCanvas();
  window.addEventListener('resize', onResize);
  lastAnimationTime = 0;
  animationRafId = requestAnimationFrame(animationLoop);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  if (animationRafId !== null) {
    cancelAnimationFrame(animationRafId);
    animationRafId = null;
  }
});

watch(
  () => [props.offset.x, props.offset.y, props.zoom],
  () => {
    updatePurePan();
  }
);
</script>

<style scoped>
.parallax-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.parallax-layer {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  pointer-events: none;
}
</style>
