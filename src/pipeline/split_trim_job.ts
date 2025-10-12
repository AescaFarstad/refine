import { mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PipelineJob, PipelineItem } from './pipeline_parse.ts';
import { getSplitRects } from './split_algo.ts';

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
      const { width, height } = await identifySize(inPath);
      const rects = await getSplitRects(inPath, width, height, tokens.length || 4);

      const baseOut = path.parse(imageName).name;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const label = tokens[i] ? slugify(tokens[i]) : `${baseOut}_${i + 1}`;
        const outName = `${label}.png`;
        const outPath = path.join(outDir, outName);

        await convertCropTrimResize(inPath, outPath, r.x, r.y, r.width, r.height, maxW, maxH);
      }
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
