#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

async function listJsonl(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  return ents
    .filter(e => e.isFile() && e.name.endsWith('.clauses.jsonl'))
    .map(e => path.join(dir, e.name))
    .sort();
}

function runOne(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/pass2_extract_features.mjs', inPath, outPath], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Pass2 failed (${code}) for ${inPath}`));
    });
  });
}

async function fileNonEmpty(p) {
  try {
    const st = await fs.stat(p);
    return st.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  const inDir = process.argv[2] ?? 'dist/features/clauses';
  const outDir = process.argv[3] ?? 'dist/features/features_raw';
  const workers = Number(process.env.PASS2_WORKERS ?? 3);

  await fs.mkdir(outDir, { recursive: true });
  const files = await listJsonl(inDir);
  console.error(`Found ${files.length} clause files under ${inDir} (workers=${workers})`);

  const queue = [];
  for (const inPath of files) {
    const base = path.basename(inPath).replace(/\.clauses\.jsonl$/, '');
    const outPath = path.join(outDir, `${base}.features.jsonl`);
    const tmpPath = `${outPath}.tmp`;

    // Skip only if the final output exists and is non-empty.
    // If a tmp exists, treat it as incomplete and redo.
    const done = await fileNonEmpty(outPath);
    const hasTmp = await fileNonEmpty(tmpPath);
    if (done && !hasTmp) continue;

    // If tmp exists, remove it so we can restart cleanly.
    if (hasTmp) {
      await fs.rm(tmpPath, { force: true });
    }

    queue.push({ inPath, outPath });
  }

  console.error(`Queue length: ${queue.length} PDFs remaining`);

  let ok = 0;
  let fail = 0;
  let idx = 0;

  async function workerLoop(workerId) {
    while (true) {
      const job = queue[idx++];
      if (!job) return;
      const { inPath, outPath } = job;
      console.error(`\n[w${workerId}] ${inPath} -> ${outPath}`);
      try {
        await runOne(inPath, outPath);
        ok++;
      } catch (e) {
        fail++;
        console.error(String(e?.stack ?? e));
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, (_, i) => workerLoop(i + 1)));

  console.error(`\nDone. ok=${ok} fail=${fail} outDir=${outDir}`);
  if (fail > 0) process.exit(2);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
