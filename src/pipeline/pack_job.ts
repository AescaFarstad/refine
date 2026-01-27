import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { PipelineJob } from './pipeline_parse.ts';

interface ImageToPack {
  id: string;
  width: number;
  height: number;
  filePath: string;
}

interface PackedRect extends ImageToPack {
  x: number;
  y: number;
}

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

// Basic growing-bin packer (similar to alma's Packer)
class Packer {
  private root: { x: number; y: number; width: number; height: number; used?: boolean; right?: any; down?: any } | null = null;
  private readonly PADDING = 1;

  pack(images: ImageToPack[]): { packed: PackedRect[]; atlasWidth: number; atlasHeight: number } {
    const sorted = [...images].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
    if (sorted.length === 0) return { packed: [], atlasWidth: 0, atlasHeight: 0 };

    const first = sorted[0];
    this.root = { x: 0, y: 0, width: first.width + this.PADDING, height: first.height + this.PADDING };

    const out: PackedRect[] = [];
    for (const img of sorted) {
      const w = img.width + this.PADDING;
      const h = img.height + this.PADDING;
      let node = this.findNode(this.root!, w, h);
      if (!node) {
        this.root = this.growNode(w, h);
        node = this.findNode(this.root!, w, h);
        if (!node) throw new Error(`Failed to pack image after growing: ${img.id}`);
      }
      const fitted = this.splitNode(node, w, h);
      out.push({ ...img, x: fitted.x, y: fitted.y });
    }

    let W = 0;
    let H = 0;
    // Include padding on the far edges so the composed image size
    // matches the geometry used during packing/compositing.
    for (const r of out) {
      W = Math.max(W, r.x + r.width + this.PADDING);
      H = Math.max(H, r.y + r.height + this.PADDING);
    }
    return { packed: out, atlasWidth: W, atlasHeight: H };
  }

  private findNode(root: any, w: number, h: number): any | null {
    if (root.used) return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
    if (w <= root.width && h <= root.height) return root;
    return null;
  }

  private splitNode(node: any, w: number, h: number): any {
    node.used = true;
    node.down = { x: node.x, y: node.y + h, width: node.width, height: node.height - h };
    node.right = { x: node.x + w, y: node.y, width: node.width - w, height: h };
    return node;
  }

  private growNode(w: number, h: number): any {
    const canGrowDown = w <= this.root!.width;
    const canGrowRight = h <= this.root!.height;
    const shouldGrowRight = canGrowRight && this.root!.height >= this.root!.width + w;
    const shouldGrowDown = canGrowDown && this.root!.width >= this.root!.height + h;
    if (shouldGrowRight) return this.growRight(w, h);
    if (shouldGrowDown) return this.growDown(w, h);
    if (canGrowRight) return this.growRight(w, h);
    if (canGrowDown) return this.growDown(w, h);
    throw new Error('Cannot grow packing root');
  }

  private growRight(w: number, h: number): any {
    const newRoot = {
      used: true,
      x: 0,
      y: 0,
      width: this.root!.width + w,
      height: this.root!.height,
      down: this.root,
      right: { x: this.root!.width, y: 0, width: w, height: this.root!.height },
    };
    this.root = newRoot;
    return newRoot;
  }

  private growDown(w: number, h: number): any {
    const newRoot = {
      used: true,
      x: 0,
      y: 0,
      width: this.root!.width,
      height: this.root!.height + h,
      down: { x: 0, y: this.root!.height, width: this.root!.width, height: h },
      right: this.root,
    };
    this.root = newRoot;
    return newRoot;
  }

  getPadding(): number { return this.PADDING; }
}

async function listImages(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries
    .filter((name) => /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(name))
    .map((name) => path.join(dir, name));
}

function parseIntSetting(name: string, raw: string | undefined, fallback: number): number {
  const trimmed = (raw || '').trim();
  if (!trimmed) return fallback;
  const v = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(v)) throw new Error(`${name} must be an integer (got: ${raw})`);
  return v;
}

function parseBoolSetting(name: string, raw: string | undefined, fallback: boolean): boolean {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return fallback;
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;
  throw new Error(`${name} must be true/false (got: ${raw})`);
}

