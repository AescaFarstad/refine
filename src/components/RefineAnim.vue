<template>
  <div class="refine-anim-container">
    <canvas 
      ref="canvas" 
      class="anim-canvas"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { Wafer } from '../logic/Wafer';
import { getCell } from '../logic/Wafer';
import type { Shard } from '../logic/GameState';
import { uiState, getGameState } from '../logic/UIState';
import { WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT, HEX_SIZE, ESSENCE_SIZE, eventToCanvasPixel } from '../logic/RefineUIBehaviour';
import { axialToPixel } from '../logic/HexMath';
import atlasStorage from '../logic/AtlasStorage';
import { getShardDisplay, calculateShardFontSize } from '../utils/ShardDisplay';
import { computeRefinePreviewChem } from '../logic/RefinePreview';

// Animation tuning constants (t is 0..1 over refiningDuration)
const T_DRAG_END = 0.2;
const SPEED_RATIO_AT_T_DRAG_END = 0.5; // speed should drop by half by t = 0.2
// Per-unit-t drag base so that v(T_DRAG_END) = SPEED_RATIO_AT_T_DRAG_END * v0
const DRAG_BASE_PER_T = Math.pow(SPEED_RATIO_AT_T_DRAG_END, 1 / T_DRAG_END);

const INITIAL_IMPULSE_SPEED_PER_HEX = 20; // px per unit t when distance is 1 hex
const INITIAL_IMPULSE_SAME_COLOR_MULT = 2;
const INITIAL_IMPULSE_RANDOMNESS = 0.15;

const CENTER_ACCEL_T_START = 0.2;
const CENTER_ACCEL_T_END = 1.0;
const CENTER_ACCEL_START = 19000;  // px per t^2 at t = 0.2
const CENTER_ACCEL_END = 190000;   // px per t^2 at t = 1.0
const CENTER_ACCEL_POWER = 1.5;

const PHYSICS_SUB_STEPS = 4;

const FLASH_DURATION_SEC = 1.25;
const FLASH_MAX_ALPHA = 0.7;
const FLASH_COLOR_SUCCESS = 'rgba(255, 255, 255, ';
const FLASH_COLOR_FAILURE = 'rgba(255, 50, 50, ';

const props = defineProps<{
  wafer: Wafer;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animFrameId: number = 0;

interface AnimAtom {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  effectiveCount: number; // buffed effective count used for impulse strength/mass
}

const atoms = ref<AnimAtom[]>([]);
const lastT = ref<number>(0);
const initialized = ref(false);

let flashTimeRemaining = 0;
let flashIsFailure = false;
let lastFrameTimestamp = 0;
let lastShardCountForFlash = 0;

const activeRefinery = computed(() => uiState.refinery);
const isRefining = computed(() => activeRefinery.value && activeRefinery.value.timeRemainingSec !== undefined && activeRefinery.value.timeRemainingSec > 0);

// Don't use computed for shards - read directly from GameState each frame

const origin = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };

// Track which shards have already spawned a flying animation
const animatedShardIds = new Set<string>();

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = WAFER_CANVAS_WIDTH;
    canvas.value.height = WAFER_CANVAS_HEIGHT;
    ctx = canvas.value.getContext('2d');
  }

  // Initialize atoms if refining
  if (isRefining.value) {
    initAtoms();
  }

  startAnim();
});

onUnmounted(() => {
  cancelAnimationFrame(animFrameId);
  const gs = getGameState();
  if (gs) {
    gs.waferMouseCoords = null;
  }
});

watch(isRefining, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    initAtoms();
  }
});

function initAtoms() {
  if (!props.wafer) return;
  const newAtoms: AnimAtom[] = [];

  const gs = getGameState()!;
  const preview = computeRefinePreviewChem(props.wafer, {
    signatures: gs.lib.signatures,
    signatureLevel: gs.signatureLevel,
    completedSignatureIds: gs.completedSignatureIds,
    discoveries: gs.discoveries,
    refinedUniqueItemIds: gs.refinedUniqueItemIds,
  });
  const cellEffectiveCounts = preview.cellEffectiveCounts || {};

  for (const item of props.wafer.items) {
    if (!item) continue;
    for (const atom of item.molecule.atoms) {
      const pixel = axialToPixel({ x: atom.x, y: atom.y }, HEX_SIZE, origin);
      const key = `${atom.x},${atom.y}`;
      const eff = cellEffectiveCounts[key];
      const effectiveCount = (typeof eff === 'number' && eff > 0) ? eff : 1;
      const cell = getCell(props.wafer, { x: atom.x, y: atom.y });
      const color = (cell && cell.effectiveEssence) || atom.color;
      newAtoms.push({
        x: pixel.x,
        y: pixel.y,
        vx: 0,
        vy: 0,
        color,
        effectiveCount,
      });
    }
  }
  atoms.value = newAtoms;
  lastT.value = getCurrentT();
  initialized.value = true;

  applyInitialImpulses();
}

