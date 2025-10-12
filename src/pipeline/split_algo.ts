import { spawn } from 'node:child_process';

const DEBUG_ENABLED = false;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Internal: run a command and capture binary stdout
async function runCmdBuffer(bin: string, args: string[]): Promise<{ code: number; stdout: Uint8Array; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    const chunks: Buffer[] = [];
    let stderr = '';
    p.stdout.on('data', (d: Buffer) => chunks.push(d));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? 0, stdout: Buffer.concat(chunks), stderr }));
    p.on('error', (err) => reject(err));
  });
}

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

function isTransparent(alpha: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return alpha[idx(x, y, w)] === 0;
}

function colTransparentIn(alpha: Uint8Array, w: number, _h: number, x: number, y0: number, y1: number): boolean {
  for (let y = y0; y <= y1; y++) {
    if (!isTransparent(alpha, w, _h, x, y)) return false;
  }
  return true;
}

function rowTransparentIn(alpha: Uint8Array, w: number, h: number, y: number, x0: number, x1: number): boolean {
  for (let x = x0; x <= x1; x++) {
    if (!isTransparent(alpha, w, h, x, y)) return false;
  }
  return true;
}

function* zigzag(rangeMin: number, rangeMax: number, start: number): Generator<number> {
  // Yields start, start-1, start+1, start-2, start+2, ... while within [rangeMin, rangeMax]
  yield start;
  for (let d = 1; ; d++) {
    const left = start - d;
    const right = start + d;
    let yielded = false;
    if (left >= rangeMin) {
      yield left;
      yielded = true;
    }
    if (right <= rangeMax) {
      yield right;
      yielded = true;
    }
    if (!yielded) break;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isDebugEnabled(): boolean {
  // const v = process.env.DEBUG_SPLIT || '';
  // return /^(1|true|yes|on)$/i.test(v);
  return DEBUG_ENABLED;
}

function firstNonTransparentInRow(
  alpha: Uint8Array,
  w: number,
  h: number,
  y: number,
  x0: number,
  x1: number,
): { x: number; a: number } | null {
  for (let x = x0; x <= x1; x++) {
    const a = alpha[idx(x, y, w)];
    if (a !== 0) return { x, a };
  }
  return null;
}

function firstNonTransparentInCol(
  alpha: Uint8Array,
  w: number,
  h: number,
  x: number,
  y0: number,
  y1: number,
): { y: number; a: number } | null {
  for (let y = y0; y <= y1; y++) {
    const a = alpha[idx(x, y, w)];
    if (a !== 0) return { y, a };
  }
  return null;
}

function summarizeAlpha(alpha: Uint8Array, w: number, h: number): string[] {
  const lines: string[] = [];
  let zeros = 0;
  let minNZ = 255;
  let maxA = 0;
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i];
    if (a === 0) zeros++;
    else if (a < minNZ) minNZ = a;
    if (a > maxA) maxA = a;
  }
  const pct = ((zeros / alpha.length) * 100).toFixed(2);
  lines.push(`alpha summary: zero=${zeros}/${alpha.length} (${pct}%), min_nonzero=${minNZ === 255 ? 'n/a' : minNZ}, max=${maxA}`);

  // Count fully transparent rows/cols (global info)
  let fullyRows = 0;
  let fullyCols = 0;
  for (let y = 0; y < h; y++) {
    if (rowTransparentIn(alpha, w, h, y, 0, w - 1)) fullyRows++;
  }
  for (let x = 0; x < w; x++) {
    if (colTransparentIn(alpha, w, h, x, 0, h - 1)) fullyCols++;
  }
  lines.push(`alpha global: fully_transparent_rows=${fullyRows}, fully_transparent_cols=${fullyCols}`);
  return lines;
}

async function identifyInfo(input: string): Promise<string | null> {
  try {
    const res = await runCmdBuffer('identify', ['-format', '%m %wx%h %[channels] %[opaque]', input]);
    if (res.code === 0) return res.stdout.toString();
    return res.stderr || null;
  } catch {
    return null;
  }
}

async function readAlphaMap(input: string, width: number, height: number): Promise<Uint8Array> {
  // Use ImageMagick to extract the alpha channel as 8-bit grayscale raw bytes
  const args = [input, '-alpha', 'extract', '-depth', '8', 'gray:-'];
  const res = await runCmdBuffer('convert', args);
  if (res.code !== 0) throw new Error(`convert alpha extract failed: ${res.stderr}`);
  if (res.stdout.length !== width * height) {
    throw new Error(`alpha size mismatch: got ${res.stdout.length}, expected ${width * height}`);
  }
  return new Uint8Array(res.stdout);
}