export async function runPackJob(job: PipelineJob, baseDir: string): Promise<void> {
  const inputFolder = job.settings.input_folder || 'split';
  const outputFolder = job.settings.output_folder || 'packed';
  const inDir = path.join(baseDir, inputFolder);
  const outDir = path.join(baseDir, outputFolder);
  await mkdir(outDir, { recursive: true });

  // Determine atlas name from explicit setting or fallback to input folder name
  const atlasName = (job.settings.name && job.settings.name.trim()) || path.basename(inputFolder);

  // Collect images and sizes
  const files = await listImages(inDir);
  const images: ImageToPack[] = [];
  for (const file of files) {
    const st = await stat(file);
    if (!st.isFile()) continue;
    const { width, height } = await identifySize(file);
    const id = path.parse(file).name;

    if (job.settings.include) {
      const includes = job.settings.include.split(',').map((s) => s.trim());
      const filename = path.basename(file);
      if (!includes.includes(filename) && !includes.includes(id)) {
        continue;
      }
    }

    images.push({ id, width, height, filePath: file });
  }

  if (images.length === 0) {
    console.log(`pack: no images found in ${inDir}`);
    return;
  }

  // Pack
  const packer = new Packer();
  const { packed, atlasWidth, atlasHeight } = packer.pack(images);

  // Compose atlas with ImageMagick on transparent canvas
  const outImg = path.join(outDir, `${atlasName}.png`);
  const args: string[] = ['-size', `${atlasWidth}x${atlasHeight}`, 'xc:none'];
  for (const rect of packed) {
    args.push(rect.filePath, '-geometry', `+${rect.x}+${rect.y}`, '-compose', 'over', '-composite');
  }
  args.push(outImg);
  const conv = await runCmd('convert', args);
  if (conv.code !== 0) throw new Error(`convert (compose atlas) failed: ${conv.stderr || conv.stdout}`);

  // Also export WebP with alpha for efficient delivery
  const outWebp = path.join(outDir, `${atlasName}.webp`);
  const lossless = parseBoolSetting('webp_lossless', job.settings.webp_lossless, true);
  const quality = parseIntSetting('webp_quality', job.settings.webp_quality, lossless ? 100 : 85);
  const alphaQuality = parseIntSetting('webp_alpha_quality', job.settings.webp_alpha_quality, 100);
  const methodRaw = (job.settings.webp_method || '').trim();
  const method = methodRaw ? parseIntSetting('webp_method', methodRaw, 0) : null;

  const webpArgs: string[] = [
    outImg,
    ...(lossless ? (['-define', 'webp:lossless=true'] as const) : (['-define', 'webp:lossless=false'] as const)),
    ...(method !== null ? (['-define', `webp:method=${method}`] as const) : ([] as const)),
    '-define',
    `webp:alpha-quality=${alphaQuality}`,
    '-quality',
    `${quality}`,
    outWebp,
  ];
  const convWebp = await runCmd('convert', webpArgs);
  if (convWebp.code !== 0) throw new Error(`convert (png -> webp) failed: ${convWebp.stderr || convWebp.stdout}`);

  // Build and write JSON map with atlas metadata for a single source of truth
  const atlasMap: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const r of packed) atlasMap[r.id] = { x: r.x, y: r.y, w: r.width, h: r.height };

  // Process aliases from items: { original: alias1 alias2 ... }
  for (const item of job.items) {
    for (const [original, aliasStr] of Object.entries(item)) {
      const rect = atlasMap[original];
      if (!rect) {
        console.warn(`pack: alias original '${original}' not found in atlas, skipping`);
        continue;
      }
      const aliases = aliasStr.split(/\s+/).filter(Boolean);
      for (const alias of aliases) {
        atlasMap[alias] = rect;
      }
    }
  }

  const sortedKeys = Object.keys(atlasMap).sort((a, b) => a.localeCompare(b));
  const outData: Record<string, any> = {};
  // Place meta first; viewers can prefer these exact dimensions
  outData['__meta'] = { w: atlasWidth, h: atlasHeight, padding: packer.getPadding() };
  for (const k of sortedKeys) outData[k] = atlasMap[k];
  const outJson = path.join(outDir, `${atlasName}.json`);
  await writeFile(outJson, JSON.stringify(outData, null, 2), 'utf8');
}
