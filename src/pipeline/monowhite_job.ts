import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PipelineItem, PipelineJob } from './pipeline_parse.ts';

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

async function resolveInputPath(baseDir: string, folder: string, name: string): Promise<string> {
  return path.join(baseDir, folder, name);
}

function parseFuzz(tolerance: string | undefined): string | null {
  const raw = (tolerance || '').trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?%$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) {
    const v = Number.parseInt(raw, 10);
    const pct = (v / 255) * 100;
    return `${pct.toFixed(3)}%`;
  }
  return raw;
}

function parseBoolSetting(name: string, raw: string | undefined, fallback: boolean): boolean {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return fallback;
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;
  throw new Error(`${name} must be true/false (got: ${raw})`);
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function shouldSkipOutput(outPath: string, skipExisting: boolean): Promise<boolean> {
  if (!skipExisting) return false;
  try {
    const st = await stat(outPath);
    return st.isFile();
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') return false;
    throw err;
  }
}

async function listImages(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const out: string[] = [];
  for (const name of entries) {
    if (!/\.(png|jpg|jpeg|webp|gif|avif)$/i.test(name)) continue;
    const full = path.join(dir, name);
    const st = await stat(full);
    if (!st.isFile()) continue;
    out.push(name);
  }
  return out;
}

function outputFilename(item: PipelineItem, inputName: string): string {
  const rawOut = (item.out || item.output || '').trim();
  if (rawOut) return rawOut;
  const base = path.parse(path.basename(inputName)).name;
  return `${base}.png`;
}

async function convertMonowhiteToTransparent(input: string, outFile: string, fuzz: string | null): Promise<void> {
  const args = [
    input,
    '-write',
    'mpr:orig',
    '+delete',

    'mpr:orig',
    '-alpha',
    'extract',
    '-write',
    'mpr:alpha',
    '+delete',

    'mpr:orig',
    '-alpha',
    'off',
    '-fill',
    'black',
    ...(fuzz ? (['-fuzz', fuzz] as const) : ([] as const)),
    '+opaque',
    '#FFFFFF',
    '-colorspace',
    'gray',
    '-threshold',
    '0',
    '-write',
    'mpr:mask',
    '+delete',

    'mpr:alpha',
    'mpr:mask',
    '-compose',
    'Multiply',
    '-composite',
    '-write',
    'mpr:newalpha',
    '+delete',

    'mpr:orig',
    'mpr:newalpha',
    '-compose',
    'CopyOpacity',
    '-composite',
    outFile,
  ];

  const res = await runCmd('convert', args);
  if (res.code !== 0) throw new Error(`convert failed: ${res.stderr || res.stdout}`);
}

export async function runMonowhiteJob(job: PipelineJob, baseDir: string): Promise<void> {
  const inputFolder = job.settings.input_folder || 'source';
  const outputFolder = job.settings.output_folder || 'monowhites';
  const fuzz = parseFuzz(job.settings.tolerance);
  const skipExisting = parseBoolSetting('skip_existing', job.settings.skip_existing, false);

  const outDir = path.join(baseDir, outputFolder);
  await mkdir(outDir, { recursive: true });

  if (job.items.length === 0) {
    const inDir = path.join(baseDir, inputFolder);
    const images = await listImages(inDir);
    for (const imageName of images) {
      const inPath = await resolveInputPath(baseDir, inputFolder, imageName);
      const outName = `${path.parse(path.basename(imageName)).name}.png`;
      const outPath = path.join(outDir, outName);
      if (await shouldSkipOutput(outPath, skipExisting)) continue;
      await convertMonowhiteToTransparent(inPath, outPath, fuzz);
    }
    return;
  }

  for (const item of job.items) {
    const imageName = item.image?.trim();
    if (!imageName) continue;

    const inPath = await resolveInputPath(baseDir, inputFolder, imageName);
    const outName = outputFilename(item, imageName);
    const outPath = path.join(outDir, outName);
    if (await shouldSkipOutput(outPath, skipExisting)) continue;
    await convertMonowhiteToTransparent(inPath, outPath, fuzz);
  }
}
