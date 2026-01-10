import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PipelineJob } from './pipeline_parse.ts';

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

function parseIntSetting(name: string, raw: string | undefined, fallback: number): number {
  const trimmed = (raw || '').trim();
  if (!trimmed) return fallback;
  const v = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(v)) throw new Error(`${name} must be an integer (got: ${raw})`);
  return v;
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

export async function runResizeJob(job: PipelineJob, baseDir: string): Promise<void> {
  const inputFolder = job.settings.input_folder || 'source';
  const outputFolder = job.settings.output_folder || 'resized';

  const inDir = path.join(baseDir, inputFolder);
  const outDir = path.join(baseDir, outputFolder);
  await mkdir(outDir, { recursive: true });

  const width = parseIntSetting('width', job.settings.width, 1000);

  const images = await listImages(inDir);
  for (const name of images) {
    const inPath = path.join(inDir, name);
    const base = path.parse(path.basename(name)).name;
    const outPath = path.join(outDir, `${base}.png`);

    const args: string[] = [
      inPath,
      '-auto-orient',
      '-resize',
      `${width}x`,
      '-strip',
      '-define',
      'png:compression-level=1',
      outPath,
    ];

    const res = await runCmd('convert', args);
    if (res.code !== 0) throw new Error(`convert failed: ${res.stderr || res.stdout}`);
  }
}
