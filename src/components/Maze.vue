<template>
  <div class="lab-root panel" ref="rootEl">
    <div class="topbar">
      <div class="title">Ice Maze — {{ levelTitle }}</div>
      <div class="stats">
        <span>Time flux remains: {{ movesLeft }}∿</span>
        <span v-if="totalKeys > 0" class="arrows-of-time">
          <span class="arrows-label">Arrows of time:</span>
          <span class="arrows">
            <svg
              v-for="(taken, i) in arrowSlots"
              :key="i"
              class="arrow-icon"
              viewBox="0 0 20 20"
              :width="arrowIconSize"
              :height="arrowIconSize"
              aria-hidden="true"
            >
              <path
                :d="arrowPathD"
                :fill="taken ? '#fcd34d' : 'transparent'"
                :stroke="taken ? 'none' : '#fcd34d'"
                :stroke-width="taken ? 0 : 2"
              />
            </svg>
          </span>
        </span>
        <span v-if="failed" class="bad">Caught!</span>
        <span v-else-if="solved" class="good">Transcended!</span>
      </div>
      <div class="actions">
        <button class="btn" @click="restart()">Restart</button>
        <button class="btn" @click="reset()">Reset</button>
      </div>
    </div>
    <div class="canvas-container">
      <canvas ref="staticCanvasEl" class="canvas canvas-static"></canvas>
      <canvas ref="dynamicCanvasEl" class="canvas canvas-dynamic"></canvas>
    </div>
    <div class="hint">Use WASD to move. R to reset.</div>
  </div>
  
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdMazeMove, CmdMazeReset, CmdMazeRestart } from '../logic/input/InputCommands';
import type { MazeDefinition } from '../logic/MazeLib';
import type { Point2 } from '../logic/core/math';

const rootEl = ref<HTMLElement | null>(null);
const staticCanvasEl = ref<HTMLCanvasElement | null>(null);
const dynamicCanvasEl = ref<HTMLCanvasElement | null>(null);

const dpr = Math.max(1, window.devicePixelRatio || 1);

// Track when static canvas needs redraw
let needsStaticRedraw = true;

// Track visual key state for change detection
let lastVisualKeyState: string = '';

function getLevels(): Array<MazeDefinition> { return getGameLib()?.mazeLevels || []; }
const levelIndex = computed(() => uiState.mazeLevelIndex);
const levelTitle = computed(() => {
  const lv = getLevels()[levelIndex.value];
  return (lv && lv.name) || `Level ${levelIndex.value + 1}`;
});

const movesMade = computed(() => uiState.mazeMovesMade);
const maxMoves = computed(() => uiState.mazeMaxMoves);
const movesLeft = computed(() => Math.max(0, (uiState.mazeMaxMoves || 0) - (uiState.mazeMovesMade || 0)));
const keysCollected = computed(() => uiState.mazeKeysCollected);
const totalKeys = computed(() => uiState.mazeTotalKeys);
const failed = computed(() => uiState.mazeFailed);
const solved = computed(() => uiState.mazeSolved);

const artefactsTaken = computed(() => {
  const game = getGameState()?.maze;
  return game?.state?.artefacts?.filter((a: any) => a.taken).length || 0;
});

