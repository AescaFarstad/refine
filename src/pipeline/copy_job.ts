import { readdir, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { PipelineJob } from './pipeline_parse.ts';

export async function runCopyJob(job: PipelineJob, baseDir: string): Promise<void> {
  const inputFolder = job.settings.input_folder || 'packed';
  const outputFolder = job.settings.output_folder || '../../public/images';

  const inDir = path.join(baseDir, inputFolder);
  const outDir = path.join(baseDir, outputFolder);

  await mkdir(outDir, { recursive: true });

  const entries = await readdir(inDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const src = path.join(inDir, entry.name);
    const dst = path.join(outDir, entry.name);

    const st = await stat(src);
    if (!st.isFile()) continue;

    await copyFile(src, dst);
  }
}

