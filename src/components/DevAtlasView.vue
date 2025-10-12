<template>
  <div class="atlas-root" ref="rootEl" @click="emitClose">
    <canvas ref="baseCanvasEl" class="canvas base"></canvas>
    <canvas ref="overlayCanvasEl" class="canvas overlay"></canvas>
    <div v-if="hover && hover.frame" class="hint" :style="hintStyle">
      <div class="hint-name">{{ hover.name }}</div>
      <div class="hint-xywh">x: {{ hover.frame.x }}, y: {{ hover.frame.y }}, w: {{ hover.frame.w }}, h: {{ hover.frame.h }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import atlasStorage, { type AtlasKey } from '../logic/AtlasStorage';

const props = defineProps<{ atlas: AtlasKey }>();

const rootEl = ref<HTMLElement | null>(null);
const baseCanvasEl = ref<HTMLCanvasElement | null>(null);
const overlayCanvasEl = ref<HTMLCanvasElement | null>(null);
const naturalW = ref(0);
const naturalH = ref(0);
const drawW = ref(0);
const drawH = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
// Base image scale derived from natural image size
const scale = ref(1);
// Overlay scale derived from JSON frames extents
const scaleX = ref(1);
const scaleY = ref(1);
const dpr = Math.max(1, window.devicePixelRatio || 1);

type HoverInfo = { name: string; frame: { x: number; y: number; w: number; h: number } } | null;
const hover = ref<HoverInfo>(null);

const hintStyle = computed(() => {
  if (!hover.value) return { display: 'none' } as Record<string, string>;
  const f = hover.value.frame;
  const cx = offsetX.value + f.x * scaleX.value + f.w * scaleX.value + 8;
  const cy = offsetY.value + f.y * scaleY.value;
  const el = overlayCanvasEl.value;
  const cw = el ? el.clientWidth : 0;
  const ch = el ? el.clientHeight : 0;
  let left = cx;
  let top = cy;
  const pad = 8;
  // simple bounds clamp
  if (left + 220 > cw) left = Math.max(pad, cw - 220);
  if (top + 60 > ch) top = Math.max(pad, ch - 60);
  return { left: `${left}px`, top: `${top}px` };
});

async function ensureLoaded() {
  switch (props.atlas) {
    case 'items':
      await atlasStorage.loadItemsAtlas();
      break;
  }
}

function layoutAndDrawBase() {
  const root = rootEl.value;
  const base = baseCanvasEl.value;
  const overlay = overlayCanvasEl.value;
  if (!root || !base || !overlay) return;

  const img = atlasStorage.getSource(props.atlas);
  if (!img) return;

  naturalW.value = img.naturalWidth;
  naturalH.value = img.naturalHeight;

  const cw = root.clientWidth;
  const ch = root.clientHeight;

  for (const c of [base, overlay]) {
    c.width = Math.max(1, Math.floor(cw * dpr));
    c.height = Math.max(1, Math.floor(ch * dpr));
    c.style.width = cw + 'px';
    c.style.height = ch + 'px';
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
    }
  }

  const s = Math.min(cw / Math.max(1, naturalW.value), ch / Math.max(1, naturalH.value));
  scale.value = s;
  drawW.value = naturalW.value * s;
  drawH.value = naturalH.value * s;
  offsetX.value = Math.floor((cw - drawW.value) / 2);
  offsetY.value = Math.floor((ch - drawH.value) / 2);

  // Prefer atlas meta (exact dimensions used for composition);
  // fall back to computing extents from frames
  const meta = atlasStorage.getMeta(props.atlas);
  if (meta && meta.w > 0 && meta.h > 0) {
    scaleX.value = drawW.value / meta.w;
    scaleY.value = drawH.value / meta.h;
  } else {
    const frames = atlasStorage.getFrames(props.atlas);
    if (frames && frames.size > 0) {
      let jsonW = 0;
      let jsonH = 0;
      for (const [, f] of frames) {
        jsonW = Math.max(jsonW, f.x + f.w);
        jsonH = Math.max(jsonH, f.y + f.h);
      }
      const safeJsonW = Math.max(1e-6, jsonW);
      const safeJsonH = Math.max(1e-6, jsonH);
      scaleX.value = drawW.value / safeJsonW;
      scaleY.value = drawH.value / safeJsonH;
    } else {
      scaleX.value = scale.value;
      scaleY.value = scale.value;
    }
  }

  const bctx = base.getContext('2d');
  if (!bctx) return;
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(img, offsetX.value, offsetY.value, drawW.value, drawH.value);

  drawOverlay();
}