function getCurrentT(): number {
  if (!activeRefinery.value) return 0;
  // Assuming progressPct is 0..100
  return (activeRefinery.value.progressPct || 0) / 100;
}

function applyInitialImpulses() {
  const distUnit = HEX_SIZE * Math.sqrt(3);

  for (let i = 0; i < atoms.value.length; i++) {
    const a = atoms.value[i];
    let vx = 0;
    let vy = 0;
    for (let j = 0; j < atoms.value.length; j++) {
      if (i === j) continue;
      const b = atoms.value[j];

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) continue;

      const colorFactor = (a.color === b.color) ? INITIAL_IMPULSE_SAME_COLOR_MULT : 1;
      const sourceStrength = b.effectiveCount || 1;
      const targetMass = a.effectiveCount || 1;
      const velMag = INITIAL_IMPULSE_SPEED_PER_HEX * (dist / distUnit) * colorFactor * (sourceStrength / targetMass);

      const nx = dx / dist;
      const ny = dy / dist;

      vx += nx * velMag;
      vy += ny * velMag;
    }
    const baseSpeed = Math.sqrt(vx * vx + vy * vy);
    if (baseSpeed > 0 && INITIAL_IMPULSE_RANDOMNESS > 0) {
      const randAngle = Math.random() * 2 * Math.PI;
      const randMag = baseSpeed * INITIAL_IMPULSE_RANDOMNESS;
      vx += Math.cos(randAngle) * randMag;
      vy += Math.sin(randAngle) * randMag;
    }
    a.vx = vx;
    a.vy = vy;
  }
}

function startAnim() {
  const loop = (timestamp: number) => {
    if (lastFrameTimestamp === 0) {
      lastFrameTimestamp = timestamp;
    }
    const deltaTimeSec = (timestamp - lastFrameTimestamp) / 1000;
    lastFrameTimestamp = timestamp;

    update(deltaTimeSec);
    draw();
    animFrameId = requestAnimationFrame(loop);
  };
  animFrameId = requestAnimationFrame(loop);
}

