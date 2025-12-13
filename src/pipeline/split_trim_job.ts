import { mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PipelineJob, PipelineItem } from './pipeline_parse.ts';
import { getSplitRects } from './split_algo.ts';

// Tolerance for alpha channel when determining if a neighbor pixel is effectively transparent (0-255).
// Islands themselves are detected using anything that is not 100% transparent (alpha > 0),
// but neighbors are considered transparent if their alpha is <= this value.
// Tolerance for alpha channel when determining if a neighbor pixel is effectively transparent (0-255).
const TRANSPARENCY_TOLERANCE = 10;

// Edge cleaning constants
const EDGE_SELF_LIMIT = 100; // Pixel must be <= this to be considered for removal
const EDGE_AREA_LIMIT = 300; // Sum of 3x3 alpha must be < this to remove

async function runCmd(bin: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
    p.on('error', (err) => reject(err));
  });
}

async function identifySize(file: string): Promise<{ width: number; height: number }> {
  const res = await runCmd('identify', ['-format', '%w %h', file]);
  if (res.code !== 0) throw new Error(`identify failed: ${res.stderr || res.stdout}`);
  const [w, h] = res.stdout.trim().split(/\s+/).map((v) => parseInt(v, 10));
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error(`identify parse error: ${res.stdout}`);
  return { width: w, height: h };
}

async function convertCropTrimResize(
  input: string,
  outFile: string,
  x: number,
  y: number,
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): Promise<void> {
  const args = [
    input,
    '-crop',
    `${w}x${h}+${x}+${y}`,
    '+repage',
    '-bordercolor',
    'none',
    '-trim',
    '+repage',
    '-resize',
    `${maxW}x${maxH}`,
    outFile,
  ];


  const res = await runCmd('convert', args);
  if (res.code !== 0) throw new Error(`convert failed: ${res.stderr || res.stdout}`);
}

async function erodeIsolatedPixels(file: string): Promise<void> {
  // Detect tiny alpha islands (connected components of alpha > 0 with area 1–4)
  // and erase them if all of their neighbors are effectively transparent
  // (alpha <= TRANSPARENCY_TOLERANCE). Islands themselves use alpha > 0 as the
  // criterion, as requested.

  const alphaRes = await runCmd('convert', [
    file,
    '-alpha',
    'extract',
    '-depth',
    '8',
    'txt:-',
  ]);
  if (alphaRes.code !== 0) throw new Error(`erode isolated pixels (read alpha) failed: ${alphaRes.stderr || alphaRes.stdout}`);

  const lines = alphaRes.stdout.split(/\r?\n/);
  let width = 0;
  let height = 0;

  for (const line of lines) {
    const m = line.match(/^#\s*ImageMagick pixel enumeration:\s*(\d+),(\d+),/);
    if (m) {
      width = parseInt(m[1], 10);
      height = parseInt(m[2], 10);
      break;
    }
  }

  if (!width || !height) {
    throw new Error('erode isolated pixels: failed to parse image size from alpha map');
  }

  const size = width * height;
  const alpha = new Uint8Array(size);

  for (const line of lines) {
    const m = line.match(/^\s*(\d+),(\d+):.*gray\(([\d.]+)\)/);
    if (!m) continue;
    const x = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    const gray = parseFloat(m[3]); // 0-255
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    alpha[y * width + x] = gray;
  }

  const visited = new Uint8Array(size);
  const toDrop: number[] = [];

  const neighborOffsets: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      neighborOffsets.push([dx, dy]);
    }
  }

  for (let i = 0; i < size; i++) {
    if (visited[i] || alpha[i] === 0) continue;

    // BFS to collect a connected component (8-neighborhood).
    const queue: number[] = [i];
    visited[i] = 1;
    const component: number[] = [];

    while (queue.length) {
      const idx = queue.pop() as number;
      component.push(idx);
      const x = idx % width;
      const y = (idx / width) | 0;

      for (const [dx, dy] of neighborOffsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx] || alpha[nIdx] === 0) continue;
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }

    // Only consider tiny islands up to 6 pixels (e.g. 2x3 or 3x2).
    if (component.length === 0 || component.length > 6) continue;

    let shouldDrop = true;

    // Check neighbors around the component; if any neighbor outside it has
    // alpha > TRANSPARENCY_TOLERANCE, we keep the island.
    for (let ci = 0; ci < component.length && shouldDrop; ci++) {
      const idx = component[ci];
      const x = idx % width;
      const y = (idx / width) | 0;

      for (const [dx, dy] of neighborOffsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;

        // Skip pixels that are part of the island itself.
        let isInComponent = false;
        for (let cj = 0; cj < component.length; cj++) {
          if (component[cj] === nIdx) {
            isInComponent = true;
            break;
          }
        }
        if (isInComponent) continue;

        const a = alpha[nIdx];
        if (a > TRANSPARENCY_TOLERANCE) {
          shouldDrop = false;
          break;
        }
      }
    }

    if (shouldDrop) {
      for (const idx of component) {
        toDrop.push(idx);
      }
    }
  }

  // --- Edge Cleaning Pass ---
  // Pixels that are surrounded by mostly transparent pixels and which are mostly transparent themselves
  // should be made 100% transparent.

  // Create a working alpha array that reflects the island removals
  const workingAlpha = new Uint8Array(alpha);
  for (const idx of toDrop) {
    workingAlpha[idx] = 0;
  }

  for (let i = 0; i < size; i++) {
    // Skip if already fully transparent or removed
    if (workingAlpha[i] === 0) continue;

    // Skip if the pixel itself is too opaque (protected)
    if (workingAlpha[i] > EDGE_SELF_LIMIT) continue;

    const x = i % width;
    const y = (i / width) | 0;

    let sum = 0;

    // Calculate 3x3 sum
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          // Out of bounds counts as 0 alpha
          continue;
        }

        const nIdx = ny * width + nx;
        sum += workingAlpha[nIdx];
      }
    }

    if (sum < EDGE_AREA_LIMIT) {
      toDrop.push(i);
    }
  }

  if (!toDrop.length) return;

  // Apply the erosion by zeroing alpha for all pixels in the collected islands.
  // Apply the erosion using a mask approach to ensure full transparency.
  // 1. Clone input
  // 2. Extract alpha channel (White=Opaque, Black=Transparent)
  // 3. Draw black points (force transparency)
  // 4. Compose using CopyOpacity
  const args: string[] = [file, '(', '+clone', '-alpha', 'extract', '-fill', 'black'];

  for (const idx of toDrop) {
    const x = idx % width;
    const y = (idx / width) | 0;
    args.push('-draw', `point ${x},${y}`);
  }

  args.push(')', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', file);

  const res = await runCmd('convert', args);
  if (res.code !== 0) throw new Error(`erode isolated pixels failed: ${res.stderr || res.stdout}`);
}

