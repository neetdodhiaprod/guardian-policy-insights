#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function listFiles(dir) {
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  return ents
    .filter(e => e.isFile() && e.name.endsWith('.features.jsonl'))
    .map(e => path.join(dir, e.name))
    .sort();
}

function runOne(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/grade_pdf_features.mjs', inPath, outPath], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`grade failed (${code}) for ${inPath}`));
    });
  });
}

async function existsNonEmpty(p) {
  try {
    const st = await fsp.stat(p);
    return st.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  const inDir = process.argv[2] ?? 'dist/features/features_raw';
  const outDir = process.argv[3] ?? 'dist/graded_all';
  const workers = Number(process.env.GRADE_WORKERS ?? 3);

  await fsp.mkdir(outDir, { recursive: true });

  const files = await listFiles(inDir);
  console.error(`Found ${files.length} feature files (workers=${workers})`);

  const queue = [];
  for (const inPath of files) {
    const base = path.basename(inPath).replace(/\.features\.jsonl$/, '');
    const outPath = path.join(outDir, `${base}.graded.json`);
    if (await existsNonEmpty(outPath)) continue;
    queue.push({ inPath, outPath });
  }

  console.error(`Queue length: ${queue.length} PDFs remaining`);

  let idx = 0;
  let ok = 0;
  let fail = 0;

  async function workerLoop(id) {
    while (true) {
      const job = queue[idx++];
      if (!job) return;
      console.error(`\n[w${id}] ${job.inPath} -> ${job.outPath}`);
      try {
        await runOne(job.inPath, job.outPath);
        ok++;
      } catch (e) {
        fail++;
        console.error(String(e?.stack ?? e));
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, (_, i) => workerLoop(i + 1)));
  console.error(`\nDone. ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(2);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