function update(deltaTimeSec: number) {
  if (flashTimeRemaining > 0 && deltaTimeSec > 0) {
    flashTimeRemaining = Math.max(0, flashTimeRemaining - deltaTimeSec);
  }

  if (isRefining.value && initialized.value) {
    const currentT = getCurrentT();
    const dt = currentT - lastT.value;

    if (dt > 0) {
      const subDt = dt / PHYSICS_SUB_STEPS;

      for (let step = 0; step < PHYSICS_SUB_STEPS; step++) {
        const stepT = lastT.value + subDt * (step + 1);

        for (const atom of atoms.value) {
          const dragFactor = Math.pow(DRAG_BASE_PER_T, subDt);
          atom.vx *= dragFactor;
          atom.vy *= dragFactor;

          if (stepT > CENTER_ACCEL_T_START) {
            const tRel = Math.min(
              1,
              Math.max(0, (stepT - CENTER_ACCEL_T_START) / (CENTER_ACCEL_T_END - CENTER_ACCEL_T_START)),
            );
            const accelMag = CENTER_ACCEL_START + (CENTER_ACCEL_END - CENTER_ACCEL_START) * Math.pow(tRel, CENTER_ACCEL_POWER);

            const dx = origin.x - atom.x;
            const dy = origin.y - atom.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              atom.vx += nx * accelMag * subDt;
              atom.vy += ny * accelMag * subDt;
            }
          }

          atom.x += atom.vx * subDt;
          atom.y += atom.vy * subDt;

          if (atom.x < 0 || atom.x > WAFER_CANVAS_WIDTH) {
            atom.vx *= -1;
            atom.x = Math.max(0, Math.min(WAFER_CANVAS_WIDTH, atom.x));
          }
          if (atom.y < 0 || atom.y > WAFER_CANVAS_HEIGHT) {
            atom.vy *= -1;
            atom.y = Math.max(0, Math.min(WAFER_CANVAS_HEIGHT, atom.y));
          }
        }
      }
    }
    lastT.value = currentT;
  }
  updateShardPickupAnimations();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT);

  const gs = getGameState();
  const gameShards = gs?.shards || [];
  const shardsToRender = gameShards.filter(s => s !== null && !s.triggered);
  const shardCount = shardsToRender.length;

  if (shardCount > 0 && lastShardCountForFlash === 0) {
    flashTimeRemaining = FLASH_DURATION_SEC;
    flashIsFailure = uiState.lastRefineryOutcome ? !uiState.lastRefineryOutcome.success : false;
    atoms.value = [];
    initialized.value = false;
  }
  lastShardCountForFlash = shardCount;

  if (isRefining.value) {
    const source = atlasStorage.getItemsSource();

    for (const atom of atoms.value) {
      const frame = atlasStorage.getItemsFrame(atom.color);
      if (source && frame) {
        ctx.drawImage(
          source,
          frame.x, frame.y, frame.w, frame.h,
          atom.x - ESSENCE_SIZE / 2, atom.y - ESSENCE_SIZE / 2, ESSENCE_SIZE, ESSENCE_SIZE
        );
      } else {
        ctx.fillStyle = atom.color;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, ESSENCE_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const shard of shardsToRender) {
    if (!shard) continue;
    drawShard(ctx, shard);
  }

  if (flashTimeRemaining > 0) {
    const alpha = FLASH_MAX_ALPHA * (flashTimeRemaining / FLASH_DURATION_SEC);
    ctx.save();
    const colorPrefix = flashIsFailure ? FLASH_COLOR_FAILURE : FLASH_COLOR_SUCCESS;
    ctx.fillStyle = `${colorPrefix}${alpha})`;
    ctx.fillRect(0, 0, WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT);
    ctx.restore();
  }
}

const ZONE_CRYSTAL_SHARD_SIZE = 32;

function drawShard(ctx: CanvasRenderingContext2D, shard: Shard) {
  const x = origin.x + shard.pos.x;
  const y = origin.y + shard.pos.y;
  const angle = shard.angle || 0;

  // For zone_crystal, draw the gear image instead of text
  if (shard.resource === 'zone_crystal') {
    const source = atlasStorage.getItemsSource();
    const frame = atlasStorage.getItemsFrame('quartz'); // zone_crystal uses 'quartz' image
    if (source && frame) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(
        source,
        frame.x, frame.y, frame.w, frame.h,
        -ZONE_CRYSTAL_SHARD_SIZE / 2, -ZONE_CRYSTAL_SHARD_SIZE / 2,
        ZONE_CRYSTAL_SHARD_SIZE, ZONE_CRYSTAL_SHARD_SIZE
      );
      ctx.restore();
    }
    return;
  }

  const { symbol, color } = getShardDisplay(shard.resource);
  const fontSize = calculateShardFontSize(shard.amount);

  const cacheKey = `${shard.resource}:${fontSize}`;
  const sprite = getShardSprite(cacheKey, symbol, color, fontSize);
  if (!sprite) return;

  const spriteW = sprite.width;
  const spriteH = sprite.height;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -spriteW / 2, -spriteH / 2);
  ctx.restore();
}

const shardSpriteCache = new Map<string, HTMLCanvasElement>();

function getShardSprite(
  key: string,
  symbol: string,
  color: string,
  fontSize: number,
): HTMLCanvasElement | null {
  const existing = shardSpriteCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.font = `bold ${fontSize}px sans-serif`;
  const metrics = ctx.measureText(symbol);
  const textWidth = metrics.width;
  const padding = 4;
  const width = Math.ceil(textWidth + padding * 2);
  const height = Math.ceil(fontSize + padding * 2);

  canvas.width = width;
  canvas.height = height;

  const ctx2 = canvas.getContext('2d');
  if (!ctx2) return null;

  ctx2.font = `bold ${fontSize}px sans-serif`;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillStyle = color;
  ctx2.fillText(symbol, width / 2, height / 2);

  shardSpriteCache.set(key, canvas);
  return canvas;
}

