import { spawn } from 'node:child_process';
import path from 'node:path';

// Hardcoded paths as requested
const INPUT_FILE = '/mnt/WoB/WOB/web_rep/refine/data/img/split/rucksack.png';
const OUTPUT_DIR = '/mnt/WoB/WOB/web_rep/refine/data/img';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'rucksack_cleaned.png');

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

async function erodeIsolatedPixels(inputFile: string, outputFile: string): Promise<void> {
  console.log(`Processing ${inputFile}...`);

  // 1. Read alpha channel
  console.log('Reading alpha channel...');
  const alphaRes = await runCmd('convert', [
    inputFile,
    '-alpha',
    'extract',
    '-depth',
    '8',
    'txt:-',
  ]);
  if (alphaRes.code !== 0) throw new Error(`read alpha failed: ${alphaRes.stderr || alphaRes.stdout}`);

  const lines = alphaRes.stdout.split(/\r?\n/);
  let width = 0;
  let height = 0;

  // Parse header
  for (const line of lines) {
    const m = line.match(/^#\s*ImageMagick pixel enumeration:\s*(\d+),(\d+),/);
    if (m) {
      width = parseInt(m[1], 10);
      height = parseInt(m[2], 10);
      break;
    }
  }

  if (!width || !height) {
    throw new Error('failed to parse image size from alpha map');
  }
  console.log(`Image dimensions: ${width}x${height}`);

  const size = width * height;
  const alpha = new Uint8Array(size);

  // Parse pixels
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

  let islandsFound = 0;
  let islandsRemoved = 0;

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

    islandsFound++;
    let shouldDrop = true;

    // Check neighbors around the component
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
          // console.log(`Island at ${x},${y} kept due to neighbor at ${nx},${ny} with alpha ${a}`);
          break;
        }
      }
    }

    if (shouldDrop) {
      islandsRemoved++;
      console.log(`Removing island of size ${component.length} at ${component[0] % width},${(component[0] / width) | 0}`);
      for (const idx of component) {
        toDrop.push(idx);
      }
    }
  }

  console.log(`Found ${islandsFound} small islands (<= 6 pixels).`);
  console.log(`Marked ${islandsRemoved} islands for removal.`);

  // --- Edge Cleaning Pass ---
  // Pixels that are surrounded by mostly transparent pixels and which are mostly transparent themselves
  // should be made 100% transparent.

  let edgesRemoved = 0;

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
      edgesRemoved++;
      // Note: we don't update workingAlpha here, so the decision is based on the state after island removal
      // but independent of other edge removals in this pass (parallel update).
    }
  }

  console.log(`Marked ${edgesRemoved} edge pixels for removal.`);

  if (!toDrop.length) {
    console.log('No pixels to erode. Copying input to output.');
    await runCmd('cp', [inputFile, outputFile]);
    return;
  }

  // Apply the erosion
  console.log('Applying erosion...');
  // Use mask approach:
  // 1. Clone input
  // 2. Extract alpha channel (White=Opaque, Black=Transparent)
  // 3. Draw black points (force transparency)
  // 4. Compose using CopyOpacity

  const drawArgs: string[] = [inputFile, '(', '+clone', '-alpha', 'extract', '-fill', 'black'];

  if (toDrop.length > 1000) {
    console.warn('Warning: Many points to drop, command might be too long.');
  }

  for (const idx of toDrop) {
    const x = idx % width;
    const y = (idx / width) | 0;
    drawArgs.push('-draw', `point ${x},${y}`);
  }

  drawArgs.push(')', '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', outputFile);

  const res = await runCmd('convert', drawArgs);
  if (res.code !== 0) throw new Error(`erode failed: ${res.stderr || res.stdout}`);

  console.log(`Saved cleaned image to ${outputFile}`);

  // Verification Step
  console.log('Verifying output...');
  const verifyRes = await runCmd('convert', [
    outputFile,
    '-alpha',
    'extract',
    '-depth',
    '8',
    'txt:-',
  ]);

  if (verifyRes.code !== 0) {
    console.error('Verification failed to read alpha');
  } else {
    const vLines = verifyRes.stdout.split(/\r?\n/);
    let failedCount = 0;
    for (const line of vLines) {
      const m = line.match(/^\s*(\d+),(\d+):.*gray\(([\d.]+)\)/);
      if (!m) continue;
      const x = parseInt(m[1], 10);
      const y = parseInt(m[2], 10);
      const gray = parseFloat(m[3]);

      // Check if this x,y was in our toDrop list
      // This is O(N*M) but N is small (8 islands * ~2 pixels).
      const wasDropped = toDrop.some(idx => (idx % width) === x && ((idx / width) | 0) === y);

      if (wasDropped) {
        if (gray > 0) {
          console.error(`FAILED: Pixel at ${x},${y} should be transparent but has alpha ${gray}`);
          failedCount++;
        }
      }
    }

    if (failedCount === 0) {
      console.log('Verification SUCCESS: All targeted pixels are now transparent.');
    } else {
      console.error(`Verification FAILED: ${failedCount} pixels were not cleared.`);
    }
  }

  // Trim step
  console.log('Trimming output...');
  const trimRes = await runCmd('convert', [outputFile, '-trim', '+repage', outputFile]);
  if (trimRes.code !== 0) {
    throw new Error(`trim failed: ${trimRes.stderr || trimRes.stdout}`);
  }
  console.log('Trimmed output saved.');
}

async function main() {
  try {
    await erodeIsolatedPixels(INPUT_FILE, OUTPUT_FILE);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