function growCentralBox(alpha: Uint8Array, w: number, h: number, cx: number, cy: number): { x0: number; y0: number; x1: number; y1: number } {
  if (!isTransparent(alpha, w, h, cx, cy)) {
    const a = alpha[idx(cx, cy, w)];
    if (isDebugEnabled()) {
      console.error(`[split_algo] center not transparent at (${cx},${cy}), alpha=${a}`);
    }
    throw new Error('Center pixel is not transparent');
  }
  let x0 = cx;
  let x1 = cx;
  let y0 = cy;
  let y1 = cy;

  while (true) {
    let grew = false;
    if (x0 > 0 && colTransparentIn(alpha, w, h, x0 - 1, y0, y1)) {
      x0--;
      grew = true;
    }
    if (x1 < w - 1 && colTransparentIn(alpha, w, h, x1 + 1, y0, y1)) {
      x1++;
      grew = true;
    }
    if (y0 > 0 && rowTransparentIn(alpha, w, h, y0 - 1, x0, x1)) {
      y0--;
      grew = true;
    }
    if (y1 < h - 1 && rowTransparentIn(alpha, w, h, y1 + 1, x0, x1)) {
      y1++;
      grew = true;
    }
    if (!grew) break;
  }
  return { x0, y0, x1, y1 };
}

function findConnectingColumnFromTop(alpha: Uint8Array, w: number, h: number, midX: number, xMin: number, xMax: number, y0: number): number {
  const start = clamp(midX, xMin, xMax);
  for (const x of zigzag(xMin, xMax, start)) {
    if (colTransparentIn(alpha, w, h, x, 0, y0)) return x;
  }
  if (isDebugEnabled()) {
    console.error(`[split_algo] No transparent column from top -> box. x-range=[${xMin},${xMax}] start=${start} y0=${y0}`);
    const maxProbe = Math.min(20, xMax - xMin + 1);
    let probed = 0;
    for (const x of zigzag(xMin, xMax, start)) {
      const first = firstNonTransparentInCol(alpha, w, h, x, 0, y0);
      if (first) {
        console.error(`  x=${x}: first non-transparent at y=${first.y}, a=${first.a}`);
      } else {
        console.error(`  x=${x}: fully transparent (unexpected; should have been caught)`);
      }
      if (++probed >= maxProbe) break;
    }
  }
  throw new Error('No transparent column from top to central box');
}

function findConnectingColumnFromBottom(alpha: Uint8Array, w: number, h: number, midX: number, xMin: number, xMax: number, y1: number): number {
  const start = clamp(midX, xMin, xMax);
  for (const x of zigzag(xMin, xMax, start)) {
    if (colTransparentIn(alpha, w, h, x, y1, h - 1)) return x;
  }
  if (isDebugEnabled()) {
    console.error(`[split_algo] No transparent column from bottom -> box. x-range=[${xMin},${xMax}] start=${start} y1=${y1}`);
    const maxProbe = Math.min(20, xMax - xMin + 1);
    let probed = 0;
    for (const x of zigzag(xMin, xMax, start)) {
      const first = firstNonTransparentInCol(alpha, w, h, x, y1, h - 1);
      if (first) {
        console.error(`  x=${x}: first non-transparent at y=${first.y}, a=${first.a}`);
      } else {
        console.error(`  x=${x}: fully transparent (unexpected; should have been caught)`);
      }
      if (++probed >= maxProbe) break;
    }
  }
  throw new Error('No transparent column from bottom to central box');
}

function findConnectingRowFromLeft(alpha: Uint8Array, w: number, h: number, midY: number, yMin: number, yMax: number, x0: number): number {
  const start = clamp(midY, yMin, yMax);
  for (const y of zigzag(yMin, yMax, start)) {
    if (rowTransparentIn(alpha, w, h, y, 0, x0)) return y;
  }
  if (isDebugEnabled()) {
    console.error(`[split_algo] No transparent row from left -> box. y-range=[${yMin},${yMax}] start=${start} x0=${x0}`);
    const maxProbe = Math.min(20, yMax - yMin + 1);
    let probed = 0;
    for (const y of zigzag(yMin, yMax, start)) {
      const first = firstNonTransparentInRow(alpha, w, h, y, 0, x0);
      if (first) {
        console.error(`  y=${y}: first non-transparent at x=${first.x}, a=${first.a}`);
      } else {
        console.error(`  y=${y}: fully transparent (unexpected; should have been caught)`);
      }
      if (++probed >= maxProbe) break;
    }
  }
  throw new Error('No transparent row from left to central box');
}