function onMouseMove(event: MouseEvent) {
  if (!canvas.value) return;
  const { x, y } = eventToCanvasPixel(event, canvas.value);
  // Update GameState with mouse position in shard/wafer space (0,0 = center)
  const gs = getGameState();
  if (gs) {
    gs.waferMouseCoords = {
      x: x - origin.x,
      y: y - origin.y,
    };
  }
}

function onMouseLeave() {
  const gs = getGameState();
  if (gs) {
    gs.waferMouseCoords = null;
  }
}

function updateShardPickupAnimations() {
  const gs = getGameState();
  const gameShards = gs?.shards || [];

  // Trigger flying animations for shards that have just been picked up (triggered in the model)
  for (const shard of gameShards) {
    if (!shard) continue;
    if (!shard.triggered) continue;
    if (animatedShardIds.has(shard.id)) continue;

    const x = origin.x + shard.pos.x;
    const y = origin.y + shard.pos.y;
    createFlyingShardAnimation(shard, x, y);
    animatedShardIds.add(shard.id);
  }

  const existingIds = new Set<string>();
  for (const shard of gameShards) {
    if (!shard) continue;
    existingIds.add(shard.id);
  }
  for (const id of Array.from(animatedShardIds)) {
    if (!existingIds.has(id)) {
      animatedShardIds.delete(id);
    }
  }
}

function createFlyingShardAnimation(shard: Shard, startX: number, startY: number) {
  if (!canvas.value) return;

  const canvasRect = canvas.value.getBoundingClientRect();
  const screenX = canvasRect.left + startX;
  const screenY = canvasRect.top + startY;

  const flyingEl = document.createElement('div');
  flyingEl.style.position = 'fixed';
  flyingEl.style.left = screenX + 'px';
  flyingEl.style.top = screenY + 'px';
  flyingEl.style.pointerEvents = 'none';
  flyingEl.style.zIndex = '10000';
  flyingEl.style.transition = 'left 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  // For zone_crystal, use an image sprite instead of text
  if (shard.resource === 'zone_crystal') {
    const source = atlasStorage.getItemsSource();
    const frame = atlasStorage.getItemsFrame('quartz');
    if (source && frame) {
      const spriteEl = document.createElement('div');
      spriteEl.style.width = ZONE_CRYSTAL_SHARD_SIZE + 'px';
      spriteEl.style.height = ZONE_CRYSTAL_SHARD_SIZE + 'px';
      spriteEl.style.backgroundImage = `url(${source.src})`;
      spriteEl.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
      spriteEl.style.backgroundSize = `${source.naturalWidth}px ${source.naturalHeight}px`;
      spriteEl.style.transform = 'translate(-50%, -50%)';
      flyingEl.appendChild(spriteEl);
    }
  } else {
    const { symbol, color } = getShardDisplay(shard.resource);
    const fontSize = calculateShardFontSize(shard.amount);
    flyingEl.style.fontSize = fontSize + 'px';
    flyingEl.style.fontWeight = 'bold';
    flyingEl.textContent = symbol;
    flyingEl.style.color = color;
  }

  document.body.appendChild(flyingEl);

  let targetX = window.innerWidth / 2;
  let targetY = 20;

  const targetEl = document.querySelector(`[data-resource-display="${shard.resource}"]`) as HTMLElement | null;
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    targetX = rect.left + rect.width / 2;
    targetY = rect.top + rect.height / 2;
  }

  setTimeout(() => {
    flyingEl.style.left = `${targetX}px`;
    flyingEl.style.top = `${targetY}px`;
  }, 10);

  setTimeout(() => {
    document.body.removeChild(flyingEl);
  }, 650);
}

</script>

<style scoped>
.refine-anim-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass through if needed? */
  /* But we need to catch hover for shards. */
  /* "The shards should be transparent to mouse events. But when user hovers over RefineAnim, we check which shards it intersects" */
  /* So we need pointer-events: auto? */
  /* "Placing items on wafer is impossible untill RefineAnim is removed" */
  /* So blocking clicks is fine/good. */
  pointer-events: auto;
  z-index: 100;
}

.anim-canvas {
  width: 100%;
  height: 100%;
}
</style>
