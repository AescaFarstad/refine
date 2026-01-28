
import { uiState, getGameState, type ShardPhysics } from './UIState';
import { globalInputQueue } from './Model';
import { CmdPickupShard } from './input/InputCommands';
import { distancePointToSegment } from './core/math';
import { WAFER_CANVAS_WIDTH, WAFER_CANVAS_HEIGHT } from './Const';
import { ESSENCE_SIZE } from './RenderConstants';
import atlasStorage from './AtlasStorage';
import { getShardDisplay, calculateShardFontSize } from '../utils/ShardDisplay';
import type { Shard } from './GameState';

// Shard physics constants
const SHARD_RADIUS_MULT = 1.2;
const SHARD_LAUNCH_SPEED = { x: 20, y: 100 };
const SHARD_MIN_OMEGA = 0.1;
const SHARD_MAX_OMEGA = 20;
const SHARD_OMEGA_POWER = 5;
const SHARD_OMEGA_TO_SPEED_K = 4;
const SHARD_OMEGA_TRANSFER_FRACTION = 0.5;
const SHARD_DRAG_STRENGTH_PER_SEC = 0.05;
const SHARD_ATTRACTION_RANGE_PX = 250;
const SHARD_BASE_GRAV_ACCEL = 180;
const SHARD_ATTRACTION_BASE_AMOUNT = 5;
const ZONE_CRYSTAL_SHARD_SIZE = 32;

const origin = { x: WAFER_CANVAS_WIDTH / 2, y: WAFER_CANVAS_HEIGHT / 2 };

// State
export let localMouseCoords: { x: number; y: number } | null = null;
let lastLocalMouseCoords: { x: number; y: number } | null = null;
const animatedShardIds = new Set<string>();
const shardSpriteCache = new Map<string, HTMLCanvasElement>();

export function updateMouseCoords(x: number, y: number) {
  localMouseCoords = {
    x: x - origin.x,
    y: y - origin.y,
  };
}

export function resetMouseCoords() {
  localMouseCoords = null;
  lastLocalMouseCoords = null;
}

// Initialize physics for a new shard (or re-initialize after save/load)
function initShardPhysics(_shard: Shard): ShardPhysics {
  const angle = Math.random() * Math.PI * 2;
  const speed = SHARD_LAUNCH_SPEED.x + Math.random() * (SHARD_LAUNCH_SPEED.y - SHARD_LAUNCH_SPEED.x);
  const speedNorm = (speed - SHARD_LAUNCH_SPEED.x) / (SHARD_LAUNCH_SPEED.y - SHARD_LAUNCH_SPEED.x || 1);
  const clampedSpeedNorm = Math.max(0, Math.min(1, speedNorm));
  const omegaBase = Math.random();
  const omegaBias = Math.pow(omegaBase, SHARD_OMEGA_POWER);
  const omegaT = clampedSpeedNorm + (1 - clampedSpeedNorm) * omegaBias;
  const omegaMagnitude = SHARD_MIN_OMEGA + (SHARD_MAX_OMEGA - SHARD_MIN_OMEGA) * omegaT;
  const omegaSign = Math.random() < 0.5 ? -1 : 1;
  const omega = omegaSign * omegaMagnitude;
  const initialAngle = Math.random() * Math.PI * 2;

  return {
    pos: { x: 0, y: 0 },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    angle: initialAngle,
    omega,
  };
}

// Ensure all shards have physics state, initialize missing ones
export function ensureShardPhysics() {
  const gs = getGameState();
  const gameShards = gs?.shards || [];
  const physicsMap = uiState.shardPhysics;

  // Initialize physics for new shards
  for (const shard of gameShards) {
    if (!shard) continue;
    if (!physicsMap.has(shard.id)) {
      physicsMap.set(shard.id, initShardPhysics(shard));
    }
  }

  // Clean up physics for shards that no longer exist
  const existingIds = new Set(gameShards.filter(s => s !== null).map(s => s!.id));
  for (const id of Array.from(physicsMap.keys())) {
    if (!existingIds.has(id)) {
      physicsMap.delete(id);
    }
  }
}