function findConnectingRowFromRight(alpha: Uint8Array, w: number, h: number, midY: number, yMin: number, yMax: number, x1: number): number {
  const start = clamp(midY, yMin, yMax);
  for (const y of zigzag(yMin, yMax, start)) {
    if (rowTransparentIn(alpha, w, h, y, x1, w - 1)) return y;
  }
  if (isDebugEnabled()) {
    console.error(`[split_algo] No transparent row from right -> box. y-range=[${yMin},${yMax}] start=${start} x1=${x1}`);
    const maxProbe = Math.min(20, yMax - yMin + 1);
    let probed = 0;
    for (const y of zigzag(yMin, yMax, start)) {
      const first = firstNonTransparentInRow(alpha, w, h, y, x1, w - 1);
      if (first) {
        console.error(`  y=${y}: first non-transparent at x=${first.x}, a=${first.a}`);
      } else {
        console.error(`  y=${y}: fully transparent (unexpected; should have been caught)`);
      }
      if (++probed >= maxProbe) break;
    }
  }
  throw new Error('No transparent row from right to central box');
}

// Main entry: split into 4 rectangles using center-transparent gutters
export async function getSplitRects(inputPath: string, width: number, height: number, _count: number): Promise<Rect[]> {
  const alpha = await readAlphaMap(inputPath, width, height);
  if (isDebugEnabled()) {
    console.error(`[split_algo] processing: ${inputPath} (${width}x${height})`);
    for (const line of summarizeAlpha(alpha, width, height)) console.error(`[split_algo] ${line}`);
    const id = await identifyInfo(inputPath);
    if (id) console.error(`[split_algo] identify: ${id}`);
  }

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  const box = growCentralBox(alpha, width, height, cx, cy);
  if (isDebugEnabled()) {
    console.error(`[split_algo] central box: x=[${box.x0},${box.x1}] y=[${box.y0},${box.y1}]`);
  }

  // Find connecting gutters from each side, restricted to the central box projection
  const topColX = findConnectingColumnFromTop(alpha, width, height, cx, box.x0, box.x1, box.y0);
  const bottomColX = findConnectingColumnFromBottom(alpha, width, height, cx, box.x0, box.x1, box.y1);
  const leftRowY = findConnectingRowFromLeft(alpha, width, height, cy, box.y0, box.y1, box.x0);
  const rightRowY = findConnectingRowFromRight(alpha, width, height, cy, box.y0, box.y1, box.x1);

  // Include split rows/columns in the rectangles (as requested)
  const rects: Rect[] = [
    // Top-Left: x:[0..topColX], y:[0..leftRowY]
    { x: 0, y: 0, width: topColX + 1, height: leftRowY + 1 },
    // Top-Right: x:[topColX..w-1], y:[0..rightRowY]
    { x: topColX, y: 0, width: width - topColX, height: rightRowY + 1 },
    // Bottom-Left: x:[0..bottomColX], y:[leftRowY..h-1]
    { x: 0, y: leftRowY, width: bottomColX + 1, height: height - leftRowY },
    // Bottom-Right: x:[bottomColX..w-1], y:[rightRowY..h-1]
    { x: bottomColX, y: rightRowY, width: width - bottomColX, height: height - rightRowY },
  ];

  // Ensure non-zero rectangles (width/height > 0) — they should be by construction
  for (const r of rects) {
    if (r.width <= 0 || r.height <= 0) {
      throw new Error('Computed zero-sized rectangle');
    }
  }

  return rects;
}

// Legacy simple split retained for potential fallback/manual testing
export function split2x2(width: number, height: number): Rect[] {
  const w1 = Math.floor(width / 2);
  const w2 = width - w1;
  const h1 = Math.floor(height / 2);
  const h2 = height - h1;

  return [
    { x: 0, y: 0, width: w1, height: h1 },
    { x: w1, y: 0, width: w2, height: h1 },
    { x: 0, y: h1, width: w1, height: h2 },
    { x: w1, y: h1, width: w2, height: h2 },
  ];
}