// Top bar visual representation of keys (updates when visualTakenKeys change)
const topBarVisualKeys = ref<boolean[]>([]);
const arrowIconSize = 18;
// Upward arrow path (head + shaft), styled to resemble maze arrows
const arrowPathD = 'M 7.5 18 L 7.5 10 L 4 10 L 10 2 L 16 10 L 12.5 10 L 12.5 18 Z';
const arrowSlots = computed(() => {
  const count = Math.max(0, totalKeys.value || 0);
  const vis = topBarVisualKeys.value || [];
  const out: boolean[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = !!vis[i];
  return out;
});

// Watch for changes that require static redraw
watch(levelIndex, () => {
  needsStaticRedraw = true;
  lastVisualKeyState = ''; // Force recheck when level changes
  topBarVisualKeys.value = [];
});

let rafId = 0;

function onKeydown(ev: KeyboardEvent) {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const target = ev.target as HTMLElement | null;
  const tag = (target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

  const code = ev.code || '';
  if (!code) return;

  const game = getGameState()?.maze || null;
  if (!game) return;

  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      globalInputQueue.push(new CmdMazeMove('up')); break;
    case 'KeyA':
    case 'ArrowLeft':
      globalInputQueue.push(new CmdMazeMove('left')); break;
    case 'KeyS':
    case 'ArrowDown':
      globalInputQueue.push(new CmdMazeMove('down')); break;
    case 'KeyD':
    case 'ArrowRight':
      globalInputQueue.push(new CmdMazeMove('right')); break;
    case 'KeyR':
      globalInputQueue.push(new CmdMazeReset()); break;
  }

  // prevent accidental page scroll in some contexts when relevant
  if (
    code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ||
    code === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowDown' || code === 'ArrowRight'
  ) {
    ev.preventDefault();
  }
}

function reset() {
  globalInputQueue.push(new CmdMazeReset());
  needsStaticRedraw = true;
  lastVisualKeyState = ''; // Force recheck of visual state
}

function restart() {
  globalInputQueue.push(new CmdMazeRestart());
  needsStaticRedraw = true;
  lastVisualKeyState = ''; // Force recheck of visual state
}

// No nextLevel() here — handled by Model when solved

function layoutCanvas() {
  const root = rootEl.value;
  const staticCanvas = staticCanvasEl.value;
  const dynamicCanvas = dynamicCanvasEl.value;
  if (!root || !staticCanvas || !dynamicCanvas) return;

  const cw = Math.max(1, root.clientWidth);
  const ch = Math.max(300, root.clientHeight - 52); // reserve a bit for topbar

  // Set both canvases to same size
  for (const canvas of [staticCanvas, dynamicCanvas]) {
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
  }
  
  needsStaticRedraw = true;
}

function getBoardMetrics(game: any, w: number, h: number) {
  const cols = game.dimensions.x;
  const rows = game.dimensions.y;
  const pad = 12;
  const tile = Math.floor(Math.max(1, Math.min((w - pad * 2) / cols, (h - pad * 2) / rows)));
  const boardW = tile * cols;
  const boardH = tile * rows;
  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor((h - boardH) / 2);
  return { cols, rows, tile, boardW, boardH, ox, oy };
}

function drawStatic() {
  const canvas = staticCanvasEl.value;
  const game = getGameState()?.maze || null;
  if (!canvas || !game) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = Math.floor(canvas.width / dpr);
  const h = Math.floor(canvas.height / dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { cols, rows, tile, boardW, boardH, ox, oy } = getBoardMetrics(game, w, h);

  // Background
  ctx.save();
  ctx.fillStyle = 'rgba(14, 20, 32, 0.95)';
  ctx.fillRect(ox - 6, oy - 6, boardW + 12, boardH + 12);
  ctx.restore();

  // Draw cells
  const cells = game.state.cells;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const c = cells[x][y];
      const px = ox + x * tile;
      const py = oy + y * tile;
      if (c.isObstacle) {
        ctx.fillStyle = '#0b1320';
      } else {
        ctx.fillStyle = '#172235';
      }
      ctx.fillRect(px, py, tile, tile);
    }
  }

  // Grid lines
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    const gx = ox + x * tile + 0.5;
    ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + boardH); ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    const gy = oy + y * tile + 0.5;
    ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + boardW, gy); ctx.stroke();
  }
  ctx.restore();

  // Keys — draw an arrow on an adjacent obstacle cell,
  // pointing from the key cell toward that obstacle.
  for (let i = 0; i < game.state.keys.length; i++) {
    if (game.visualTakenKeys[i]) continue;
    const k = game.state.keys[i] as Point2;

    // Find an adjacent obstacle (priority: up, right, down, left)
    const dirs = [
      { dx: 0, dy: -1, angle: -Math.PI / 2 }, // up
      { dx: 1, dy: 0, angle: 0 },              // right
      { dx: 0, dy: 1, angle: Math.PI / 2 },    // down
      { dx: -1, dy: 0, angle: Math.PI },       // left
    ];

    let obsX = -1, obsY = -1, angle = 0;
    for (const d of dirs) {
      const nx = k.x + d.dx;
      const ny = k.y + d.dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        if (cells[nx][ny]?.isObstacle) {
          obsX = nx; obsY = ny; angle = d.angle; break;
        }
      }
    }

    // If no adjacent obstacle was found (should not happen), fallback to a small dot on key.
    if (obsX === -1 || obsY === -1) {
      const cx = ox + (k.x + 0.5) * tile;
      const cy = oy + (k.y + 0.5) * tile;
      const r = Math.max(3, Math.floor(tile * 0.18));
      ctx.save();
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }

    // Draw arrow inside obstacle tile at (obsX, obsY), oriented toward that tile.
    const opx = ox + obsX * tile;
    const opy = oy + obsY * tile;

    // Arrow geometry: wider head, shorter leg; tail starts slightly outside entry edge
    // Coordinates are relative to tile center, arrow points along +X before rotation
    const outside = Math.max(2, tile * 0.18);       // tail extends outside obstacle
    const innerMargin = Math.max(2, tile * 0.40);   // keep tip inside far edge
    const tipX = tile / 2 - innerMargin;            // tip near far edge inside tile
    const tailX = -tile / 2 - outside;              // start outside entry edge
    const L = tipX - tailX;                         // total arrow length

    // Make the shaft wider and the head longer (shorter leg)
    const shaftW = Math.max(3, tile * 0.3);
    const headLen = Math.min(Math.max(L * 0.6, tile * 0.3), L * 0.8);
    const shaftLen = Math.max(2, L - headLen);
    const headBaseW = Math.min(tile * 0.6, Math.max(shaftW * 2.1, tile * 0.4));

    const shaftEndX = tailX + shaftLen;

    ctx.save();
    ctx.translate(opx + tile / 2, opy + tile / 2);
    ctx.rotate(angle);
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    // shaft
    ctx.moveTo(tailX, -shaftW / 2);
    ctx.lineTo(shaftEndX, -shaftW / 2);
    // transition to head
    ctx.lineTo(shaftEndX, -headBaseW / 2);
    // head tip
    ctx.lineTo(tipX, 0);
    // other side of head
    ctx.lineTo(shaftEndX, headBaseW / 2);
    // back to shaft
    ctx.lineTo(shaftEndX, shaftW / 2);
    ctx.lineTo(tailX, shaftW / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Artefacts
  for (const a of game.state.artefacts) {
    if (a.taken) continue;
    const cx = ox + (a.cell.x + 0.5) * tile;
    const cy = oy + (a.cell.y + 0.5) * tile;
    const r = Math.max(3, Math.floor(tile * 0.18));
    ctx.save();
    // type: 0 BOMB, 1 EYE, 2 FREEZE
    const col = a.type === 0 ? '#ef4444' : a.type === 1 ? '#60a5fa' : '#34d399';
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.rect(cx - r, cy - r, 2 * r, 2 * r); ctx.fill();
    ctx.restore();
  }
}

