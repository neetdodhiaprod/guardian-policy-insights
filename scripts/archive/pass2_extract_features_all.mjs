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
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Pass2 failed (${code}) for ${inPath}`));
    });
  });
}

async function main() {
  const inDir = process.argv[2] ?? 'dist/features/clauses';
  const outDir = process.argv[3] ?? 'dist/features/features_raw';

  await fs.mkdir(outDir, { recursive: true });
  const files = await listJsonl(inDir);
  console.error(`Found ${files.length} clause files under ${inDir}`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < files.length; i++) {
    const inPath = files[i];
    const base = path.basename(inPath).replace(/\.clauses\.jsonl$/, '');
    const outPath = path.join(outDir, `${base}.features.jsonl`);

    console.error(`\n[${i + 1}/${files.length}] ${inPath} -> ${outPath}`);

    // Resume-friendly: if output exists and is non-empty, skip.
    try {
      const st = await fs.stat(outPath);
      if (st.size > 0) {
        console.error(`  (skip) already exists (${st.size} bytes)`);
        ok++;
        continue;
      }
    } catch {
      // not exists -> proceed
    }

    try {
      await runOne(inPath, outPath);
      ok++;
    } catch (e) {
      fail++;
      console.error(String(e?.stack ?? e));
      // continue
    }
  }

  console.error(`\nDone. ok=${ok} fail=${fail} outDir=${outDir}`);
  if (fail > 0) process.exit(2);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