function parseSize(sizeStr: string | undefined): { maxW: number; maxH: number } {

  if (!sizeStr) return { maxW: 96, maxH: 96 };
  const m = sizeStr.trim().match(/^(\d+)(?:x(\d+))?$/i);
  if (!m) return { maxW: 96, maxH: 96 };
  const w = parseInt(m[1], 10);
  const h = m[2] ? parseInt(m[2], 10) : w;
  return { maxW: w, maxH: h };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveInputPath(baseDir: string, folder: string, name: string): Promise<string> {
  // Single path: do not guess extensions
  return path.join(baseDir, folder, name);
}

function contentTokens(item: PipelineItem): string[] {
  const raw = (item.content || '').trim();
  if (!raw) return [];
  return raw.split(/\s+/g);
}

export async function runSplitTrimJob(job: PipelineJob, baseDir: string): Promise<void> {
  const inputFolder = job.settings.input_folder || 'source';
  const outputFolder = job.settings.output_folder || 'split';
  const { maxW, maxH } = parseSize(job.settings.size);

  const outDir = path.join(baseDir, outputFolder);
  await mkdir(outDir, { recursive: true });

  for (const item of job.items) {
    const imageName = item.image?.trim();
    if (!imageName) {
      // skip items without image
      continue;
    }
    const tokens = contentTokens(item);



    const inPath = await resolveInputPath(baseDir, inputFolder, imageName);
    if (!(await fileExists(inPath))) {
      console.warn(`split_trim: input not found, skipping: ${inPath}`);
      continue;
    }

    try {
      // Create a temporary eroded version of the input for processing
      const tempPath = path.join(outDir, `__temp_${path.basename(inPath)}`);
      // Copy to temp and erode before splitting
      const copyArgs = [inPath, tempPath];
      const copyRes = await runCmd('convert', copyArgs);
      if (copyRes.code !== 0) throw new Error(`temp copy failed: ${copyRes.stderr || copyRes.stdout}`);

      // No longer eroding the temp path before splitting
      // await erodeIsolatedPixels(tempPath);

      const { width, height } = await identifySize(inPath);
      // Use inPath for splitting calculation instead of tempPath (since we aren't eroding temp anymore)
      // Actually, getSplitRects might rely on the image content. 
      // If the user wants to split based on the ORIGINAL image but clean the RESULT, we should use inPath here.
      // However, if the "noise" affects splitting, we might still want to clean before splitting.
      // The user said: "this step should be performed on the resulting trimmed and split individual images."
      // So we will NOT clean before splitting.
      const rects = await getSplitRects(inPath, width, height, tokens.length || 4);

      const baseOut = path.parse(imageName).name;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (tokens[i] === '_') continue;
        const label = tokens[i] ? slugify(tokens[i]) : `${baseOut}_${i + 1}`;
        const outName = `${label}.png`;
        const outPath = path.join(outDir, outName);

        await convertCropTrimResize(inPath, outPath, r.x, r.y, r.width, r.height, maxW, maxH);

        // Apply erosion and second trim to the output file
        await erodeIsolatedPixels(outPath);

        // Second trim after erosion
        const trimRes = await runCmd('convert', [outPath, '-trim', '+repage', outPath]);
        if (trimRes.code !== 0) throw new Error(`second trim failed: ${trimRes.stderr || trimRes.stdout}`);
      }

      // Clean up temp file
      await runCmd('rm', [tempPath]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`split_trim: error processing ${inPath}: ${msg}`);
      // On error, print additional identify info to diagnose alpha/channel issues
      try {
        const id = await runCmd('identify', ['-format', '%m %wx%h %[channels] %[opaque]', inPath]);
        if (id.code === 0) {
          console.error(`split_trim: identify => ${id.stdout.trim()}`);
        } else if (id.stderr || id.stdout) {
          console.error(`split_trim: identify error => ${(id.stderr || id.stdout).trim()}`);
        }
      } catch (e) {
        // ignore secondary failure
      }
      continue;
    }
  }
}