function drawDynamic() {
  const canvas = dynamicCanvasEl.value;
  const game = getGameState()?.maze || null;
  if (!canvas || !game) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = Math.floor(canvas.width / dpr);
  const h = Math.floor(canvas.height / dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { tile, ox, oy } = getBoardMetrics(game, w, h);

  // Demons (use visual positions)
  for (const d of game.state.demons) {
    const pos = game.demonVisualPos.get(d) || d.cell;
    const cx = ox + (pos.x + 0.5) * tile;
    const cy = oy + (pos.y + 0.5) * tile;
    const r = Math.max(4, Math.floor(tile * 0.26));
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Player (use visual position)
  const p = game.playerVisualPos;
  const cx = ox + (p.x + 0.5) * tile;
  const cy = oy + (p.y + 0.5) * tile;
  const r = Math.max(5, Math.floor(tile * 0.3));
  ctx.save();
  ctx.fillStyle = '#34d399';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function frameLoop(ts: number) {
  ensureInit();
  
  const game = getGameState()?.maze;
  if (!game) {
    rafId = requestAnimationFrame(frameLoop);
    return;
  }
  
  // Check if visual key state or artifacts have changed
  // (these change asynchronously after animations, so watchers won't catch them)
  const currentVisualKeyState = game.visualTakenKeys.join(',') + '|' + 
    game.state.artefacts.map((a: any) => a.taken ? '1' : '0').join('');
  
  if (currentVisualKeyState !== lastVisualKeyState) {
    needsStaticRedraw = true;
    lastVisualKeyState = currentVisualKeyState;
    topBarVisualKeys.value = game.visualTakenKeys.slice();
  }
  
  // Draw static canvas only when needed
  if (needsStaticRedraw) {
    drawStatic();
    needsStaticRedraw = false;
  }
  
  // Always draw dynamic canvas (player and demons)
  drawDynamic();
  
  rafId = requestAnimationFrame(frameLoop);
}

function ensureInit() {
  // Model handles initialization; nothing to do here
}

onMounted(() => {
  ensureInit();
  needsStaticRedraw = true; // Force initial draw
  
  // Initialize visual key state tracking
  const game = getGameState()?.maze;
  if (game) {
    lastVisualKeyState = game.visualTakenKeys.join(',') + '|' + 
      game.state.artefacts.map((a: any) => a.taken ? '1' : '0').join('');
    topBarVisualKeys.value = game.visualTakenKeys.slice();
  }
  
  layoutCanvas();
  window.addEventListener('resize', layoutCanvas);
  window.addEventListener('keydown', onKeydown);
  rafId = requestAnimationFrame(frameLoop);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', layoutCanvas);
  window.removeEventListener('keydown', onKeydown);
});

</script>

<style scoped>
.lab-root { display: flex; flex-direction: column; gap: 8px; min-height: 420px; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { font-weight: 700; letter-spacing: 0.03em; color: var(--accent); }
.stats { display: flex; gap: 12px; font-size: 13px; color: var(--text-secondary); }
.stats .arrows-of-time { display: inline-flex; align-items: center; gap: 6px; }
.stats .arrows { display: inline-flex; align-items: center; gap: 6px; }
.stats .arrow-icon { display: inline-block; }
.stats .good { color: #34d399; font-weight: 700; }
.stats .bad { color: #ef4444; font-weight: 700; }
.actions { display: flex; gap: 8px; }
.btn { background: rgba(80, 120, 160, 0.15); border: 1px solid var(--panel-border); color: var(--text-primary); border-radius: 4px; padding: 6px 10px; cursor: pointer; }
.btn:hover { background: rgba(80, 120, 160, 0.25); }
.canvas-container { position: relative; flex: 1; min-height: 300px; }
.canvas { width: 100%; height: 100%; display: block; border-radius: 6px; position: absolute; top: 0; left: 0; }
.canvas-static { z-index: 1; }
.canvas-dynamic { z-index: 2; }
.hint { font-size: 12px; color: var(--text-secondary); }
</style>