// Update shard physics simulation
export function updateShardPhysics(dt: number) {
  const gs = getGameState()!;

  const gameShards = gs.shards || [];
  const physicsMap = uiState.shardPhysics;

  const halfW = WAFER_CANVAS_WIDTH / 2;
  const halfH = WAFER_CANVAS_HEIGHT / 2;

  for (const shard of gameShards) {
    if (!shard) continue;
    if (shard.triggered) continue; // Stop physics for picked up shards

    const physics = physicsMap.get(shard.id);
    if (!physics) continue;

    // Attraction towards mouse when hovering wafer
    if (localMouseCoords) {
      const dxMouse = localMouseCoords.x - physics.pos.x;
      const dyMouse = localMouseCoords.y - physics.pos.y;
      const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

      if (distMouse > 0.0001 && distMouse < SHARD_ATTRACTION_RANGE_PX) {
        const rangeT = 1 - (distMouse / SHARD_ATTRACTION_RANGE_PX);
        const falloff = Math.max(0, rangeT);

        let resourceFactor = 1;
        if (shard.resource === 'chronotraces') {
          resourceFactor = 0.66;
        } else if (shard.resource === 'timeFlux') {
          resourceFactor = 0.33;
        }

        const sizeFactor = SHARD_ATTRACTION_BASE_AMOUNT / Math.max(1, shard.amount);
        const gravAccel = SHARD_BASE_GRAV_ACCEL * resourceFactor * falloff * sizeFactor;
        const nx = dxMouse / distMouse;
        const ny = dyMouse / distMouse;
        physics.vel.x += nx * gravAccel * dt;
        physics.vel.y += ny * gravAccel * dt;
      }
    }

    // Apply drag
    if (SHARD_DRAG_STRENGTH_PER_SEC > 0 && dt > 0) {
      const drag = Math.exp(-SHARD_DRAG_STRENGTH_PER_SEC * dt);
      physics.vel.x *= drag;
      physics.vel.y *= drag;
      physics.omega *= drag;
    }

    // Update position and angle
    physics.pos.x += physics.vel.x * dt;
    physics.pos.y += physics.vel.y * dt;
    physics.angle += physics.omega * dt;

    const margin = shard.size * 0.5;

    // Bounce off walls with omega transfer
    if (physics.pos.x < -halfW + margin) {
      physics.pos.x = -halfW + margin;
      physics.vel.x *= -1;
      const omegaMag = Math.abs(physics.omega);
      if (omegaMag > 0) {
        const omegaSign = physics.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        physics.vel.y += omegaSign * deltaSpeed;
        physics.omega -= omegaSign * transferredOmega;
      }
    } else if (physics.pos.x > halfW - margin) {
      physics.pos.x = halfW - margin;
      physics.vel.x *= -1;
      const omegaMag = Math.abs(physics.omega);
      if (omegaMag > 0) {
        const omegaSign = physics.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        physics.vel.y += omegaSign * deltaSpeed;
        physics.omega -= omegaSign * transferredOmega;
        physics.omega -= omegaSign * transferredOmega;
      }
    }

    if (physics.pos.y < -halfH + margin) {
      physics.pos.y = -halfH + margin;
      physics.vel.y *= -1;
      const omegaMag = Math.abs(physics.omega);
      if (omegaMag > 0) {
        const omegaSign = physics.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        physics.vel.x += omegaSign * deltaSpeed;
        physics.omega -= omegaSign * transferredOmega;
      }
    } else if (physics.pos.y > halfH - margin) {
      physics.pos.y = halfH - margin;
      physics.vel.y *= -1;
      const omegaMag = Math.abs(physics.omega);
      if (omegaMag > 0) {
        const omegaSign = physics.omega > 0 ? 1 : -1;
        const transferredOmega = omegaMag * SHARD_OMEGA_TRANSFER_FRACTION;
        const deltaSpeed = transferredOmega * SHARD_OMEGA_TO_SPEED_K;
        physics.vel.x += omegaSign * deltaSpeed;
        physics.omega -= omegaSign * transferredOmega;
      }
    }
  }
}

export function checkShardPickups() {
  if (!localMouseCoords) {
    lastLocalMouseCoords = null;
    return;
  }

  const gs = getGameState();
  if (!gs || gs.shardPickupGraceSec > 0) {
    lastLocalMouseCoords = { ...localMouseCoords };
    return;
  }

  const gameShards = gs.shards || [];
  const physicsMap = uiState.shardPhysics;

  for (const shard of gameShards) {
    if (!shard || shard.triggered) continue;

    const physics = physicsMap.get(shard.id);
    if (!physics) continue;

    const pickupRadius = shard.size * SHARD_RADIUS_MULT;

    const dx = localMouseCoords.x - physics.pos.x;
    const dy = localMouseCoords.y - physics.pos.y;
    const distMouse = Math.sqrt(dx * dx + dy * dy);

    let pickupDistance = distMouse;
    if (lastLocalMouseCoords) {
      pickupDistance = distancePointToSegment(
        physics.pos,
        lastLocalMouseCoords,
        localMouseCoords,
      );
    }

    if (pickupDistance < pickupRadius) {
      globalInputQueue.push(new CmdPickupShard({ shardId: shard.id }));
    }
  }

  lastLocalMouseCoords = { ...localMouseCoords };
}

export function updateShardPickupAnimations(canvas: HTMLCanvasElement) {
  const gs = getGameState();
  const gameShards = gs?.shards || [];
  const physicsMap = uiState.shardPhysics;

  // Trigger flying animations for shards that have just been picked up (triggered in the model)
  for (const shard of gameShards) {
    if (!shard) continue;
    if (!shard.triggered) continue;
    if (animatedShardIds.has(shard.id)) continue;

    const physics = physicsMap.get(shard.id);
    const posX = physics ? physics.pos.x : 0;
    const posY = physics ? physics.pos.y : 0;
    const x = origin.x + posX;
    const y = origin.y + posY;
    createFlyingShardAnimation(shard, x, y, canvas);
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

function createFlyingShardAnimation(shard: Shard, startX: number, startY: number, canvas: HTMLCanvasElement) {
  const canvasRect = canvas.getBoundingClientRect();
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

export function drawShard(ctx: CanvasRenderingContext2D, shard: Shard) {
  const physics = uiState.shardPhysics.get(shard.id);
  if (!physics) return; // No physics state yet, skip rendering

  const x = origin.x + physics.pos.x;
  const y = origin.y + physics.pos.y;
  const angle = physics.angle || 0;

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
