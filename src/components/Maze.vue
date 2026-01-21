<template>
  <div class="lab-root panel" ref="rootEl">
    <div v-if="!hasMazeNavigation" class="maze-locked">
      <div class="locked-text">This is the Maze of Time.</div>
      <div class="locked-text">You will have to navigate it to return home.</div>
      <div class="locked-text">Yet there seems to be no entrance.</div>
    </div>
    <div v-else class="maze-layout">
      <div class="left-panel">
        <div class="left-section">
          <div class="reward-label">Completion grants:</div>
          <div v-if="rewardsText" class="reward-value">{{ rewardsText }}</div>
          <div v-else class="reward-value dim">No reward</div>
        </div>
        <div class="left-section">
          <button class="btn btn-large" @click="restart()">Restart</button>
          <button class="btn btn-large" @click="reset()">Reset</button>
        </div>
        <div class="left-section info-section">
          <div class="info-text">Resetting and restarting returns the time flux spent.</div>
          <div class="info-text">Beating the maze consumes ALL remaining time flux.</div>
          <div class="info-text">Use WASD or click to move. R to reset.</div>
          <div v-if="moveError" class="info-text error">{{ moveError }}</div>
        </div>
      </div>
      <div class="main-area">
        <div class="canvas-container">
          <div class="topbar" ref="topbarEl">
            <div class="stats">
              <span>{{ timeFluxSpec.name }} remains: {{ timeFluxRemaining }}{{ timeFluxSpec.glyph }}</span>
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
            </div>
          </div>
          <canvas ref="staticCanvasEl" class="canvas canvas-static"></canvas>
          <canvas ref="dynamicCanvasEl" class="canvas canvas-dynamic"></canvas>
          <div v-if="solved" class="overlay-message solved-overlay">Transcended!</div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed, watch } from 'vue';
import { getGameLib, getGameState, uiState } from '../logic/UIState';
import { globalInputQueue } from '../logic/Model';
import { CmdMazeMove, CmdMazeReset, CmdMazeRestart } from '../logic/input/InputCommands';
import type { MazeDefinition } from '../logic/MazeLib';
import type { Point2 } from '../logic/core/math';
import { getResourceSpec } from '../logic/Resources';
import { DISCOVERY } from '../logic/DiscoveryLib';

const rootEl = ref<HTMLElement | null>(null);
const staticCanvasEl = ref<HTMLCanvasElement | null>(null);
const dynamicCanvasEl = ref<HTMLCanvasElement | null>(null);
const topbarEl = ref<HTMLElement | null>(null);

const dpr = Math.max(1, window.devicePixelRatio || 1);

// Mouse hover state for move preview
let hoverCell: { x: number; y: number } | null = null;

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

const timeFluxRemaining = computed(() => Math.max(0, Math.floor(uiState.timeFlux || 0)));
const keysCollected = computed(() => uiState.mazeKeysCollected);
const totalKeys = computed(() => uiState.mazeTotalKeys);
const failed = computed(() => uiState.mazeFailed);
const solved = computed(() => uiState.mazeSolved);

const timeFluxSpec = getResourceSpec('timeFlux');
const moveError = ref('');

const hasMazeNavigation = computed(() => {
  const _dep = uiState.discoveryCounter;
  return getGameState()?.discoveries?.[DISCOVERY.MAZE_NAVIGATION] === true;
});

const artefactsTaken = computed(() => {
  const game = getGameState()?.maze;
  return game?.state?.artefacts?.filter((a: any) => a.taken).length || 0;
});