function drawOverlay() {
  const root = rootEl.value;
  const overlay = overlayCanvasEl.value;
  if (!root || !overlay) return;
  const cw = root.clientWidth;
  const ch = root.clientHeight;
  const ctx = overlay.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  if (hover.value) {
    const f = hover.value.frame;
    ctx.save();
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.strokeRect(
      Math.floor(offsetX.value + f.x * scaleX.value) + 0.5,
      Math.floor(offsetY.value + f.y * scaleY.value) + 0.5,
      Math.floor(f.w * scaleX.value),
      Math.floor(f.h * scaleY.value)
    );
    ctx.restore();
  }
}

function onMove(ev: MouseEvent) {
  const canvas = overlayCanvasEl.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;

  // Check if inside drawn image area first
  if (
    mx < offsetX.value || my < offsetY.value ||
    mx > offsetX.value + drawW.value || my > offsetY.value + drawH.value
  ) {
    if (hover.value) {
      hover.value = null;
      drawOverlay();
    }
    return;
  }

  const ix = (mx - offsetX.value) / Math.max(1e-6, scaleX.value);
  const iy = (my - offsetY.value) / Math.max(1e-6, scaleY.value);

  // Find frame containing point
  const frames = atlasStorage.getFrames(props.atlas);
  let found: HoverInfo = null;
  if (frames) {
    for (const [name, f] of frames) {
      if (ix >= f.x && iy >= f.y && ix < f.x + f.w && iy < f.y + f.h) {
        found = { name, frame: f };
        break;
      }
    }
  }
  const prev = hover.value && hover.value.name;
  const next = found && found.name;
  hover.value = found;
  if (prev !== next) drawOverlay();
}

function onLeave() {
  if (hover.value) {
    hover.value = null;
    drawOverlay();
  }
}

function onResize() { layoutAndDrawBase(); }

function emitClose() {
  // also reset hover for cleanliness
  hover.value = null;
  // signal parent
  // emit declared via defineEmits below
  emit('close');
}

const emit = defineEmits<{ (e: 'close'): void }>();

onMounted(async () => {
  // ensure atlas loaded then draw
  await ensureLoaded();
  const overlay = overlayCanvasEl.value;
  if (!overlay) return;
  overlay.addEventListener('mousemove', onMove);
  overlay.addEventListener('mouseleave', onLeave);
  window.addEventListener('resize', onResize);
  layoutAndDrawBase();
});

onBeforeUnmount(() => {
  const overlay = overlayCanvasEl.value;
  if (overlay) {
    overlay.removeEventListener('mousemove', onMove);
    overlay.removeEventListener('mouseleave', onLeave);
  }
  window.removeEventListener('resize', onResize);
});

watch(() => props.atlas, async () => {
  hover.value = null;
  await ensureLoaded();
  layoutAndDrawBase();
});
</script>

<style scoped>
.atlas-root { position: relative; width: 100%; height: 100%; overflow: hidden; }
.canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.canvas.base { z-index: 0; pointer-events: none; }
.canvas.overlay { z-index: 1; pointer-events: auto; cursor: crosshair; }
.hint {
  position: absolute;
  min-width: 200px;
  max-width: 280px;
  background: rgba(20, 28, 40, 0.98);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 var(--panel-shine);
  padding: 6px 8px;
  font-size: 12px;
  pointer-events: none;
  z-index: 2;
}
.hint-name { font-weight: 800; color: var(--accent); margin-bottom: 4px; }
.hint-xywh { color: var(--text-secondary); }
</style>
