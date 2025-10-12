import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePipeline, type PipelineJob } from './pipeline_parse.ts';
import { runSplitTrimJob } from './split_trim_job.ts';
import { runPackJob } from './pack_job.ts';

async function listPipelineFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.startsWith('pipeline'))
    .map((e) => path.join(dir, e.name));
}

async function parseJobsFromDir(dir: string): Promise<{ file: string; job: PipelineJob }[]> {
  const files = await listPipelineFiles(dir);
  const out: { file: string; job: PipelineJob }[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const job = parsePipeline(content);
    out.push({ file, job });
  }
  return out;
}

async function main() {
  const dataDir = path.join(process.cwd(), 'data', 'img');
  const jobs = await parseJobsFromDir(dataDir);
  // Sort by numeric priority (ascending). Default priority is 0 if missing/invalid.
  jobs.sort((a, b) => {
    const pa = Number.parseInt((a.job.settings.priority || '').trim(), 10);
    const pb = Number.parseInt((b.job.settings.priority || '').trim(), 10);
    const aa = Number.isFinite(pa) ? pa : 0;
    const bb = Number.isFinite(pb) ? pb : 0;
    if (aa !== bb) return aa - bb;
    // Stable tie-breaker on filename for determinism
    return path.basename(a.file).localeCompare(path.basename(b.file));
  });
  for (const { file, job } of jobs) {
    const jobType = (job.settings.job || '').trim();
    if (jobType === 'split_trim') {
      console.log(`Running split_trim on ${path.basename(file)}...`);
      try {
        await runSplitTrimJob(job, dataDir);
        console.log(`Finished split_trim for ${path.basename(file)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`split_trim failed for pipeline ${path.basename(file)}: ${msg}`);
        // continue with next pipeline file
      }
    } else if (jobType === 'pack') {
      console.log(`Running pack on ${path.basename(file)}...`);
      try {
        await runPackJob(job, dataDir);
        console.log(`Finished pack for ${path.basename(file)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`pack failed for pipeline ${path.basename(file)}: ${msg}`);
      }
    } else if (jobType) {
      console.log(`Unknown job: ${jobType} — skipping.`);
    } else {
      console.log(`No job specified — skipping.`);
    }
  }
}

main().catch((err) => {
  console.error('run_pipeline error:', err);
  process.exitCode = 1;
});