const rewardsText = computed(() => {
  const lv = getLevels()[levelIndex.value];
  if (!lv || !lv.reward || !Array.isArray(lv.reward)) return '';
  const lib = getGameLib();
  return lv.reward
    .map(r => {
      if (r.kind === 'resource') {
        const spec = getResourceSpec(r.resource);
        return `${r.amount}${spec.glyph}`;
      }
      if (r.kind === 'unlock_raid') {
        const raidDef = lib?.raids.get(r.raidId);
        const raidName = raidDef?.name || r.raidId;
        return `New raid location: ${raidName}`;
      }
      return '';
    })
    .filter(s => s.length > 0)
    .join(' ');
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

function screenToCell(clientX: number, clientY: number): { x: number; y: number } | null {
  const canvas = dynamicCanvasEl.value;
  const game = getGameState()?.maze;
  if (!canvas || !game) return null;

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const w = Math.floor(canvas.width / dpr);
  const h = Math.floor(canvas.height / dpr);
  const { cols, rows, tile, ox, oy } = getBoardMetrics(game, w, h);

  const cellX = Math.floor((x - ox) / tile);
  const cellY = Math.floor((y - oy) / tile);

  if (cellX < 0 || cellX >= cols || cellY < 0 || cellY >= rows) return null;
  return { x: cellX, y: cellY };
}

function getHoverMovePreview(game: any, mouseCell: { x: number; y: number }): {
  direction: Point2;
  endCell: Point2;
  isValid: boolean;
} | null {
  const playerCell = game.state.player.cell;

  // Determine direction based on which axis aligns with player
  let direction: Point2 | null = null;

  if (mouseCell.x === playerCell.x && mouseCell.y !== playerCell.y) {
    // Same column - vertical move
    direction = { x: 0, y: mouseCell.y > playerCell.y ? 1 : -1 };
  } else if (mouseCell.y === playerCell.y && mouseCell.x !== playerCell.x) {
    // Same row - horizontal move
    direction = { x: mouseCell.x > playerCell.x ? 1 : -1, y: 0 };
  }

  if (!direction) return null;

  // Check if there's an obstacle immediately adjacent (invalid move)
  const adjacentX = playerCell.x + direction.x;
  const adjacentY = playerCell.y + direction.y;
  const cells = game.state.cells;

  if (adjacentX < 0 || adjacentX >= game.dimensions.x ||
      adjacentY < 0 || adjacentY >= game.dimensions.y ||
      cells[adjacentX][adjacentY]?.isObstacle) {
    // Invalid move - obstacle right next to player
    return { direction, endCell: playerCell, isValid: false };
  }

  // Compute slide destination (slide until hitting obstacle or edge)
  let endX = playerCell.x;
  let endY = playerCell.y;

  while (true) {
    const nextX = endX + direction.x;
    const nextY = endY + direction.y;

    if (nextX < 0 || nextX >= game.dimensions.x ||
        nextY < 0 || nextY >= game.dimensions.y ||
        cells[nextX][nextY]?.isObstacle) {
      break;
    }
    endX = nextX;
    endY = nextY;
  }

  return { direction, endCell: { x: endX, y: endY }, isValid: true };
}

function onCanvasMouseMove(ev: MouseEvent) {
  hoverCell = screenToCell(ev.clientX, ev.clientY);
}

function onCanvasMouseLeave() {
  hoverCell = null;
}

function onCanvasClick(ev: MouseEvent) {
  const cell = screenToCell(ev.clientX, ev.clientY);
  if (!cell) return;

  const game = getGameState()?.maze;
  if (!game) return;

  const preview = getHoverMovePreview(game, cell);
  if (!preview) return;

  // Trigger move in that direction (just like WASD)
  const dir = preview.direction;
  if (dir.x === -1) globalInputQueue.push(new CmdMazeMove('left'));
  else if (dir.x === 1) globalInputQueue.push(new CmdMazeMove('right'));
  else if (dir.y === -1) globalInputQueue.push(new CmdMazeMove('up'));
  else if (dir.y === 1) globalInputQueue.push(new CmdMazeMove('down'));
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

const TOPBAR_HEIGHT = 40;

function getBoardMetrics(game: any, w: number, h: number) {
  const cols = game.dimensions.x;
  const rows = game.dimensions.y;
  const pad = 12;
  const availH = h - TOPBAR_HEIGHT; // Reserve space for topbar
  const tile = Math.floor(Math.max(1, Math.min((w - pad * 2) / cols, (availH - pad * 2) / rows)));
  const boardW = tile * cols;
  const boardH = tile * rows;
  const ox = Math.floor((w - boardW) / 2);
  const oy = TOPBAR_HEIGHT + Math.floor((availH - boardH) / 2);
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

  // Time flux invested into cells (spent once per cell)
  const tf = game.cellTimeFlux;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = timeFluxSpec.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.max(10, Math.floor(tile * 0.55));
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace`;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (cells[x]![y]!.isObstacle) continue;
      if (!tf[x]![y]) continue;
      const cx = ox + (x + 0.5) * tile;
      const cy = oy + (y + 0.5) * tile;
      ctx.fillText(timeFluxSpec.glyph, cx, cy);
    }
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

  // Draw move preview if hovering over a valid cell
  if (hoverCell && !game.isAnimating()) {
    const preview = getHoverMovePreview(game, hoverCell);
    if (preview) {
      const playerCell = game.state.player.cell;
      const startX = ox + (playerCell.x + 0.5) * tile;
      const startY = oy + (playerCell.y + 0.5) * tile;

      // For invalid moves, draw line 1 cell in the blocked direction
      let endX: number, endY: number;
      if (preview.isValid) {
        endX = ox + (preview.endCell.x + 0.5) * tile;
        endY = oy + (preview.endCell.y + 0.5) * tile;
      } else {
        endX = ox + (playerCell.x + preview.direction.x + 0.5) * tile;
        endY = oy + (playerCell.y + preview.direction.y + 0.5) * tile;
      }

      const color = preview.isValid ? '#34d399' : '#ef4444';
      const lineWidth = Math.max(2, tile * 0.08);
      const circleRadius = Math.max(4, tile * 0.15);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      // Draw line from player to end cell
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw circle at end if valid move
      if (preview.isValid) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(endX, endY, circleRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

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

  moveError.value = game.lastMoveError || '';

  // Check if visual key state or artifacts have changed
  // (these change asynchronously after animations, so watchers won't catch them)
  const currentVisualKeyState = game.visualTakenKeys.join(',') + '|' + 
    game.state.artefacts.map((a: any) => a.taken ? '1' : '0').join('') + '|' +
    (game.cellTimeFluxVersion || 0);

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

  // Position topbar to align with board
  const canvas = staticCanvasEl.value;
  const topbar = topbarEl.value;
  if (canvas && topbar) {
    const w = Math.floor(canvas.width / dpr);
    const h = Math.floor(canvas.height / dpr);
    const { boardW, ox } = getBoardMetrics(game, w, h);
    topbar.style.left = ox + 'px';
    topbar.style.width = boardW + 'px';
  }

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
      game.state.artefacts.map((a: any) => a.taken ? '1' : '0').join('') + '|' +
      (game.cellTimeFluxVersion || 0);
    topBarVisualKeys.value = game.visualTakenKeys.slice();
  }

  layoutCanvas();
  window.addEventListener('resize', layoutCanvas);
  window.addEventListener('keydown', onKeydown);

  // Mouse controls for move preview and click-to-move
  const dynCanvas = dynamicCanvasEl.value;
  if (dynCanvas) {
    dynCanvas.addEventListener('mousemove', onCanvasMouseMove);
    dynCanvas.addEventListener('mouseleave', onCanvasMouseLeave);
    dynCanvas.addEventListener('click', onCanvasClick);
  }

  rafId = requestAnimationFrame(frameLoop);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', layoutCanvas);
  window.removeEventListener('keydown', onKeydown);

  const dynCanvas = dynamicCanvasEl.value;
  if (dynCanvas) {
    dynCanvas.removeEventListener('mousemove', onCanvasMouseMove);
    dynCanvas.removeEventListener('mouseleave', onCanvasMouseLeave);
    dynCanvas.removeEventListener('click', onCanvasClick);
  }
});

</script>

<style scoped>
.lab-root { display: flex; flex-direction: column; height: 100%; max-height: 800px; }
.maze-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 24px;
}
.locked-text {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
}
.maze-layout { display: flex; gap: 16px; flex: 1; min-height: 0; }
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 320px;
  flex-shrink: 0;
  padding: 8px 0;
}
.left-section { display: flex; flex-direction: column; gap: 10px; }
.reward-label { font-size: 18px; color: var(--text-secondary); }
.reward-value {
  font-size: 28px;
  font-weight: 700;
  color: #fbbf24;
}
.reward-value.dim { color: var(--text-secondary); font-size: 18px; }
.info-text {
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}
.info-text.error { color: #ef4444; font-weight: 700; }
.main-area { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.topbar { position: absolute; top: 0; z-index: 3; text-align: center; }
.stats { display: inline-flex; align-items: center; gap: 16px; font-size: 28px; color: var(--text-secondary); }
.stats .arrows-of-time { display: inline-flex; align-items: center; gap: 8px; }
.stats .arrows { display: inline-flex; align-items: center; gap: 4px; }
.stats .arrow-icon { display: inline-block; }
.stats .good { color: #34d399; font-weight: 700; }
.stats .bad { color: #ef4444; font-weight: 700; }
.btn {
  background: rgba(80, 120, 160, 0.15);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
}
.btn:hover { background: rgba(80, 120, 160, 0.25); }
.btn-large {
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  width: 100%;
}
.canvas-container { position: relative; flex: 1; min-height: 300px; max-height: 720px; width: 100%; }
.canvas { width: 100%; height: 100%; display: block; position: absolute; top: 0; left: 0; }
.canvas-static { z-index: 1; }
.canvas-dynamic { z-index: 2; }
.overlay-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  font-size: 48px;
  font-weight: 700;
  padding: 16px 32px;
  border-radius: 8px;
  text-align: center;
  pointer-events: none;
}
.solved-overlay {
  color: #34d399;
  background: rgba(14, 20, 32, 0.9);
  border: 2px solid #34d399;
  text-shadow: 0 0 20px rgba(52, 211, 153, 0.5);
}
</style>
